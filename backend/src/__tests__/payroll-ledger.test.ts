// ============================================
// J4 — what paying a salary does to the books.
//
// `updatePayrollStatus()` moved a payroll to `paid` and stopped. No journal
// entry, no ledger line. A salary expense and a cash outflow — both real, both
// material — happened entirely outside the books, every month, and nothing
// reported an error because nothing knew an entry was owed.
//
// The arithmetic is pure, so these are real tests. What they lock is the part
// that is easy to get subtly wrong and impossible to notice: WHICH figure is
// the expense, and where withheld tax goes.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  linesBalance,
  payrollLines,
  rolesRequired,
  type PayrollAmounts,
} from '../services/payroll/payroll-ledger.domain'

const amounts = (over: Partial<PayrollAmounts> = {}): PayrollAmounts => ({
  grossMinor: 10_000_00,
  taxMinor: 0,
  deductionsMinor: 0,
  netMinor: 10_000_00,
  ...over,
})

const roleOf = (lines: ReturnType<typeof payrollLines>, role: string) =>
  lines.find((line) => line.role === role)

describe('a simple salary, no tax or deductions', () => {
  const lines = payrollLines(amounts(), 'cash')

  it('debits the expense with the gross', () => {
    expect(roleOf(lines, 'salary_expense')?.debitMinor).toBe(10_000_00)
  })

  it('credits cash with the same amount', () => {
    expect(roleOf(lines, 'cash')?.creditMinor).toBe(10_000_00)
  })

  it('balances', () => {
    expect(linesBalance(lines)).toBe(true)
  })
})

describe('withheld tax', () => {
  const lines = payrollLines(amounts({ taxMinor: 1_000_00, netMinor: 9_000_00 }), 'cash')

  it('is a LIABILITY, not an expense and not cash', () => {
    // THE CASE THAT IS EASY TO GET WRONG.
    //
    // Netting tax into the cash line would understate the wage bill by the
    // tax, and the money the business is holding on someone else's behalf
    // would appear nowhere as owed. Both errors are invisible on a payslip
    // and wrong on every statement.
    expect(roleOf(lines, 'tax')?.creditMinor).toBe(1_000_00)
  })

  it('still charges the FULL gross to the expense', () => {
    // The business bears the gross. What the employee receives is smaller;
    // that difference is not a saving.
    expect(roleOf(lines, 'salary_expense')?.debitMinor).toBe(10_000_00)
  })

  it('credits cash with only what was handed over', () => {
    expect(roleOf(lines, 'cash')?.creditMinor).toBe(9_000_00)
  })

  it('balances', () => {
    expect(linesBalance(lines)).toBe(true)
  })
})

describe('non-tax deductions', () => {
  const lines = payrollLines(amounts({ deductionsMinor: 500_00, netMinor: 9_500_00 }), 'cash')

  it('reduces cash but not the expense', () => {
    expect(roleOf(lines, 'salary_expense')?.debitMinor).toBe(10_000_00)
    expect(roleOf(lines, 'cash')?.creditMinor).toBe(9_500_00)
  })

  it('lands in payables rather than vanishing', () => {
    // An advance being repaid is money the business keeps. Dropping the line
    // would leave the entry unbalanced; crediting cash for it would say the
    // employee received it.
    expect(roleOf(lines, 'payable')?.creditMinor).toBe(500_00)
  })

  it('balances', () => {
    expect(linesBalance(lines)).toBe(true)
  })
})

describe('tax and deductions together', () => {
  const lines = payrollLines(
    amounts({ taxMinor: 1_000_00, deductionsMinor: 500_00, netMinor: 8_500_00 }),
    'bank',
  )

  it('balances', () => {
    expect(linesBalance(lines)).toBe(true)
  })

  it('splits the gross three ways', () => {
    expect(roleOf(lines, 'tax')?.creditMinor).toBe(1_000_00)
    expect(roleOf(lines, 'payable')?.creditMinor).toBe(500_00)
    expect(roleOf(lines, 'bank')?.creditMinor).toBe(8_500_00)
  })
})

describe('paying by transfer', () => {
  it('credits bank instead of cash', () => {
    const lines = payrollLines(amounts(), 'bank')

    expect(roleOf(lines, 'bank')?.creditMinor).toBe(10_000_00)
    expect(roleOf(lines, 'cash')).toBeUndefined()
  })
})

describe('degenerate payrolls', () => {
  it('produces no lines for a zero gross', () => {
    // The RPC refuses a zero entry (JOURNAL_ENTRY_EMPTY). A payroll of nothing
    // is a data problem to look at, not an entry to file.
    expect(payrollLines(amounts({ grossMinor: 0 }), 'cash')).toEqual([])
  })

  it('produces no lines for a negative gross', () => {
    expect(payrollLines(amounts({ grossMinor: -100 }), 'cash')).toEqual([])
  })

  it('omits the cash line when tax and deductions consume the whole gross', () => {
    // Rare but real: an advance equal to the full salary. Nothing is handed
    // over, so there is no cash line — and it must still balance.
    const lines = payrollLines(
      amounts({ taxMinor: 0, deductionsMinor: 10_000_00, netMinor: 0 }),
      'cash',
    )

    expect(roleOf(lines, 'cash')).toBeUndefined()
    expect(linesBalance(lines)).toBe(true)
  })

  it('ignores a negative tax rather than turning it into a debit', () => {
    const lines = payrollLines(amounts({ taxMinor: -500_00 }), 'cash')

    expect(roleOf(lines, 'tax')).toBeUndefined()
    expect(linesBalance(lines)).toBe(true)
  })
})

describe('rolesRequired', () => {
  it('names only the accounts this payroll actually needs', () => {
    expect(rolesRequired(amounts(), 'cash').sort()).toEqual(['cash', 'salary_expense'])

    expect(rolesRequired(amounts({ taxMinor: 1_000_00 }), 'bank').sort()).toEqual([
      'bank',
      'salary_expense',
      'tax',
    ])
  })
})

describe('money is integer throughout', () => {
  it('does not drift on figures with fractional currency', () => {
    // Lesson 9. A float tolerance both accepts genuinely unbalanced entries
    // and rejects sound ones, so the balance check is integer equality — and
    // that only holds if nothing upstream produced a fraction of a minor unit.
    const lines = payrollLines(
      amounts({ grossMinor: 3_333_33, taxMinor: 333_33, netMinor: 3_000_00 }),
      'cash',
    )

    const debit = lines.reduce((sum, l) => sum + l.debitMinor, 0)
    const credit = lines.reduce((sum, l) => sum + l.creditMinor, 0)

    expect(Number.isInteger(debit)).toBe(true)
    expect(Number.isInteger(credit)).toBe(true)
    expect(debit).toBe(credit)
  })
})
