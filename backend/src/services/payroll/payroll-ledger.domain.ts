// ============================================
// backend/src/services/payroll/payroll-ledger.domain.ts
//
// J4 — what paying a salary does to the books.
//
// ---------------------------------------------------------------------------
// WHAT WAS WRONG
//
// `updatePayrollStatus()` moved a payroll to `paid` and stopped. No journal
// entry, no ledger line, nothing. A salary expense and a cash outflow — both
// real, both material — happened entirely outside the books.
//
// Nothing reported an error, because nothing knew an entry was owed. Every
// income statement was short by exactly the payroll, every month, silently.
//
// ---------------------------------------------------------------------------
// THE ENTRY
//
//     DEBIT   salary expense      gross + employer cost
//     CREDIT  tax payable         withheld tax        (only if withheld)
//     CREDIT  cash or bank        what was actually handed over
//
// Tax withheld is NOT an expense and NOT cash — it is money the business is
// holding on someone else's behalf until it is remitted. Netting it into the
// cash line would understate both the wage bill and the liability, and the tax
// would never appear as owed anywhere.
//
// ⚠️ MINOR UNITS THROUGHOUT. Lesson 9: a float tolerance on money both accepts
// genuinely unbalanced entries and rejects sound ones. The balance check here
// is integer equality.
// ============================================

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
 * ⚠️ RETURNS AN EMPTY ARRAY FOR A ZERO PAYROLL rather than a zero entry.
 * `accounting_post_journal_entry` refuses an entry whose total is zero
 * (`JOURNAL_ENTRY_EMPTY`), and a payroll of nothing is a data problem to see,
 * not an entry to book.
 */
export function payrollLines(amounts: PayrollAmounts, cashRole: 'cash' | 'bank'): PayrollLine[] {
  const gross = Math.round(amounts.grossMinor)
  if (gross <= 0) return []

  const tax = Math.max(0, Math.round(amounts.taxMinor))
  const deductions = Math.max(0, Math.round(amounts.deductionsMinor))

  // What actually left the till. Derived rather than trusted: `net_salary` is
  // stored on the row and a stored figure that disagrees with its own parts
  // would produce an unbalanced entry the RPC then refuses — with an error
  // naming the ledger rather than the payroll that caused it.
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

/**
 * Do these lines balance, in integers?
 *
 * Exported so the caller can refuse to post rather than discovering it from a
 * Postgres exception three layers down.
 */
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
