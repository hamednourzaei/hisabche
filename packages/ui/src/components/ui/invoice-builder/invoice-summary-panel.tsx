// ============================================
// خلاصه فاکتور — the live summary.
//
// Every figure here comes from `summarize()`; none is re-derived locally.
// That is the reason the number in this panel, the number in the preview and
// the number sent to the server are the same number.
// ============================================
'use client'

import { memo } from 'react'
import type { CurrencyCode } from '@hisabche/store'
import type { InvoiceSummary } from '@hisabche/validation'
import { formatNumber } from '@hisabche/formatting'

import { Input } from '../input'
import { cn } from '../../../lib/utils'

export interface InvoiceSummaryPanelProps {
  t: (key: string, fallback?: string) => string
  locale: string
  currency: CurrencyCode
  precision: number
  summary: InvoiceSummary
  discountValue: string
  discountType: 'fixed' | 'percentage'
  onDiscountValueChange: (value: string) => void
  onDiscountTypeChange: (type: 'fixed' | 'percentage') => void
  taxRate: string
  onTaxRateChange: (value: string) => void
}

const rowClass = 'flex items-center justify-between gap-3 py-2 text-sm'
const labelClass = 'text-[hsl(var(--fg-secondary))]'
const valueClass = 'tabular-nums font-medium text-[hsl(var(--fg-primary))]'

export const InvoiceSummaryPanel = memo(function InvoiceSummaryPanel({
  t,
  locale,
  currency,
  precision,
  summary,
  discountValue,
  discountType,
  onDiscountValueChange,
  onDiscountTypeChange,
  taxRate,
  onTaxRateChange,
}: InvoiceSummaryPanelProps) {
  const fmt = (value: number, decimals = precision) => formatNumber(value, locale, decimals)

  return (
    <div className="rounded-[var(--radius-lg)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div className="border-b border-[hsl(var(--border-default))] px-4 py-3">
        <h2 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t('invoiceBuilder.summary.title', 'خلاصه فاکتور')}
        </h2>
      </div>

      <div className="divide-y divide-[hsl(var(--border-default))] px-4 py-1">
        <div className={rowClass}>
          <span className={labelClass}>{t('invoiceBuilder.summary.itemCount', 'تعداد اقلام')}</span>
          <span className={valueClass} dir="ltr">
            {fmt(summary.itemCount, 0)}
          </span>
        </div>

        <div className={rowClass}>
          <span className={labelClass}>
            {t('invoiceBuilder.summary.subtotal', 'جمع مبلغ')} (
            {t(`currency.${currency.toLowerCase()}`, currency)})
          </span>
          <span className={valueClass} dir="ltr">
            {fmt(summary.subtotal)}
          </span>
        </div>

        {/* Foreign-currency columns are reported here on their own line. An
            invoice settles in ONE currency, so these are never added in. */}
        {summary.foreignTotals.map((entry) => (
          <div key={entry.currency} className={rowClass}>
            <span className={labelClass}>
              {t('invoiceBuilder.summary.foreignTotal', 'جمع')} (
              {t(`currency.${entry.currency.toLowerCase()}`, entry.currency)})
            </span>
            <span className={cn(valueClass, 'text-[hsl(var(--fg-secondary))]')} dir="ltr">
              {formatNumber(entry.amount, locale, entry.currency === 'USD' ? 2 : 0)}
            </span>
          </div>
        ))}

        <div className={rowClass}>
          <label htmlFor="summary-discount" className={labelClass}>
            {t('invoiceBuilder.summary.discount', 'تخفیف کل')}
          </label>
          <div className="flex items-center gap-1.5">
            <Input
              id="summary-discount"
              inputMode="decimal"
              value={discountValue}
              onChange={(e) => onDiscountValueChange(e.target.value)}
              className="h-9 w-28 text-end"
            />
            <div className="flex rounded-[var(--radius-sm)] bg-[hsl(var(--surface-muted))] p-0.5">
              {(['fixed', 'percentage'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={discountType === type}
                  onClick={() => onDiscountTypeChange(type)}
                  className={cn(
                    'rounded-[var(--radius-sm)] px-2 py-1 text-[11px] font-medium',
                    discountType === type
                      ? 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--fg-primary))]'
                      : 'text-[hsl(var(--fg-tertiary))]',
                  )}
                >
                  {type === 'fixed' ? t(`currency.${currency.toLowerCase()}`, currency) : '٪'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={rowClass}>
          <label htmlFor="summary-tax" className={labelClass}>
            {t('invoiceBuilder.summary.taxRate', 'مالیات (درصد)')}
          </label>
          <Input
            id="summary-tax"
            inputMode="decimal"
            value={taxRate}
            onChange={(e) => onTaxRateChange(e.target.value)}
            className="h-9 w-28 text-end"
          />
        </div>

        <div className={rowClass}>
          <span className={labelClass}>{t('invoiceBuilder.summary.taxTotal', 'مبلغ مالیات')}</span>
          <span className={valueClass} dir="ltr">
            {fmt(summary.taxTotal)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 py-3">
          <span className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {t('invoiceBuilder.summary.payable', 'مبلغ قابل پرداخت')}
          </span>
          <span
            dir="ltr"
            className="text-lg font-bold tabular-nums text-[hsl(var(--color-success))]"
          >
            {fmt(summary.total)}
          </span>
        </div>
      </div>
    </div>
  )
})

InvoiceSummaryPanel.displayName = 'InvoiceSummaryPanel'
