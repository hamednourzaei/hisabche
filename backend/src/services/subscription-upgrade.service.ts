// ============================================
// backend/src/services/subscription-upgrade.service.ts
//
// Buying a plan: a member REQUESTS, the platform admin APPROVES once the
// money has arrived (owner's decision, 26 Sep 2026 — card-to-card now, a
// gateway later).
//
// ⚠️ WHY IT IS NOT «click → active». `POST /api/billing/upgrade` used to set
// the caller's subscription to pro/enterprise with no payment at all, for
// every workspace the caller owned. A plan now changes only inside
// `approve_subscription_upgrade` (docs/subscription-upgrade-requests-
// migration.sql), which only the backend's service role can execute, and only
// the platform-admin routes call.
//
// Every write is one Postgres function — the request and its log line, the
// approval and the activation — so nothing is half-done (راهنمای سشن §۱٫۴).
// Before the migration the functions do not exist: that is «not configured»
// (503), and it NEVER falls back to activating a plan.
// ============================================

import type { Plan } from '@hisabche/validation'

import { supabase } from '../db'
import { BaseError } from '../errors/base.error'
import { DatabaseError } from '../errors/database.error'
import type { TenancyContext } from './tenancy.service'
import { PLAN_PRICING } from './plan-pricing'

export type UpgradePlan = Extract<Plan, 'pro' | 'enterprise'>
export type BillingInterval = 'month' | 'year'
export type PaymentMethod = 'card_to_card' | 'gateway' | 'manual'

export interface UpgradeRequest {
  id: string
  workspace_id: string
  requested_by: string
  current_plan: string
  requested_plan: UpgradePlan
  billing_interval: BillingInterval
  amount_minor: number | null
  currency: string | null
  payment_method: PaymentMethod | null
  payment_reference: string | null
  member_note: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  decided_by: string | null
  decided_at: string | null
  admin_note: string | null
  created_at: string
}

export interface SubscriptionEvent {
  id: string
  workspace_id: string
  event: string
  plan: string | null
  billing_interval: string | null
  amount_minor: number | null
  currency: string | null
  period_end: string | null
  actor_id: string | null
  note: string | null
  created_at: string
}

/** The functions or tables are not there yet — the migration has not run. */
function notConfigured(error: { code?: string } | null): boolean {
  return !!error && ['42P01', 'PGRST205', '42883', 'PGRST202'].includes(error.code ?? '')
}

class UpgradeError extends BaseError {
  constructor(code: string, statusCode: number) {
    super(code, statusCode)
    this.name = 'UpgradeError'
  }
}

const NOT_CONFIGURED = () => new UpgradeError('UPGRADE_NOT_CONFIGURED', 503)

/** A raised `RAISE EXCEPTION 'CODE'` from one of the functions, as an HTTP error. */
function fromRaised(error: { message?: string }): UpgradeError | null {
  const code =
    /(UPGRADE_REQUEST_PENDING|UPGRADE_REQUEST_NOT_FOUND|UPGRADE_REQUEST_NOT_PENDING|SUBSCRIPTION_NOT_FOUND)/.exec(
      error.message ?? '',
    )?.[1]
  if (!code) return null
  return new UpgradeError(code, code.endsWith('NOT_FOUND') ? 404 : 409)
}

/**
 * The price of a plan in MINOR units, from the one price list — computed here,
 * never taken from the client (راهنمای سشن §۱٫۳). `null` = not priced by the
 * product (enterprise is negotiated; the admin enters it on approval).
 */
export function priceOf(
  plan: UpgradePlan,
  interval: BillingInterval,
): { amountMinor: number | null; currency: string } {
  const price = PLAN_PRICING[plan]
  const major = interval === 'year' ? price.yearly : price.monthly
  return { amountMinor: major === null ? null : Math.round(major * 100), currency: price.currency }
}

