// ============================================
// Fixed assets, FX revaluation, bank reconciliation and dimensions.
//
// Four cores, one shared property: each computes a figure that somebody will
// defend to an auditor, so each is tested on the case where the obvious
// implementation is quietly wrong.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  bookValueMinor,
  buildSchedule,
  disposeAsset,
  duePostings,
  validateAsset,
  type AssetInput,
} from '../services/assets/depreciation.domain'
import {
  rateFor,
  realisedDifferenceMinor,
  revalue,
  runRevaluation,
  type ForeignBalance,
} from '../services/currency/revaluation.domain'
import {
  scoreMatch,
  statementLineKey,
  suggestMatches,
  summariseReconciliation,
  validateReconcile,
  type BookEntry,
  type StatementLine,
} from '../services/banking/reconciliation.domain'
import {
  coverageGapMinor,
  requirementApplies,
  totalsByDimension,
  validateLine,
  valueAndDescendants,
  type DimensionValue,
} from '../services/dimensions/dimension.domain'

// ══════════════════════════════════════════════ FIXED ASSETS

describe('depreciation', () => {
  const asset = (over: Partial<AssetInput> = {}): AssetInput => ({
    costMinor: 10_000_000, // 100,000 AFN
    salvageMinor: 0,
    periods: 36,
    method: 'straight_line',
    firstPeriodOn: '2026-01-31',
    periodMonths: 1,
    ...over,
  })

  it('spreads the cost evenly on straight line', () => {
    const schedule = buildSchedule(asset())
    expect(schedule).toHaveLength(36)
    expect(schedule[0]!.amountMinor).toBe(277_778)
  })

  it('SUMS EXACTLY to the depreciable amount', () => {
    // Thirty-six roundings of 2,777.77 do not add up to 100,000. The last
    // period absorbs the remainder so the asset reaches zero on its last day
    // rather than settling at 0.12 forever.
    const schedule = buildSchedule(asset())
    const total = schedule.reduce((sum, entry) => sum + entry.amountMinor, 0)
    expect(total).toBe(10_000_000)
  })

  it('stops at the salvage value, not at zero', () => {
    const schedule = buildSchedule(asset({ salvageMinor: 1_000_000 }))
    expect(schedule[schedule.length - 1]!.bookValueMinor).toBe(1_000_000)
  })

  it('front-loads a declining schedule', () => {
    const schedule = buildSchedule(asset({ method: 'declining', periods: 5, decliningFactor: 2 }))
    expect(schedule[0]!.amountMinor).toBeGreaterThan(schedule[4]!.amountMinor)
  })

  it('the hybrid still reaches the salvage value', () => {
    // Declining alone approaches zero without arriving; the switch is what
    // makes the asset finish depreciating.
    const schedule = buildSchedule(
      asset({ method: 'declining_then_straight', periods: 5, decliningFactor: 2 }),
    )
    expect(schedule[schedule.length - 1]!.bookValueMinor).toBe(0)
  })

  it('prorates the first period when the asset was bought mid-period', () => {
    const schedule = buildSchedule(
      asset({ periods: 12, firstPeriodOn: '2026-01-16', prorataFrom: '2026-01-01' }),
    )
    expect(schedule[0]!.amountMinor).toBeLessThan(schedule[1]!.amountMinor)
  })

  it('still sums exactly after prorating', () => {
    const schedule = buildSchedule(
      asset({ periods: 12, firstPeriodOn: '2026-01-16', prorataFrom: '2026-01-01' }),
    )
    expect(schedule.reduce((sum, e) => sum + e.amountMinor, 0)).toBe(10_000_000)
  })

  it('clamps month arithmetic instead of overflowing into the next month', () => {
    // Adding a month to 31 January must give the end of February.
    const schedule = buildSchedule(asset({ periods: 3, firstPeriodOn: '2026-01-31' }))
    expect(schedule[1]!.onDate).toBe('2026-02-28')
  })

  it('refuses a salvage value above cost', () => {
    expect(validateAsset(asset({ salvageMinor: 20_000_000 }))).toContain(
      'ASSET_SALVAGE_EXCEEDS_COST',
    )
  })
})

describe('a missed depreciation run is recoverable', () => {
  const schedule = buildSchedule({
    costMinor: 1_200_000,
    salvageMinor: 0,
    periods: 12,
    method: 'straight_line',
    firstPeriodOn: '2026-01-31',
    periodMonths: 1,
  })

  it('POSTS EVERY ENTRY IT OWES, not one that swallowed three', () => {
    // The schedule is fixed, so a run six weeks late knows exactly what it
    // missed. A monthly formula would post one figure and lose the rest.
    const due = duePostings(schedule, [1], '2026-04-30')
    expect(due.map((entry) => entry.period)).toEqual([2, 3, 4])
  })

  it('posts nothing twice', () => {
    expect(duePostings(schedule, [1, 2, 3, 4], '2026-04-30')).toEqual([])
  })

  it('posts nothing before it is due', () => {
    expect(duePostings(schedule, [], '2025-12-31')).toEqual([])
  })

  it('reports the book value on any date', () => {
    expect(bookValueMinor(1_200_000, schedule, '2026-03-31')).toBe(900_000)
  })
})

