import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

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
 * Formats a date string to Jalali (Shamsi) or Gregorian.
 */
export function formatDate(
  date: string | Date | null | undefined,
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
  if (date === null || date === undefined || date === '') return '—'

  const parsed = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(parsed.getTime())) return '—'

  return new Intl.DateTimeFormat('fa-AF', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  }).format(parsed)
}
