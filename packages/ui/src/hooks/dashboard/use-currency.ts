// packages/ui/src/hooks/dashboard/use-currency.ts
'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useCurrencyStore } from '@hisabche/store'

import { useIntlLocale } from '../use-intl-locale'
import { CURRENCY_SIGN, type KnownCurrency } from '@hisabche/formatting'

/**
 * Aligned with the canonical `currencyCodeSchema`
 * (`z.enum(['AFN','USD','PKR','IRR'])`).
 *
 * This union previously read `"AFN" | "USD" | "EUR" | "IRR"` — it listed EUR,
 * which the product does not support and the backend schema rejects, and it
 * omitted PKR, which the product DOES support. A PKR workspace therefore fell
 * through `symbols[code] || code` and rendered the bare text "PKR".
 */
/**
 * ⚠️ Derived from the formatting contract, not restated.
 *
 * This was a fourth hand-maintained copy of the currency list, and it had
 * already drifted once — it listed a currency the product rejected and omitted
 * PKR, which it supported, so a PKR workspace rendered the bare text "PKR".
 *
 * `KnownCurrency` and `CURRENCY_SIGN` in @hisabche/formatting are the source
 * for both the codes and their symbols.
 */
export type CurrencyCode = KnownCurrency

interface UseCurrencyOptions {
  /** Override the user's currency — only for a figure that carries its own. */
  code?: CurrencyCode
  /** Override the reader's locale. Almost never correct. */
  locale?: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

/**
 * The symbols, straight from the formatting contract.
 *
 * A local table here is how the previous drift happened: two lists of the same
 * thing, one of them edited.
 */
const SYMBOLS: Record<CurrencyCode, string> = CURRENCY_SIGN

export function useCurrency(options: UseCurrencyOptions = {}) {
  // `code` defaulted to the literal 'AFN' and `locale` to the literal 'fa-AF'.
  // Every dashboard KPI therefore rendered in افغانی with Persian digits no
  // matter what the shopkeeper chose at onboarding or which language they read
  // the interface in. Both now come from the user; the options remain only as
  // explicit per-call overrides.
  const selected = useCurrencyStore((s) => s.primaryCurrency)
  const readerLocale = useIntlLocale()

  const {
    code = selected,
    locale = readerLocale,
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
  } = options

  const t = useTranslations()

  const format = useMemo(() => {
    return (amount: number, showCode: boolean = true): string => {
      if (amount === undefined || amount === null || isNaN(amount)) {
        return t('common.zero')
      }

      const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: code,
        minimumFractionDigits,
        maximumFractionDigits,
      })

      const formatted = formatter.format(amount)

      if (!showCode) {
        return formatted.replace(/[A-Z]{3}/, '').trim()
      }

      return formatted
    }
  }, [code, locale, minimumFractionDigits, maximumFractionDigits, t])

  const getSymbol = useMemo(() => {
    return (): string => SYMBOLS[code] || code
  }, [code])

  return {
    format,
    getSymbol,
    code,
    locale,
  }
}
