// ============================================
// backend/src/services/budgeting/index.ts
//
// A budget is checked BEFORE the money is committed. Callers ask
// `checkSpend` and then `commit`; the pair is what makes it a control rather
// than a report.
// ============================================

export { BudgetService } from './budget.service'

export {
  applicableBudgets,
  checkSpend,
  evaluate,
  periodFor,
  varianceReport,
  checkImpact,
  equalDistribution,
  findOverlap,
  openCommitments,
  performance,
  reviseBudget,
  theoreticalToDate,
  validateDistribution,
  type BudgetDistribution,
  type BudgetPerformance,
  type BudgetPolicy,
  type BudgetRevision,
  type BudgetType,
  type ImpactResult,
  type Budget,
  type BudgetAction,
  type BudgetCheck,
  type BudgetConsumption,
  type BudgetPeriod,
  type BudgetStatus,
  type VarianceRow,
} from './budget.domain'

import { BudgetService } from './budget.service'

export const budgets = new BudgetService()
