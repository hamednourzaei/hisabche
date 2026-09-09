// ============================================
// The calendar follows the language. It did not.
//
// ---------------------------------------------------------------------------
// ⚠️ WHAT WAS BEING SHOWN
//
// Dates were formatted with a hardcoded `'fa-AF'` across the app — including
// inside `packages/ui/src/lib/utils.ts#formatDate`, whose own doc comment
// promised «Jalali (Shamsi) or Gregorian» while taking no language at all.
//
// So the calendar was a constant, not a consequence of the reader's choice:
// an English user got the Afghan solar calendar in Persian digits, and an
// Iranian Persian user got «سنبله» where their calendar says «شهریور» — the
// right calendar with the wrong month names, which reads as a typo rather
// than as a bug and so was never reported as one.
//
// These assertions are about ICU output, not about our arithmetic: nothing in
// this package converts a calendar by hand. Reimplementing Jalali leap years
// is how a date silently drifts by a day once a cycle.
// ============================================

import { describe, expect, it } from 'vitest'

import { formatDate, formatDateLong, formatDateTime, toIsoDay } from '../dates'

// 2026-09-09 — Gregorian. 18 Shahrivar / 18 Sonbola 1405 in the solar Hijri
// calendar. Noon UTC so no timezone can move it across a day boundary.
const DAY = '2026-09-09T12:00:00.000Z'

describe('the calendar follows the language', () => {
  it('⚠️ Persian (fa) uses Iranian month names', () => {
    expect(formatDateLong(DAY, 'fa')).toContain('شهریور')
  })

  it('⚠️ Dari (af) uses Afghan month names', () => {
    // The bug: every locale got this one, including English.
    expect(formatDateLong(DAY, 'af')).toContain('سنبله')
  })

  it('⚠️ English uses the Gregorian calendar', () => {
    const formatted = formatDateLong(DAY, 'en')
    expect(formatted).toContain('September')
    expect(formatted).toContain('2026')
  })

  it('fa and af are the same calendar with different names', () => {
    // Both are solar Hijri — the year agrees, the month name does not. This is
    // exactly why `resolveIntlLocale` must not collapse `af` onto `fa-IR`.
    expect(formatDateLong(DAY, 'fa')).not.toEqual(formatDateLong(DAY, 'af'))
    expect(formatDateLong(DAY, 'fa')).toContain('۱۴۰۵')
    expect(formatDateLong(DAY, 'af')).toContain('۱۴۰۵')
  })

  it('an unknown language falls back to Persian, as the rest of the app does', () => {
    expect(formatDateLong(DAY, 'ps')).toEqual(formatDateLong(DAY, 'fa'))
  })
})

describe('a value that is not a date', () => {
  it.each([null, undefined, '', 'not a date', NaN])(
    '⚠️ %s renders as empty, never «Invalid Date»',
    (value) => {
      // `new Date(undefined).toLocaleDateString()` returns the STRING «Invalid
      // Date», which is truthy, passes every falsy check, and ends up printed on
      // an invoice.
      expect(formatDate(value as never, 'fa')).toBe('')
      expect(formatDateTime(value as never, 'fa')).toBe('')
    },
  )

  it('never invents today', () => {
    // Falling back to `new Date()` would put a plausible, wrong date on a
    // record that has none.
    expect(formatDate(null, 'en')).not.toContain('20')
  })
})

describe('the machine-readable day', () => {
  it('⚠️ is always Gregorian, whatever the UI language', () => {
    // This value goes into query strings, `<input type="date">` and Postgres.
    // A Jalali «۱۴۰۵-۰۶-۱۸» there is either a parse error or a date six
    // hundred years in the past.
    expect(toIsoDay(new Date(2026, 8, 9))).toBe('2026-09-09')
  })

  it('pads month and day', () => {
    expect(toIsoDay(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('is empty for a missing value', () => {
    expect(toIsoDay(null)).toBe('')
  })
})

describe('formatters are reused', () => {
  it('a thousand rows do not build a thousand formatters', () => {
    // Constructing `Intl.DateTimeFormat` is the expensive part and it is why
    // this helper exists rather than a `toLocaleDateString` per cell.
    const start = Date.now()
    for (let i = 0; i < 5000; i++) formatDate(DAY, 'fa')
    expect(Date.now() - start).toBeLessThan(2000)
  })
})
