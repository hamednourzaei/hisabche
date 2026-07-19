// ============================================
// backend/src/services/webhook.service.ts — Optimized v2.2
// FIXED: Removed supabase.raw(), use standard queries
// ============================================

import { supabase } from '../db'
import { BillingService } from './billing.service'
import { DatabaseError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'

export interface WebhookEvent {
  id: string
  type: string
  data: any
  timestamp: Date
}

export interface WebhookResult {
  success: boolean
  action: string
  error?: string
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

      switch(event.type) {
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

  // ─── Handle: Checkout Completed ──────────────────────────────────
  private async handleCheckoutCompleted(event: WebhookEvent): Promise<WebhookResult> {
    const session = event.data.object
    const userId = session.client_reference_id
    const plan = session.metadata?.plan || 'pro'
    const interval = session.metadata?.interval || 'month'

    if (!userId) {
      throw new DatabaseError('Missing user_id in webhook')
    }

    await this.billingService.upgrade(userId, plan, interval)
    await this.invalidateUserCache(userId)

    return { success: true, action: 'upgraded' }
  }

  // ─── Handle: Invoice Paid ──────────────────────────────────────
  private async handleInvoicePaid(event: WebhookEvent): Promise<WebhookResult> {
    const invoice = event.data.object
    const userId = invoice.client_reference_id

    if (userId) {
      await this.extendSubscription(userId)
      await this.invalidateUserCache(userId)
    }

    return { success: true, action: 'invoice_paid' }
  }

  // ─── Handle: Payment Failed ─────────────────────────────────────
  private async handlePaymentFailed(event: WebhookEvent): Promise<WebhookResult> {
    const invoice = event.data.object
    const userId = invoice.client_reference_id

    if (userId) {
      await this.setSubscriptionStatus(userId, 'past_due')
      await this.invalidateUserCache(userId)
    }

    return { success: true, action: 'payment_failed' }
  }

  // ─── Handle: Subscription Deleted ──────────────────────────────
  private async handleSubscriptionDeleted(event: WebhookEvent): Promise<WebhookResult> {
    const subscription = event.data.object
    const userId = subscription.client_reference_id

    if (userId) {
      await this.setSubscriptionStatus(userId, 'cancelled')
      await this.invalidateUserCache(userId)
    }

    return { success: true, action: 'subscription_deleted' }
  }

  // ─── Handle: Subscription Updated ─────────────────────────────
  private async handleSubscriptionUpdated(event: WebhookEvent): Promise<WebhookResult> {
    const subscription = event.data.object
    const userId = subscription.client_reference_id
    const status = subscription.status

    if (userId) {
      await this.setSubscriptionStatus(userId, status)
      await this.invalidateUserCache(userId)
    }

    return { success: true, action: 'subscription_updated' }
  }

  // ─── Private: Check Idempotency ─────────────────────────────────
  private async isProcessed(eventId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('id', eventId)
      .single()

    return !!data
  }

  // ─── Private: Log Webhook ──────────────────────────────────────
  private async logWebhook(event: WebhookEvent): Promise<void> {
    const { error } = await supabase
      .from('webhook_events')
      .upsert({
        id: event.id,
        type: event.type,
        payload: event.data,
        processed_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
        ignoreDuplicates: true,
      })

    if (error) {
      console.error('Failed to log webhook:', error)
    }
  }

  // ─── Private: Extend Subscription — FIXED ──────────────────────
  private async extendSubscription(userId: string): Promise<void> {
    // ✅ FIX: گرفتن subscription فعلی و به‌روزرسانی
    const { data: subscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select('period_end')
      .eq('user_id', userId)
      .single()

    if (fetchError || !subscription) {
      console.error('Failed to fetch subscription:', fetchError)
      throw new DatabaseError('Failed to fetch subscription', fetchError)
    }

    // ✅ محاسبه period_end جدید
    const currentPeriodEnd = new Date(subscription.period_end)
    const newPeriodEnd = new Date(currentPeriodEnd)
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)

    // ✅ به‌روزرسانی با مقدار جدید
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        period_end: newPeriodEnd.toISOString(),
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (updateError) {
      console.error('Failed to extend subscription:', updateError)
      throw new DatabaseError('Failed to extend subscription', updateError)
    }
  }

  // ─── Private: Set Subscription Status ──────────────────────────
  private async setSubscriptionStatus(userId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: status as any,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (error) {
      console.error('Failed to set subscription status:', error)
      throw new DatabaseError('Failed to set subscription status', error)
    }
  }

  // ─── Private: Invalidate User Cache ────────────────────────────
  private async invalidateUserCache(userId: string): Promise<void> {
    await memoryCache.invalidate(this.getSubscriptionCacheKey(userId))
    await memoryCache.invalidate(`dashboard:v2:${userId}`)
    await memoryCache.invalidate(`entitlements:${userId}`)
    await memoryCache.invalidate(`feature_flags:${userId}`)
    await memoryCache.invalidate(`limits:${userId}`)
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