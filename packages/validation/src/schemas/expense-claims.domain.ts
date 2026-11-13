// ============================================
// packages/validation/src/schemas/expense-claims.domain.ts
//
// OPTION 9: EXPENSE CLAIMS & EMPLOYEE REIMBURSEMENTS
//
// Integer minor units, approval gate.
// Approve records the decision; reject posts nothing; reimbursement is a payment.
//
// ⚠️ A CLAIM CAN CARRY LINES IN MORE THAN ONE CURRENCY, AND THEY CANNOT BE ADDED.
//
// `calculateExpenseReportTotal` used to `reduce((sum, l) => sum + l.amountMinor)`
// with no question about the currency — so a claim of 5,000 AFN and 20 USD
// «totalled» 5,020 and the reimbursement paid that number in whichever currency
// the caller named. Both helpers therefore return null when the number cannot be
// computed: null is «cannot be calculated», never zero (AGENTS.md §3).
// ============================================

export type ExpenseReportStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'reimbursed'

export interface ExpenseClaimLine {
  readonly id: string
  readonly category: string
  readonly amountMinor: number
  readonly currency: string
  readonly receiptUrl?: string | null | undefined
  readonly notes?: string | null | undefined
}

export interface ExpenseReport {
  readonly id: string
  readonly employeeId: string
  readonly title: string
  readonly status: ExpenseReportStatus
  readonly lines: readonly ExpenseClaimLine[]
  readonly approvedBy?: string | null | undefined
  readonly approvedAt?: string | null | undefined
  readonly rejectedReason?: string | null | undefined
  readonly paymentId?: string | null | undefined
}

/**
 * The ONE currency every line is in, or null when there is no line or more than
 * one currency. A caller that needs an amount must ask this first.
 */
export function expenseReportCurrency(lines: readonly ExpenseClaimLine[]): string | null {
  let currency: string | null = null
  for (const line of lines) {
    const code = line.currency.toUpperCase()
    if (currency === null) currency = code
    else if (currency !== code) return null
  }
  return currency
}

/**
 * The claim's total in minor units of its own currency.
 *
 * null = cannot be calculated: no lines, or lines in more than one currency.
 * Never sum money across currencies — group by currency, or refuse.
 */
export function calculateExpenseReportTotal(report: {
  readonly lines: readonly ExpenseClaimLine[]
}): number | null {
  if (expenseReportCurrency(report.lines) === null) return null
  let total = 0
  for (const line of report.lines) total += line.amountMinor
  return total
}

export function canApproveExpenseReport(status: ExpenseReportStatus): boolean {
  return status === 'submitted'
}

export function canRejectExpenseReport(status: ExpenseReportStatus): boolean {
  return status === 'submitted'
}

/** Approved and not yet paid: the only state a reimbursement may start from. */
export function canReimburseExpenseReport(
  status: ExpenseReportStatus,
  paymentId: string | null | undefined,
): boolean {
  return status === 'approved' && !paymentId
}
