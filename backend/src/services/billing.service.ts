// ============================================
// backend/src/services/billing.service.ts — Optimized v2.2
// FIXED: usage counts scoped to the WORKSPACE (DECISION A), count errors
// fail closed, Stripe identifiers persisted on upgrade, cache invalidation
// covers both the user-shaped and workspace-shaped subscription keys.
// ============================================

import { supabase } from '../db'
import { Plan, Subscription, SubscriptionStatus, UsageLimits } from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'
// ⚠️ A CONSTANTS MODULE THAT IMPORTS NOTHING — see plan-pricing.ts. These
// used to live in this file, which put `billing.service` and the Referral
// Core in a module cycle and left `referralService` undefined at runtime.
import { PLAN_PRICING, intervalOfPeriod } from './plan-pricing'
// Re-exported so existing importers keep working.
export { PLAN_PRICING, intervalOfPeriod }
import { referralService } from './referral'
import { PLAN_LIMIT_DEFAULTS } from './plan-limit-defaults'
import { effectiveLimits } from './plan-limits.service'
import { countBusinesses } from './workspace-counts'

/**
 * How a usage counter is scoped. Workspace-owned tables (the shared book) are
 * counted per WORKSPACE; a user's own workspaces are counted by OWNERSHIP.
 * Counting any of these by `user_id` was either wrong (a three-member shop
 * would burn the plan's quota three times) or broken outright (`workspaces`
 * has no `user_id` column — the query errored and the count read as 0).
 */
type UsageScope = 'workspace' | 'owner'

const USAGE_TABLES: Partial<Record<keyof UsageLimits, { table: string; scope: UsageScope }>> = {
  invoices: { table: 'invoices', scope: 'workspace' },
  transactions: { table: 'transactions', scope: 'workspace' },
  users: { table: 'workspace_members', scope: 'workspace' },
  workspaces: { table: 'workspaces', scope: 'owner' },
}

// ─── Plan Configuration ────────────────────────────────────────

/**
 * ⚠️ THE ONE PLACE A PLAN'S PRICE IS WRITTEN DOWN.
 *
 * These numbers lived as literals inside `GET /api/billing/plans`
 * (`key === 'pro' ? 12 : null`). Nothing else could read them, so anything
 * that needed the amount someone paid — the referral commission, for one —
 * had no source but the plan's NAME, and a commission inferred from a name is
 * an invented figure in a financial product.
 *
 * `null` means «not priced here»: `free` costs nothing and `enterprise` is
 * negotiated. A null price is NOT zero, and nothing may treat it as zero —
 * a 10% commission on a null is not «0», it is «unknown», and the referral
 * table says so rather than showing someone a number that is not owed.
 *
 * ⚠️ The currency is USD because the pricing page has always rendered a
 * hardcoded `$`. That records what is charged today; it is not a new
 * decision, and the owner should confirm it — everything else in this product
 * prices in the workspace's own currency.
 */
export const PLANS: Record<
  Plan,
  {
    name: string
    limits: UsageLimits
    featureKeys: string[]
  }
> = {
  free: {
    name: 'Free',
    limits: {
      invoices: PLAN_LIMIT_DEFAULTS.free.invoices,
      users: PLAN_LIMIT_DEFAULTS.free.users,
      businesses: 1,
      reports: 0,
      transactions: 20,
      teamMembers: 0,
      workspaces: 1,
    },
    featureKeys: [
      'billing.free.feature.invoices_10',
      'billing.free.feature.user_1',
      'billing.free.feature.business_1',
      'billing.free.feature.basic_reports',
    ],
  },
  pro: {
    name: 'Pro',
    limits: {
      invoices: PLAN_LIMIT_DEFAULTS.pro.invoices,
      users: PLAN_LIMIT_DEFAULTS.pro.users,
      businesses: null,
      reports: null,
      transactions: null,
      teamMembers: 10,
      workspaces: 5,
    },
    featureKeys: [
      'billing.pro.feature.unlimited_invoices',
      'billing.pro.feature.advanced_reports',
      'billing.pro.feature.users_10',
      'billing.pro.feature.businesses_5',
      'billing.pro.feature.priority_support',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    limits: {
      invoices: PLAN_LIMIT_DEFAULTS.enterprise.invoices,
      users: PLAN_LIMIT_DEFAULTS.enterprise.users,
      businesses: null,
      reports: null,
      transactions: null,
      teamMembers: null,
      workspaces: null,
    },
    featureKeys: [
      'billing.enterprise.feature.all_features',
      'billing.enterprise.feature.sso',
      'billing.enterprise.feature.unlimited_teams',
      'billing.enterprise.feature.dedicated_support',
      'billing.enterprise.feature.sla',
    ],
  },
}

const TRIAL_DAYS = 7
const GRACE_PERIOD_DAYS = 7

/** Stripe status → our enum. Anything unmapped is REFUSED, never guessed. */
const STRIPE_STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: 'active',
  trialing: 'trial',
  past_due: 'past_due',
  canceled: 'cancelled',
}

