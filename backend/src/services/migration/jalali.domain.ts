// ============================================
// backend/src/services/migration/jalali.domain.ts
//
// Solar Hijri (Jalali) dates, as they are typed into spreadsheets in Iran and
// Afghanistan, read as Gregorian days. Pure arithmetic; no clock, no locale.
// ============================================

import { normalizeDigits, normalizeText } from './migration.domain'

/* ─── Dates: Solar Hijri as well as Gregorian ─────────────────────────────── */

/**
 * A Solar Hijri (Jalali) date as a Gregorian `[year, month, day]`.
 *
 * The 33-year arithmetic every Jalali library uses; exact for the years a
 * ledger can hold (1200–1500). Iran's and Afghanistan's calendars are this one
 * calendar with different month names, so one conversion serves both.
 */
export function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  const year = jy + 1595
  let days =
    -355668 +
    365 * year +
    Math.floor(year / 33) * 8 +
    Math.floor(((year % 33) + 3) / 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186)

  let gy = 400 * Math.floor(days / 146097)
  days %= 146097
  if (days > 36524) {
    days -= 1
    gy += 100 * Math.floor(days / 36524)
    days %= 36524
    if (days >= 365) days += 1
  }
  gy += 4 * Math.floor(days / 1461)
  days %= 1461
  if (days > 365) {
    gy += Math.floor((days - 1) / 365)
    days = (days - 1) % 365
  }

  let gd = days + 1
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let gm = 0
  while (gm < 12 && gd > (lengths[gm] ?? 31)) {
    gd -= lengths[gm] ?? 31
    gm += 1
  }
  return [gy, gm + 1, gd]
}

const isoOf = (parts: [number, number, number]): string =>
  `${String(parts[0]).padStart(4, '0')}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`

export type JalaliParse =
  { ok: true; iso: string } | { ok: false; reason: 'NOT_JALALI' | 'OUT_OF_RANGE' }

/**
 * `1403/07/10` (in any digits, with / . or -) as a Gregorian ISO day.
 *
 * ⚠️ The calendar is read from the YEAR, not from a setting: 1200–1500 can
 * only be Solar Hijri, 1900 and up can only be Gregorian, and no real ledger
 * has a date in between. That is what lets one column hold either without
 * anyone being asked.
 */
export function parseJalaliIso(raw: string): JalaliParse {
  const text = normalizeDigits(normalizeText(raw))
  const parts = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(text)
  if (!parts) return { ok: false, reason: 'NOT_JALALI' }

  const year = Number(parts[1])
  const month = Number(parts[2])
  const day = Number(parts[3])
  if (year < 1200 || year > 1500) return { ok: false, reason: 'NOT_JALALI' }
  if (month < 1 || month > 12 || day < 1) return { ok: false, reason: 'OUT_OF_RANGE' }

  const limit = month <= 6 ? 31 : month <= 11 ? 30 : 30
  if (day > limit) return { ok: false, reason: 'OUT_OF_RANGE' }
  // 30 Esfand exists only in a leap year: when it does not, it lands on the
  // same day as 1 Farvardin of the next.
  if (month === 12 && day === 30) {
    const last = isoOf(jalaliToGregorian(year, 12, 30))
    const next = isoOf(jalaliToGregorian(year + 1, 1, 1))
    if (last === next) return { ok: false, reason: 'OUT_OF_RANGE' }
  }

  return { ok: true, iso: isoOf(jalaliToGregorian(year, month, day)) }
}
