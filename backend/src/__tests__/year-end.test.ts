// ============================================
// Closing a financial year.
//
// The property worth defending: the entry zeroes the P&L AND the books still
// balance. An entry that does the first and quietly breaks the second looks
// exactly like success.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  carryForward,
  planClosing,
  type AccountBalance,
} from '../services/accounting/year-end.domain'

const RETAINED = 'acc-retained'

const account = (
  type: AccountBalance['type'],
  debit: number,
  credit: number,
  id = `acc-${type}-${debit}-${credit}`,
): AccountBalance => ({ accountId: id, code: '4000', type, debit, credit })

describe('a year with a profit', () => {
  const balances = [
    account('revenue', 0, 500),
    account('expense', 300, 0),
    account('asset', 800, 0),
  ]

  it('debits revenue and credits expense', () => {
    const result = planClosing(balances, RETAINED)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const revenue = result.plan.lines.find((line) => line.debit === 500)
    const expense = result.plan.lines.find((line) => line.credit === 300)

    // Revenue is credit-natured, so closing it DEBITS it. Getting this
    // backwards doubles the year's profit instead of clearing it.
    expect(revenue).toBeDefined()
    expect(expense).toBeDefined()
  })

  it('puts the profit into retained earnings as a CREDIT', () => {
    const result = planClosing(balances, RETAINED)
    if (!result.ok) throw new Error('expected a plan')

    expect(result.plan.netProfit).toBe(200)

    const retained = result.plan.lines.find((line) => line.accountId === RETAINED)
    expect(retained).toEqual({ accountId: RETAINED, debit: 0, credit: 200 })
  })

  it('balances', () => {
    const result = planClosing(balances, RETAINED)
    if (!result.ok) throw new Error('expected a plan')
    expect(result.plan.totalDebit).toBe(result.plan.totalCredit)
  })

  it('leaves balance sheet accounts alone', () => {
    // An asset is not closed. Including it would zero the bank account.
    const result = planClosing(balances, RETAINED)
    if (!result.ok) throw new Error('expected a plan')

    const touched = result.plan.lines.map((line) => line.accountId)
    expect(touched).not.toContain(balances[2]!.accountId)
  })
})

describe('a year with a loss', () => {
  it('DEBITS retained earnings', () => {
    const result = planClosing([account('revenue', 0, 100), account('expense', 400, 0)], RETAINED)
    if (!result.ok) throw new Error('expected a plan')

    expect(result.plan.netProfit).toBe(-300)
    expect(result.plan.lines.find((line) => line.accountId === RETAINED)).toEqual({
      accountId: RETAINED,
      debit: 300,
      credit: 0,
    })
  })

  it('still balances', () => {
    const result = planClosing([account('revenue', 0, 100), account('expense', 400, 0)], RETAINED)
    if (!result.ok) throw new Error('expected a plan')
    expect(result.plan.totalDebit).toBe(result.plan.totalCredit)
  })
})

describe('refusals', () => {
  it('refuses without a retained earnings account rather than inventing one', () => {
    expect(planClosing([account('revenue', 0, 100)], null)).toEqual({
      ok: false,
      reason: 'NO_RETAINED_EARNINGS_ACCOUNT',
    })
  })

  it('refuses a year with nothing to close', () => {
    // Only balance sheet accounts. Posting an empty entry would put a
    // meaningless row in the journal every year end.
    expect(planClosing([account('asset', 500, 0)], RETAINED)).toEqual({
      ok: false,
      reason: 'NOTHING_TO_CLOSE',
    })
  })
})

describe('accounts at exactly zero are skipped', () => {
  it('does not include them', () => {
    // A hundred-line entry that says nothing buries the real movements.
    const result = planClosing(
      [account('revenue', 250, 250, 'wash'), account('expense', 100, 0, 'real')],
      RETAINED,
    )
    if (!result.ok) throw new Error('expected a plan')

    expect(result.plan.lines.map((line) => line.accountId)).not.toContain('wash')
  })
})

describe('arithmetic', () => {
  it('is exact over amounts that float addition would drift on', () => {
    const balances = Array.from({ length: 3 }, (_, index) =>
      account('revenue', 0, 0.1, `r-${index}`),
    )
    const result = planClosing(balances, RETAINED)
    if (!result.ok) throw new Error('expected a plan')

    // 0.1 × 3 is 0.30000000000000004 in floats.
    expect(result.plan.netProfit).toBe(0.3)
    expect(result.plan.totalDebit).toBe(result.plan.totalCredit)
  })
})

describe('carry-forward is a statement, never an entry', () => {
  it('reports balance sheet accounts only', () => {
    const rows = carryForward([
      account('asset', 800, 0, 'bank'),
      account('liability', 0, 300, 'loan'),
      account('revenue', 0, 500, 'sales'),
    ])

    expect(rows.map((row) => row.accountId).sort()).toEqual(['bank', 'loan'])
  })

  it('drops accounts that carry nothing', () => {
    expect(carryForward([account('asset', 100, 100, 'wash')])).toEqual([])
  })

  it('signs each balance by its natural side', () => {
    // A liability we owe 300 on reads +300, not −300. The sign convention is
    // what makes the opening figures reconcile against the closing ones.
    const [loan] = carryForward([account('liability', 0, 300, 'loan')])
    expect(loan?.openingBalance).toBe(300)
  })
})
