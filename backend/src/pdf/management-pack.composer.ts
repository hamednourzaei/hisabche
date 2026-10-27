// ============================================
// backend/src/pdf/management-pack.composer.ts
//
// Management Pack PDF Composer (Option 36 / Analysis -> Reports)
// Aggregates:
// 1. Income Statement
// 2. Cash Flow Statement
// 3. Working Capital Analysis
// 4. Aging Report (Receivables/Payables)
//
// Guaranteed invariant:
// Pack totals match each underlying source to the exact minor unit (no floats).
// ============================================

export interface IncomeStatementSource {
  revenueMinor: number
  costOfGoodsSoldMinor: number
  grossProfitMinor: number
  operatingExpensesMinor: number
  netIncomeMinor: number
}

export interface CashFlowSource {
  operatingCashFlowMinor: number
  investingCashFlowMinor: number
  financingCashFlowMinor: number
  netCashFlowMinor: number
}

export interface WorkingCapitalSource {
  currentAssetsMinor: number
  currentLiabilitiesMinor: number
  workingCapitalMinor: number
}

export interface AgingReportSource {
  totalDueMinor: number
  currentMinor: number
  days30Minor: number
  days60Minor: number
  days90PlusMinor: number
}

export interface ManagementPackPayload {
  title: string
  periodEnd: string
  incomeStatement: IncomeStatementSource
  cashFlow: CashFlowSource
  workingCapital: WorkingCapitalSource
  aging: AgingReportSource
}

export interface ManagementPackSummary {
  periodEnd: string
  netIncomeMinor: number
  netCashFlowMinor: number
  workingCapitalMinor: number
  totalDueMinor: number
  composedAt: string
}

export function composeManagementPack(payload: ManagementPackPayload): {
  summary: ManagementPackSummary
  report: ManagementPackPayload
} {
  // Assert integer minor units (money discipline)
  if (
    !Number.isInteger(payload.incomeStatement.netIncomeMinor) ||
    !Number.isInteger(payload.cashFlow.netCashFlowMinor) ||
    !Number.isInteger(payload.workingCapital.workingCapitalMinor) ||
    !Number.isInteger(payload.aging.totalDueMinor)
  ) {
    throw new Error('MANAGEMENT_PACK_FLOAT_DETECTED: All money amounts must be integer minor units')
  }

  const summary: ManagementPackSummary = {
    periodEnd: payload.periodEnd,
    netIncomeMinor: payload.incomeStatement.netIncomeMinor,
    netCashFlowMinor: payload.cashFlow.netCashFlowMinor,
    workingCapitalMinor: payload.workingCapital.workingCapitalMinor,
    totalDueMinor: payload.aging.totalDueMinor,
    composedAt: new Date().toISOString(),
  }

  return { summary, report: payload }
}
