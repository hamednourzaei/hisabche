// ============================================
// The ledger's rules, tested without a database.
//
// Everything here is a rule that was NOT enforced before the accounting core
// existed, or was enforced wrongly. Each test names the defect it stands for,
// so a later change that reintroduces one fails with an explanation rather
// than a red assertion.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  collapseLines,
  isPeriodLocked,
  naturalBalance,
  nextEntryNumber,
  reverseLines,
  validateAccountPlacement,
  validateEntryLines,
  type AccountNode,
  type LedgerAccountFacts,
} from '../services/accounting/accounting.domain'
import {
  toBalanceSheet,
  toIncomeStatement,
  toTrialBalance,
  trialBalanceTotals,
  type LedgerTotals,
} from '../services/accounting/accounting.reports'

const account = (
  id: string,
  type: LedgerAccountFacts['type'],
  overrides: Partial<LedgerAccountFacts> = {},
): LedgerAccountFacts => ({ id, type, isGroup: false, isActive: true, ...overrides })

const chart = new Map<string, LedgerAccountFacts>([
  ['bank', account('bank', 'asset')],
  ['sales', account('sales', 'revenue')],
  ['group', account('group', 'asset', { isGroup: true })],
  ['closed', account('closed', 'expense', { isActive: false })],
])

const codes = (violations: { code: string }[]) => violations.map((v) => v.code)

describe('a journal entry may only reach the ledger balanced', () => {
  it('accepts equal debits and credits', () => {
    const violations = validateEntryLines(
      [
        { accountId: 'bank', debit: 150.5, credit: 0 },
        { accountId: 'sales', debit: 0, credit: 150.5 },
      ],
      chart,
    )
    expect(violations).toEqual([])
  })

  it('rejects an unbalanced entry', () => {
    const violations = validateEntryLines(
      [
        { accountId: 'bank', debit: 100, credit: 0 },
        { accountId: 'sales', debit: 0, credit: 90 },
      ],
      chart,
    )
    expect(codes(violations)).toContain('JOURNAL_ENTRY_UNBALANCED')
  })

  it('does not accept an entry that only balances within a float tolerance', () => {
    // The old check allowed any difference under 0.001. A tenth of a cent is
    // still money that came from nowhere, and it accumulates.
    const violations = validateEntryLines(
      [
        { accountId: 'bank', debit: 100.005, credit: 0 },
        { accountId: 'sales', debit: 0, credit: 100 },
      ],
      chart,
    )
    expect(codes(violations)).toContain('JOURNAL_ENTRY_UNBALANCED')
  })

  it('sums many lines without float drift deciding the outcome', () => {
    const lines = Array.from({ length: 30 }, () => ({
      accountId: 'bank',
      debit: 0.1,
      credit: 0,
    }))
    lines.push({ accountId: 'sales', debit: 0, credit: 3 } as (typeof lines)[number])

    expect(codes(validateEntryLines(lines, chart))).not.toContain('JOURNAL_ENTRY_UNBALANCED')
  })

  it('rejects a line carrying both a debit and a credit', () => {
    const violations = validateEntryLines(
      [
        { accountId: 'bank', debit: 50, credit: 50 },
        { accountId: 'sales', debit: 0, credit: 0 },
      ],
      chart,
    )
    expect(codes(violations)).toContain('JOURNAL_LINE_TWO_SIDED')
  })

  it('refuses to post to a group account', () => {
    const violations = validateEntryLines(
      [
        { accountId: 'group', debit: 10, credit: 0 },
        { accountId: 'sales', debit: 0, credit: 10 },
      ],
      chart,
    )
    expect(codes(violations)).toContain('JOURNAL_LINE_ACCOUNT_IS_GROUP')
  })

  it('refuses an account that is not in this workspace chart', () => {
    const violations = validateEntryLines(
      [
        { accountId: 'someone-elses-account', debit: 10, credit: 0 },
        { accountId: 'sales', debit: 0, credit: 10 },
      ],
      chart,
    )
    expect(codes(violations)).toContain('JOURNAL_LINE_ACCOUNT_UNKNOWN')
  })

  it('refuses a deactivated account', () => {
    const violations = validateEntryLines(
      [
        { accountId: 'closed', debit: 10, credit: 0 },
        { accountId: 'sales', debit: 0, credit: 10 },
      ],
      chart,
    )
    expect(codes(violations)).toContain('JOURNAL_LINE_ACCOUNT_INACTIVE')
  })

  it('reports every problem at once rather than the first', () => {
    const violations = validateEntryLines(
      [
        { accountId: 'group', debit: 10, credit: 10 },
        { accountId: 'nope', debit: 0, credit: 3 },
      ],
      chart,
    )
    expect(violations.length).toBeGreaterThan(2)
  })
})

