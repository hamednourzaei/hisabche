export type BudgetPostingPolicy = 'warn' | 'block'

export interface BudgetPostingTarget {
  budgetId: string
  accountId: string
  dimensionId?: string | null | undefined
  period: string
  limitMinor: number
  actualMinor: number
}

export interface BudgetPostingCheckResult {
  status: 'ok' | 'warn' | 'block'
  code: 'BUDGET_EXCEEDED' | null
  budgetId: string | null
  limitMinor: number | null
  actualMinor: number | null
  projectedMinor: number | null
  overageMinor: number | null
}

export function evaluateBudgetAtPosting(params: {
  budgets: readonly BudgetPostingTarget[]
  accountId: string
  dimensionId?: string | null | undefined
  period: string
  expenseDeltaMinor: number
  policy?: BudgetPostingPolicy | undefined
}): BudgetPostingCheckResult {
  const match = params.budgets.find(
    (b) =>
      b.accountId === params.accountId &&
      b.period === params.period &&
      (b.dimensionId == null || b.dimensionId === params.dimensionId),
  )

  if (!match || params.expenseDeltaMinor <= 0) {
    return {
      status: 'ok',
      code: null,
      budgetId: null,
      limitMinor: null,
      actualMinor: null,
      projectedMinor: null,
      overageMinor: null,
    }
  }

  const projectedMinor = match.actualMinor + params.expenseDeltaMinor
  if (projectedMinor <= match.limitMinor) {
    return {
      status: 'ok',
      code: null,
      budgetId: match.budgetId,
      limitMinor: match.limitMinor,
      actualMinor: match.actualMinor,
      projectedMinor,
      overageMinor: 0,
    }
  }

  const mode: BudgetPostingPolicy = params.policy ?? 'warn'
  return {
    status: mode,
    code: 'BUDGET_EXCEEDED',
    budgetId: match.budgetId,
    limitMinor: match.limitMinor,
    actualMinor: match.actualMinor,
    projectedMinor,
    overageMinor: projectedMinor - match.limitMinor,
  }
}
