// ============================================
// @hisabche/formatting — dates, in the calendar the reader is actually using.
//
// ---------------------------------------------------------------------------
// ⚠️ WHAT WAS WRONG
//
// Dates were formatted with a HARDCODED `'fa-AF'` in dozens of components:
//
//     new Date(value).toLocaleDateString('fa-AF')
//
// So the calendar had nothing to do with the language the person chose:
//
//   * an English user saw «۱۸ سنبلهٔ ۱۴۰۵» — the Afghan solar calendar, in
//     Persian digits, on an English screen
//   * an Iranian Persian user saw «سنبله» instead of «شهریور» — the right
//     calendar with the wrong month names, which is the kind of wrong that
//     reads as a typo rather than as a bug
//
// ICU already knows all three. The mapping is exactly `resolveIntlLocale`:
//
//     fa    → fa-IR  →  ۱۸ شهریور ۱۴۰۵     (Solar Hijri, Iranian month names)
//     af    → fa-AF  →  ۱۸ سنبلهٔ ۱۴۰۵      (Solar Hijri, Afghan month names)
//     en    → en     →  September 9, 2026  (Gregorian)
//
// Nothing here converts a calendar by hand. Reimplementing Jalali arithmetic
// is how leap years get quietly wrong once a cycle, and the platform already
// ships a correct implementation.
// ============================================

import { resolveIntlLocale, type UiLanguage } from './locale'

/** What a caller can hand us. `null`/`undefined`/unparseable all render as ''. */
export type DateInput = string | number | Date | null | undefined

/**
 * ⚠️ EVERY FORMATTER IS CACHED. `Intl.DateTimeFormat` construction is the
 * expensive part — a table of 500 rows building one per cell is a measurable
 * freeze, and it is the reason to have a shared helper at all rather than a
 * `toLocaleDateString` in each component.
 */
const cache = new Map<string, Intl.DateTimeFormat>()

function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`
  let found = cache.get(key)
  if (!found) {
    found = new Intl.DateTimeFormat(locale, options)
    cache.set(key, found)
  }
  return found
}

/**
 * Parse whatever the API gave us.
 *
 * ⚠️ RETURNS `null` RATHER THAN «Invalid Date». `new Date(undefined)` produces
 * a Date object that formats as «Invalid Date» — a string that ends up in an
 * invoice, a CSV export and a printed page, because it is truthy and no check
 * catches it.
 */
function toDate(value: DateInput): Date | null {
  if (value == null || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const DATE_ONLY: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' }
const DATE_LONG: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }
const DATE_TIME: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}

/**
 * A date, in the reader's calendar.
 *
 * Returns '' for a missing or unparseable value — never «Invalid Date», and
 * never today's date, which would be an invented fact.
 */
export function formatDate(
  value: DateInput,
  lang: UiLanguage,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = toDate(value)
  if (!date) return ''
  return formatter(resolveIntlLocale(lang), options ?? DATE_ONLY).format(date)
}

/** A date with its month spelled out — «۱۸ شهریور ۱۴۰۵» / «September 9, 2026». */
export function formatDateLong(value: DateInput, lang: UiLanguage): string {
  return formatDate(value, lang, DATE_LONG)
}

/** A date and a time of day. */
export function formatDateTime(value: DateInput, lang: UiLanguage): string {
  return formatDate(value, lang, DATE_TIME)
}

/**
 * The ISO day (`YYYY-MM-DD`) for a value, in the GREGORIAN calendar.
 *
 * ⚠️ THIS IS NOT A DISPLAY FUNCTION AND MUST NEVER BE LOCALIZED. It is what
 * goes into a query string, an `<input type="date">` and a database column.
 * A Jalali «۱۴۰۵-۰۶-۱۸» sent to Postgres as a date is either a parse error or,
 * far worse, a date six hundred years in the past.
 */
export function toIsoDay(value: DateInput): string {
  const date = toDate(value)
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
