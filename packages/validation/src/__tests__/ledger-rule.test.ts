// ============================================
// The rules of the ledger — does an entry balance, may it be posted, and the
// journal lines an invoice books.
//
// ⚠️ WHY THIS FILE EXISTS. Phase 2 of the offline edition moved these rules out
// of `backend/src/services/accounting/accounting.domain.ts` and
// `invoice-posting.domain.ts`, so the device can post a document to its own
// ledger with no server to ask. Two ledgers, one arithmetic: if they disagree,
// the books do not foot and nobody can say which side is wrong.
//
// ⚠️ EVERY MONEY FIXTURE USES TWO CURRENCIES (AFN, no minor unit; USD, two) and
// comparisons are made in INTEGER MINOR UNITS, never with a tolerance — a
// 0.001 slack is what let the old balance check pass entries that were genuinely
// out by a tenth of a cent.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  collapseLines,
  dateOnly,
  dayBefore,
  evaluatePeriodLock,
  isPeriodLocked,
  naturalBalance,
  naturalSide,
  normaliseLines,
  reverseLines,
  sumMinorUnits,
  toMinorUnits,
  validateEntryLines,
  type DraftLine,
  type LedgerAccountFacts,
  type LedgerPeriodLock,
} from '../schemas/accounting.domain'
import { inBooksCurrency, invoiceLedgerLines } from '../schemas/invoice-posting.domain'
import { minor } from '../schemas/money'

const accounts = new Map<string, LedgerAccountFacts>([
  ['cash', { id: 'cash', type: 'asset', isGroup: false, isActive: true }],
  ['inventory', { id: 'inventory', type: 'asset', isGroup: false, isActive: true }],
  ['payable', { id: 'payable', type: 'liability', isGroup: false, isActive: true }],
  ['receivable', { id: 'receivable', type: 'asset', isGroup: false, isActive: true }],
  ['sales', { id: 'sales', type: 'revenue', isGroup: false, isActive: true }],
  ['cogs', { id: 'cogs', type: 'expense', isGroup: false, isActive: true }],
  ['old', { id: 'old', type: 'expense', isGroup: false, isActive: false }],
  ['group', { id: 'group', type: 'asset', isGroup: true, isActive: true }],
])

const line = (accountId: string, debit: number, credit: number): DraftLine => ({
  accountId,
  debit,
  credit,
})

describe('money is compared in integer minor units', () => {
  it('rounds to the unit the ledger posts in', () => {
    expect(toMinorUnits(10)).toBe(1000)
    expect(toMinorUnits(20.5)).toBe(2050)
    expect(toMinorUnits(100.5)).toBe(10050)
    expect(toMinorUnits(Number.NaN)).toBe(0)
    expect(sumMinorUnits([10, 20.5])).toBe(3050)
  })

  it('an entry that only balances in minor units still balances', () => {
    // ⚠️ 0.1 + 0.2 !== 0.3 in IEEE-754. Adding the floats and calling it
    // balanced would be a lie that shows up as a one-cent difference in the
    // trial balance three months later.
    expect(minor(0.1) + minor(0.2)).toBe(minor(0.3))
    expect(
      validateEntryLines(
        [line('cash', 0.1, 0), line('receivable', 0.2, 0), line('sales', 0, 0.3)],
        accounts,
      ),
    ).toEqual([])
  })
})

