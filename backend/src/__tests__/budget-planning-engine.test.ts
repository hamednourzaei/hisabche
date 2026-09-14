// backend/src/__tests__/budget-planning-engine.test.ts
//
// The financial invariants of the budget engine. Pure functions, real numbers.

import { describe, expect, it } from 'vitest'

import {
  checkImpact,
  distributeByWeights,
  normalizeActual,
  distributionTotal,
  equalDistribution,
  findOverlap,
  openCommitments,
  performance,
  reviseBudget,
  theoreticalToDate,
  validateDistribution,
  type OverlapCandidate,
} from '../services/budgeting/budget.domain'

const base = { theoreticalMinor: 0, elapsedDays: 0, totalDays: 30 }

describe('remaining = budget − actual − open commitments', () => {
  it('120 − 20 − 10 = 90', () => {
    const p = performance({
      ...base,
      type: 'expense',
      budgetMinor: 120,
      actualMinor: 20,
      openCommitmentMinor: 10,
    })
    expect(p.remainingMinor).toBe(90)
  })

  it('⚠️ converting a commitment to actual does not move remaining (30, never 10)', () => {
    const before = openCommitments([{ amountMinor: 20, consumedMinor: 0, released: false }])
    const b = performance({
      ...base,
      type: 'expense',
      budgetMinor: 100,
      actualMinor: 50,
      openCommitmentMinor: before,
    })
    expect(b.remainingMinor).toBe(30)

    const after = openCommitments([{ amountMinor: 20, consumedMinor: 20, released: false }])
    const a = performance({
      ...base,
      type: 'expense',
      budgetMinor: 100,
      actualMinor: 70,
      openCommitmentMinor: after,
    })
    expect(after).toBe(0)
    expect(a.actualMinor).toBe(70)
    expect(a.remainingMinor).toBe(30)
  })

  it('released and partly consumed commitments', () => {
    expect(
      openCommitments([
        { amountMinor: 50, consumedMinor: 20, released: false },
        { amountMinor: 40, consumedMinor: 0, released: true },
      ]),
    ).toBe(30)
  })
})

describe('period distribution and theoretical', () => {
  const d = {
    periodStarts: ['2026-01-01', '2026-02-01', '2026-03-01'],
    amountsMinor: [10, 30, 60],
  }

  it('uneven distribution sums and validates', () => {
    validateDistribution(d)
    expect(distributionTotal(d)).toBe(100)
  })

  it('equal distribution keeps every unit', () => {
    const parts = equalDistribution(100, 12)
    expect(parts.reduce((s, x) => s + x, 0)).toBe(100)
    expect(parts).toHaveLength(12)
  })

  it('theoretical follows the distribution, not total / periods', () => {
    expect(theoreticalToDate(d, '2026-03-31', '2026-02-28')).toBe(40)
    expect(theoreticalToDate(d, '2026-03-31', '2025-12-31')).toBe(0)
    expect(theoreticalToDate(d, '2026-03-31', '2026-03-31')).toBe(100)
  })

  it('rejects negative and unordered lines', () => {
    expect(() =>
      validateDistribution({ periodStarts: ['2026-01-01'], amountsMinor: [-1] }),
    ).toThrow('BUDGET_AMOUNT_INVALID')
    expect(() =>
      validateDistribution({ periodStarts: ['2026-02-01', '2026-01-01'], amountsMinor: [1, 1] }),
    ).toThrow('BUDGET_DISTRIBUTION_INVALID')
  })
})

describe('variance semantics', () => {
  it('expense: budget − actual; theoretical 60, actual 75 → −15 to date', () => {
    const p = performance({
      type: 'expense',
      budgetMinor: 120,
      theoreticalMinor: 60,
      actualMinor: 75,
      openCommitmentMinor: 0,
      elapsedDays: 6,
      totalDays: 12,
    })
    expect(p.varianceMinor).toBe(45)
    expect(p.varianceToDateMinor).toBe(-15)
  })

  it('revenue: actual − budget, positive above target', () => {
    const p = performance({
      type: 'revenue',
      budgetMinor: 100,
      theoreticalMinor: 50,
      actualMinor: 130,
      openCommitmentMinor: 0,
      elapsedDays: 1,
      totalDays: 1,
    })
    expect(p.varianceMinor).toBe(30)
    expect(p.remainingMinor).toBe(-30)
  })
})

