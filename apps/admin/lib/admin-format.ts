// ============================================
// Admin display formatting.
//
// The console had 34 `toLocaleString()` / `toLocaleDateString()` calls with no
// locale, and zero imports from `@hisabche/formatting`: the calendar and the
// digits followed the operator's OS, not the language in the URL. Every admin
// screen formats through these five functions instead, so there is exactly one
// answer to "how is a date drawn here".
//
// Formatting only. Nothing here returns a number.
// ============================================

import {
  formatDate as formatDateValue,
  formatDateTime as formatDateTimeValue,
  formatMoney as formatMoneyValue,
  formatNumber as formatNumberValue,
  resolveIntlLocale,
  type DateInput,
  type KnownCurrency,
} from '@hisabche/formatting'
import type { AdminLocale } from '@/components/admin-shell/admin-nav'

/** What the console draws when a value is missing — never `0`, never today. */
export const UNKNOWN_VALUE = '—'

export function adminIntlLocale(locale: AdminLocale): string {
  return resolveIntlLocale(locale)
}

/** Grouped digits for counts, quantities and percentages. */
export function adminNumber(value: number, locale: AdminLocale, maximumFractionDigits = 0): string {
  return formatNumberValue(value, adminIntlLocale(locale), maximumFractionDigits)
}

/** The books currency of the row, never a currency assumed by the view. */
export function adminMoney(value: number, currency: KnownCurrency, locale: AdminLocale): string {
  return formatMoneyValue(value, currency, adminIntlLocale(locale))
}

/** A date in the calendar of the chosen language; `—` when unreadable. */
export function adminDate(value: DateInput, locale: AdminLocale): string {
  return formatDateValue(value, locale) || UNKNOWN_VALUE
}

/** A date and time in the calendar of the chosen language; `—` when unreadable. */
export function adminDateTime(value: DateInput, locale: AdminLocale): string {
  return formatDateTimeValue(value, locale) || UNKNOWN_VALUE
}
