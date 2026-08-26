// ============================================
// backend/src/services/webhook.service.ts — v2.3
//
// D1 — webhook events are resolved to OUR subscription row by STRIPE
// identifiers, then mutated BY PRIMARY KEY. The previous code trusted
// `client_reference_id` as a user id and updated `.eq('user_id', …)`, which
// meant any event whose payload we didn't control could retarget whichever
// subscription belonged to that user — and `setSubscriptionStatus` wrote the
// raw Stripe status string through `as any`, bypassing our status enum.
//
// Resolution order (see resolveSubscriptionRow):
//   1. subscriptions.stripe_subscription_id  ← written by upgrade()
//   2. subscriptions.stripe_customer_id      ← written by upgrade()
//   3. LEGACY-ONLY: client_reference_id treated as the buyer's user id,
//      pinned to that user's OLDEST subscription row. This exists solely for
//      events produced before Stripe ids were persisted (i.e. every live
//      subscription until the first renewal after this deploy). It is covered
//      by a dedicated test and can only ever land on a row the buyer already
//      owns — it never widens what a webhook may touch.
// An event that resolves to NOTHING fails with success:false so Stripe
// retries; it is never logged as processed and never reported as handled.
// ============================================

import { supabase } from '../db'
import { planEnum } from '@hisabche/validation'
import { BillingService, mapStripeStatus } from './billing.service'
import { DatabaseError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'

export interface WebhookEvent {
  id: string
  type: string
  data: Record<string, unknown>
  timestamp: Date
}

export interface WebhookResult {
  success: boolean
  action: string
  error?: string
}

/** The parts of a Stripe event object this service reads. */
interface StripeEventObject {
  subscription?: string | null
  customer?: string | null
  client_reference_id?: string | null
  status?: string | null
  metadata?: Record<string, string> | null
}

/** The columns resolution needs back from our own row. */
const SUBSCRIPTION_ROW_COLUMNS = 'id, user_id, workspace_id'

interface SubscriptionRowRef {
  id: string
  user_id: string | null
  workspace_id: string | null
}

const CHECKOUT_INTERVALS = ['month', 'year'] as const
type CheckoutInterval = (typeof CHECKOUT_INTERVALS)[number]

function parseInterval(raw: unknown): CheckoutInterval {
  if (typeof raw === 'string' && (CHECKOUT_INTERVALS as readonly string[]).includes(raw)) {
    return raw as CheckoutInterval
  }
  return 'month'
}

/** Narrow the event payload's `object` defensively — it crosses a trust boundary. */
function objectOf(data: Record<string, unknown>): StripeEventObject {
  const raw = data.object
  return (typeof raw === 'object' && raw !== null ? raw : {}) as StripeEventObject
}

export class WebhookService {
  private billingService: BillingService

  constructor() {
    this.billingService = new BillingService()
  }

  // ─── Cache Keys ──────────────────────────────────────────────
  private getWebhookCacheKey(eventId: string) {
    return `webhook:processed:${eventId}`
  }

  private getSubscriptionCacheKey(userId: string) {
    return `subscription:${userId}`
  }

  // ─── Process Incoming Webhook ──────────────────────────────────
  async processWebhook(event: WebhookEvent): Promise<WebhookResult> {
    try {
      const cacheKey = this.getWebhookCacheKey(event.id)
      const cached = await memoryCache.get(cacheKey)
      if (cached) {
        return { success: true, action: 'already_processed' }
      }

      const processed = await this.isProcessed(event.id)
      if (processed) {
        await memoryCache.set(cacheKey, true, 86400)
        return { success: true, action: 'already_processed' }
      }

      let result: WebhookResult

      switch (event.type) {
        case 'checkout.session.completed':
          result = await this.handleCheckoutCompleted(event)
          break

        case 'invoice.paid':
          result = await this.handleInvoicePaid(event)
          break

        case 'invoice.payment_failed':
          result = await this.handlePaymentFailed(event)
          break

        case 'customer.subscription.deleted':
          result = await this.handleSubscriptionDeleted(event)
          break

        case 'customer.subscription.updated':
          result = await this.handleSubscriptionUpdated(event)
          break

        default:
          result = { success: true, action: 'ignored' }
      }

      if (result.success) {
        await this.logWebhook(event)
        await memoryCache.set(cacheKey, true, 86400)
      }

      return result
    } catch (error) {
      console.error('Webhook processing error:', error)
      return {
        success: false,
        action: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // ─── Resolve OUR subscription row from the Stripe object ────
  //
  // Every branch ends in the same place: a primary key of OUR row. Nothing
  // here lets the payload name a workspace or another user's subscription.
  private async resolveSubscriptionRow(
    object: StripeEventObject,
  ): Promise<SubscriptionRowRef | null> {
    // 1. Our row stamped with the Stripe subscription id (post-upgrade events).
    if (object.subscription) {
      const { data } = await supabase
        .from('subscriptions')
        .select(SUBSCRIPTION_ROW_COLUMNS)
        .eq('stripe_subscription_id', object.subscription)
        .maybeSingle()
      if (data) return data
    }

    // 2. Our row stamped with the Stripe customer id (renewals that omit the
    //    subscription reference). Oldest wins for determinism, mirroring how
    //    user-shaped subscription reads disambiguate.
    if (object.customer) {
      const { data } = await supabase
        .from('subscriptions')
        .select(SUBSCRIPTION_ROW_COLUMNS)
        .eq('stripe_customer_id', object.customer)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (data) return data
    }

    // 3. LEGACY COMPATIBILITY ONLY — see header. Events emitted before
    //    upgrade() began persisting Stripe ids carry only the buyer's user id
    //    in client_reference_id. Restricted to that buyer's OWN oldest row;
    //    a webhook can still never reach a subscription belonging to anyone
    //    else. Once all live rows carry Stripe ids this branch is dead code
    //    kept for replayed historical events.
    if (object.client_reference_id) {
      const { data } = await supabase
        .from('subscriptions')
        .select(SUBSCRIPTION_ROW_COLUMNS)
        .eq('user_id', object.client_reference_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (data) return data
    }

    return null
  }

  // ─── Handle: Checkout Completed ──────────────────────────────────
  private async handleCheckoutCompleted(event: WebhookEvent): Promise<WebhookResult> {
    const session = objectOf(event.data)
    const planRaw = session.metadata?.plan
    const interval = parseInterval(session.metadata?.interval)

    // Metadata crosses an external boundary — validate it like one. An
    // unrecognized plan used to fall back to 'pro', letting a malformed event
    // hand out the paid tier.
    const parsedPlan = planEnum.safeParse(planRaw)
    if (!parsedPlan.success) {
      throw new DatabaseError(`Unrecognized plan in webhook metadata: ${String(planRaw)}`)
    }

    const row = await this.resolveSubscriptionRow(session)
    if (!row) {
      // Not reported as handled: Stripe will retry while we (or a human) figure
      // out which subscription this belongs to.
      throw new DatabaseError(
        `No subscription row resolved for checkout session (event ${event.id})`,
      )
    }

    // exactOptionalPropertyTypes: properties are assigned only when present,
    // never set to explicit undefined.
    const stripeIds: { customerId?: string; subscriptionId?: string } = {}
    if (session.customer) stripeIds.customerId = session.customer
    if (session.subscription) stripeIds.subscriptionId = session.subscription

    await this.billingService.upgradeSubscriptionRow(row.id, parsedPlan.data, interval, stripeIds)
    await this.invalidateUserCache(row)

    return { success: true, action: 'upgraded' }
  }

  // ─── Handle: Invoice Paid ──────────────────────────────────────
  private async handleInvoicePaid(event: WebhookEvent): Promise<WebhookResult> {
    const invoice = objectOf(event.data)

    const row = await this.resolveSubscriptionRow(invoice)
    if (!row) {
      throw new DatabaseError(`No subscription row resolved for invoice.paid (event ${event.id})`)
    }

    await this.billingService.extendSubscriptionRow(row.id)
    await this.invalidateUserCache(row)

    return { success: true, action: 'invoice_paid' }
  }

  // ─── Handle: Payment Failed ─────────────────────────────────────
  private async handlePaymentFailed(event: WebhookEvent): Promise<WebhookResult> {
    const invoice = objectOf(event.data)

    const row = await this.resolveSubscriptionRow(invoice)
    if (!row) {
      throw new DatabaseError(
        `No subscription row resolved for invoice.payment_failed (event ${event.id})`,
      )
    }

    await this.billingService.setSubscriptionRowStatus(row.id, 'past_due')
    await this.invalidateUserCache(row)

    return { success: true, action: 'payment_failed' }
  }

  // ─── Handle: Subscription Deleted ──────────────────────────────
  private async handleSubscriptionDeleted(event: WebhookEvent): Promise<WebhookResult> {
    const subscription = objectOf(event.data)

    const row = await this.resolveSubscriptionRow(subscription)
    if (!row) {
      throw new DatabaseError(
        `No subscription row resolved for subscription deletion (event ${event.id})`,
      )
    }

    await this.billingService.setSubscriptionRowStatus(row.id, 'cancelled')
    await this.invalidateUserCache(row)

    return { success: true, action: 'subscription_deleted' }
  }

  // ─── Handle: Subscription Updated ─────────────────────────────
  private async handleSubscriptionUpdated(event: WebhookEvent): Promise<WebhookResult> {
    const subscription = objectOf(event.data)

    const row = await this.resolveSubscriptionRow(subscription)
    if (!row) {
      throw new DatabaseError(
        `No subscription row resolved for subscription update (event ${event.id})`,
      )
    }

    // Stripe statuses are mapped through our enum; anything unmapped THROWS
    // rather than being written verbatim (the old `as any` behaviour).
    const status = mapStripeStatus(subscription.status)
    await this.billingService.setSubscriptionRowStatus(row.id, status)
    await this.invalidateUserCache(row)

    return { success: true, action: 'subscription_updated' }
  }

  // ─── Private: Check Idempotency ─────────────────────────────────
  private async isProcessed(eventId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('id', eventId)
      .single()

    return !error && !!data
  }

  // ─── Private: Log Webhook ──────────────────────────────────────
  private async logWebhook(event: WebhookEvent): Promise<void> {
    const { error } = await supabase.from('webhook_events').upsert(
      {
        id: event.id,
        type: event.type,
        payload: event.data,
        processed_at: new Date().toISOString(),
      },
      {
        onConflict: 'id',
        ignoreDuplicates: true,
      },
    )

    if (error) {
      console.error('Failed to log webhook:', error)
    }
  }

  // ─── Private: Invalidate User Cache ────────────────────────────
  // Flushes the user-shaped keys always, plus the workspace-shaped twin when
  // the resolved row carries a workspace (DECISION A readers).
  private async invalidateUserCache(row: SubscriptionRowRef): Promise<void> {
    if (row.user_id) {
      await memoryCache.invalidate(this.getSubscriptionCacheKey(row.user_id))
      await memoryCache.invalidate(`dashboard:v2:${row.user_id}`)
      await memoryCache.invalidate(`entitlements:${row.user_id}`)
      await memoryCache.invalidate(`feature_flags:${row.user_id}`)
      await memoryCache.invalidate(`limits:${row.user_id}`)
    }
    if (row.workspace_id) {
      await memoryCache.invalidate(`subscription:ws:${row.workspace_id}`)
    }
  }

  // ─── Get Webhook Stats ──────────────────────────────────────────
  async getStats(days: number = 7): Promise<{
    total: number
    byType: Record<string, number>
    failed: number
  }> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const { data, error } = await supabase
      .from('webhook_events')
      .select('type')
      .gte('processed_at', cutoffDate.toISOString())

    if (error) {
      console.error('Failed to get webhook stats:', error)
      return { total: 0, byType: {}, failed: 0 }
    }

    const byType: Record<string, number> = {}
    for (const event of data || []) {
      byType[event.type] = (byType[event.type] || 0) + 1
    }

    return {
      total: data?.length || 0,
      byType,
      failed: 0,
    }
  }

  // ─── Cleanup Old Webhooks ──────────────────────────────────────
  async cleanupOldWebhooks(daysToKeep: number = 30): Promise<{ deleted: number }> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const { data, error } = await supabase
      .from('webhook_events')
      .delete()
      .lt('processed_at', cutoffDate.toISOString())
      .select('id')

    if (error) {
      console.error('Failed to cleanup webhooks:', error)
      return { deleted: 0 }
    }

    return { deleted: data?.length || 0 }
  }
}

export default WebhookService