export function mapStripeStatus(status: unknown): SubscriptionStatus {
  const mapped = typeof status === 'string' ? STRIPE_STATUS_MAP[status] : undefined
  if (!mapped) {
    throw new DatabaseError(`Unmapped Stripe subscription status: ${String(status)}`)
  }
  return mapped
}

/**
 * Whether a workspace may still WRITE, as seen by the subscription guard.
 *
 * `expired` is true only when expiry is POSITIVELY known. A workspace with no
 * subscription row, or a row with no readable `period_end`, is reported as not
 * expired: locking a business out on the absence of data is a guess about a
 * real person's account, not a fact about it.
 */
export interface SubscriptionAccess {
  expired: boolean
  /** ISO timestamp the paid (or trial) period ends, or null when unknown. */
  periodEnd: string | null
}

/**
 * THE definition of an expired subscription. One rule, used by the write guard
 * (`middleware/subscription.middleware.ts`) and reported to the client through
 * `GET /api/billing/subscription` so the UI never keeps a second copy.
 *
 * - `status` 'expired' or 'cancelled' → expired. Both are written only when the
 *   subscription has actually ended (Stripe `canceled` maps to 'cancelled').
 * - otherwise the period decides: `now` past `period_end` → expired. This is
 *   the same predicate the platform admin already counts as "expired"
 *   (`admin.service.ts`, `period_end < now`).
 * - a still-running TRIAL (`is_trial && !trial_used`) keeps the grace window
 *   `checkTrialStatus` already promises the user on /billing; locking during a
 *   grace period the billing page is advertising would contradict it.
 */
export function isSubscriptionExpired(
  sub: {
    status: string | null | undefined
    periodEnd: string | null | undefined
    isTrial: boolean
    trialUsed: boolean
  },
  now: Date,
): boolean {
  if (sub.status === 'expired' || sub.status === 'cancelled') return true
  if (!sub.periodEnd) return false

  const end = Date.parse(sub.periodEnd)
  if (Number.isNaN(end)) return false

  const graceMs = sub.isTrial && !sub.trialUsed ? GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000 : 0
  return now.getTime() > end + graceMs
}

/** Shape of the /api/billing/usage payload. */
export interface UsageReport {
  usage: {
    invoices: number
    users: number
    workspaces: number
    transactions: number
  }
  limits: UsageLimits
  plan: Plan
  isTrial: boolean
}

export class BillingService {
  // ─── Cache Keys ───────────────────────────────────────────
  private getSubscriptionCacheKey(userId: string) {
    return `subscription:${userId}`
  }

  // D5 — the workspace-shaped twin of the subscription cache key. DECISION A
  // (docs/subscription-workspace-migration.sql) moved the tenancy of a
  // subscription to the WORKSPACE; every writer must therefore flush both
  // spellings, because readers resolve through either depending on whether a
  // workspace was resolvable on their request.
  private getWorkspaceSubscriptionCacheKey(workspaceId: string) {
    return `subscription:ws:${workspaceId}`
  }

  private getWorkspaceAccessCacheKey(workspaceId: string) {
    return `subscription-access:ws:${workspaceId}`
  }

  private getPlanCacheKey(plan: string) {
    return `plan:${plan}`
  }

  private getUsageCacheKey(userId: string) {
    return `usage:${userId}`
  }

