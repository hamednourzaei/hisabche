import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { resolveIntlLocale } from '@hisabche/formatting'

/**
 * Combines class names and resolves Tailwind CSS conflicts.
 * Uses clsx for conditional classes and tailwind-merge for deduplication.
 *
 * @param inputs - Class names or conditional class objects
 * @returns Merged class string
 *
 * @example
 * cn('px-4 py-2', 'px-6') // => 'py-2 px-6' (later overrides earlier)
 * cn('text-red-500', false && 'hidden', 'font-bold') // => 'text-red-500 font-bold'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * Formats a number as currency based on locale and currency code.
 * Used for displaying prices in AFN, USD, PKR, IRR.
 */
export function formatCurrency(
  amount: number,
  currency: 'AFN' | 'USD' | 'PKR' | 'IRR',
  locale: 'fa-AF' | 'en' = 'fa-AF',
): string {
  // `NaN` and `Infinity` do not throw here, but they render as "NaN ؋" beside
  // real figures, which reads like a number rather than like missing data.
  if (!Number.isFinite(amount)) return '—'

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * A date, in the reader's calendar.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ `lang` IS REQUIRED, AND IT DID NOT EXIST.
 *
 * This function's own doc comment used to promise «Jalali (Shamsi) or
 * Gregorian» while formatting with a hardcoded `'fa-AF'` and taking no
 * language at all. The abstraction was here; the one input that decides the
 * answer was not. So thirty-five call sites across fourteen screens rendered
 * the Afghan solar calendar to everyone:
 *
 *   * an English reader saw «۱۸ سنبلهٔ ۱۴۰۵» — Afghan months, Persian digits
 *   * an Iranian Persian reader saw «سنبله» where their calendar says
 *     «شهریور» — the right calendar with the wrong month names, which reads
 *     as a typo rather than as a bug, so nobody reported it
 *
 * Making it required rather than defaulted is the point: a default would have
 * left every existing caller silently wrong, and the compiler would have found
 * none of them. In a component, get it from `useDateFormat()`.
 *
 * ⚠️ AND IT MUST NOT BE READ FROM MODULE STATE. `apps/web` renders on the
 * server, where one process handles a Persian request and an English one at
 * the same time; a shared «current language» would let one request decide what
 * the other renders.
 */
export function formatDate(
  date: string | Date | null | undefined,
  lang: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  // `Intl.DateTimeFormat().format()` THROWS on an invalid date — it does not
  // return a placeholder. So a null `closed_at`, an empty string from an
  // optional column, or a malformed timestamp crashed the whole page with
  // `RangeError: Invalid time value`, and the error boundary swallowed the
  // screen. That is what took down /till and /team-and-payroll.
  //
  // A missing date is an ordinary fact about a record that has not reached
  // that stage yet. It renders as a dash, and nothing else stops working.
  //
  // ⚠️ A DASH, NOT AN EMPTY STRING — unlike `@hisabche/formatting`, whose
  // `formatDate` returns ''. This one is read inside table cells where a blank
  // cell reads as a rendering failure. The difference is deliberate; the
  // calendar decision is shared, the placeholder is not.
  if (date === null || date === undefined || date === '') return '—'

  const parsed = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(parsed.getTime())) return '—'

  return new Intl.DateTimeFormat(resolveIntlLocale(lang), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  }).format(parsed)
}
