'use client'

// ============================================
// packages/ui/src/hooks/use-number-format.ts
//
// Numbers in the reader's digits. `value.toLocaleString()` with no locale uses the
// BROWSER's language, so a Persian page showed half its figures in Latin digits.
// Persian → Persian digits; Dari, English and the rest → Latin (`resolveIntlLocale`).
// ============================================

import { useCallback } from 'react'
import { useLocale } from 'next-intl'
import { formatNumber, resolveIntlLocale } from '@hisabche/formatting'

export function useNumberFormat(): (value: number, maximumFractionDigits?: number) => string {
  const lang = useLocale()
  return useCallback(
    (value, maximumFractionDigits = 3) =>
      formatNumber(value, resolveIntlLocale(lang), maximumFractionDigits),
    [lang],
  )
}