describe('disposing of an asset', () => {
  const schedule = buildSchedule({
    costMinor: 1_200_000,
    salvageMinor: 0,
    periods: 12,
    method: 'straight_line',
    firstPeriodOn: '2026-01-31',
    periodMonths: 1,
  })

  it('COMPARES PROCEEDS TO BOOK VALUE, not to cost', () => {
    // Comparing against cost reports a loss on every asset ever sold after
    // being used, which is exactly backwards.
    const result = disposeAsset(1_200_000, schedule, {
      onDate: '2026-06-30',
      proceedsMinor: 700_000,
    })
    expect(result.netBookValueMinor).toBe(600_000)
    expect(result.gainOrLossMinor).toBe(100_000)
  })

  it('reports a loss when it sold for less than its book value', () => {
    const result = disposeAsset(1_200_000, schedule, {
      onDate: '2026-06-30',
      proceedsMinor: 400_000,
    })
    expect(result.gainOrLossMinor).toBe(-200_000)
  })

  it('cancels the periods that will never be posted', () => {
    const result = disposeAsset(1_200_000, schedule, {
      onDate: '2026-06-30',
      proceedsMinor: 0,
    })
    expect(result.cancelledPeriods).toEqual([7, 8, 9, 10, 11, 12])
  })
})

// ══════════════════════════════════════════════ FX

describe('foreign currency', () => {
  const receivable: ForeignBalance = {
    sourceType: 'receivable',
    sourceId: 'inv-1',
    currency: 'USD',
    foreignMinor: 100_000, // $1,000
    bookedRate: 70,
    bookedBaseMinor: 7_000_000,
  }

  it('a receivable worth more is a gain', () => {
    expect(revalue(receivable, 73).differenceMinor).toBe(300_000)
  })

  it('A PAYABLE WORTH MORE IS A LOSS', () => {
    // The sign trap: computing both as "revalued minus booked" turns a rising
    // dollar into a windfall on money you owe.
    const payable: ForeignBalance = { ...receivable, sourceType: 'payable', sourceId: 'bill-1' }
    expect(revalue(payable, 73).differenceMinor).toBe(-300_000)
  })

  it('SKIPS a currency it has no rate for rather than valuing it at zero', () => {
    // Guessing a rate is how a revaluation invents a loss.
    const run = runRevaluation([receivable], { EUR: 80 }, '2026-06-30')
    expect(run.lines).toEqual([])
    expect(run.netDifferenceMinor).toBe(0)
  })

  it('REVERSES the previous run before booking its own', () => {
    // Unrealised difference is an opinion about a rate. Last month's opinion
    // must not still be in the books underneath this month's.
    const run = runRevaluation([receivable], { USD: 73 }, '2026-06-30', 200_000)
    expect(run.reversesPreviousMinor).toBe(-200_000)
  })

  it('separates gains from losses instead of only netting them', () => {
    const other: ForeignBalance = {
      ...receivable,
      sourceId: 'inv-2',
      bookedRate: 75,
      bookedBaseMinor: 7_500_000,
    }
    const run = runRevaluation([receivable, other], { USD: 73 }, '2026-06-30')
    expect(run.gainMinor).toBe(300_000)
    expect(run.lossMinor).toBe(-200_000)
    expect(run.netDifferenceMinor).toBe(100_000)
  })

  it('books a realised difference when the money actually moved', () => {
    const realised = realisedDifferenceMinor({
      foreignMinor: 100_000,
      bookedRate: 70,
      settlementRate: 73,
      sourceType: 'receivable',
    })
    expect(realised).toBe(300_000)
  })
})

describe('choosing a rate', () => {
  const quotes = [
    { currency: 'USD', rate: 70, onDate: '2026-06-01' },
    { currency: 'USD', rate: 73, onDate: '2026-06-20' },
    { currency: 'USD', rate: 75, onDate: '2026-07-01' },
  ]

  it('NEVER uses a rate from after the transaction', () => {
    // Valuing a past event with information nobody had at the time is what
    // makes a restated figure impossible to defend.
    const result = rateFor(quotes, 'USD', '2026-06-25')
    expect(result).toMatchObject({ rate: 73 })
  })

  it('flags a stale rate rather than refusing it', () => {
    // An old rate is usually all a shop has; knowing it is old beats being
    // blocked.
    const result = rateFor(quotes, 'USD', '2026-06-19')
    expect(result).toMatchObject({ rate: 70, isStale: true })
  })

  it('reports when there is no rate at all', () => {
    expect(rateFor(quotes, 'EUR', '2026-06-25')).toEqual({ error: 'RATE_NOT_FOUND' })
  })
})

