// ============================================
// backend/src/services/budgeting/budget.domain.ts
//
// What a business meant to spend, against what it has. The rules now live in
// `@hisabche/validation` (schemas/budget-rules.ts) so the offline engine applies
// the SAME rule as the server instead of a copy of it. This file keeps the old
// import path working.
// ============================================

export {
  type BudgetAction,
  type BudgetPeriod,
  type Budget,
  type BudgetConsumption,
  type BudgetStatus,
  periodFor,
  evaluate,
  type BudgetRuleCode,
  type BudgetCheck,
  checkSpend,
  applicableBudgets,
  type VarianceRow,
  varianceReport,
  type BudgetType,
  BUDGET_TYPES,
  normalizeActual,
  distributeByWeights,
  type BudgetPolicy,
  type BudgetDistribution,
  equalDistribution,
  validateDistribution,
  distributionTotal,
  theoreticalToDate,
  type PerformanceInput,
  type BudgetPerformance,
  spendsBudget,
  performance,
  type ImpactResult,
  checkImpact,
  openCommitments,
  type BudgetRevision,
  reviseBudget,
  type OverlapCandidate,
  findOverlap,
} from '@hisabche/validation'
