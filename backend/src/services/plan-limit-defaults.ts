// ============================================
// backend/src/services/plan-limit-defaults.ts
//
// ⚠️ THE ONE PLACE A PLAN'S BUILT-IN LIMITS ARE WRITTEN DOWN — and a leaf:
// it imports nothing, so billing.service, ai-quota.service and
// plan-limits.service can all read it without a module cycle.
//
// Limits:
//   - FREE (and legacy free): 50 lifetime invoices, 1 user, 20 AI/mo
//   - OFFLINE: null invoices lifetime, null daily, 1 user, 0 AI
//   - ONLINE_500: null invoices lifetime, 500 daily, null users, 500 AI/mo
//   - ONLINE_1000: null invoices lifetime, 1000 daily, null users, 1000 AI/mo
//   - ONLINE_1500: null invoices lifetime, 1500 daily, null users, 1500 AI/mo
//
// `null` = unlimited. A number is a hard ceiling; 0 is a real «none».
// ============================================

export type LimitedPlan =
  'FREE' | 'OFFLINE' | 'ONLINE_500' | 'ONLINE_1000' | 'ONLINE_1500' | 'free' | 'pro' | 'enterprise'

export interface PlanLimitValues {
  /** Invoices a workspace may create (in total lifetime). */
  invoices: number | null
  /** Invoices a workspace may create per local day. */
  invoicesDaily: number | null
  /** Members (logins) a workspace may have — «کارمندها» on the admin page. */
  users: number | null
  /** AI questions per calendar month. */
  aiMonthly: number | null
}

export const LIMIT_KEYS = [
  'invoices',
  'invoicesDaily',
  'users',
  'aiMonthly',
] as const satisfies readonly (keyof PlanLimitValues)[]

export const PLAN_LIMIT_DEFAULTS: Record<LimitedPlan, PlanLimitValues> = {
  FREE: { invoices: 50, invoicesDaily: null, users: 1, aiMonthly: 20 },
  OFFLINE: { invoices: null, invoicesDaily: null, users: 1, aiMonthly: 0 },
  ONLINE_500: { invoices: null, invoicesDaily: 500, users: null, aiMonthly: 500 },
  ONLINE_1000: { invoices: null, invoicesDaily: 1000, users: null, aiMonthly: 1000 },
  ONLINE_1500: { invoices: null, invoicesDaily: 1500, users: null, aiMonthly: 1500 },
  // Legacy aliases
  free: { invoices: 50, invoicesDaily: null, users: 1, aiMonthly: 20 },
  pro: { invoices: null, invoicesDaily: null, users: null, aiMonthly: 500 },
  enterprise: { invoices: null, invoicesDaily: null, users: null, aiMonthly: 5000 },
}

export function defaultsFor(plan: string): PlanLimitValues {
  const normalized = plan in PLAN_LIMIT_DEFAULTS ? (plan as LimitedPlan) : 'FREE'
  return PLAN_LIMIT_DEFAULTS[normalized]
}