// ══════════════════════════════════════════════ BANK RECONCILIATION

describe('matching a bank statement', () => {
  const line = (over: Partial<StatementLine> = {}): StatementLine => ({
    id: 'sl1',
    externalRef: 'BANK-9001',
    onDate: '2026-06-15',
    amountMinor: 50_000,
    description: 'TRANSFER FROM AHMAD PMT-1024',
    ...over,
  })

  const entry = (over: Partial<BookEntry> = {}): BookEntry => ({
    id: 'be1',
    kind: 'payment',
    onDate: '2026-06-15',
    amountMinor: 50_000,
    reference: 'PMT-1024',
    partyName: 'Ahmad',
    ...over,
  })

  it('NEVER matches opposite directions', () => {
    expect(scoreMatch(line(), entry({ amountMinor: -50_000 }))).toBeNull()
  })

  it('never matches across a month', () => {
    expect(scoreMatch(line(), entry({ onDate: '2026-04-15' }))).toBeNull()
  })

  it('scores our own reference appearing in the narrative highest', () => {
    const match = scoreMatch(line(), entry())!
    expect(match.reasons).toContain('exact_reference')
    expect(match.score).toBeGreaterThan(0.9)
  })

  it('CAPS confidence below certain without the bank reference', () => {
    // Only the bank quoting our reference earns certainty.
    const match = scoreMatch(
      line({ description: 'DEPOSIT' }),
      entry({ reference: 'X', partyName: null }),
    )!
    expect(match.score).toBeLessThanOrEqual(0.9)
  })

  it('MARKS AN AMBIGUOUS LINE instead of picking for you', () => {
    // Two invoices for the same amount from the same customer in one week is
    // completely ordinary, and the wrong guess sends a receipt to the wrong
    // invoice.
    const twins = [
      entry({ id: 'a', reference: 'A', partyName: null }),
      entry({ id: 'b', reference: 'B', partyName: null }),
    ]
    const [suggestion] = suggestMatches([line({ description: 'DEPOSIT' })], twins)
    expect(suggestion!.isAmbiguous).toBe(true)
  })

  it('is not ambiguous when one candidate is clearly better', () => {
    const candidates = [
      entry(),
      entry({ id: 'weak', reference: 'ZZZ', partyName: null, onDate: '2026-06-10' }),
    ]
    const [suggestion] = suggestMatches([line()], candidates)
    expect(suggestion!.isAmbiguous).toBe(false)
    expect(suggestion!.bookEntryId).toBe('be1')
  })

  it('never re-suggests something already matched', () => {
    expect(suggestMatches([line({ matchedTo: 'be1' })], [entry()])).toEqual([])
  })

  it('refuses to reconcile an unexplained difference', () => {
    // A difference is usually a bank charge, and writing it off is a real
    // accounting entry that has to land somewhere on purpose.
    expect(validateReconcile(line(), entry({ amountMinor: 49_500 }))).toContain(
      'RECONCILE_DIFFERENCE_UNEXPLAINED',
    )
  })

  it('accepts an explained difference', () => {
    expect(
      validateReconcile(line(), entry({ amountMinor: 49_500 }), {
        differenceReason: 'bank transfer charge',
      }),
    ).toEqual([])
  })

  it('ENUMERATES the difference rather than only stating it', () => {
    // "Out by 4,300" is a problem; "out by 4,300, which is these two uncleared
    // cheques" is a reconciliation.
    const summary = summariseReconciliation(
      [line({ id: 'u1', matchedTo: null, amountMinor: -3_000, description: 'CHEQUE 88' })],
      [entry({ id: 'u2', reconciledWith: null, amountMinor: -1_300, reference: 'CHQ-89' })],
      100_000,
      104_300,
    )
    expect(summary.differenceMinor).toBe(-4_300)
    expect(summary.reconcilingItems).toHaveLength(2)
  })

  it('keys a statement line on the bank reference so a re-import is idempotent', () => {
    expect(
      statementLineKey(
        { externalRef: 'BANK-9001', onDate: '2026-06-15', amountMinor: 1, description: 'x' },
        0,
      ),
    ).toBe('ref:BANK-9001')
  })

  it('falls back to position when the bank gives no reference', () => {
    const first = statementLineKey(
      { externalRef: null, onDate: '2026-06-15', amountMinor: 50_000, description: 'ATM' },
      0,
    )
    const second = statementLineKey(
      { externalRef: null, onDate: '2026-06-15', amountMinor: 50_000, description: 'ATM' },
      1,
    )
    expect(first).not.toBe(second)
  })
})

