// ============================================
// One invoice line, as a CARD.
//
// A phone is not a narrow desktop. The grid packs ten columns into a row
// because a mouse can hit a 24px cell; a thumb cannot, and a ten-column table
// on a 360px screen is a horizontal scroller with nothing readable in view.
//
// So mobile renders the same ROW through a different presentation: a card with
// a clear hierarchy — what it is, how many, what it costs, what it comes to —
// and everything else folded behind «اطلاعات بیشتر».
//
// It reads the SAME column configuration and the SAME money engine as the
// desktop grid. Nothing here decides what a column means, and nothing here
// re-derives a total.
// ============================================
'use client'

import { memo, useState } from 'react'
import { ChevronDown, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import {
  COLUMN,
  hasCellValue,
  isForeignMoneyColumn,
  parseCellNumber,
  rowTotal,
  visibleColumns,
  type GridMoneyContext,
  type InvoiceColumn,
  type InvoiceGridRow,
} from '@hisabche/validation'
import { formatNumber } from '@hisabche/formatting'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../dropdown-menu'
import { cn } from '../../../../lib/utils'

export interface InvoiceItemCardProps {
  t: (key: string, fallback?: string) => string
  locale: string
  index: number
  row: InvoiceGridRow
  columns: readonly InvoiceColumn[]
  ctx: GridMoneyContext
  invalid: boolean
  onEdit: () => void
  onDuplicate: () => void
  onRemove: () => void
}

/**
 * The fields that earn a place on the face of the card.
 *
 * Not a hardcoded list of business fields — a list of the four ROLES every
 * invoice line has regardless of trade. A gold shop's «عیار» and a
 * contractor's «کد پروژه» are both "everything else", and both land in the
 * same disclosure without either being named here.
 */
const PRIMARY_IDS: readonly string[] = [
  COLUMN.description,
  COLUMN.quantity,
  COLUMN.unit,
  COLUMN.unitPrice,
]

/** 44px minimum, per the touch-target audit. */
const iconButton = cn(
  'inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)]',
  'text-[hsl(var(--fg-tertiary))]',
  'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary)/0.5)]',
  'transition-colors duration-150 motion-reduce:transition-none',
)

export const InvoiceItemCard = memo(function InvoiceItemCard({
  t,
  locale,
  index,
  row,
  columns,
  ctx,
  invalid,
  onEdit,
  onDuplicate,
  onRemove,
}: InvoiceItemCardProps) {
  const [expanded, setExpanded] = useState(false)

  const shown = visibleColumns(columns)
  const description = (row.values[COLUMN.description] ?? '').trim()
  const total = rowTotal(row, columns, ctx)

  /** Renders a value the way its column type means it to be read. */
  const display = (column: InvoiceColumn): string => {
    const raw = row.values[column.id] ?? ''
    if (column.type === 'computed') return formatNumber(total, locale, ctx.precision)
    if (!hasCellValue(raw)) return '—'
    if (column.type === 'boolean') {
      return raw === 'true' ? t('common.yes', 'بله') : t('common.no', 'خیر')
    }
    if (column.id === COLUMN.unit) return t(`unit.${raw}`, raw)
    if (column.type === 'select' || column.type === 'text' || column.type === 'date') return raw

    const number = formatNumber(parseCellNumber(raw), locale, column.precision)
    if (column.type === 'percent') return `${number}٪`
    if (column.type === 'currency' && isForeignMoneyColumn(column, ctx)) {
      return `${number} ${t(`currency.${(column.currency ?? '').toLowerCase()}`, column.currency ?? '')}`
    }
    return number
  }

  const label = (column: InvoiceColumn) =>
    column.labelKey ? t(column.labelKey, column.label) : column.label

  // Everything configured that is not one of the four primary roles, and not
  // the computed total (which has its own emphasised row at the bottom).
  const secondary = shown.filter(
    (c) => !PRIMARY_IDS.includes(c.id) && c.type !== 'computed' && hasCellValue(row.values[c.id]),
  )

  const quantityColumn = shown.find((c) => c.id === COLUMN.quantity)
  const unitColumn = shown.find((c) => c.id === COLUMN.unit)
  const priceColumn = shown.find((c) => c.id === COLUMN.unitPrice)

  return (
    <li
      className={cn(
        'rounded-[var(--radius-lg)] border bg-[hsl(var(--surface-elevated))]',
        invalid
          ? 'border-[hsl(var(--color-destructive)/0.5)]'
          : 'border-[hsl(var(--border-default))]',
      )}
    >
      <div className="flex items-start gap-2 p-3 pb-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-[hsl(var(--fg-tertiary))]">
            {t('invoiceBuilder.columns.description', 'شرح کالا / خدمت')}
          </p>
          {/* Tapping the name is the same as tapping edit — the biggest,
              most obvious target on the card opens the editor. */}
          <button
            type="button"
            onClick={onEdit}
            className="mt-0.5 block w-full min-h-[44px] text-start"
          >
            <span
              className={cn(
                'block truncate text-base font-semibold',
                description ? 'text-[hsl(var(--fg-primary))]' : 'text-[hsl(var(--fg-tertiary))]',
              )}
            >
              {description || t('invoiceBuilder.mobile.untitledItem', 'بدون عنوان')}
            </span>
          </button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={iconButton}
              aria-label={t('invoiceBuilder.mobile.itemActions', 'عملیات این قلم')}
            >
              <MoreVertical className="size-5" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="size-4" aria-hidden="true" />
              {t('common.edit', 'ویرایش')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate}>
              {t('invoiceBuilder.grid.duplicateRow', 'تکرار ردیف')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onRemove}>
              <Trash2 className="size-4" aria-hidden="true" />
              {t('invoiceBuilder.grid.removeRow', 'حذف ردیف')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Quantity · unit · unit price — the three numbers that explain the
          total. Laid out as label/value pairs rather than a mini-table. */}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-3 pb-2 text-sm">
        {quantityColumn ? (
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[hsl(var(--fg-secondary))]">{label(quantityColumn)}</dt>
            <dd dir="ltr" className="tabular-nums text-[hsl(var(--fg-primary))]">
              {display(quantityColumn)}
            </dd>
          </div>
        ) : null}
        {unitColumn ? (
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[hsl(var(--fg-secondary))]">{label(unitColumn)}</dt>
            <dd className="text-[hsl(var(--fg-primary))]">{display(unitColumn)}</dd>
          </div>
        ) : null}
        {priceColumn ? (
          <div className="col-span-2 flex items-baseline justify-between gap-2">
            <dt className="text-[hsl(var(--fg-secondary))]">{label(priceColumn)}</dt>
            <dd dir="ltr" className="tabular-nums text-[hsl(var(--fg-primary))]">
              {display(priceColumn)}
            </dd>
          </div>
        ) : null}
      </dl>

      {secondary.length ? (
        <div className="px-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className={cn(
              'flex min-h-[44px] w-full items-center justify-between gap-2',
              'text-sm text-[hsl(var(--color-primary))]',
            )}
          >
            {t('invoiceBuilder.mobile.moreDetails', 'اطلاعات بیشتر')}
            <ChevronDown
              className={cn(
                'size-4 transition-transform duration-150 motion-reduce:transition-none',
                expanded && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </button>

          {expanded ? (
            <dl className="space-y-1.5 pb-2 text-sm">
              {secondary.map((column) => (
                <div key={column.id} className="flex items-baseline justify-between gap-2">
                  <dt className="text-[hsl(var(--fg-secondary))]">{label(column)}</dt>
                  <dd
                    dir={column.type === 'text' || column.type === 'select' ? undefined : 'ltr'}
                    className="tabular-nums text-[hsl(var(--fg-primary))]"
                  >
                    {display(column)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}

      {/* The line total is the number the user is checking. It gets its own
          band and the strongest type on the card. */}
      <div className="flex items-baseline justify-between gap-2 border-t border-[hsl(var(--border-default))] px-3 py-2.5">
        <span className="text-sm text-[hsl(var(--fg-secondary))]">
          {t('invoiceBuilder.columns.lineTotal', 'مبلغ کل')}
        </span>
        <span dir="ltr" className="text-base font-bold tabular-nums text-[hsl(var(--fg-primary))]">
          {formatNumber(total, locale, ctx.precision)}
        </span>
      </div>

      <span className="sr-only">{`${t('invoiceBuilder.columns.rowNumber', 'ردیف')} ${index + 1}`}</span>
    </li>
  )
})

InvoiceItemCard.displayName = 'InvoiceItemCard'
