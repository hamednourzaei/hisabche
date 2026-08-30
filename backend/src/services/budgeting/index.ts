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
