// ============================================
// The invoice spreadsheet.
//
// Three properties this component exists to guarantee:
//
//   1. It renders from the column configuration, never from a hardcoded
//      <th> list. Adding a trade-specific field is data, not code.
//   2. Columns are sized to their CONTENT, not to a fixed generous minimum.
//      The first version gave every column ~6–13rem, so five columns needed a
//      scrollbar on a laptop. Now the widths follow the type, the table is
//      `w-full` with `table-auto`, and horizontal scrolling only starts when
//      the columns genuinely cannot fit.
//   3. Horizontal overflow is confined to the scroller INSIDE the card. The
//      page itself never scrolls sideways at any width.
// ============================================
'use client'

import { memo, useCallback, useMemo } from 'react'
import type { KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, Copy, Trash2 } from 'lucide-react'
import {
  COLUMN,
  columnTotals,
  hasCellValue,
  isForeignMoneyColumn,
  parseCellNumber,
  rowTotal,
  toInvoiceCurrency,
  visibleColumns,
  type GridMoneyContext,
  type InvoiceColumn,
  type InvoiceGridRow,
} from '@hisabche/validation'
import { formatNumber } from '@hisabche/formatting'

import { cn } from '../../../../lib/utils'
import { DescriptionCell } from './description-cell'
import { GridCell } from './grid-cell'

export interface InvoiceItemsGridProps {
  t: (key: string, fallback?: string) => string
  locale: string
  columns: readonly InvoiceColumn[]
  rows: readonly InvoiceGridRow[]
  ctx: GridMoneyContext
  selectedColumnId: string | null
  onSelectColumn: (id: string | null) => void
  onCellChange: (rowId: string, columnId: string, value: string) => void
  onPickProduct: (
    rowId: string,
    product: { id: string; name: string; price: string; unit: string },
  ) => void
  onMoveColumn: (id: string, direction: -1 | 1) => void
  onRemoveRow: (rowId: string) => void
  onDuplicateRow: (rowId: string) => void
  /** Rows the user must fix before the invoice can be confirmed. */
  invalidRowIds: ReadonlySet<string>
  /** See `DescriptionCell.pickAs`. Absent = an invoice line. */
  pickAs?: 'sale' | 'component' | undefined
}

/**
 * Width per column type.
 *
 * A percentage `width` on a `table-auto` layout is a HINT: the browser gives
 * the description the slack and lets the numeric columns shrink to their
 * content. That is why five columns now fill a laptop instead of overflowing
 * it, and why a fourteen-column gold invoice still scrolls gracefully.
 */
function widthFor(column: InvoiceColumn): { className: string; width?: string } {
  if (column.id === COLUMN.description) {
    return { className: 'min-w-[10rem]', width: '32%' }
  }
  if (column.type === 'currency' || column.type === 'computed') {
    return { className: 'min-w-[7rem] w-[1%] whitespace-nowrap' }
  }
  if (column.type === 'select' || column.type === 'date') {
    return { className: 'min-w-[5.5rem] w-[1%] whitespace-nowrap' }
  }
  if (column.type === 'boolean') {
    return { className: 'min-w-[3.5rem] w-[1%] whitespace-nowrap' }
  }
  if (column.type === 'text') {
    return { className: 'min-w-[7rem]' }
  }
  return { className: 'min-w-[4.5rem] w-[1%] whitespace-nowrap' }
}

/** Vertical rule between every column, in both the head and the body. */
const cellBorder = 'border-s border-[hsl(var(--border-default))]'
const numericFont = 'tabular-nums [font-variant-numeric:tabular-nums] font-medium'

/** Reveal-on-intent, so an idle header row is only labels. */
const headArrow = cn(
  'shrink-0 rounded p-0.5 text-[hsl(var(--fg-tertiary))]',
  'opacity-0 group-hover/head:opacity-100 focus-visible:opacity-100',
  'hover:text-[hsl(var(--color-primary))]',
  'disabled:opacity-0 disabled:group-hover/head:opacity-20',
  'transition-opacity duration-150 motion-reduce:transition-none',
  // No hover on touch, so the affordance has to be permanently available.
  '[@media(pointer:coarse)]:opacity-100',
)

