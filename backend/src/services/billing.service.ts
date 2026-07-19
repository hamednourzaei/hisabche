// ============================================
// backend/src/services/billing.service.ts — Optimized v2.1
// FIXED: count: "estimated", added cache, optimized queries
// ============================================

import { supabase } from '../db'
import { Plan, Subscription, UsageLimits } from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'

// ─── Plan Configuration ────────────────────────────────────────

export const PLANS: Record<Plan, { 
  name: string; 
  limits: UsageLimits; 
  featureKeys: string[]
}> = {
  free: {
    name: 'Free',
    limits: { invoices: 10, users: 1, businesses: 1, reports: 0, transactions: 20, teamMembers: 0, workspaces: 1 },
    featureKeys: ['billing.free.feature.invoices_10', 'billing.free.feature.user_1', 'billing.free.feature.business_1', 'billing.free.feature.basic_reports'],
  },
  pro: {
    name: 'Pro',
    limits: { invoices: null, users: null, businesses: null, reports: null, transactions: null, teamMembers: 10, workspaces: 5 },
    featureKeys: ['billing.pro.feature.unlimited_invoices', 'billing.pro.feature.advanced_reports', 'billing.pro.feature.users_10', 'billing.pro.feature.businesses_5', 'billing.pro.feature.priority_support'],
  },
  enterprise: {
    name: 'Enterprise',
    limits: { invoices: null, users: null, businesses: null, reports: null, transactions: null, teamMembers: null, workspaces: null },
    featureKeys: ['billing.enterprise.feature.all_features', 'billing.enterprise.feature.sso', 'billing.enterprise.feature.unlimited_teams', 'billing.enterprise.feature.dedicated_support', 'billing.enterprise.feature.sla'],
  },
}

const TRIAL_DAYS = 7
const GRACE_PERIOD_DAYS = 7

export class BillingService {
  
  // ─── Cache Keys ───────────────────────────────────────────
  private getSubscriptionCacheKey(userId: string) {
    return `subscription:${userId}`
  }

  private getPlanCacheKey(plan: string) {
    return `plan:${plan}`
  }

  private getUsageCacheKey(userId: string) {
    return `usage:${userId}`
  }

  // ─── Get or Create Subscription ─────────────────────────────
  async getOrCreateSubscription(userId: string): Promise<Subscription> {
    const cacheKey = this.getSubscriptionCacheKey(userId)
    
    // ✅ ابتدا از کش بخوان
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as Subscription

    const { data: existing } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single()

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
  async getCurrentSubscription(userId: string): Promise<Subscription> {
    const cacheKey = this.getSubscriptionCacheKey(userId)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as Subscription

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) throw new DatabaseError('Failed to fetch subscription', error)
    
    const subscription = this.mapSubscription(data)
    await memoryCache.set(cacheKey, subscription, 300)
    return subscription
  }

  // ─── Check Usage Limit — OPTIMIZED ──────────────────────────
  async checkUsageLimit(userId: string, feature: keyof UsageLimits): Promise<boolean> {
    const subscription = await this.getCurrentSubscription(userId)
    const plan = PLANS[subscription.plan as Plan]
    const limit = plan.limits[feature]

    if (subscription.isTrial) return true
    if (limit === null) return true

    // ✅ استفاده از کش برای Usage
    const usageCacheKey = `${this.getUsageCacheKey(userId)}:${feature}`
    const cached = await memoryCache.get(usageCacheKey)
    if (cached !== null) {
      return (cached as number) < limit
    }

    let count = 0
    const tableMap: Record<string, string> = {
      invoices: 'invoices',
      users: 'workspace_members',
      workspaces: 'workspaces',
      transactions: 'transactions',
    }

    const table = tableMap[feature]
    if (!table) return true

    // ✅ استفاده از count: "estimated"
    const { count: c, error } = await supabase
      .from(table)
      .select('id', { count: 'estimated', head: true })
      .eq('user_id', userId)

    if (error) {
      console.error(`Failed to count ${feature}:`, error)
      return true
    }

    count = c || 0
    
    // ✅ ذخیره در کش با TTL 60 ثانیه
    await memoryCache.set(usageCacheKey, count, 60)
    
    return count < limit
  }

