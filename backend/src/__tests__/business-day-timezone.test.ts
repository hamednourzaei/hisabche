import { describe, it, expect } from 'vitest'
import { businessDayOf } from '../utils/local-day'

describe('BUG-NEW-002: businessDayOf timezone calculations', () => {
  it('correctly maps 21:00 UTC to next day for Kabul and Tehran timezones', () => {
    // 2026-10-31T21:00:00Z is:
    // UTC: 2026-10-31
    // Kabul (+04:30): 2026-11-01 01:30
    // Tehran (+03:30): 2026-11-01 00:30
    const eveningUtc = new Date('2026-10-31T21:00:00.000Z')

    const dayKabul = businessDayOf(eveningUtc, 'Asia/Kabul')
    expect(dayKabul).toBe('2026-11-01')

    const dayTehran = businessDayOf(eveningUtc, 'Asia/Tehran')
    expect(dayTehran).toBe('2026-11-01')

    const dayUtc = businessDayOf(eveningUtc, 'UTC')
    expect(dayUtc).toBe('2026-10-31')
  })

  it('falls back safely when timezone is undefined or empty', () => {
    const middayUtc = new Date('2026-10-31T12:00:00.000Z')
    const dayDefault = businessDayOf(middayUtc)
    expect(dayDefault).toBe('2026-10-31')
  })
})
