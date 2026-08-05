// ============================================
// Currency + number formatting.
//
// The code union is derived from the shared Zod schema rather than
// redeclared, so it can never drift from the backend contract.
// ============================================

import type { z } from 'zod'
import { currencyCodeSchema } from '@hisabche/validation'

import { i18n } from '@/shared/i18n'

export type CurrencyCode = z.infer<typeof currencyCodeSchema>

export const CURRENCY_CODES = currencyCodeSchema.options

const CURRENCY_SIGN: Record<CurrencyCode, string> = {
  AFN: '؋',
  IRR: '﷼',
  USD: '$',
  PKR: '₨',
}

function localeTag(): string {
  return i18n.language || 'fa-IR'
}

export function currencySign(currency: CurrencyCode): string {
  return CURRENCY_SIGN[currency] ?? currency
}

export function formatAmount(value: number): string {
  return new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 0 }).format(value)
}

export function formatMoney(value: number, currency: CurrencyCode): string {
  return `${formatAmount(value)} ${currencySign(currency)}`
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
