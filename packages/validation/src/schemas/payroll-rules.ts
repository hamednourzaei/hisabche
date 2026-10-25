// ============================================
// packages/validation/src/schemas/payroll-rules.ts
//
// Payroll and leave rules — the figures, the settle/decide transitions and the
// journal entry a paid salary makes — shared by the server
// (backend/src/services/human-resources.service.ts) and the offline engine
// (packages/local-engine/src/routes/people.ts) so the two cannot disagree about
// what a salary is worth or when it may still change.
//
// ---------------------------------------------------------------------------
// THE ENTRY (J4)
//
//     DEBIT   salary expense      gross
//     CREDIT  tax payable         withheld tax        (only if withheld)
//     CREDIT  payables            non-tax deductions  (only if any)
//     CREDIT  cash or bank        what was actually handed over
//
// ⚠️ MINOR UNITS FOR THE ARITHMETIC. A float tolerance on money both accepts
// genuinely unbalanced entries and rejects sound ones, so balance is integer
// equality; the lines handed to the ledger are converted back to the units the
// ledger takes.
// ============================================

import { isPayrollFinal } from './human-resources.schema'

// ─── The figures ─────────────────────────────────────────────────────────────

export interface PayrollFigureInput {
  baseSalary: number
  bonuses: number
  deductions: number
  overtimeHours: number
  overtimeRate: number
  taxAmount: number
}

/** Overtime and net pay: base plus bonuses plus overtime, less deductions and tax. */
export function computePayrollFigures(input: PayrollFigureInput): {
  overtimeAmount: number
  netSalary: number
} {
  const overtimeAmount = input.overtimeHours * input.overtimeRate
  const netSalary =
    input.baseSalary + input.bonuses + overtimeAmount - input.deductions - input.taxAmount
  return { overtimeAmount, netSalary }
}

// ─── The books (J4) ──────────────────────────────────────────────────────────

export interface PayrollAmounts {
  /** Base pay plus bonuses and overtime, before deductions. */
  grossMinor: number
  /** Tax withheld from the employee — a liability, not an expense. */
  taxMinor: number
  /** Non-tax deductions (advances, loans). Reduce cash, not the expense. */
  deductionsMinor: number
  /** What the employee actually receives. */
  netMinor: number
}

export interface PayrollLine {
  role: 'salary_expense' | 'tax' | 'cash' | 'bank' | 'payable'
  debitMinor: number
  creditMinor: number
}

/**
 * Turn a payroll into balanced journal lines.
 *
 * `cashRole` is whichever account the business actually pays from — the caller
 * resolves it, because a shop paying wages in cash and one paying by transfer
 * are the same entry with a different credit side.
 *
 * ⚠️ RETURNS AN EMPTY ARRAY FOR A ZERO PAYROLL rather than a zero entry. The
 * ledger refuses an entry whose total is zero, and a payroll of nothing is a
 * data problem to see, not an entry to book.
 */
export function payrollLines(amounts: PayrollAmounts, cashRole: 'cash' | 'bank'): PayrollLine[] {
  const gross = Math.round(amounts.grossMinor)
  if (gross <= 0) return []

  const tax = Math.max(0, Math.round(amounts.taxMinor))
  const deductions = Math.max(0, Math.round(amounts.deductionsMinor))

  // What actually left the till. Derived rather than trusted: `net_salary` is
  // stored on the row and a stored figure that disagrees with its own parts
  // would produce an unbalanced entry.
  const paid = gross - tax - deductions

  const lines: PayrollLine[] = [{ role: 'salary_expense', debitMinor: gross, creditMinor: 0 }]

  if (tax > 0) lines.push({ role: 'tax', debitMinor: 0, creditMinor: tax })

  // Non-tax deductions are money the business keeps — an advance being repaid.
  // Credited to payables so it reduces what the business owes rather than
  // vanishing.
  if (deductions > 0) lines.push({ role: 'payable', debitMinor: 0, creditMinor: deductions })

  if (paid > 0) lines.push({ role: cashRole, debitMinor: 0, creditMinor: paid })

  return lines
}

/** Do these lines balance, in integers? */
export function linesBalance(lines: PayrollLine[]): boolean {
  const debit = lines.reduce((sum, line) => sum + line.debitMinor, 0)
  const credit = lines.reduce((sum, line) => sum + line.creditMinor, 0)
  return debit === credit
}

/** Every account role a payroll entry needs, given how it is paid. */
export function rolesRequired(
  amounts: PayrollAmounts,
  cashRole: 'cash' | 'bank',
): PayrollLine['role'][] {
  return [...new Set(payrollLines(amounts, cashRole).map((line) => line.role))]
}

/** The stored fields of a payroll the booking reads. */
export interface PayrollBookingInput {
  base_salary: unknown
  bonuses: unknown
  overtime_amount: unknown
  tax_amount: unknown
  deductions: unknown
  net_salary: unknown
}

const toMinor = (value: unknown) => Math.round((Number(value) || 0) * 100)

/** The amounts of a stored payroll, in minor units. Gross is what the business BEARS. */
export function payrollBookingAmounts(payroll: PayrollBookingInput): PayrollAmounts {
  return {
    grossMinor:
      toMinor(payroll.base_salary) + toMinor(payroll.bonuses) + toMinor(payroll.overtime_amount),
    taxMinor: toMinor(payroll.tax_amount),
    deductionsMinor: toMinor(payroll.deductions),
    netMinor: toMinor(payroll.net_salary),
  }
}

