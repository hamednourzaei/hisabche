// ============================================
// packages/ui/src/hooks/use-currency.ts
//
// The ONE place a web/desktop component asks "what currency, and how do I
// render it". It reads the user's selection from the store and formats through
// `@hisabche/formatting`, the same code desktop and mobile use.
//
// It used to carry its own table:
//
//   AFN: { symbol: "افغانی", locale: "fa-AF", decimals: 0 }
//   ...
//   const config = CURRENCY_CONFIG[primaryCurrency] || CURRENCY_CONFIG.AFN
//
// Two defects lived in those four lines. The locale was pinned to the
// CURRENCY, so a USD shop reading the interface in Persian got Latin digits
// and an English shop on AFN got Persian ones — digits follow the reader's
// language, not their money. And the `|| CURRENCY_CONFIG.AFN` fallback meant
// any code outside the four-code union silently rendered as افغانی.
// ============================================
'use client'

import { useCallback, useMemo } from 'react'
import { useCurrencyStore, type CurrencyCode } from '@hisabche/store'
import { currencySign, formatAmount } from '@hisabche/formatting'

import { useIntlLocale } from './use-intl-locale'

export interface UseCurrencyResult {
  /** The user's selected currency. Never guessed. */
  currency: CurrencyCode
  /** Its sign, e.g. `؋`. */
  symbol: string
  format: (value: number, options?: { showSymbol?: boolean; compact?: boolean }) => string
}

export function useCurrency(): UseCurrencyResult {
  const currency = useCurrencyStore((s) => s.primaryCurrency)
  const locale = useIntlLocale()
  const symbol = currencySign(currency)

  const format = useCallback(
    (value: number, options?: { showSymbol?: boolean; compact?: boolean }): string => {
      const { showSymbol = true, compact = false } = options ?? {}

      // Compact form keeps its existing "1.2M" shape. `toFixed` rather than
      // formatAmount because the currency's precision applies to the amount,
      // not to a magnitude abbreviation.
      if (compact && Math.abs(value) >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M${showSymbol ? ` ${symbol}` : ''}`
      }
      if (compact && Math.abs(value) >= 1_000) {
        return `${(value / 1_000).toFixed(1)}K${showSymbol ? ` ${symbol}` : ''}`
      }

      const formatted = formatAmount(value, currency, locale)
      return showSymbol ? `${formatted} ${symbol}` : formatted
    },
    [currency, locale, symbol],
  )

  return useMemo(() => ({ format, currency, symbol }), [format, currency, symbol])
}
