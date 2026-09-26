// ============================================
// backend/src/services/plan-limit-defaults.ts
//
// ⚠️ THE ONE PLACE A PLAN'S BUILT-IN LIMITS ARE WRITTEN DOWN — and a leaf:
// it imports nothing, so billing.service, ai-quota.service and
// plan-limits.service can all read it without a module cycle (راهنمای سشن §۸,
// no-service-import-cycles.test.ts; the same reason plan-pricing.ts exists).
//
// These are the DEFAULTS. The platform admin can override them per plan and
// per workspace (services/plan-limits.service.ts); what a workspace actually
// gets is always read through `effectiveLimits()`, never from here directly.
//
// `null` = unlimited. A number is a hard ceiling; 0 is a real «none».
// ============================================

export type LimitedPlan = 'free' | 'pro' | 'enterprise'

export interface PlanLimitValues {
  /** Invoices a workspace may create (in total). */
  invoices: number | null
  /** Members (logins) a workspace may have — «کارمندها» on the admin page. */
  users: number | null
  /** AI questions per calendar month. */
  aiMonthly: number | null
}

export const LIMIT_KEYS = [
  'invoices',
  'users',
  'aiMonthly',
] as const satisfies readonly (keyof PlanLimitValues)[]

export const PLAN_LIMIT_DEFAULTS: Record<LimitedPlan, PlanLimitValues> = {
  free: { invoices: 10, users: 1, aiMonthly: 20 },
  pro: { invoices: null, users: null, aiMonthly: 500 },
  enterprise: { invoices: null, users: null, aiMonthly: 5000 },
}

export function defaultsFor(plan: string): PlanLimitValues {
  return PLAN_LIMIT_DEFAULTS[
    (plan as LimitedPlan) in PLAN_LIMIT_DEFAULTS ? (plan as LimitedPlan) : 'free'
  ]
}
