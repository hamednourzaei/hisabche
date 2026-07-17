// ============================================
// backend/src/services/billing.service.ts
// Billing & Subscription Service
// ============================================

import { supabase } from '../db'
import { Plan, Subscription, UsageLimits } from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'

// ─── Plan Configuration ────────────────────────────────────────

export const PLANS: Record<Plan, { name: string; limits: UsageLimits; features: string[] }> = {
  trial: {
    name: 'Trial',
    limits: { invoices: null, users: null, businesses: null, reports: null, transactions: null, teamMembers: null, workspaces: null },
    features: ['همه امکانات Pro به مدت ۷ روز'],
  },
  pro: {
    name: 'Pro',
    limits: { invoices: null, users: null, businesses: null, reports: null, transactions: null, teamMembers: 10, workspaces: 5 },
    features: ['فاکتور نامحدود', 'گزارش پیشرفته', '۱۰ کاربر', '۵ کسب‌وکار', 'پشتیبانی اولویت‌دار'],
  },
  enterprise: {
    name: 'Enterprise',
    limits: { invoices: null, users: null, businesses: null, reports: null, transactions: null, teamMembers: null, workspaces: null },
    features: ['همه امکانات', 'SSO', 'تیم نامحدود', 'پشتیبانی اختصاصی', 'SLA'],
  },
}

const TRIAL_DAYS = 7

export class BillingService {
  // ─── Get or Create Subscription ─────────────────────────────
  async getOrCreateSubscription(userId: string): Promise<Subscription> {
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (existing) return existing

    const now = new Date()
    const trialEndsAt = new Date(now)
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS)

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan: 'trial',
        status: 'trial',
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
        period_start: now.toISOString(),
        period_end: trialEndsAt.toISOString(),
      })
      .select('*')
      .single()

    if (error) throw new DatabaseError('Failed to create subscription', error)
    
    // ✅ تبدیل snake_case به camelCase برای خروجی
    return this.mapSubscription(subscription)
  }

  // ─── Get Current Subscription ────────────────────────────────
  async getCurrentSubscription(userId: string): Promise<Subscription> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) throw new DatabaseError('Failed to fetch subscription', error)
    
    // ✅ تبدیل snake_case به camelCase برای خروجی
    return this.mapSubscription(data)
  }

  // ─── Check if User Can Access Feature ──────────────────────
async checkUsageLimit(userId: string, feature: keyof UsageLimits): Promise<boolean> {
  const subscription = await this.getCurrentSubscription(userId)
  const plan = PLANS[subscription.plan as Plan]
  const limit = plan.limits[feature]

  if (limit === null) return true

  // ✅ اصلاح: استفاده از switch برای featureهای مختلف
  let count = 0
  switch(feature) {
    case 'invoices':
      const { count: invoiceCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
      count = invoiceCount || 0
      break
    case 'users':
      const { count: userCount } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
      count = userCount || 0
      break
    case 'workspaces':
      const { count: workspaceCount } = await supabase
        .from('workspaces')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
      count = workspaceCount || 0
      break
    case 'transactions':
      const { count: transactionCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
      count = transactionCount || 0
      break
    default:
      return true
  }

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
        period_start: now.toISOString(),
        period_end: periodEnd.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) throw new DatabaseError('Failed to upgrade subscription', error)
    
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
    
    return this.mapSubscription(subscription)
  }

  // ─── Check Trial Status ──────────────────────────────────────
  async checkTrialStatus(userId: string): Promise<{ isTrial: boolean; daysLeft: number; ended: boolean }> {
    const subscription = await this.getCurrentSubscription(userId)

    if (subscription.plan !== 'trial' || subscription.status === 'expired') {
      return { isTrial: false, daysLeft: 0, ended: true }
    }

    const now = new Date()
    // ✅ اصلاح: استفاده از camelCase
    const trialEnd = new Date(subscription.trialEndsAt)
    const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

    return {
      isTrial: daysLeft > 0 && subscription.status === 'trial',
      daysLeft,
      ended: daysLeft === 0,
    }
  }

  // ─── Get Plan Features ──────────────────────────────────────
  getPlanFeatures(plan: Plan) {
    const config = PLANS[plan]
    return {
      plan,
      name: config.name,
      limits: config.limits,
      features: config.features,
    }
  }

  // ─── Usage Report (برای Dashboard) ──────────────────────────
  async getUsageReport(userId: string) {
    const [invoiceCount, userCount, workspaceCount, transactionCount] = await Promise.all([
      supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('workspace_members').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('workspaces').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    ])

    return {
      invoices: invoiceCount.count || 0,
      users: userCount.count || 0,
      workspaces: workspaceCount.count || 0,
      transactions: transactionCount.count || 0,
    }
  }

  // ─── Private: Map snake_case to camelCase ────────────────────
  private mapSubscription(raw: any): Subscription {
    return {
      id: raw.id,
      userId: raw.user_id,
      plan: raw.plan,
      status: raw.status,
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