// ══════════════════════════════════════════════ DIMENSIONS

describe('accounting dimensions', () => {
  const values: DimensionValue[] = [
    {
      id: 'north',
      dimensionId: 'cost_center',
      code: 'N',
      name: 'North',
      parentId: null,
      isActive: true,
    },
    {
      id: 'shop-a',
      dimensionId: 'cost_center',
      code: 'A',
      name: 'Shop A',
      parentId: 'north',
      isActive: true,
    },
    {
      id: 'shop-b',
      dimensionId: 'cost_center',
      code: 'B',
      name: 'Shop B',
      parentId: 'north',
      isActive: false,
    },
    {
      id: 'proj-1',
      dimensionId: 'project',
      code: 'P1',
      name: 'Bridge',
      parentId: null,
      isActive: true,
    },
  ]

  const requirement = { dimensionId: 'cost_center', accountTypes: ['expense' as const] }

  it('REQUIRES A COST CENTRE ON EXPENSES, not on the bank account', () => {
    // "Every posting must name a cost centre" is unworkable and gets switched
    // off within a week.
    expect(
      requirementApplies(requirement, { accountId: 'a', accountType: 'expense', dimensions: {} }),
    ).toBe(true)
    expect(
      requirementApplies(requirement, { accountId: 'b', accountType: 'asset', dimensions: {} }),
    ).toBe(false)
  })

  it('refuses an expense posting with no cost centre', () => {
    expect(
      validateLine(
        { accountId: 'a', accountType: 'expense', dimensions: {} },
        [requirement],
        values,
      ),
    ).toContain('DIMENSION_REQUIRED')
  })

  it('accepts one that names a leaf value', () => {
    expect(
      validateLine(
        { accountId: 'a', accountType: 'expense', dimensions: { cost_center: 'shop-a' } },
        [requirement],
        values,
      ),
    ).toEqual([])
  })

  it('REFUSES posting to a group value', () => {
    // Posting to "North" when it contains three cost centres produces a total
    // nobody can break down — the opposite of why dimensions exist.
    expect(
      validateLine(
        { accountId: 'a', accountType: 'expense', dimensions: { cost_center: 'north' } },
        [requirement],
        values,
      ),
    ).toContain('DIMENSION_VALUE_IS_GROUP')
  })

  it('refuses an inactive value', () => {
    expect(
      validateLine(
        { accountId: 'a', accountType: 'expense', dimensions: { cost_center: 'shop-b' } },
        [requirement],
        values,
      ),
    ).toContain('DIMENSION_VALUE_INACTIVE')
  })

  it('refuses a value belonging to another dimension', () => {
    expect(
      validateLine(
        { accountId: 'a', accountType: 'expense', dimensions: { cost_center: 'proj-1' } },
        [requirement],
        values,
      ),
    ).toContain('DIMENSION_NOT_ALLOWED')
  })

  it('honours an explicit exception', () => {
    const withException = { ...requirement, exceptAccountIds: ['petty-cash'] }
    expect(
      requirementApplies(withException, {
        accountId: 'petty-cash',
        accountType: 'expense',
        dimensions: {},
      }),
    ).toBe(false)
  })

  it('reports on a group by covering everything under it', () => {
    expect(valueAndDescendants('north', values).sort()).toEqual(['north', 'shop-a', 'shop-b'])
  })
})

describe('a dimension breakdown must sum back to the account', () => {
  const values: DimensionValue[] = [
    {
      id: 'a',
      dimensionId: 'cost_center',
      code: 'A',
      name: 'Shop A',
      parentId: null,
      isActive: true,
    },
  ]

  const lines = [
    { dimensions: { cost_center: 'a' }, debitMinor: 60_000, creditMinor: 0 },
    { dimensions: {}, debitMinor: 40_000, creditMinor: 0 },
  ]

  it('COLLECTS UNTAGGED POSTINGS instead of dropping them', () => {
    // Dropping them makes the slices sum to less than the account and hides
    // exactly the postings somebody forgot to tag.
    const totals = totalsByDimension(lines, 'cost_center', values)
    expect(totals.map((t) => t.valueId).sort()).toEqual(['a', 'unassigned'])
  })

  it('sums back to the account total', () => {
    const totals = totalsByDimension(lines, 'cost_center', values)
    expect(coverageGapMinor(totals, 100_000)).toBe(0)
  })

  it('reports the gap when something is missing', () => {
    const partial = totalsByDimension([lines[0]!], 'cost_center', values)
    expect(coverageGapMinor(partial, 100_000)).toBe(40_000)
  })
})
