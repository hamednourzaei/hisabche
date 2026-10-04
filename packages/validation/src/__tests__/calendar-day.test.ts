// ============================================
// «The same day every month» in the solar Hijri calendar and in the Gregorian
// one. The Persian dates below are fixed points of the real calendar
// (1 Farvardin 1405 = 21 March 2026; 1 Mehr 1405 = 23 September 2026).
// ============================================

import { describe, expect, it } from 'vitest'

import {
  addIsoDays,
  calendarDay,
  isLastDayOfMonth,
  isMonthlySlot,
  monthBounds,
} from '../schemas/calendar-day'

describe('calendarDay', () => {
  it('reads a Gregorian day as itself', () => {
    expect(calendarDay('2026-10-04', 'gregory')).toEqual({ year: 2026, month: 10, day: 4 })
  })

  it('reads the solar Hijri date of an ISO day', () => {
    expect(calendarDay('2026-03-21', 'persian')).toEqual({ year: 1405, month: 1, day: 1 })
    expect(calendarDay('2026-09-23', 'persian')).toEqual({ year: 1405, month: 7, day: 1 })
    expect(calendarDay('2026-10-04', 'persian')).toEqual({ year: 1405, month: 7, day: 12 })
  })

  it('takes an instant’s date part, and reads it as a UTC day', () => {
    expect(calendarDay('2026-09-23T00:00:00.000Z', 'persian').day).toBe(1)
  })
})

describe('addIsoDays', () => {
  it('crosses months, years and February without string arithmetic', () => {
    expect(addIsoDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addIsoDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addIsoDays('2028-03-01', -1)).toBe('2028-02-29')
  })
})

describe('isMonthlySlot', () => {
  it('the 1st of a Persian month is NOT the 1st of a Gregorian one', () => {
    // 1 Mehr, 1 Aban, 1 Azar 1405
    for (const day of ['2026-09-23', '2026-10-23', '2026-11-22']) {
      expect(isMonthlySlot(day, 1, 'persian'), day).toBe(true)
      expect(isMonthlySlot(day, 1, 'gregory'), day).toBe(false)
    }
    expect(isMonthlySlot('2026-10-01', 1, 'persian')).toBe(false)
    expect(isMonthlySlot('2026-10-01', 1, 'gregory')).toBe(true)
  })

  it('exactly one day of every Persian month of a year is the slot for «the 31st»', () => {
    // The first six months have 31 days; the next five 30; Esfand 29 or 30. A
    // rule on the 31st must still fire once in each — on the last day.
    let slots = 0
    for (let day = '2026-03-21'; day < '2027-03-21'; day = addIsoDays(day, 1)) {
      if (isMonthlySlot(day, 31, 'persian')) slots += 1
    }
    expect(slots).toBe(12)
  })

  it('exactly one day of every Gregorian month is the slot for «the 31st»', () => {
    let slots = 0
    for (let day = '2026-01-01'; day < '2027-01-01'; day = addIsoDays(day, 1)) {
      if (isMonthlySlot(day, 31, 'gregory')) slots += 1
    }
    expect(slots).toBe(12)
  })

  it('a day that exists in the month is that day only — no early «last day» match', () => {
    // 30 Mehr exists (Mehr has 30 days): the 29th must not match «the 30th».
    expect(isMonthlySlot('2026-10-21', 30, 'persian')).toBe(false)
    expect(isMonthlySlot('2026-10-22', 30, 'persian')).toBe(true)
  })
})

describe('monthBounds', () => {
  it('a Gregorian month', () => {
    expect(monthBounds('2026-02-14', 'gregory')).toMatchObject({
      from: '2026-02-01',
      to: '2026-02-28',
      month: 2,
    })
  })

  it('a Persian month spans two Gregorian ones', () => {
    // Mehr 1405: 23 September – 22 October 2026.
    expect(monthBounds('2026-10-04', 'persian')).toEqual({
      from: '2026-09-23',
      to: '2026-10-22',
      month: 7,
      year: 1405,
    })
  })

  it('the last day of a month is its own upper bound', () => {
    expect(isLastDayOfMonth('2026-10-22', 'persian')).toBe(true)
    expect(monthBounds('2026-10-22', 'persian').to).toBe('2026-10-22')
  })

  it('Esfand, the last month, ends the day before Nowruz', () => {
    const esfand = monthBounds('2027-03-01', 'persian')
    expect(esfand.month).toBe(12)
    expect(calendarDay(addIsoDays(esfand.to, 1), 'persian')).toMatchObject({ month: 1, day: 1 })
  })
})
