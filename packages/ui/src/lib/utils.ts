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
  date: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('fa-AF', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  }).format(d)
}