describe('a reversal mirrors the original', () => {
  it('exchanges the two sides and leaves the amounts alone', () => {
    const reversed = reverseLines([
      { accountId: 'bank', debit: 200, credit: 0 },
      { accountId: 'sales', debit: 0, credit: 200 },
    ])

    expect(reversed).toEqual([
      { accountId: 'bank', debit: 0, credit: 200, description: undefined },
      { accountId: 'sales', debit: 200, credit: 0, description: undefined },
    ])
  })

  it('still balances, so it can itself be posted', () => {
    const original = [
      { accountId: 'bank', debit: 75.25, credit: 0 },
      { accountId: 'sales', debit: 0, credit: 75.25 },
    ]
    expect(validateEntryLines(reverseLines(original), chart)).toEqual([])
  })
})

describe('lines are collapsed per account before posting', () => {
  it('merges repeated accounts and nets the two sides', () => {
    const collapsed = collapseLines([
      { accountId: 'bank', debit: 300, credit: 0 },
      { accountId: 'bank', debit: 0, credit: 100 },
      { accountId: 'sales', debit: 0, credit: 200 },
    ])

    expect(collapsed).toEqual([
      { accountId: 'bank', debit: 200, credit: 0, description: undefined },
      { accountId: 'sales', debit: 0, credit: 200, description: undefined },
    ])
  })

  it('drops an account whose lines cancel out entirely', () => {
    const collapsed = collapseLines([
      { accountId: 'bank', debit: 50, credit: 0 },
      { accountId: 'bank', debit: 0, credit: 50 },
    ])
    expect(collapsed).toEqual([])
  })
})

describe('the period lock closes the books', () => {
  it('refuses a date on the boundary itself', () => {
    expect(isPeriodLocked('2026-03-20', '2026-03-20')).toBe(true)
  })

  it('refuses anything earlier', () => {
    expect(isPeriodLocked('2026-01-05', '2026-03-20')).toBe(true)
  })

  it('allows the day after', () => {
    expect(isPeriodLocked('2026-03-21', '2026-03-20')).toBe(false)
  })

  it('is open when no lock has ever been set', () => {
    expect(isPeriodLocked('2020-01-01', null)).toBe(false)
  })

  it('compares dates, not instants, so a timestamp cannot slip past it', () => {
    expect(isPeriodLocked('2026-03-20T23:59:59.000Z', '2026-03-20')).toBe(true)
  })
})

describe('the chart of accounts keeps its shape', () => {
  const existing: AccountNode[] = [
    { id: 'a1', code: '1000', type: 'asset', parentId: null, isGroup: true },
    { id: 'a2', code: '1100', type: 'asset', parentId: 'a1', isGroup: false },
    { id: 'r1', code: '4000', type: 'revenue', parentId: null, isGroup: true },
  ]

  it('rejects a duplicate code', () => {
    const problems = validateAccountPlacement(
      { id: '', code: '1100', type: 'asset', parentId: 'a1', isGroup: false },
      existing,
    )
    expect(problems).toContain('ACCOUNT_CODE_DUPLICATE')
  })

  it('rejects a parent of a different root type', () => {
    const problems = validateAccountPlacement(
      { id: '', code: '4100', type: 'revenue', parentId: 'a1', isGroup: false },
      existing,
    )
    expect(problems).toContain('ACCOUNT_PARENT_TYPE_MISMATCH')
  })

  it('rejects a posting account as a parent', () => {
    const problems = validateAccountPlacement(
      { id: '', code: '1110', type: 'asset', parentId: 'a2', isGroup: false },
      existing,
    )
    expect(problems).toContain('ACCOUNT_PARENT_NOT_GROUP')
  })

  it('rejects a cycle when an account is moved under its own descendant', () => {
    const problems = validateAccountPlacement(
      { id: 'a1', code: '1000', type: 'asset', parentId: 'a2', isGroup: true },
      existing,
    )
    expect(problems).toContain('ACCOUNT_PARENT_CYCLE')
  })

  it('accepts a well-placed new account', () => {
    const problems = validateAccountPlacement(
      { id: '', code: '1200', type: 'asset', parentId: 'a1', isGroup: false },
      existing,
    )
    expect(problems).toEqual([])
  })
})

