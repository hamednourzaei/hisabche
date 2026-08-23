// ============================================
// Everything derived from the invoice draft, in one place.
//
// The builder and the preview both call this. That is the whole point: if
// they each derived their own money context, their own column list and their
// own totals, «preview matches builder» would be an ongoing maintenance
// promise instead of a structural fact.
// ============================================
'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  currencyPrecision,
  parseCellNumber,
  rowToInvoiceItem,
  summarize,
  validateGrid,
  type GridMoneyContext,
  type InvoiceSummary,
  type MappedInvoiceItem,
} from '@hisabche/validation'
import { useCurrencyStore, useInvoiceDraftStore, type CurrencyCode } from '@hisabche/store'

import { useIntlLocale } from '../use-intl-locale'

export interface UseInvoiceDraftResult {
  t: (key: string, fallback?: string) => string
  locale: string
  currency: CurrencyCode
  ctx: GridMoneyContext
  summary: InvoiceSummary
  /** Rows the server would reject, so the builder can mark them. */
  invalidRowIds: Set<string>
  /** Translated, deduplicated blocking problems. */
  issues: string[]
  /** The rows that will actually become invoice items. */
  items: MappedInvoiceItem[]
}

export function useInvoiceDraft(): UseInvoiceDraftResult {
  const tOriginal = useTranslations()
  const locale = useIntlLocale()
  const currency = useCurrencyStore((s) => s.primaryCurrency)

  const columns = useInvoiceDraftStore((s) => s.columns)
  const rows = useInvoiceDraftStore((s) => s.rows)
  const rawRates = useInvoiceDraftStore((s) => s.rates)
  const discountValue = useInvoiceDraftStore((s) => s.discountValue)
  const discountType = useInvoiceDraftStore((s) => s.discountType)
  const taxRate = useInvoiceDraftStore((s) => s.taxRate)

  // Most components in this codebase call `t('key', 'متن فارسی')`. `next-intl`
  // returns the key itself when it is missing, so this wrapper turns that into
  // the fallback — see the i18n skill.
  const t = useMemo(
    () =>
      (key: string, fallback?: string): string => {
        const value = tOriginal(key as Parameters<typeof tOriginal>[0])
        return value && value !== key ? value : (fallback ?? key)
      },
    [tOriginal],
  )

  const ctx = useMemo<GridMoneyContext>(() => {
    const rates: Partial<Record<CurrencyCode, number>> = {}
    for (const [code, raw] of Object.entries(rawRates)) {
      const parsed = parseCellNumber(raw)
      // A blank or zero rate is NOT a rate. Storing it as 0 would make every
      // amount in that currency silently worth nothing.
      if (parsed > 0) rates[code as CurrencyCode] = parsed
    }
    return { currency, precision: currencyPrecision(currency), rates }
  }, [currency, rawRates])

  const summary = useMemo(
    () =>
      summarize({
        rows,
        columns,
        ctx,
        discountValue: parseCellNumber(discountValue),
        discountType,
        taxRate: parseCellNumber(taxRate),
      }),
    [rows, columns, ctx, discountValue, discountType, taxRate],
  )

  const validation = useMemo(() => validateGrid(rows, columns, ctx), [rows, columns, ctx])

  const invalidRowIds = useMemo(
    () => new Set(validation.filter((i) => i.rowId).map((i) => i.rowId)),
    [validation],
  )

  const issues = useMemo(
    () => [...new Set(validation.map((issue) => t(issue.key, issue.fallback)))],
    [validation, t],
  )

  const items = useMemo(
    () =>
      rows
        .map((row) => rowToInvoiceItem(row, columns, ctx))
        .filter((item): item is MappedInvoiceItem => item !== null),
    [rows, columns, ctx],
  )

  return { t, locale, currency, ctx, summary, invalidRowIds, issues, items }
}
