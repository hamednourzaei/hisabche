// ============================================
// Locale-aware formatting.
//
// Amounts and currency signs are formatted separately so <Money> can weight
// them differently — the digits lead, the sign recedes.
// ============================================

import type { CurrencyCode } from '@hisabche/store'

import { i18n } from '../i18n'

const CURRENCY_SIGN: Record<CurrencyCode, string> = {
  AFN: '؋',
  IRR: '﷼',
  USD: '$',
  PKR: '₨',
}

function localeTag(): string {
  return i18n.language || 'fa-IR'
}

/** Grouped digits only — no currency sign. Pair with <Money sign={...} />. */
export function formatAmount(value: number): string {
  try {
    return new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 0 }).format(value)
  } catch {
    // Hermes ships a partial Intl on some Android builds.
    return String(Math.round(value))
  }
}

export function currencySign(currency: CurrencyCode): string {
  return CURRENCY_SIGN[currency] ?? currency
}

/** Hook form, so a component re-renders when the currency preference changes. */
export function useCurrencySign(currency: CurrencyCode): string {
  return currencySign(currency)
}

/** Single-string form for places that cannot host a two-part component. */
export function formatCurrency(value: number, currency: CurrencyCode): string {
  return `${formatAmount(value)} ${currencySign(currency)}`
}

export function formatNumber(value: number): string {
  return formatAmount(value)
}

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'

  try {
    return new Intl.DateTimeFormat(localeTag(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

export function formatPercent(value: number): string {
  return `${formatAmount(Math.round(value * 10) / 10)}%`
}