describe('forecast baseline', () => {
  it('plan_remaining when on plan', () => {
    const p = performance({
      type: 'expense',
      budgetMinor: 120,
      theoreticalMinor: 60,
      actualMinor: 50,
      openCommitmentMinor: 5,
      elapsedDays: 6,
      totalDays: 12,
    })
    expect(p.forecastMethod).toBe('plan_remaining')
    expect(p.forecastMinor).toBe(50 + 5 + 60)
  })

  it('run_rate when spending ahead of plan, and flags overrun', () => {
    const p = performance({
      type: 'expense',
      budgetMinor: 120,
      theoreticalMinor: 10,
      actualMinor: 70,
      openCommitmentMinor: 0,
      elapsedDays: 3,
      totalDays: 12,
    })
    expect(p.forecastMethod).toBe('run_rate')
    expect(p.forecastMinor).toBe(280)
    expect(p.forecastVarianceMinor).toBe(-160)
  })
})

describe('control policy', () => {
  const state = { budgetMinor: 100, actualMinor: 50, openCommitmentMinor: 20 }

  it('available 30, new 80 → exceeded by 50', () => {
    const r = checkImpact('warn', state, 80)
    expect(r.availableMinor).toBe(30)
    expect(r.exceededByMinor).toBe(50)
  })

  it('WARN / BLOCK / APPROVAL / within budget', () => {
    expect(checkImpact('warn', state, 80).decision).toBe('warn')
    expect(checkImpact('block', state, 80).decision).toBe('block')
    expect(checkImpact('approval', state, 80).decision).toBe('require_approval')
    expect(checkImpact('block', state, 30).decision).toBe('allow')
  })
})

describe('edges', () => {
  it('zero budget and zero actual', () => {
    const z = performance({
      ...base,
      type: 'expense',
      budgetMinor: 0,
      actualMinor: 0,
      openCommitmentMinor: 0,
    })
    expect(z.state).toBe('ok')
    expect(
      checkImpact('block', { budgetMinor: 0, actualMinor: 0, openCommitmentMinor: 0 }, 1).decision,
    ).toBe('block')
  })

  it('large monetary values stay exact', () => {
    const big = 1_200_000_000_00
    const parts = equalDistribution(big, 12)
    expect(parts.reduce((s, x) => s + x, 0)).toBe(big)
    const p = performance({
      ...base,
      type: 'expense',
      budgetMinor: big,
      actualMinor: big - 1,
      openCommitmentMinor: 1,
    })
    expect(p.remainingMinor).toBe(0)
  })
})

describe('revision and overlap', () => {
  it('revision keeps history and needs a reason', () => {
    const r = reviseBudget(
      { version: 1, status: 'approved', linesMinor: { total: 100 } },
      { total: 130 },
      { reason: 'expansion', actorId: 'u1', at: '2026-09-14T00:00:00Z' },
    )
    expect(r).toMatchObject({
      version: 2,
      previousVersion: 1,
      lines: [{ lineKey: 'total', beforeMinor: 100, afterMinor: 130 }],
    })
    expect(() =>
      reviseBudget(
        { version: 1, status: 'draft', linesMinor: {} },
        { total: 1 },
        { reason: 'x', actorId: 'u', at: '' },
      ),
    ).toThrow('BUDGET_REVISION_REQUIRES_APPROVED')
    expect(() =>
      reviseBudget(
        { version: 1, status: 'approved', linesMinor: { total: 1 } },
        { total: 2 },
        { reason: ' ', actorId: 'u', at: '' },
      ),
    ).toThrow('BUDGET_REVISION_REASON_REQUIRED')
  })

  it('approved budgets on the same scope may not overlap', () => {
    const a: OverlapCandidate = {
      id: 'a',
      accountId: 'acc',
      type: 'expense',
      startsOn: '2026-01-01',
      endsOn: '2026-12-31',
      status: 'approved',
    }
    expect(
      findOverlap({ ...a, id: 'b', startsOn: '2026-06-01', endsOn: '2027-05-31' }, [a])?.id,
    ).toBe('a')
    expect(findOverlap({ ...a, id: 'b', branchId: 'kabul' }, [a])).toBeNull()
    expect(findOverlap({ ...a, id: 'b', status: 'draft' }, [a])).toBeNull()
  })
})

