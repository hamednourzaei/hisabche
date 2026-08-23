// ============================================
// خلاصه فاکتور — the live summary.
//
// Every figure here comes from `summarize()`; none is re-derived locally.
// That is the reason the number in this panel, the number in the preview and
// the number sent to the server are the same number.
// ============================================
'use client'

import { memo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { CurrencyCode } from '@hisabche/store'
import type { InvoiceSummary } from '@hisabche/validation'
import { formatNumber } from '@hisabche/formatting'

import { NumberStepper } from '../number-stepper'
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
  /** The item count is derived, so its stepper adds and removes ROWS. */
  onAddRow: () => void
  onRemoveLastRow: () => void
}

const rowClass = 'flex items-center justify-between gap-3 py-2 text-sm'
const labelClass = 'text-[hsl(var(--fg-secondary))]'
const numericFont = 'tabular-nums [font-variant-numeric:tabular-nums]'
const valueClass = cn('font-medium text-[hsl(var(--fg-primary))]', numericFont)

const fieldShell = cn(
  'h-9 w-32 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] px-2',
  'bg-[hsl(var(--surface-base))]',
  'focus-within:border-[hsl(var(--color-primary))]',
  'transition-colors duration-150 motion-reduce:transition-none',
)

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
  onAddRow,
  onRemoveLastRow,
}: InvoiceSummaryPanelProps) {
  const fmt = (value: number, decimals = precision) => formatNumber(value, locale, decimals)
  const currencyName = t(`currency.${currency.toLowerCase()}`, currency)

  const countArrow = cn(
    'flex h-1/2 items-center justify-center px-1',
    'text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--color-primary))]',
    'transition-colors duration-150 motion-reduce:transition-none',
    'disabled:opacity-30 disabled:hover:text-[hsl(var(--fg-tertiary))]',
  )

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
          {/* The count itself is derived, so the arrows act on the grid: up
              adds a row to type into, down drops the last one. */}
          <div className="flex items-center gap-1.5">
            <span className={valueClass} dir="ltr">
              {fmt(summary.itemCount, 0)}
            </span>
            <div className="flex h-9 flex-col rounded-[var(--radius-sm)] border border-[hsl(var(--border-default))]">
              <button
                type="button"
                onClick={onAddRow}
                aria-label={t('invoiceBuilder.toolbar.addRow', 'افزودن ردیف')}
                className={countArrow}
              >
                <ChevronUp className="size-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onRemoveLastRow}
                aria-label={t('invoiceBuilder.grid.removeRow', 'حذف ردیف')}
                className={countArrow}
              >
                <ChevronDown className="size-3" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <div className={rowClass}>
          <span className={labelClass}>
            {t('invoiceBuilder.summary.subtotal', 'جمع مبلغ')} ({currencyName})
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
          <span className={labelClass}>{t('invoiceBuilder.summary.discount', 'تخفیف کل')}</span>
          <div className="flex items-center gap-1.5">
            <NumberStepper
              value={discountValue}
              onValueChange={onDiscountValueChange}
              step={discountType === 'percentage' ? 1 : 1000}
              min={0}
              {...(discountType === 'percentage' ? { max: 100 } : {})}
              groupThousands={discountType === 'fixed'}
              aria-label={t('invoiceBuilder.summary.discount', 'تخفیف کل')}
              className={fieldShell}
              inputClassName={numericFont}
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
                    'transition-colors duration-150 motion-reduce:transition-none',
                    discountType === type
                      ? 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--fg-primary))] shadow-sm'
                      : 'text-[hsl(var(--fg-tertiary))]',
                  )}
                >
                  {type === 'fixed' ? currencyName : '٪'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={rowClass}>
          <span className={labelClass}>{t('invoiceBuilder.summary.taxRate', 'مالیات (درصد)')}</span>
          <NumberStepper
            value={taxRate}
            onValueChange={onTaxRateChange}
            step={1}
            min={0}
            max={100}
            aria-label={t('invoiceBuilder.summary.taxRate', 'مالیات (درصد)')}
            suffix="٪"
            className={fieldShell}
            inputClassName={numericFont}
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
            className={cn('text-lg font-bold text-[hsl(var(--color-success))]', numericFont)}
          >
            {fmt(summary.total)}
          </span>
        </div>
      </div>
    </div>
  )
})

InvoiceSummaryPanel.displayName = 'InvoiceSummaryPanel'
