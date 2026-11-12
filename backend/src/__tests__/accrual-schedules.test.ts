import { describe, expect, it } from 'vitest'
import { buildAccrualPeriods } from '@hisabche/validation'

describe('B.2.4 Accrual schedules & auto-reversing journals', () => {
  it('splits total minor units across N periods with exact remainder on final period', () => {
    const periods = buildAccrualPeriods(1000, 3, '2026-01-01')
    expect(periods).toEqual([
      { periodIndex: 1, periodDate: '2026-01-01', amountMinor: 333 },
      { periodIndex: 2, periodDate: '2026-02-01', amountMinor: 333 },
      { periodIndex: 3, periodDate: '2026-03-01', amountMinor: 334 },
    ])
    expect(periods.reduce((s, p) => s + p.amountMinor, 0)).toBe(1000)
  })
})