/** A line for the ledger: the role resolved to an account by the caller, amounts in major units. */
export interface PayrollDraftLine {
  role: PayrollLine['role']
  debit: number
  credit: number
}

/** The ledger-unit form of `payrollLines`, for a ledger that takes major units. */
export function payrollDraftLines(
  payroll: PayrollBookingInput,
  cashRole: 'cash' | 'bank',
): PayrollDraftLine[] {
  return payrollLines(payrollBookingAmounts(payroll), cashRole).map((line) => ({
    role: line.role,
    debit: line.debitMinor / 100,
    credit: line.creditMinor / 100,
  }))
}

// ─── Settling a salary ───────────────────────────────────────────────────────

export type PayrollStatusInput = 'draft' | 'approved' | 'paid' | 'cancelled'

export interface PayrollOutcomeInput {
  status?: PayrollStatusInput | undefined
  paymentDate?: string | null | undefined
  notes?: string | null | undefined
}

export type PayrollOutcomeProblem = 'PAYROLL_REASON_REQUIRED' | 'PAYROLL_ALREADY_PAID'

/**
 * What a settle changes — or why it cannot.
 *
 * ⚠️ «پرداخت نشد» without a reason is the question the owner asks three months
 * later with nobody left to answer it. A paid salary has a journal entry behind
 * it, so it is never moved back (`isPayrollFinal`).
 */
export function planPayrollOutcome(
  current: { status: string | null },
  update: PayrollOutcomeInput,
  nowIso: string,
):
  | { ok: true; changes: { status?: string; payment_date?: string | null; notes?: string | null } }
  | { ok: false; problem: PayrollOutcomeProblem } {
  const reason = (update.notes ?? '').trim()
  if (update.status === 'cancelled' && reason === '') {
    return { ok: false, problem: 'PAYROLL_REASON_REQUIRED' }
  }
  if (isPayrollFinal(current.status)) return { ok: false, problem: 'PAYROLL_ALREADY_PAID' }

  const changes: { status?: string; payment_date?: string | null; notes?: string | null } = {}
  if (update.status !== undefined) changes.status = update.status
  if (update.paymentDate !== undefined) changes.payment_date = update.paymentDate
  // A salary marked paid with no date was paid now, not «never».
  else if (update.status === 'paid') changes.payment_date = nowIso
  if (update.notes !== undefined) changes.notes = reason || null
  return { ok: true, changes }
}

/**
 * «جمع حقوق پرداختی». ⚠️ CANCELLED PAYROLLS DO NOT COUNT: a cancelled run is
 * money that was not paid; including it inflates the card. This matches what
 * the profit report already excludes, so the two figures cannot disagree.
 */
export function summarizePayrolls(
  rows: ReadonlyArray<{ employee_id: string; net_salary: unknown; status: string | null }>,
): { total: number; byEmployee: Record<string, number> } {
  const byEmployee: Record<string, number> = {}
  let total = 0
  for (const row of rows) {
    if (['cancelled', 'rejected'].includes(String(row.status ?? ''))) continue
    const amount = Number(row.net_salary) || 0
    total += amount
    byEmployee[row.employee_id] = (byEmployee[row.employee_id] || 0) + amount
  }
  return { total, byEmployee }
}

// ─── Leave ───────────────────────────────────────────────────────────────────

/** Calendar days from start to end, both included. */
export function leaveTotalDays(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

export type LeaveDecisionProblem = 'LEAVE_ALREADY_DECIDED'

/**
 * A decision is made once. An approval is never quietly turned into a rejection
 * after the person has taken the days.
 */
export function planLeaveDecision(
  current: { status: string | null },
  update: { status?: string | undefined },
  decidedBy: string,
  nowIso: string,
):
  | {
      ok: true
      changes: { status?: string; approved_by?: string; approved_at?: string }
    }
  | { ok: false; problem: LeaveDecisionProblem } {
  if (update.status === undefined) return { ok: true, changes: {} }
  if (current.status !== 'pending') return { ok: false, problem: 'LEAVE_ALREADY_DECIDED' }
  const changes: { status?: string; approved_by?: string; approved_at?: string } = {
    status: update.status,
  }
  if (update.status === 'approved') {
    changes.approved_by = decidedBy
    changes.approved_at = nowIso
  }
  return { ok: true, changes }
}

/**
 * The branch an employee belonged to ON A GIVEN DATE — from their assignments,
 * never from their current primary. Null when no assignment covers the date:
 * «unknown», and the caller must not substitute a default.
 */
export function branchOnDate(
  assignments: ReadonlyArray<{
    branch_id: string
    is_primary: boolean | number
    starts_at: string
    ends_at: string | null
  }>,
  onDate: string,
): string | null {
  const day = onDate.slice(0, 10)
  const covering = assignments
    .filter(
      (row) =>
        (row.is_primary === true || row.is_primary === 1) &&
        row.starts_at.slice(0, 10) <= day &&
        (row.ends_at === null || row.ends_at.slice(0, 10) >= day),
    )
    .sort((a, b) => (a.starts_at < b.starts_at ? 1 : -1))
  return covering[0]?.branch_id ?? null
}
