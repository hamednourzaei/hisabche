// ============================================
// packages/validation/src/schemas/expense-claims.domain.ts
//
// OPTION 9: EXPENSE CLAIMS & EMPLOYEE REIMBURSEMENTS
//
// Integer minor units, approval gate.
// Approve -> posts once; reject posts nothing; reimbursement via a payment.
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

export function calculateExpenseReportTotal(report: {
  readonly lines: readonly ExpenseClaimLine[]
}): number {
  return report.lines.reduce((sum, l) => sum + l.amountMinor, 0)
}

export function canApproveExpenseReport(status: ExpenseReportStatus): boolean {
  return status === 'submitted'
}

export function canRejectExpenseReport(status: ExpenseReportStatus): boolean {
  return status === 'submitted'
}
