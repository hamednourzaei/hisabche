// ============================================
// Capability #69 — the month-end package, end to end through the service.
//
// ⚠️ WHY THIS FILE EXISTS ALONGSIDE `month-end-package.test.ts`.
//
// That file tests the RULES: the order, and the stop condition. This one tests
// that the service obeys them — that it calls the engines in the declared order,
// that a failing engine stops the run before the lock, and that a step which
// THROWS is reported rather than escaping and aborting the whole request.
//
// Those are different failures. A service can honour `decideMonthEnd` perfectly
// and still call `setPeriodLock` on the way out because of how its branches are
// written. The domain tests cannot see that; these can.
//
// ⚠️ THE ENGINES ARE STUBBED, NOT MOCKED AWAY.
//
// Each stub records that it ran and returns a shape the real one returns, so
// the service's own branching is exercised against realistic values — a real
// `postDue` returns `{posted, skipped}` and a real `revalue` returns `lines`.
// A stub returning `undefined` would make the service's `result.posted.length`
// throw and prove nothing.
// ============================================

import { describe, expect, it, vi } from 'vitest'

const calls: string[] = []
/** Shaped like the real `postDue` return, so the service's branches see real values. */
type DueResult = {
  posted: { assetId: string; period: number; amountMinor: number }[]
  skipped: { assetId: string; period: number; reason: string }[]
}
let postDueResult: DueResult = {
  posted: [{ assetId: 'a', period: 1, amountMinor: 100 }],
  skipped: [],
}
let revalueResult = { lines: [{ currency: 'USD' }], netDifferenceMinor: 250 }
let repostResult = {
  fromDate: '2026-09-01',
  examined: 4,
  adjustments: [],
  posted: 2,
  netPostedMinor: -500,
}
let throwOn: string | null = null

vi.mock('../services/inventory-costing/repost.service', () => ({
  repostCosts: vi.fn(async () => {
    calls.push('cost_repost')
    if (throwOn === 'cost_repost') throw new Error('cost trail unreadable')
    return repostResult
  }),
}))

vi.mock('../services/assets/assets.service', () => ({
  AssetsService: class {
    async postDue() {
      calls.push('depreciation')
      if (throwOn === 'depreciation') throw new Error('asset has no accounts')
      return postDueResult
    }
  },
}))

vi.mock('../services/currency/currency.service', () => ({
  CurrencyService: class {
    async revalue() {
      calls.push('fx_revaluation')
      if (throwOn === 'fx_revaluation') throw new Error('no rate for PKR')
      return revalueResult
    }
  },
}))

const { runMonthEnd, monthEndContext } = await import('../services/accounting/month-end.service')

const accountingStub = () => ({
  postYearEndClose: vi.fn(async () => {
    calls.push('year_end_close')
    return {}
  }),
  setPeriodLock: vi.fn(async () => {
    calls.push('period_lock')
    return {}
  }),
})

const run = (input: Partial<Parameters<typeof runMonthEnd>[1]> = {}) =>
  runMonthEnd(
    monthEndContext('ws-1'),
    { fromDate: '2026-09-01', toDate: '2026-09-30', fiscalYearEnd: '12-31', ...input },
    accountingStub(),
  )

describe('#69 — the service calls the engines in order', () => {
  it('depreciation runs before revaluation, and the lock runs last', async () => {
    calls.length = 0
    await run()

    expect(calls).toEqual(['depreciation', 'fx_revaluation', 'cost_repost', 'period_lock'])
  })

  it('closes the year only in the closing month', async () => {
    calls.length = 0
    const accounting = accountingStub()

    await runMonthEnd(
      monthEndContext('ws-1'),
      { fromDate: '2026-09-01', toDate: '2026-09-30', fiscalYearEnd: '12-31' },
      accounting,
    )

    expect(calls).not.toContain('year_end_close')
    expect(accounting.postYearEndClose).not.toHaveBeenCalled()
  })

  it('closes the year in December', async () => {
    calls.length = 0
    const accounting = accountingStub()

    await runMonthEnd(
      monthEndContext('ws-1'),
      { fromDate: '2026-12-01', toDate: '2026-12-31', fiscalYearEnd: '12-31' },
      accounting,
    )

    expect(calls).toEqual([
      'depreciation',
      'fx_revaluation',
      'cost_repost',
      'year_end_close',
      'period_lock',
    ])
    expect(accounting.postYearEndClose).toHaveBeenCalledWith(
      expect.anything(),
      '2026-12-01',
      '2026-12-31',
    )
  })

  it('lock:false runs everything but does not seal the period', async () => {
    calls.length = 0
    const accounting = accountingStub()

    const result = await runMonthEnd(
      monthEndContext('ws-1'),
      { fromDate: '2026-09-01', toDate: '2026-09-30', fiscalYearEnd: '12-31', lock: false },
      accounting,
    )

    expect(calls).not.toContain('period_lock')
    expect(accounting.setPeriodLock).not.toHaveBeenCalled()
    expect(result.locked).toBe(false)
  })
})

