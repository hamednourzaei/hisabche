// ============================================
// The sales line sits on zero on a day without sales, and rises on a sale.
//
// The endpoint returns only days that HAD sales, so the chart joined them
// straight across the empty days (a quiet week drawn as a steady line), and a
// single sale was a lone dot with no line at all.
// ============================================

import { describe, expect, it } from 'vitest'

import { fillDailyGaps, type SalesDataPoint } from '../hooks/dashboard'

const sale = (
  date: string,
  value: number,
  extra: Partial<SalesDataPoint> = {},
): SalesDataPoint => ({
  label: date,
  value,
  date,
  ...extra,
})

describe('fillDailyGaps', () => {
  it('one point per day across the range, zero where nothing was sold', () => {
    const out = fillDailyGaps([sale('2026-09-23', 150_000)], '2026-09-20', '2026-09-25')
    expect(out.map((p) => [p.date, p.value])).toEqual([
      ['2026-09-20', 0],
      ['2026-09-21', 0],
      ['2026-09-22', 0],
      ['2026-09-23', 150_000],
      ['2026-09-24', 0],
      ['2026-09-25', 0],
    ])
  })

  it('an empty answer is a flat line at zero, not nothing', () => {
    const out = fillDailyGaps([], '2026-09-01', '2026-09-03')
    expect(out.map((p) => p.value)).toEqual([0, 0, 0])
  })

  it("keeps the server's own point untouched, including its extra series", () => {
    const real = sale('2026-09-02', 10, { invoiceCount: 2, customerCount: 1 })
    const out = fillDailyGaps([real], '2026-09-01', '2026-09-03')
    expect(out[1]).toBe(real)
    // …and a series the server sent is zero on the filled days, not missing.
    expect(out[0]).toMatchObject({ value: 0, invoiceCount: 0, customerCount: 0 })
  })

  it('does not invent a series the server did not send', () => {
    const out = fillDailyGaps([sale('2026-09-02', 10)], '2026-09-01', '2026-09-03')
    expect(out[0]).not.toHaveProperty('invoiceCount')
    expect(out[0]).not.toHaveProperty('customerCount')
  })

  it('crosses month and year ends', () => {
    const out = fillDailyGaps([], '2026-12-30', '2027-01-02')
    expect(out.map((p) => p.date)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
  })

  it('leaves the data alone when the range is unusable', () => {
    const points = [sale('2026-09-02', 10)]
    expect(fillDailyGaps(points, 'nonsense', '2026-09-03')).toBe(points)
    expect(fillDailyGaps(points, '2026-09-05', '2026-09-01')).toBe(points)
  })
})