  // ─── Get or Create Subscription ─────────────────────────────
  // `.single()` replaced with order+limit(1)+maybeSingle: a user owning several
  // workspaces can hold several subscription rows once the workspace migration
  // lands, and `.single()` turned that from "pick deterministically" into a
  // hard PGRST116 error on every read. Oldest row wins, matching the
  // joined_at-first convention in tenancy resolution.
  /**
   * The subscription row for this business, preferring the workspace.
   *
   * DECISION A (docs/subscription-workspace-migration.sql) says a subscription
   * belongs to a WORKSPACE, not to a user — otherwise handing the shop to a
   * new owner hands them a different subscription, or none.
   *
   * The user_id lookup remains as a FALLBACK, not as an equal path: the
   * migration's backfill deliberately leaves ambiguous rows NULL rather than
   * guessing, so some subscriptions still have no workspace and must still
   * resolve. Once every live row carries one, this fallback is dead code and
   * can go.
   */
  private async findSubscriptionRow(userId: string, workspaceId?: string) {
    if (workspaceId) {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (error && !/column .*workspace_id.* does not exist/i.test(error.message ?? '')) {
        throw new DatabaseError('Failed to fetch subscription', error)
      }
      if (data) return data
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch subscription', error)
    return data
  }

  async getOrCreateSubscription(userId: string, workspaceId?: string): Promise<Subscription> {
    // Two DIFFERENT keys, never `workspaceId ?? userId`. Workspace ids and user
    // ids live in the same UUID space, so one shared key shape can collide —
    // and the bare `??` is the fail-open pattern the tenancy guard forbids
    // elsewhere, which should not be normalised just because this is a cache.
    const cacheKey = workspaceId
      ? this.getWorkspaceSubscriptionCacheKey(workspaceId)
      : this.getSubscriptionCacheKey(userId)

    // ✅ ابتدا از کش بخوان
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as Subscription

    const existing = await this.findSubscriptionRow(userId, workspaceId)

    if (existing) {
      const subscription = this.mapSubscription(existing)
      await memoryCache.set(cacheKey, subscription, 300) // 5 دقیقه
      return subscription
    }

    const now = new Date()
    const trialEndsAt = new Date(now)
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS)

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        // Stamped when we know it, so new rows never need the backfill.
        ...(workspaceId ? { workspace_id: workspaceId } : {}),
        plan: 'pro',
        status: 'active',
        is_trial: true,
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
        period_start: now.toISOString(),
        period_end: trialEndsAt.toISOString(),
      })
      .select('*')
      .single()

    if (error) throw new DatabaseError('Failed to create subscription', error)

    const result = this.mapSubscription(subscription)
    await memoryCache.set(cacheKey, result, 300)
    return result
  }

  // ─── Get Current Subscription ────────────────────────────────
  // ✅ FIX: هر کاربری که هنوز رکورد subscription ندارد (مثلاً race condition
  // در ثبت‌نام) دیگر باعث 500 نمی‌شود — به همان مسیر getOrCreateSubscription
  // برمی‌گردد که یک اشتراک آزمایشی می‌سازد.
  async getCurrentSubscription(userId: string, workspaceId?: string): Promise<Subscription> {
    // Two DIFFERENT keys, never `workspaceId ?? userId`. Workspace ids and user
    // ids live in the same UUID space, so one shared key shape can collide —
    // and the bare `??` is the fail-open pattern the tenancy guard forbids
    // elsewhere, which should not be normalised just because this is a cache.
    const cacheKey = workspaceId
      ? this.getWorkspaceSubscriptionCacheKey(workspaceId)
      : this.getSubscriptionCacheKey(userId)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as Subscription

    const data = await this.findSubscriptionRow(userId, workspaceId)

    if (!data) {
      return this.getOrCreateSubscription(userId, workspaceId)
    }

    const subscription = this.mapSubscription(data)
    await memoryCache.set(cacheKey, subscription, 300)
    return subscription
  }

  // ─── Workspace access (read-only, never creates) ────────────
  // The subscription guard's lookup. Unlike getCurrentSubscription it NEVER
  // inserts a trial row: a guard on a write path must not have a write of its
  // own as a side effect.
  //
  // Decided per WORKSPACE. A legacy row with no workspace_id is resolved
  // through the workspace's OWNER — never through the acting user, whose own
  // subscription says nothing about someone else's shop.
  //
  // Lookup errors THROW (DatabaseError), the same way the entitlement quota
  // checks fail: an unreadable subscription neither grants nor locks.
  async getWorkspaceAccess(
    workspaceId: string,
    now: Date = new Date(),
  ): Promise<SubscriptionAccess> {
    const cacheKey = this.getWorkspaceAccessCacheKey(workspaceId)
    const cached = await memoryCache.get<SubscriptionAccess>(cacheKey)
    if (cached) return cached

    const row = await this.findWorkspaceSubscriptionRow(workspaceId)

    const access: SubscriptionAccess = row
      ? {
          expired: isSubscriptionExpired(
            {
              status: row.status,
              periodEnd: row.period_end,
              isTrial: row.is_trial ?? false,
              trialUsed: row.trial_used ?? false,
            },
            now,
          ),
          periodEnd: row.period_end ?? null,
        }
      : { expired: false, periodEnd: null }

    // Short TTL: expiry is a moment in time, and renewal flushes this key
    // (invalidateCache) so paying unlocks immediately rather than in a minute.
    await memoryCache.set(cacheKey, access, 60)
    return access
  }

  private async findWorkspaceSubscriptionRow(workspaceId: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const missingColumn = /column .*workspace_id.* does not exist/i.test(error?.message ?? '')
    if (error && !missingColumn) throw new DatabaseError('Failed to fetch subscription', error)
    if (data) return data

    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .maybeSingle()

    if (wsError) throw new DatabaseError('Failed to resolve workspace owner', wsError)
    if (!workspace?.owner_id) return null

    const { data: legacy, error: legacyError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', workspace.owner_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (legacyError) throw new DatabaseError('Failed to fetch subscription', legacyError)
    return legacy
  }

  // ─── Count a usage meter — shared by every quota check ──────
  // D4 — a failed COUNT is thrown, never read as 0. Reading it as 0 meant a
  // database hiccup widened the plan's cap exactly when we could least verify
  // it.
  private async countUsage(
    userId: string,
    feature: keyof UsageLimits,
    workspaceId?: string,
  ): Promise<number> {
    const cfg = USAGE_TABLES[feature]
    if (!cfg) return 0 // unknown meters don't gate anything

    if (cfg.scope === 'owner') {
      // Businesses the person owns. A sandbox is a test space, not a business:
      // counted here it used up the free plan's one business.
      const owned = await countBusinesses((query) => query.eq('owner_id', userId))
      if (owned.error)
        throw new DatabaseError(`Failed to count ${feature} for usage limit`, owned.error)
      return owned.count
    }

    let query = supabase.from(cfg.table).select('id', { count: 'exact', head: true })

    if (cfg.scope === 'workspace') {
      // Workspace-owned meters REQUIRE a workspace. There is no user-shaped
      // fallback: counting the shared book per actor is precisely the defect
      // this replaces.
      if (!workspaceId) {
        throw new DatabaseError(
          `Usage limit "${feature}" is workspace-scoped and requires a workspace context`,
        )
      }
      query = query.eq('workspace_id', workspaceId)
    }

    const { count, error } = await query
    if (error) throw new DatabaseError(`Failed to count ${feature} for usage limit`, error)
    return count ?? 0
  }

  // ─── Check Usage Limit ──────────────────────────────────────
  async checkUsageLimit(
    userId: string,
    feature: keyof UsageLimits,
    workspaceId?: string,
  ): Promise<boolean> {
    const subscription = await this.getCurrentSubscription(userId)
    const plan = PLANS[subscription.plan as Plan]
    const limit = plan.limits[feature]

    if (subscription.isTrial) return true
    if (limit === null) return true

    const usageCacheKey = `${this.getUsageCacheKey(userId)}:${feature}`
    const cached = await memoryCache.get<number>(usageCacheKey)
    if (cached !== null) return cached < limit

    const count = await this.countUsage(userId, feature, workspaceId)

    // ✅ ذخیره در کش با TTL 60 ثانیه
    await memoryCache.set(usageCacheKey, count, 60)

    return count < limit
  }

  // ─── Upgrade Subscription ────────────────────────────────────
  // D1 — Stripe identifiers ride along so later webhooks can resolve the
  // subscription row WITHOUT `client_reference_id`. mapSubscription already
  // read these columns; until now nothing ever wrote them.
  async upgrade(
    userId: string,
    plan: Plan,
    interval: 'month' | 'year',
    stripe?: { customerId?: string; subscriptionId?: string },
  ): Promise<Subscription> {
    const { data, error } = await supabase
      .from('subscriptions')
      .update(this.upgradePatch(plan, interval, stripe))
      .eq('user_id', userId)
      .select('*')

    if (error) throw new DatabaseError('Failed to upgrade subscription', error)

    const row = data?.[0]
    if (!row) throw new DatabaseError('No subscription found to upgrade')

    await this.invalidateFor(row)
    await this.creditReferral(row)
    return this.mapSubscription(row)
  }

  /**
   * After the platform admin approved an upgrade (the plan itself was changed
   * inside `approve_subscription_upgrade`): drop every cached view of this
   * subscription and credit the referral, exactly as a paid activation does.
   */
  async afterApprovedUpgrade(rowId: string): Promise<void> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', rowId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to read the activated subscription', error)
    if (!data) return
    await this.invalidateFor(data)
    await this.creditReferral(data)
  }

  // Same upgrade, addressed by OUR primary key. The webhook path resolves the
  // row from Stripe identifiers and then hands over the row id, so the mutation
  // is always scoped to the exact subscription record — never to a
  // client-supplied user or workspace id.
  async upgradeSubscriptionRow(
    rowId: string,
    plan: Plan,
    interval: 'month' | 'year',
    stripe?: { customerId?: string; subscriptionId?: string },
  ): Promise<Subscription> {
    const { data, error } = await supabase
      .from('subscriptions')
      .update(this.upgradePatch(plan, interval, stripe))
      .eq('id', rowId)
      .select('*')

    if (error) throw new DatabaseError('Failed to upgrade subscription', error)

    const row = data?.[0]
    if (!row) throw new DatabaseError('No subscription found to upgrade')

    await this.invalidateFor(row)
    await this.creditReferral(row)
    return this.mapSubscription(row)
  }

  /**
   * A paid plan just became active — credit whoever invited this business.
   *
   * ⚠️ HERE, NOT AT THE FOUR CALL SITES. Checkout, the Stripe webhook, the
   * admin panel and the direct upgrade route all end in `upgrade` or
   * `upgradeSubscriptionRow`. Crediting in each is four chances to miss one,
   * and a missed one is somebody not paid what they are owed.
   *
   * ⚠️ A TRIAL EARNS NOTHING, and the row says whether it is one. The Referral
   * Core refuses it anyway; passing the flag rather than assuming `false`
   * means the refusal is based on this subscription, not on a guess here.
   *
   * ⚠️ NEVER THROWS. The customer's subscription is already active by this
   * point; referral bookkeeping must not turn a successful payment into an
   * error response.
   */
  private async creditReferral(raw: {
    id?: string
    workspace_id?: string | null
    plan?: string
    period_start?: string | null
    period_end?: string | null
    is_trial?: boolean | null
  }) {
    if (!raw.workspace_id || !raw.id || !raw.plan) return

    const periodStart = raw.period_start ?? new Date().toISOString()

    await referralService.recordPayment({
      workspaceId: raw.workspace_id,
      subscriptionId: raw.id,
      plan: raw.plan as Plan,
      interval: intervalOfPeriod(periodStart, raw.period_end ?? null),
      periodStart,
      isTrial: raw.is_trial === true,
    })
  }

  private upgradePatch(
    plan: Plan,
    interval: 'month' | 'year',
    stripe?: { customerId?: string; subscriptionId?: string },
  ) {
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + (interval === 'month' ? 1 : 12))

    return {
      plan,
      status: 'active' as const,
      is_trial: false,
      trial_used: true,
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
      ...(stripe?.customerId !== undefined && { stripe_customer_id: stripe.customerId }),
      ...(stripe?.subscriptionId !== undefined && {
        stripe_subscription_id: stripe.subscriptionId,
      }),
    }
  }

  // ─── Set Status / Extend Period — row-addressed variants ────
  async setSubscriptionRowStatus(rowId: string, status: SubscriptionStatus): Promise<void> {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', rowId)
      .select('*')

    if (error) throw new DatabaseError('Failed to set subscription status', error)

    const row = data?.[0]
    if (!row) throw new DatabaseError('No subscription found to update')

    await this.invalidateFor(row)
  }

  async extendSubscriptionRow(rowId: string): Promise<void> {
    const { data: current, error: fetchError } = await supabase
      .from('subscriptions')
      .select('period_end')
      .eq('id', rowId)
      .single()

    if (fetchError || !current) {
      throw new DatabaseError('Failed to fetch subscription for extension', fetchError)
    }

    const newPeriodEnd = new Date(current.period_end)
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)

    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        period_end: newPeriodEnd.toISOString(),
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', rowId)
      .select('*')

    if (error) throw new DatabaseError('Failed to extend subscription', error)

    const row = data?.[0]
    if (!row) throw new DatabaseError('No subscription found to extend')

    await this.invalidateFor(row)
  }

  // ─── Cancel Subscription ─────────────────────────────────────
  async cancel(userId: string): Promise<Subscription> {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select('*')

    if (error) throw new DatabaseError('Failed to cancel subscription', error)

    const row = data?.[0]
    if (!row) throw new DatabaseError('No subscription found to cancel')

    // ✅ Clear cache
    await this.invalidateFor(row)

    return this.mapSubscription(row)
  }

  // ─── Check Trial Status ──────────────────────────────────────
  async checkTrialStatus(userId: string): Promise<{
    isTrial: boolean
    daysLeft: number
    /**
     * How long the trial is in total.
     *
     * Reported so the client can draw «۳ روز از ۷» without keeping its own
     * copy of the number. `BillingContainer` had a hardcoded `/ 7` in its
     * progress bar: changing TRIAL_DAYS here would have left that bar reading
     * over 100% on day one of a longer trial, and nothing would have failed.
     */
    totalDays: number
    ended: boolean
    graceDaysLeft: number
    isInGracePeriod: boolean
  }> {
    const subscription = await this.getCurrentSubscription(userId)

    if (!subscription.isTrial || subscription.trialUsed) {
      return {
        isTrial: false,
        daysLeft: 0,
        totalDays: TRIAL_DAYS,
        ended: true,
        graceDaysLeft: 0,
        isInGracePeriod: false,
      }
    }

    const now = new Date()
    const trialEnd = new Date(subscription.trialEndsAt)
    const daysLeft = Math.max(
      0,
      Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    )

    if (daysLeft === 0) {
      const graceEnd = new Date(trialEnd)
      graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS)
      const graceDaysLeft = Math.max(
        0,
        Math.ceil((graceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      )

      if (graceDaysLeft > 0) {
        return {
          isTrial: false,
          daysLeft: 0,
          totalDays: TRIAL_DAYS,
          ended: false,
          graceDaysLeft,
          isInGracePeriod: true,
        }
      }

      await this.expireTrial(userId)
      return {
        isTrial: false,
        daysLeft: 0,
        totalDays: TRIAL_DAYS,
        ended: true,
        graceDaysLeft: 0,
        isInGracePeriod: false,
      }
    }

    return {
      isTrial: true,
      daysLeft,
      totalDays: TRIAL_DAYS,
      ended: false,
      graceDaysLeft: 0,
      isInGracePeriod: false,
    }
  }

  // ─── Expire Trial ────────────────────────────────────────────
  // Called by the system cron worker with the subscriber's user id — a trusted
  // internal caller, not a webhook — so the user-shaped predicate stands.
  async expireTrial(userId: string): Promise<void> {
    await supabase
      .from('subscriptions')
      .update({
        is_trial: false,
        trial_used: true,
        plan: 'free',
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    // ✅ Clear cache
    await this.invalidateCache(userId)
  }

  // ─── Get Plan Features ──────────────────────────────────────
  getPlanFeatures(plan: Plan) {
    // ✅ کش برای Plan
    const cacheKey = this.getPlanCacheKey(plan)

    // چک کردن کش (Planها ثابت هستند)
    const config = PLANS[plan]
    return {
      plan,
      name: config.name,
      limits: config.limits,
      featureKeys: config.featureKeys,
    }
  }

  // ─── Usage Report ─────────────────────────────────────────
  // Workspace-scoped meters are counted per WORKSPACE; `workspaces` by
  // ownership. Requires a workspace context — the route enforces membership
  // before this runs, so a missing id here is a misordered route, not a
  // fallback opportunity.
  async getUsageReport(userId: string, workspaceId: string): Promise<UsageReport> {
    const cacheKey = `usage:ws:${workspaceId}:report`

    const cached = await memoryCache.get<UsageReport>(cacheKey)
    if (cached) return cached

    const [invoices, users, transactions, subscription] = await Promise.all([
      this.countUsage(userId, 'invoices', workspaceId),
      this.countUsage(userId, 'users', workspaceId),
      this.countUsage(userId, 'transactions', workspaceId),
      // This workspace's plan — not whichever the user's first one is.
      this.getCurrentSubscription(userId, workspaceId),
    ])
    const workspaces = await this.countUsage(userId, 'workspaces', workspaceId)

    const plan = PLANS[subscription.plan as Plan]

    const result = {
      usage: {
        invoices,
        users,
        workspaces,
        transactions,
      },
      // The limits this workspace actually has — the admin's plan and
      // workspace settings over the built-in defaults.
      limits: { ...plan.limits, ...(await effectiveLimits(workspaceId, subscription.plan)) },
      plan: subscription.plan,
      isTrial: subscription.isTrial,
    }

    // ✅ ذخیره در کش با TTL 60 ثانیه
    await memoryCache.set(cacheKey, result, 60)
    return result
  }

  // ─── Invalidate Cache ──────────────────────────────────────
  // Flushes the user-shaped key always, the workspace-shaped twins when the
  // workspace is known (both the subscription twin and the workspace usage
  // report written by getUsageReport). Bare-key prefixes fan out via
  // memoryCache.invalidate's prefix rule, so `usage:<userId>` also clears
  // `usage:<userId>:<feature>`.
  //
  // The write guard's access entries are flushed for EVERY workspace, not just
  // this one: a legacy row with no workspace_id is resolved through its owner,
  // so the row alone cannot name every workspace whose lock it decides.
  // Renewals are rare; a missed flush would leave a paying business locked.
  async invalidateCache(userId: string, workspaceId?: string) {
    await memoryCache.invalidate(this.getSubscriptionCacheKey(userId))
    await memoryCache.invalidate('subscription-access:')
    if (workspaceId) {
      await memoryCache.invalidate(this.getWorkspaceSubscriptionCacheKey(workspaceId))
      // The route-level response cache of GET /api/billing/subscription
      // (cacheMiddleware keyPrefix 'subscription', scope workspace).
      await memoryCache.invalidate(`subscription:${workspaceId}:`)
      await memoryCache.invalidate(`usage:ws:${workspaceId}`)
    }
    await memoryCache.invalidate(this.getUsageCacheKey(userId))
  }

  /** Row-aware invalidation: knows both spellings from the row itself. */
  private async invalidateFor(raw: { user_id?: string; workspace_id?: string | null }) {
    if (!raw.user_id) return
    await this.invalidateCache(raw.user_id, raw.workspace_id ?? undefined)
  }

  // ─── Private: Map snake_case to camelCase ────────────────────
  private mapSubscription(raw: any): Subscription {
    return {
      id: raw.id,
      userId: raw.user_id,
      plan: raw.plan,
      status: raw.status,
      isTrial: raw.is_trial ?? false,
      trialUsed: raw.trial_used ?? false,
      trialStartedAt: raw.trial_started_at,
      trialEndsAt: raw.trial_ends_at,
      periodStart: raw.period_start,
      periodEnd: raw.period_end,
      cancelAtPeriodEnd: raw.cancel_at_period_end,
      stripeCustomerId: raw.stripe_customer_id,
      stripeSubscriptionId: raw.stripe_subscription_id,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    }
  }
}

export default BillingService