describe('#69 — a failing step stops the run before the lock', () => {
  it('depreciation failing means nothing else runs, and the lock is withheld', async () => {
    calls.length = 0
    throwOn = 'depreciation'
    const accounting = accountingStub()

    const result = await runMonthEnd(
      monthEndContext('ws-1'),
      { fromDate: '2026-09-01', toDate: '2026-09-30', fiscalYearEnd: '12-31' },
      accounting,
    )

    expect(calls).toEqual(['depreciation'])
    expect(accounting.setPeriodLock).not.toHaveBeenCalled()
    expect(result.locked).toBe(false)
    expect(result.failedAt).toBe('depreciation')

    throwOn = null
  })

  it('revaluation failing withholds the lock even though depreciation succeeded', async () => {
    // ⚠️ The realistic month-end. Depreciation is already posted and must not be
    // rolled back; the lock is withheld so the period stays repairable.
    calls.length = 0
    throwOn = 'fx_revaluation'
    const accounting = accountingStub()

    const result = await runMonthEnd(
      monthEndContext('ws-1'),
      { fromDate: '2026-09-01', toDate: '2026-09-30', fiscalYearEnd: '12-31' },
      accounting,
    )

    expect(calls).toEqual(['depreciation', 'fx_revaluation'])
    expect(accounting.setPeriodLock).not.toHaveBeenCalled()
    expect(result.failedAt).toBe('fx_revaluation')
    // The successful step is still reported — it really happened.
    expect(result.outcomes.find((o) => o.step === 'depreciation')?.status).toBe('ok')

    throwOn = null
  })

  it('cost repost failing also withholds the lock', async () => {
    // ⚠️ Re-posting writes real entries, so a failure here is a real hole in the
    // period — the same reason depreciation failing withholds it.
    calls.length = 0
    throwOn = 'cost_repost'
    const accounting = accountingStub()

    const result = await runMonthEnd(
      monthEndContext('ws-1'),
      { fromDate: '2026-09-01', toDate: '2026-09-30', fiscalYearEnd: '12-31' },
      accounting,
    )

    expect(calls).toEqual(['depreciation', 'fx_revaluation', 'cost_repost'])
    expect(accounting.setPeriodLock).not.toHaveBeenCalled()
    expect(result.failedAt).toBe('cost_repost')

    throwOn = null
  })
})

describe('#69 — an empty month still closes', () => {
  it('a shop with nothing to depreciate, revalue or re-post still locks', async () => {
    calls.length = 0
    postDueResult = { posted: [], skipped: [] }
    revalueResult = { lines: [], netDifferenceMinor: 0 }
    repostResult = {
      fromDate: '2026-09-01',
      examined: 0,
      adjustments: [],
      posted: 0,
      netPostedMinor: 0,
    }

    const result = await run()

    expect(result.outcomes.find((o) => o.step === 'depreciation')?.status).toBe('nothing_to_do')
    expect(result.outcomes.find((o) => o.step === 'fx_revaluation')?.status).toBe('nothing_to_do')
    expect(result.outcomes.find((o) => o.step === 'cost_repost')?.status).toBe('nothing_to_do')
    // ⚠️ THE POINT OF THIS TEST: the small shop most of this product's users are
    // can close its month. Treating "nothing to do" as failure would make
    // month-end impossible for exactly the shops it was built for.
    expect(result.locked).toBe(true)

    postDueResult = { posted: [{ assetId: 'a', period: 1, amountMinor: 100 }], skipped: [] }
    revalueResult = { lines: [{ currency: 'USD' }], netDifferenceMinor: 250 }
    repostResult = {
      fromDate: '2026-09-01',
      examined: 4,
      adjustments: [],
      posted: 2,
      netPostedMinor: -500,
    }
  })

  it('a skip is reported with its reason, not swallowed', async () => {
    calls.length = 0
    postDueResult = {
      posted: [],
      skipped: [{ assetId: 'a', period: 1, reason: 'ACCOUNTS_NOT_SET' }],
    }

    const result = await run()
    expect(result.outcomes.find((o) => o.step === 'depreciation')?.detail).toContain(
      'ACCOUNTS_NOT_SET',
    )

    postDueResult = { posted: [{ assetId: 'a', period: 1, amountMinor: 100 }], skipped: [] }
  })
})
