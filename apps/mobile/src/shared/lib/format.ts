// ============================================
// Locale-aware formatting.
//
// Amounts and currency signs are formatted separately so <Money> can weight
// them differently — the digits lead, the sign recedes.
// ============================================

import type { CurrencyCode } from '@hisabche/store'

import {
  currencySign as canonicalSign,
  formatAmount as canonicalAmount,
  formatMoney as canonicalMoney,
  formatNumber as canonicalNumber,
} from '@hisabche/formatting'

import { i18n } from '../i18n'

function localeTag(): string {
  return i18n.language || 'fa-IR'
}

/**
 * Grouped digits only — no currency sign. Pair with <Money sign={...} />.
 * Currency-aware amounts must use `formatMoneyAmount`, which applies the
 * per-currency decimal policy. The canonical helper already carries the
 * Hermes fallback for Android builds with a partial Intl.
 */
export function formatAmount(value: number): string {
  return canonicalNumber(value, localeTag())
}

/** Digits only, with the currency's decimal precision. Pair with <Money />. */
export function formatMoneyAmount(value: number, currency: CurrencyCode): string {
  return canonicalAmount(value, currency, localeTag())
}

export function currencySign(currency: CurrencyCode): string {
  return canonicalSign(currency)
}

/** Hook form, so a component re-renders when the currency preference changes. */
export function useCurrencySign(currency: CurrencyCode): string {
  return currencySign(currency)
}

/** Single-string form for places that cannot host a two-part component. */
export function formatCurrency(value: number, currency: CurrencyCode): string {
  return canonicalMoney(value, currency, localeTag())
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
