// ============================================
// backend/src/services/payroll/attendance-link.domain.ts
//
// The pure rules of an employee's attendance link: is it live, what day is it
// where the shop is, and what clock time did the person type.
// Imports nothing.
// ============================================

export type AttendanceLinkState = 'active' | 'expired' | 'revoked'

/** Revoked wins over expired: it says a person closed it. */
export function linkState(
  revokedAt: string | null,
  expiresAt: string | null,
  now: Date,
): AttendanceLinkState {
  if (revokedAt) return 'revoked'
  if (expiresAt && new Date(expiresAt).getTime() <= now.getTime()) return 'expired'
  return 'active'
}

/** A zone this runtime knows. No fallback: an unknown zone is refused, not replaced. */
export function isIanaTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** The calendar day it is in `timeZone` at `instant`, as `YYYY-MM-DD` (Gregorian). */
export function isoDayIn(timeZone: string, instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    calendar: 'gregory',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${read('year')}-${read('month')}-${read('day')}`
}

/**
 * `days` after `isoDay` (negative = before). Built in UTC so a day is always a
 * day. `addDays('2026-02-31', 0)` is `2026-03-03` — which is how a caller tells
 * a date that does not exist from one that does.
 */
export function addDays(isoDay: string, days: number): string {
  const [year, month, day] = isoDay.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

const PERSIAN_ZERO = 0x06f0
const ARABIC_ZERO = 0x0660

/**
 * `HH:MM` with ASCII digits, or null when nothing (or nothing readable) was
 * typed. Persian and Arabic-Indic digits are digits here: a phone keyboard in
 * Kabul types «۰۸:۳۰».
 */
export function normalizeClock(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  let ascii = ''
  for (const char of value.trim()) {
    const code = char.codePointAt(0) ?? 0
    if (code >= PERSIAN_ZERO && code <= PERSIAN_ZERO + 9) ascii += String(code - PERSIAN_ZERO)
    else if (code >= ARABIC_ZERO && code <= ARABIC_ZERO + 9) ascii += String(code - ARABIC_ZERO)
    else ascii += char
  }
  const match = /^([0-9]{1,2}):([0-9]{2})$/.exec(ascii)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}
