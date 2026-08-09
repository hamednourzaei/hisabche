// ============================================
// One invoice line, plus its optional nested components.
//
// Split out of new-invoice-page so the page stays a layout, and so the row —
// the densest part of the screen — can be memoized independently.
//
// Desktop density rules apply: 28px controls, no decorative padding, the
// components table is a real table rather than a stack of cards.
// ============================================

import React, { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'

import { Input } from '@/components/ui/primitives'
import {
  DRAFT_UNITS,
  detailsSum,
  lineTotal,
  type DraftDetail,
  type DraftLine,
  type DraftUnit,
} from '@/features/sales/invoice-draft'
import { formatMoney } from '@/shared/lib/currency'
import type { CurrencyCode } from '@/shared/lib/currency'

export interface InvoiceLineRowProps {
  line: DraftLine
  currency: CurrencyCode
  onChange: (key: string, patch: Partial<DraftLine>) => void
  onRemove: (key: string) => void
}

const GRID = 'grid-cols-[1fr_80px_110px_120px_120px_28px]'

export const InvoiceLineRow = memo(function InvoiceLineRow({
  line,
  currency,
  onChange,
  onRemove,
}: InvoiceLineRowProps) {
  const { t } = useTranslation('desktop')
  const details = line.details ?? []
  const [expanded, setExpanded] = useState(details.length > 0)

  const patchDetails = (next: DraftDetail[]) => onChange(line.key, { details: next })

  const addDetail = () =>
    patchDetails([
      ...details,
      { key: `${line.key}-d${Date.now()}`, title: '', quantity: 1, amount: 0 },
    ])

  const toggle = () => {
    // Opening an empty line seeds the first component — one keystroke, not two.
    if (!expanded && details.length === 0) addDetail()
    setExpanded((prev) => !prev)
  }

  return (
    <div className="border-b border-[hsl(var(--border-default)/0.5)]">
      <div className={`grid ${GRID} items-center gap-3 px-4 py-1.5 text-sm`}>
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={expanded}
            aria-label={`${t('sales.details', 'جزئیات')}: ${line.productName}`}
            className="shrink-0 rounded p-0.5 text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--color-primary))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--color-primary))]"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <span className="truncate">{line.productName}</span>
          {details.length > 0 && (
            <span className="shrink-0 rounded-full bg-[hsl(var(--surface-muted))] px-1.5 text-[10px] tabular-nums text-[hsl(var(--fg-tertiary))]">
              {details.length}
            </span>
          )}
        </div>

        <Input
          type="number"
          min={0}
          step="any"
          value={line.quantity}
          className="h-7 text-end"
          aria-label={t('sales.quantity', 'تعداد')}
          onChange={(event) =>
            onChange(line.key, { quantity: Math.max(0, Number(event.target.value) || 0) })
          }
        />

        <select
          value={line.unit ?? 'piece'}
          aria-label={t('sales.unit', 'واحد')}
          onChange={(event) => {
            const unit = event.target.value as DraftUnit
            // Leaving custom drops the stale label so it cannot resurface.
            onChange(line.key, unit === 'custom' ? { unit } : { unit, unitLabel: undefined })
          }}
          className="h-7 rounded-[var(--radius-xs)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] px-1 text-xs text-[hsl(var(--fg-primary))] outline-none"
        >
          {DRAFT_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {t(`unit.${unit}`, unit)}
            </option>
          ))}
        </select>

        <Input
          type="number"
          min={0}
          step="any"
          value={line.unitPrice}
          className="h-7 text-end"
          aria-label={t('inventory.price', 'مبلغ واحد')}
          disabled={line.detailsArePriced === true}
          onChange={(event) =>
            onChange(line.key, { unitPrice: Math.max(0, Number(event.target.value) || 0) })
          }
        />

        <span className="text-end font-medium tabular-nums">
          {formatMoney(lineTotal(line), currency)}
        </span>

        <button
          type="button"
          aria-label={`${t('common.delete', 'حذف')}: ${line.productName}`}
          onClick={() => onRemove(line.key)}
          className="text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--color-destructive))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--color-primary))]"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {line.unit === 'custom' && (
        <div className="px-4 pb-1.5 ps-11">
          <Input
            value={line.unitLabel ?? ''}
            maxLength={24}
            placeholder={t('sales.customUnitPlaceholder', 'مثلاً: مثقال')}
            aria-label={t('sales.customUnit', 'واحد دلخواه')}
            className="h-7 w-40"
            onChange={(event) => onChange(line.key, { unitLabel: event.target.value })}
          />
        </div>
      )}

      {expanded && (
        <div className="border-t border-dashed border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted)/0.4)] px-4 py-2 ps-11">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase text-[hsl(var(--fg-tertiary))]">
            <span>{t('sales.details', 'جزئیات')}</span>
            <span className="tabular-nums">
              {t('sales.componentsSum', 'جمع اجزا')}: {formatMoney(detailsSum(details), currency)}
            </span>
          </div>

          {details.map((detail, index) => (
            <div key={detail.key} className="mb-1 grid grid-cols-[1fr_70px_110px_28px] gap-2">
              <Input
                value={detail.title}
                placeholder={t('sales.detailTitle', 'عنوان')}
                aria-label={t('sales.detailTitle', 'عنوان')}
                className="h-7"
                onChange={(event) =>
                  patchDetails(
                    details.map((d, i) => (i === index ? { ...d, title: event.target.value } : d)),
                  )
                }
              />
              <Input
                type="number"
                min={0}
                step="any"
                value={detail.quantity}
                aria-label={t('sales.quantity', 'تعداد')}
                className="h-7 text-end"
                onChange={(event) =>
                  patchDetails(
                    details.map((d, i) =>
                      i === index
                        ? { ...d, quantity: Math.max(0, Number(event.target.value) || 0) }
                        : d,
                    ),
                  )
                }
              />
              <Input
                type="number"
                min={0}
                step="any"
                value={detail.amount}
                aria-label={t('sales.amount', 'مبلغ')}
                className="h-7 text-end"
                onChange={(event) =>
                  patchDetails(
                    details.map((d, i) =>
                      i === index
                        ? { ...d, amount: Math.max(0, Number(event.target.value) || 0) }
                        : d,
                    ),
                  )
                }
              />
              <button
                type="button"
                aria-label={`${t('sales.removeDetail', 'حذف جزئیات')}: ${detail.title}`}
                onClick={() => patchDetails(details.filter((_, i) => i !== index))}
                className="text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--color-destructive))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--color-primary))]"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}

          {/* No cap — the user adds as many components as the item has. */}
          <div className="mt-1 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={addDetail}
              className="inline-flex items-center gap-1 text-xs text-[hsl(var(--color-primary))] hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--color-primary))]"
            >
              <Plus size={12} />
              {t('sales.addDetail', 'افزودن جزئیات')}
            </button>

            {/* This is what prevents double counting: the user says explicitly
                whether the components REPLACE the line amount. */}
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[hsl(var(--fg-secondary))]">
              <input
                type="checkbox"
                checked={line.detailsArePriced ?? false}
                onChange={(event) => onChange(line.key, { detailsArePriced: event.target.checked })}
                className="size-3 accent-[hsl(var(--color-primary))]"
              />
              {t('sales.detailsArePriced', 'مبلغ خط از جمع اجزا')}
            </label>
          </div>

          <label className="mt-2 flex items-center gap-2 text-[11px] text-[hsl(var(--fg-secondary))]">
            {t('sales.weightGrams', 'وزن (گرم)')}
            <Input
              type="number"
              min={0}
              step="any"
              value={line.weightGrams ?? ''}
              aria-label={t('sales.weightGrams', 'وزن (گرم)')}
              className="h-7 w-28 text-end"
              onChange={(event) => {
                const raw = event.target.value
                // Weight is NOT quantity — a 12.5 g necklace is still 1 piece.
                onChange(line.key, {
                  weightGrams: raw === '' ? undefined : Math.max(0, Number(raw) || 0),
                })
              }}
            />
          </label>
        </div>
      )}
    </div>
  )
})
InvoiceLineRow.displayName = 'InvoiceLineRow'
