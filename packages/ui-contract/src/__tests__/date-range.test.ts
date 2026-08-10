// ============================================
// "Last 7 days" must mean the same seven days in the browser and on a phone.
// If the two resolve differently, the same labelled period shows different
// totals per device and the numbers look wrong rather than merely different.
//
// `now` is injected, so these pin the arithmetic rather than the clock.
// ============================================

import { describe, expect, it } from 'vitest'

import { COMPACT_PRESETS, presetRange } from '../date-range'

// A Wednesday mid-month, mid-year — far from any boundary that could mask an
// off-by-one.
const NOW = new Date(2026, 7, 12, 15, 30, 0)

const day = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

describe('presetRange', () => {
  it('counts day ranges inclusive of today', () => {
    // "7 days" is today plus the six before it, which is what the web picker
    // has always produced. Seven days back would silently widen every KPI.
    const range = presetRange('7days', NOW)

    expect(day(range.from)).toBe('2026-8-6')
    expect(day(range.to)).toBe('2026-8-12')
  })

  it('spans the whole day at both ends', () => {
    const range = presetRange('today', NOW)

    expect(range.from.getHours()).toBe(0)
    expect(range.from.getMinutes()).toBe(0)
    expect(range.to.getHours()).toBe(23)
    expect(range.to.getMilliseconds()).toBe(999)
  })

  it('gives yesterday its own day, not a range ending today', () => {
    const range = presetRange('yesterday', NOW)

    expect(day(range.from)).toBe('2026-8-11')
    expect(day(range.to)).toBe('2026-8-11')
  })

  it('starts this month on the first', () => {
    const range = presetRange('thisMonth', NOW)

    expect(day(range.from)).toBe('2026-8-1')
    expect(day(range.to)).toBe('2026-8-12')
  })

  it('ends last month on its final day, not on the first of this one', () => {
    const range = presetRange('lastMonth', NOW)

    expect(day(range.from)).toBe('2026-7-1')
    expect(day(range.to)).toBe('2026-7-31')
  })

  it('handles a last-month boundary across a year change', () => {
    const january = new Date(2026, 0, 15, 9, 0, 0)
    const range = presetRange('lastMonth', january)

    expect(day(range.from)).toBe('2025-12-1')
    expect(day(range.to)).toBe('2025-12-31')
  })

  it('bounds last year to that calendar year', () => {
    const range = presetRange('lastYear', NOW)

    expect(day(range.from)).toBe('2025-1-1')
    expect(day(range.to)).toBe('2025-12-31')
  })

  it('is pure — the same preset and clock always give the same range', () => {
    expect(presetRange('30days', NOW)).toEqual(presetRange('30days', NOW))
  })

  it('offers only presets it can actually resolve', () => {
    for (const preset of COMPACT_PRESETS) {
      const range = presetRange(preset.key, NOW)

      expect(range.from.getTime()).toBeLessThanOrEqual(range.to.getTime())
      expect(preset.labelKey.startsWith('dateRange.')).toBe(true)
    }
  })
})