export class SubscriptionUpgradeService {
  async request(
    ctx: TenancyContext,
    currentPlan: string,
    input: {
      plan: UpgradePlan
      interval: BillingInterval
      paymentMethod?: PaymentMethod | undefined
      paymentReference?: string | undefined
      note?: string | undefined
    },
  ): Promise<UpgradeRequest> {
    const { amountMinor, currency } = priceOf(input.plan, input.interval)
    const { data, error } = await supabase.rpc('create_subscription_upgrade_request', {
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
      p_current_plan: currentPlan,
      p_plan: input.plan,
      p_interval: input.interval,
      p_amount_minor: amountMinor,
      p_currency: currency,
      p_method: input.paymentMethod ?? null,
      p_reference: input.paymentReference?.trim() || null,
      p_note: input.note?.trim() || null,
    })
    if (notConfigured(error)) throw NOT_CONFIGURED()
    if (error)
      throw fromRaised(error) ?? new DatabaseError('Failed to create the upgrade request', error)
    return data as UpgradeRequest
  }

  async cancel(ctx: TenancyContext, requestId: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_subscription_upgrade_request', {
      p_request_id: requestId,
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
    })
    if (notConfigured(error)) throw NOT_CONFIGURED()
    if (error)
      throw fromRaised(error) ?? new DatabaseError('Failed to cancel the upgrade request', error)
  }

  /** This workspace's requests and its subscription log — for /billing. */
  async history(
    ctx: TenancyContext,
  ): Promise<{ requests: UpgradeRequest[]; events: SubscriptionEvent[]; configured: boolean }> {
    const [requests, events] = await Promise.all([
      supabase
        .from('subscription_upgrade_requests')
        .select('*')
        .eq('workspace_id', ctx.workspaceId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('subscription_events')
        .select('*')
        .eq('workspace_id', ctx.workspaceId)
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    if (notConfigured(requests.error) || notConfigured(events.error)) {
      return { requests: [], events: [], configured: false }
    }
    if (requests.error) throw new DatabaseError('Failed to read upgrade requests', requests.error)
    if (events.error) throw new DatabaseError('Failed to read the subscription log', events.error)
    return {
      requests: (requests.data ?? []) as UpgradeRequest[],
      events: (events.data ?? []) as SubscriptionEvent[],
      configured: true,
    }
  }

  // ─── Platform admin ────────────────────────────────────────────────────

  async listForAdmin(status: UpgradeRequest['status'] | 'all'): Promise<UpgradeRequest[]> {
    let query = supabase
      .from('subscription_upgrade_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (status !== 'all') query = query.eq('status', status)
    const { data, error } = await query
    if (notConfigured(error)) throw NOT_CONFIGURED()
    if (error) throw new DatabaseError('Failed to read upgrade requests', error)
    return (data ?? []) as UpgradeRequest[]
  }

  /** Returns the activated subscription's row id. */
  async approve(
    adminId: string,
    requestId: string,
    amountMinor: number | null,
    note: string | null,
  ): Promise<string> {
    const { data, error } = await supabase.rpc('approve_subscription_upgrade', {
      p_request_id: requestId,
      p_admin_id: adminId,
      p_amount_minor: amountMinor,
      p_note: note,
    })
    if (notConfigured(error)) throw NOT_CONFIGURED()
    if (error) throw fromRaised(error) ?? new DatabaseError('Failed to approve the upgrade', error)
    return data as string
  }

  async reject(adminId: string, requestId: string, note: string | null): Promise<void> {
    const { error } = await supabase.rpc('reject_subscription_upgrade', {
      p_request_id: requestId,
      p_admin_id: adminId,
      p_note: note,
    })
    if (notConfigured(error)) throw NOT_CONFIGURED()
    if (error) throw fromRaised(error) ?? new DatabaseError('Failed to reject the upgrade', error)
  }
}

export const subscriptionUpgradeService = new SubscriptionUpgradeService()