export const InvoiceItemsGrid = memo(function InvoiceItemsGrid({
  t,
  locale,
  columns,
  rows,
  ctx,
  selectedColumnId,
  onSelectColumn,
  onCellChange,
  onPickProduct,
  onMoveColumn,
  onRemoveRow,
  onDuplicateRow,
  invalidRowIds,
  pickAs,
}: InvoiceItemsGridProps) {
  const shown = useMemo(() => visibleColumns(columns), [columns])
  const totals = useMemo(() => columnTotals(rows, columns, ctx), [rows, columns, ctx])

  const fmt = useCallback(
    (value: number, decimals: number) => formatNumber(value, locale, decimals),
    [locale],
  )

  /**
   * Keyboard movement. Tab is left to the browser — its natural order already
   * walks the cells — so only the spreadsheet-specific keys are handled here.
   * Arrow keys are claimed by the stepper and the select, so Enter is the one
   * key that always moves down a row.
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, rowIndex: number, columnIndex: number) => {
      if (event.key !== 'Enter') return
      const target = rowIndex + 1
      if (target >= rows.length) return
      event.preventDefault()
      const next = document.querySelector<HTMLElement>(`[data-cell="${target}-${columnIndex}"]`)
      next?.focus()
    },
    [rows.length],
  )

  const hasAnyTotal = shown.some((c) => totals[c.id] !== undefined)
  const filledCount = rows.filter((r) => hasCellValue(r.values[COLUMN.description])).length

  return (
    // `overflow-x-auto` here plus `min-w-0` on every ancestor is the whole
    // no-page-overflow strategy: the table may be wide, the page never is.
    <div className="w-full min-w-0 overflow-x-auto">
      <table className="w-full table-auto border-collapse text-sm">
        <thead className="sticky top-0 z-20 bg-[hsl(var(--surface-muted))]">
          <tr>
            <th
              scope="col"
              className="w-[1%] whitespace-nowrap border-b border-[hsl(var(--border-default))] px-2 py-1.5 text-center text-[11px] font-semibold text-[hsl(var(--fg-secondary))]"
            >
              {t('invoiceBuilder.columns.rowNumber', 'ردیف')}
            </th>

            {shown.map((column, index) => {
              const selected = column.id === selectedColumnId
              const label = column.labelKey ? t(column.labelKey, column.label) : column.label
              const size = widthFor(column)
              return (
                <th
                  key={column.id}
                  scope="col"
                  {...(size.width ? { style: { width: size.width } } : {})}
                  className={cn(
                    'border-b border-[hsl(var(--border-default))] p-0 text-start align-bottom',
                    cellBorder,
                    size.className,
                    selected && 'bg-[hsl(var(--color-primary)/0.12)]',
                  )}
                >
                  <div className="group/head flex items-center gap-0.5 px-1 py-1">
                    {/*
                      Reorder, right on the header — moving a column is a
                      direct-manipulation gesture, not a settings trip.

                      DIRECTION: these move a column toward the START or the
                      END of the row, which in RTL is visually right and left
                      respectively — the opposite of LTR. `ChevronRight` was
                      being mirrored by `rtl:rotate-180`, which cancelled that
                      out and left both arrows pointing the wrong way in
                      Persian. Rendering the glyph that already points the
                      right way per direction, with no rotation, makes the two
                      languages behave identically.

                      VISIBILITY: shown on hover, on keyboard focus, and while
                      the column is selected. Idle headers are just labels.
                    */}
                    <button
                      type="button"
                      onClick={() => onMoveColumn(column.id, -1)}
                      disabled={index === 0}
                      aria-label={t('invoiceBuilder.settings.moveStart', 'انتقال به ابتدا')}
                      className={cn(headArrow, selected && 'opacity-100')}
                    >
                      <ChevronRight className="size-3 hidden ltr:block" aria-hidden="true" />
                      <ChevronLeft className="size-3 hidden rtl:block" aria-hidden="true" />
                    </button>

                    {/* A button, not a click handler on the th — column
                        selection has to work by tap and by keyboard. */}
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onSelectColumn(selected ? null : column.id)}
                      className={cn(
                        'min-w-0 flex-1 rounded px-1 py-0.5 text-start text-[11px] font-semibold leading-tight',
                        'text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]',
                        'transition-colors duration-150 motion-reduce:transition-none',
                        selected && 'text-[hsl(var(--color-primary))]',
                      )}
                    >
                      <span className="block truncate">{label}</span>
                      {column.currency || column.suffix ? (
                        <span className="block truncate text-[10px] font-normal text-[hsl(var(--fg-tertiary))]">
                          {column.suffix ??
                            (column.currency
                              ? t(`currency.${column.currency.toLowerCase()}`, column.currency)
                              : '')}
                        </span>
                      ) : null}
                    </button>

                    <button
                      type="button"
                      onClick={() => onMoveColumn(column.id, 1)}
                      disabled={index === shown.length - 1}
                      aria-label={t('invoiceBuilder.settings.moveEnd', 'انتقال به انتها')}
                      className={cn(headArrow, selected && 'opacity-100')}
                    >
                      <ChevronLeft className="size-3 hidden ltr:block" aria-hidden="true" />
                      <ChevronRight className="size-3 hidden rtl:block" aria-hidden="true" />
                    </button>
                  </div>
                </th>
              )
            })}

            <th
              scope="col"
              className={cn(
                'w-[1%] whitespace-nowrap border-b border-[hsl(var(--border-default))] px-2 py-1.5',
                'text-center text-[11px] font-semibold text-[hsl(var(--fg-secondary))]',
                cellBorder,
              )}
            >
              {t('invoiceBuilder.columns.actions', 'عملیات')}
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIndex) => {
            const invalid = invalidRowIds.has(row.id)
            return (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-[hsl(var(--border-default))]',
                  'hover:bg-[hsl(var(--surface-muted)/0.4)]',
                  invalid && 'bg-[hsl(var(--color-destructive)/0.06)]',
                )}
              >
                <td
                  className={cn(
                    'px-2 py-1 text-center text-[11px] text-[hsl(var(--fg-tertiary))]',
                    numericFont,
                  )}
                >
                  {formatNumber(rowIndex + 1, locale, 0)}
                </td>

                {shown.map((column, columnIndex) => {
                  const value = row.values[column.id] ?? ''

                  let computedText: string | undefined
                  let hint: string | undefined

                  if (column.type === 'computed') {
                    computedText = fmt(rowTotal(row, columns, ctx), ctx.precision)
                  } else if (
                    column.type === 'currency' &&
                    isForeignMoneyColumn(column, ctx) &&
                    hasCellValue(value)
                  ) {
                    // A foreign amount always shows what it is worth here, so
                    // no conversion is ever invisible.
                    const converted = toInvoiceCurrency(
                      parseCellNumber(value),
                      column.currency ?? ctx.currency,
                      ctx,
                    )
                    hint =
                      converted === null
                        ? t('invoiceBuilder.grid.noRate', 'بدون نرخ')
                        : `≈ ${fmt(converted, ctx.precision)}`
                  }

                  return (
                    <td
                      key={column.id}
                      className={cn(
                        'p-0 align-middle',
                        cellBorder,
                        column.id === selectedColumnId && 'bg-[hsl(var(--color-primary)/0.05)]',
                      )}
                    >
                      <GridCell
                        t={t}
                        column={column}
                        value={value}
                        {...(computedText !== undefined ? { computedText } : {})}
                        hint={hint}
                        rowIndex={rowIndex}
                        columnIndex={columnIndex}
                        onChange={(next) => onCellChange(row.id, column.id, next)}
                        onKeyDown={handleKeyDown}
                        {...(column.id === COLUMN.description
                          ? {
                              slot: (
                                <DescriptionCell
                                  t={t}
                                  locale={locale}
                                  value={value}
                                  productId={row.productId}
                                  rowIndex={rowIndex}
                                  columnIndex={columnIndex}
                                  onChange={(next) =>
                                    onCellChange(row.id, COLUMN.description, next)
                                  }
                                  onPickProduct={(product) => onPickProduct(row.id, product)}
                                  pickAs={pickAs}
                                  onKeyDown={handleKeyDown}
                                />
                              ),
                            }
                          : {})}
                      />
                    </td>
                  )
                })}

                <td className={cn('px-1 py-0.5', cellBorder)}>
                  <div className="flex items-center justify-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onDuplicateRow(row.id)}
                      aria-label={t('invoiceBuilder.grid.duplicateRow', 'تکرار ردیف')}
                      className="rounded p-1 text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
                    >
                      <Copy className="size-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveRow(row.id)}
                      aria-label={t('invoiceBuilder.grid.removeRow', 'حذف ردیف')}
                      className="rounded p-1 text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))]"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>

        {hasAnyTotal ? (
          <tfoot>
            <tr className="border-t-2 border-[hsl(var(--border-strong),var(--border-default))] bg-[hsl(var(--surface-muted))] font-semibold">
              {/* The row-number column carries the LABEL here, not a number.
                  It used to print "۱", which read as a sixth invoice line. */}
              <td
                className="whitespace-nowrap px-2 py-2 text-center text-[11px] text-[hsl(var(--fg-secondary))]"
                title={t('invoiceBuilder.grid.columnTotals', 'جمع ستون‌ها')}
              >
                Σ
              </td>
              {shown.map((column, index) => {
                const total = totals[column.id]
                return (
                  <td
                    key={column.id}
                    className={cn(
                      'px-2 py-2 text-[11px]',
                      cellBorder,
                      column.id === selectedColumnId && 'bg-[hsl(var(--color-primary)/0.08)]',
                    )}
                  >
                    {total === undefined ? (
                      index === 0 ? (
                        <span className="text-[hsl(var(--fg-secondary))]">
                          {t('invoiceBuilder.grid.columnTotals', 'جمع ستون‌ها')}
                        </span>
                      ) : null
                    ) : (
                      <span
                        dir="ltr"
                        className={cn('block text-end text-[hsl(var(--fg-primary))]', numericFont)}
                      >
                        {fmt(total, column.precision)}
                      </span>
                    )}
                  </td>
                )
              })}
              <td
                className={cn(
                  'px-2 py-2 text-center text-[11px] text-[hsl(var(--fg-tertiary))]',
                  cellBorder,
                )}
              >
                {formatNumber(filledCount, locale, 0)}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  )
})

InvoiceItemsGrid.displayName = 'InvoiceItemsGrid'
