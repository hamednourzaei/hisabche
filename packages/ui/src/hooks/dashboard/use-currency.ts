// packages/ui/src/hooks/use-currency.ts
'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'

/**
 * Aligned with the canonical `currencyCodeSchema`
 * (`z.enum(['AFN','USD','PKR','IRR'])`).
 *
 * This union previously read `"AFN" | "USD" | "EUR" | "IRR"` — it listed EUR,
 * which the product does not support and the backend schema rejects, and it
 * omitted PKR, which the product DOES support. A PKR workspace therefore fell
 * through `symbols[code] || code` and rendered the bare text "PKR".
 *
 * Formatting options are deliberately unchanged (min 0 / max 2, `fa-AF`,
 * Intl `style: 'currency'`) so existing web output is untouched.
 */
export type CurrencyCode = 'AFN' | 'USD' | 'PKR' | 'IRR'

interface UseCurrencyOptions {
  code?: CurrencyCode
  locale?: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

export function useCurrency(options: UseCurrencyOptions = {}) {
  const {
    code = 'AFN',
    locale = 'fa-AF',
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
    return (): string => {
      const symbols: Record<CurrencyCode, string> = {
        AFN: '؋',
        USD: '$',
        PKR: '₨',
        IRR: '﷼',
      }
      return symbols[code] || code
    }
  }, [code])

  return {
    format,
    getSymbol,
    code,
    locale,
  }
}