describe('entry numbering', () => {
  it('continues the year sequence', () => {
    expect(nextEntryNumber(1405, 41)).toBe('JV-1405-000042')
  })

  it('starts a fresh year at one', () => {
    expect(nextEntryNumber(1406, 0)).toBe('JV-1406-000001')
  })
})

describe('balances take the account type into account', () => {
  it('reads a debit balance as positive for an asset', () => {
    expect(naturalBalance('asset', 500, 200)).toBe(300)
  })

  it('reads a credit balance as positive for revenue', () => {
    expect(naturalBalance('revenue', 0, 900)).toBe(900)
  })

  it('reports a genuinely reversed balance as negative rather than hiding it', () => {
    // An overdrawn bank account. The old balance sheet dropped this row.
    expect(naturalBalance('asset', 100, 400)).toBe(-300)
  })
})

describe('the statements', () => {
  const rows: LedgerTotals[] = [
    {
      accountId: '1',
      accountCode: '1000',
      accountName: 'Bank',
      accountType: 'asset',
      debit: 1000,
      credit: 400,
    },
    {
      accountId: '2',
      accountCode: '1100',
      accountName: 'Overdrawn',
      accountType: 'asset',
      debit: 100,
      credit: 400,
    },
    {
      accountId: '3',
      accountCode: '2000',
      accountName: 'Payable',
      accountType: 'liability',
      debit: 0,
      credit: 300,
    },
    {
      accountId: '4',
      accountCode: '3000',
      accountName: 'Capital',
      accountType: 'equity',
      debit: 0,
      credit: 500,
    },
    {
      accountId: '5',
      accountCode: '4000',
      accountName: 'Sales',
      accountType: 'revenue',
      debit: 0,
      credit: 700,
    },
    {
      accountId: '6',
      accountCode: '5000',
      accountName: 'Cost of sales',
      accountType: 'expense',
      debit: 1200,
      credit: 0,
    },
  ]

  it('trial balance totals agree, which is what says the ledger is intact', () => {
    const totals = trialBalanceTotals(toTrialBalance(rows))
    expect(totals.totalDebit).toBe(2300)
    expect(totals.totalCredit).toBe(2300)
    expect(totals.difference).toBe(0)
  })

  it('the balance sheet balances', () => {
    const sheet = toBalanceSheet(rows, '2026-08-29')
    expect(sheet.outOfBalanceBy).toBe(0)
  })

  it('keeps an account whose balance runs the wrong way', () => {
    const sheet = toBalanceSheet(rows, '2026-08-29')
    expect(sheet.assets.map((a) => a.accountCode)).toContain('1100')
    expect(sheet.assets.find((a) => a.accountCode === '1100')?.balance).toBe(-300)
  })

  it('does not put revenue or expense on the balance sheet', () => {
    const sheet = toBalanceSheet(rows, '2026-08-29')
    const shown = [...sheet.assets, ...sheet.liabilities, ...sheet.equity]
    expect(shown.some((r) => r.accountType === 'revenue' || r.accountType === 'expense')).toBe(
      false,
    )
  })

  it('carries the period result into equity instead', () => {
    const sheet = toBalanceSheet(rows, '2026-08-29')
    expect(sheet.currentYearEarnings).toBe(-500) // 700 revenue − 1200 expense
    expect(sheet.totalEquity).toBe(0) // 500 capital − 500 loss
  })

  it('the income statement reports only the period accounts', () => {
    const statement = toIncomeStatement(rows, '2026-01-01', '2026-08-29')
    expect(statement.totalRevenue).toBe(700)
    expect(statement.totalExpenses).toBe(1200)
    expect(statement.netIncome).toBe(-500)
    expect(statement.revenue.concat(statement.expenses)).toHaveLength(2)
  })
})