describe('ledger sign → budget sign (the one place)', () => {
  it('expense: debit − credit is spend; a refund gives budget back', () => {
    expect(normalizeActual('expense', 5_000)).toBe(5_000)
    expect(normalizeActual('expense', -1_000)).toBe(-1_000)
  })

  it('revenue: credit is income, so the ledger net flips', () => {
    expect(normalizeActual('revenue', -8_000)).toBe(8_000)
    expect(normalizeActual('revenue', 500)).toBe(-500)
    expect(normalizeActual('revenue', 0)).toBe(0)
  })

  it('favourable and unfavourable variance for both types', () => {
    const run = (type: 'expense' | 'revenue', actual: number) =>
      performance({ ...base, type, budgetMinor: 100, actualMinor: actual, openCommitmentMinor: 0 })
        .varianceMinor
    expect(run('expense', 60)).toBe(40)
    expect(run('expense', 130)).toBe(-30)
    expect(run('revenue', 130)).toBe(30)
    expect(run('revenue', 60)).toBe(-40)
    expect(run('expense', 0)).toBe(100)
    expect(run('revenue', 0)).toBe(-100)
  })
})

describe('percentage distribution', () => {
  it('uneven weights sum exactly, no lost minor units', () => {
    const w = [500, 500, 700, 800, 900, 1000, 1000, 1000, 1000, 900, 900, 800]
    expect(w.reduce((a, b) => a + b, 0)).toBe(10_000)
    const parts = distributeByWeights(1_000_001, w)
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1_000_001)
    expect(parts[0]).toBe(50_000)
  })

  it('10% + 20% → theoretical 30% at the end of the second period', () => {
    const amounts = distributeByWeights(1_000, [1_000, 2_000, 7_000])
    const d = { periodStarts: ['2026-01-01', '2026-02-01', '2026-03-01'], amountsMinor: amounts }
    expect(theoreticalToDate(d, '2026-03-31', '2026-02-28')).toBe(300)
  })

  it('rejects a total that is not 100%', () => {
    expect(() => distributeByWeights(100, [5_000, 4_000])).toThrow(
      'BUDGET_DISTRIBUTION_PERCENT_INVALID',
    )
  })

  it('remainder is deterministic', () => {
    expect(distributeByWeights(10, [3_333, 3_333, 3_334])).toEqual(
      distributeByWeights(10, [3_333, 3_333, 3_334]),
    )
    expect(distributeByWeights(10, [3_333, 3_333, 3_334]).reduce((a, b) => a + b, 0)).toBe(10)
  })

  it('leap-year February is prorated by its real 29 days', () => {
    const d = { periodStarts: ['2028-02-01'], amountsMinor: [2_900] }
    expect(theoreticalToDate(d, '2028-02-29', '2028-02-10')).toBe(1_000)
  })
})

describe('forecast with no data', () => {
  it('before the period starts there is no forecast, not a fake one', () => {
    const p = performance({
      ...base,
      type: 'expense',
      budgetMinor: 100,
      actualMinor: 0,
      openCommitmentMinor: 0,
    })
    expect(p.forecastMethod).toBe('insufficient_data')
    expect(p.forecastMinor).toBeNull()
    expect(p.forecastVarianceMinor).toBeNull()
  })
})

describe('commitment invariant with budget 50', () => {
  it('50 − 0 − 20 = 30; after conversion 50 − 20 − 0 = 30', () => {
    const before = performance({
      ...base,
      type: 'expense',
      budgetMinor: 50,
      actualMinor: 0,
      openCommitmentMinor: openCommitments([
        { amountMinor: 20, consumedMinor: 0, released: false },
      ]),
    })
    const after = performance({
      ...base,
      type: 'expense',
      budgetMinor: 50,
      actualMinor: 20,
      openCommitmentMinor: openCommitments([
        { amountMinor: 20, consumedMinor: 20, released: false },
      ]),
    })
    expect(before.remainingMinor).toBe(30)
    expect(after.remainingMinor).toBe(30)
  })
})

import { convertParts } from '../services/budgeting/budget.service'

describe('foreign-currency budget entry', () => {
  it('converted parts still sum exactly to the converted total', () => {
    // 1,000.00 USD split 3/3/4 at 70.37 AFN
    const rate = 70.37
    const total = Math.round(100_000 * rate)
    const parts = convertParts([33_333, 33_333, 33_334], rate, total)
    expect(parts.reduce((s, x) => s + x, 0)).toBe(total)
  })
})
