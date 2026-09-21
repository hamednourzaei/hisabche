// ============================================
// Currency + number formatting.
//
// The code union is derived from the shared Zod schema rather than
// redeclared, so it can never drift from the backend contract.
// ============================================

import type { z } from 'zod'
import { currencyCodeSchema } from '@hisabche/validation'

import {
  currencySign as canonicalSign,
  formatMoney as canonicalMoney,
  formatNumber,
} from '@hisabche/formatting'

import { i18n } from '@/shared/i18n'

export type CurrencyCode = z.infer<typeof currencyCodeSchema>

export const CURRENCY_CODES = currencyCodeSchema.options

function localeTag(): string {
  return i18n.language || 'fa-IR'
}

export function currencySign(currency: CurrencyCode): string {
  return canonicalSign(currency)
}

/**
 * Grouped digits with no currency context — counts, quantities, stock levels.
 * Money must go through `formatMoney`, which applies the per-currency decimal
 * policy (USD keeps 2 decimals; AFN/PKR/IRR keep none).
 */
export function formatAmount(value: number): string {
  return formatNumber(value, localeTag())
}

export function formatMoney(value: number, currency: CurrencyCode): string {
  return canonicalMoney(value, currency, localeTag())
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat(localeTag(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}