describe('every reason an entry may not be posted', () => {
  it('a balanced entry in either currency is accepted', () => {
    expect(validateEntryLines([line('cash', 7000, 0), line('sales', 0, 7000)], accounts)).toEqual(
      [],
    )
    expect(validateEntryLines([line('cash', 100.5, 0), line('sales', 0, 100.5)], accounts)).toEqual(
      [],
    )
  })

  it('an entry with no lines is refused', () => {
    expect(validateEntryLines([], accounts)).toEqual([
      { code: 'JOURNAL_ENTRY_EMPTY', detail: 'entry has no lines' },
    ])
  })

  it('an entry that does not balance is refused', () => {
    const violations = validateEntryLines([line('cash', 7000, 0), line('sales', 0, 6900)], accounts)
    expect(violations.map((v) => v.code)).toEqual(['JOURNAL_ENTRY_UNBALANCED'])
    expect(violations[0]?.detail).toBe('debit 7000 vs credit 6900')
  })

  it('a line with both sides filled is refused — it nets to nothing', () => {
    expect(
      validateEntryLines([line('cash', 100, 100), line('sales', 0, 0)], accounts).map(
        (v) => v.code,
      ),
    ).toContain('JOURNAL_LINE_TWO_SIDED')
  })

  it('a negative amount is refused', () => {
    expect(
      validateEntryLines([line('cash', -100, 0), line('sales', 0, -100)], accounts).map(
        (v) => v.code,
      ),
    ).toContain('JOURNAL_LINE_NEGATIVE')
  })

  it('an account that does not exist, is a group, or is closed is refused by name', () => {
    expect(validateEntryLines([line('zz', 100, 0)], accounts).map((v) => v.code)).toContain(
      'JOURNAL_LINE_ACCOUNT_UNKNOWN',
    )
    expect(validateEntryLines([line('group', 100, 0)], accounts).map((v) => v.code)).toContain(
      'JOURNAL_LINE_ACCOUNT_IS_GROUP',
    )
    expect(validateEntryLines([line('old', 100, 0)], accounts).map((v) => v.code)).toContain(
      'JOURNAL_LINE_ACCOUNT_INACTIVE',
    )
  })

  it('reports every defect at once, so one screen can fix them all', () => {
    const codes = validateEntryLines([line('group', 100, 0), line('zz', 0, 50)], accounts).map(
      (v) => v.code,
    )
    expect(codes).toEqual([
      'JOURNAL_LINE_ACCOUNT_IS_GROUP',
      'JOURNAL_LINE_ACCOUNT_UNKNOWN',
      'JOURNAL_ENTRY_UNBALANCED',
    ])
  })

  it('an entry of two zero lines is empty, not balanced', () => {
    expect(
      validateEntryLines([line('cash', 0, 0), line('sales', 0, 0)], accounts).map((v) => v.code),
    ).toEqual(['JOURNAL_LINE_TWO_SIDED', 'JOURNAL_LINE_TWO_SIDED', 'JOURNAL_ENTRY_EMPTY'])
  })
})

describe('reversing, normalising and collapsing', () => {
  it('a reversal exchanges the two sides', () => {
    expect(reverseLines([line('cash', 7000, 0), line('sales', 0, 7000)])).toEqual([
      { accountId: 'cash', debit: 0, credit: 7000, description: undefined },
      { accountId: 'sales', debit: 7000, credit: 0, description: undefined },
    ])
  })

  it('reversing twice is the original again, in minor units (USD)', () => {
    const original = [line('cash', 100.5, 0), line('sales', 0, 100.5)]
    const twice = reverseLines(reverseLines(original))
    expect(twice.map((l) => toMinorUnits(l.debit))).toEqual(
      original.map((l) => toMinorUnits(l.debit)),
    )
    expect(twice.map((l) => toMinorUnits(l.credit))).toEqual(
      original.map((l) => toMinorUnits(l.credit)),
    )
  })

  it('normalising makes the stored amount the checked amount', () => {
    expect(normaliseLines([{ accountId: 'cash', debit: 1.005, credit: 0 }])).toEqual([
      { accountId: 'cash', debit: 1, credit: 0, description: undefined },
    ])
    expect(normaliseLines([{ accountId: 'cash', debit: NaN, credit: 0 }])[0]?.debit).toBe(0)
  })

  it('lines for one account are merged, netted, and a net of zero disappears', () => {
    const collapsed = collapseLines([
      line('inventory', 300, 0),
      line('inventory', 100, 0),
      line('inventory', 0, 100),
      line('payable', 0, 7000),
      line('cogs', 50, 50),
    ])
    expect(collapsed).toEqual([
      { accountId: 'inventory', debit: 300, credit: 0, description: undefined },
      { accountId: 'payable', debit: 0, credit: 7000, description: undefined },
    ])
  })

  it('the same collapse in a decimal currency (USD)', () => {
    expect(collapseLines([line('inventory', 100.5, 0), line('inventory', 0, 0.5)])).toEqual([
      { accountId: 'inventory', debit: 100, credit: 0, description: undefined },
    ])
  })
})

describe('which side an account grows on', () => {
  it('assets and expenses grow with debits, everything else with credits', () => {
    expect(naturalSide('asset')).toBe('debit')
    expect(naturalSide('expense')).toBe('debit')
    expect(naturalSide('liability')).toBe('credit')
    expect(naturalSide('equity')).toBe('credit')
    expect(naturalSide('revenue')).toBe('credit')
  })

  it('a natural balance keeps its sign, in either currency', () => {
    expect(naturalBalance('asset', 7000, 0)).toBe(7000)
    expect(naturalBalance('asset', 0, 7000)).toBe(-7000)
    expect(naturalBalance('revenue', 0, 100.5)).toBe(100.5)
    expect(naturalBalance('revenue', 100.5, 0)).toBe(-100.5)
  })
})