  // ─── Upgrade Subscription ────────────────────────────────────
  async upgrade(userId: string, plan: Plan, interval: 'month' | 'year'): Promise<Subscription> {
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + (interval === 'month' ? 1 : 12))

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .update({
        plan,
        status: 'active',
        is_trial: false,
        trial_used: true,
        period_start: now.toISOString(),
        period_end: periodEnd.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) throw new DatabaseError('Failed to upgrade subscription', error)
    
    // ✅ Clear cache
    await this.invalidateCache(userId)
    
    return this.mapSubscription(subscription)
  }

  // ─── Cancel Subscription ─────────────────────────────────────
  async cancel(userId: string): Promise<Subscription> {
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) throw new DatabaseError('Failed to cancel subscription', error)
    
    // ✅ Clear cache
    await this.invalidateCache(userId)
    
    return this.mapSubscription(subscription)
  }

  // ─── Check Trial Status ──────────────────────────────────────
  async checkTrialStatus(userId: string): Promise<{ 
    isTrial: boolean
    daysLeft: number
    ended: boolean
    graceDaysLeft: number
    isInGracePeriod: boolean
  }> {
    const subscription = await this.getCurrentSubscription(userId)

    if (!subscription.isTrial || subscription.trialUsed) {
      return { isTrial: false, daysLeft: 0, ended: true, graceDaysLeft: 0, isInGracePeriod: false }
    }

    const now = new Date()
    const trialEnd = new Date(subscription.trialEndsAt)
    const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

    if (daysLeft === 0) {
      const graceEnd = new Date(trialEnd)
      graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS)
      const graceDaysLeft = Math.max(0, Math.ceil((graceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

      if (graceDaysLeft > 0) {
        return {
          isTrial: false,
          daysLeft: 0,
          ended: false,
          graceDaysLeft,
          isInGracePeriod: true,
        }
      }

      await this.expireTrial(userId)
      return {
        isTrial: false,
        daysLeft: 0,
        ended: true,
        graceDaysLeft: 0,
        isInGracePeriod: false,
      }
    }

    return {
      isTrial: true,
      daysLeft,
      ended: false,
      graceDaysLeft: 0,
      isInGracePeriod: false,
    }
  }

  // ─── Expire Trial ────────────────────────────────────────────
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

  // ─── Usage Report — OPTIMIZED ──────────────────────────────
  async getUsageReport(userId: string) {
    const cacheKey = this.getUsageCacheKey(userId)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    // ✅ استفاده از count: "estimated" برای همه
    const [invoiceCount, userCount, workspaceCount, transactionCount] = await Promise.all([
      supabase.from('invoices').select('id', { count: 'estimated', head: true }).eq('user_id', userId),
      supabase.from('workspace_members').select('id', { count: 'estimated', head: true }).eq('user_id', userId),
      supabase.from('workspaces').select('id', { count: 'estimated', head: true }).eq('user_id', userId),
      supabase.from('transactions').select('id', { count: 'estimated', head: true }).eq('user_id', userId),
    ])

    const subscription = await this.getCurrentSubscription(userId)
    const plan = PLANS[subscription.plan as Plan]

    const result = {
      usage: {
        invoices: invoiceCount.count || 0,
        users: userCount.count || 0,
        workspaces: workspaceCount.count || 0,
        transactions: transactionCount.count || 0,
      },
      limits: plan.limits,
      plan: subscription.plan,
      isTrial: subscription.isTrial,
    }

    // ✅ ذخیره در کش با TTL 60 ثانیه
    await memoryCache.set(cacheKey, result, 60)
    return result
  }

  // ─── Invalidate Cache ──────────────────────────────────────
  async invalidateCache(userId: string) {
    await memoryCache.invalidate(this.getSubscriptionCacheKey(userId))
    await memoryCache.invalidate(this.getUsageCacheKey(userId))
    await memoryCache.invalidate(`${this.getUsageCacheKey(userId)}:*`)
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