describe('the period lock, company and branch', () => {
  const company: LedgerPeriodLock = {
    branchId: null,
    lockedUntil: '2026-01-31',
    reason: 'year closed',
  }
  const kabul: LedgerPeriodLock = {
    branchId: 'kabul',
    lockedUntil: '2026-06-30',
    reason: 'stocktake',
  }

  it('locks the day itself and everything before it, and nothing after', () => {
    expect(isPeriodLocked('2026-01-31', '2026-01-31')).toBe(true)
    expect(isPeriodLocked('2026-01-30', '2026-01-31')).toBe(true)
    expect(isPeriodLocked('2026-02-01', '2026-01-31')).toBe(false)
    expect(isPeriodLocked('2026-02-01', null)).toBe(false)
  })

  it('the company lock covers a branch that has no lock of its own', () => {
    expect(evaluatePeriodLock('2026-01-15', 'herat', [company])).toEqual({
      locked: true,
      scope: 'company',
      lockedUntil: '2026-01-31',
      reason: 'year closed',
    })
  })

  it('a branch lock covers that branch only — and cannot unlock a closed one', () => {
    expect(evaluatePeriodLock('2026-05-01', 'kabul', [kabul])).toMatchObject({
      locked: true,
      scope: 'branch',
    })
    expect(evaluatePeriodLock('2026-05-01', 'herat', [kabul]).locked).toBe(false)
    // ⚠️ OR-ed, never overridden: the branch is inside the company's closed year.
    expect(evaluatePeriodLock('2026-01-15', 'kabul', [company, kabul])).toMatchObject({
      locked: true,
      scope: 'company',
    })
  })

  it('a posting with no branch is judged by the company lock only', () => {
    expect(evaluatePeriodLock('2026-05-01', null, [kabul]).locked).toBe(false)
    expect(evaluatePeriodLock('2026-01-15', null, [company]).locked).toBe(true)
  })
})

describe('dates are stored, never instants', () => {
  it('the day before a window start', () => {
    expect(dayBefore('2026-01-01')).toBe('2025-12-31')
    expect(dayBefore('2026-03-01')).toBe('2026-02-28')
  })

  it('a timestamp is reduced to its date', () => {
    expect(dateOnly('2026-01-15T23:30:00.000Z')).toBe('2026-01-15')
    expect(dateOnly(new Date('2026-01-15T23:30:00.000Z'))).toBe('2026-01-15')
  })
})

describe('the journal lines one invoice books (in the books currency)', () => {
  it('restates an amount at a rate, and leaves rate 1 alone', () => {
    // ⚠️ Rate 1 is a pass-through, not a multiply-and-round: the same amount in
    // the same currency must come back bit for bit, not re-rounded.
    expect(inBooksCurrency(0.005, 1)).toBe(0.005)
    expect(inBooksCurrency(100, 1)).toBe(100)
    expect(inBooksCurrency(100, 70)).toBe(7000)
    expect(inBooksCurrency(100.5, 1)).toBe(100.5)
    expect(inBooksCurrency(0.005, 2)).toBe(0.01)
  })

  it('a purchase adds stock and owes the supplier — no revenue at all', () => {
    expect(
      invoiceLedgerLines({
        isPurchase: true,
        total: 7000,
        accounts: { inventory: 'inventory', payable: 'payable' },
      }),
    ).toEqual([
      { accountId: 'inventory', debit: 7000, credit: 0 },
      { accountId: 'payable', debit: 0, credit: 7000 },
    ])
  })

  it('a sale adds a receivable and revenue, then the cost of the goods', () => {
    expect(
      invoiceLedgerLines({
        isPurchase: false,
        total: 100.5,
        costOfGoodsSold: 60.25,
        accounts: {
          receivable: 'receivable',
          sales: 'sales',
          cogs: 'cogs',
          inventory: 'inventory',
        },
      }),
    ).toEqual([
      { accountId: 'receivable', debit: 100.5, credit: 0 },
      { accountId: 'sales', debit: 0, credit: 100.5 },
      { accountId: 'cogs', debit: 60.25, credit: 0 },
      { accountId: 'inventory', debit: 0, credit: 60.25 },
    ])
  })

  it('a sale with no cost books no cost lines, and every posting balances', () => {
    const lines = invoiceLedgerLines({
      isPurchase: false,
      total: 7000,
      accounts: { receivable: 'receivable', sales: 'sales', cogs: 'cogs', inventory: 'inventory' },
    })
    expect(lines).toHaveLength(2)
    expect(sumMinorUnits(lines.map((l) => l.debit))).toBe(sumMinorUnits(lines.map((l) => l.credit)))
  })

  it('the cost is never a negative line', () => {
    const lines = invoiceLedgerLines({
      isPurchase: false,
      total: 100.5,
      costOfGoodsSold: -5,
      accounts: { receivable: 'receivable', sales: 'sales', cogs: 'cogs', inventory: 'inventory' },
    })
    expect(lines).toHaveLength(2)
  })
})
