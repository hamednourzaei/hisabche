// ============================================
// The invoice spreadsheet.
//
// Two properties this component exists to guarantee:
//
//   1. It renders from the column configuration, never from a hardcoded
//      <th> list. Adding a trade-specific field is data, not code.
//   2. Horizontal overflow is confined to the scroller INSIDE the card. The
//      page itself never scrolls sideways at any width — that is what makes a
//      wide invoice usable on a 320px phone instead of broken on it.
// ============================================
'use client'

import { memo, useCallback, useMemo } from 'react'
import type { KeyboardEvent } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import {
  COLUMN,
  columnTotals,
  hasCellValue,
  isForeignMoneyColumn,
  parseCellNumber,
  rowTotal,
  rowUnitPrice,
  toInvoiceCurrency,
  visibleColumns,
  type GridMoneyContext,
  type InvoiceColumn,
  type InvoiceGridRow,
} from '@hisabche/validation'
import { formatNumber } from '@hisabche/formatting'

import { cn } from '../../../../lib/utils'
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
  onRemoveRow: (rowId: string) => void
  onDuplicateRow: (rowId: string) => void
  /** Rows the user must fix before the invoice can be confirmed. */
  invalidRowIds: ReadonlySet<string>
}

/** Minimum width per column type, so a cell is never too small to tap. */
function widthFor(column: InvoiceColumn): string {
  if (column.id === COLUMN.description) return 'min-w-[13rem]'
  if (column.type === 'currency' || column.type === 'computed') return 'min-w-[9rem]'
  if (column.type === 'select' || column.type === 'date') return 'min-w-[7rem]'
  if (column.type === 'boolean') return 'min-w-[5rem]'
  return 'min-w-[6rem]'
}

export const InvoiceItemsGrid = memo(function InvoiceItemsGrid({
  t,
  locale,
  columns,
  rows,
  ctx,
  selectedColumnId,
  onSelectColumn,
  onCellChange,
  onRemoveRow,
  onDuplicateRow,
  invalidRowIds,
}: InvoiceItemsGridProps) {
  const shown = useMemo(() => visibleColumns(columns), [columns])
  const totals = useMemo(() => columnTotals(rows, columns, ctx), [rows, columns, ctx])

  const fmt = useCallback(
    (value: number, decimals: number) => formatNumber(value, locale, decimals),
    [locale],
  )

  /**
   * Keyboard movement. Tab is left to the browser — its natural order already
   * walks the cells — so only the spreadsheet-specific keys are handled:
   * Enter drops to the row below, arrows move up and down the column.
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, rowIndex: number, columnIndex: number) => {
      // A <select> owns Arrow keys for choosing its option, so only Enter
      // moves the caret out of one.
      const isSelect = (event.target as HTMLElement).tagName === 'SELECT'

      let target: number
      if (event.key === 'Enter') target = rowIndex + 1
      else if (event.key === 'ArrowDown' && !isSelect) target = rowIndex + 1
      else if (event.key === 'ArrowUp' && !isSelect) target = rowIndex - 1
      else return

      if (target < 0 || target >= rows.length) return
      event.preventDefault()
      const next = document.querySelector<HTMLElement>(`[data-cell="${target}-${columnIndex}"]`)
      next?.focus()
    },
    [rows.length],
  )

  const hasAnyTotal = shown.some((c) => totals[c.id] !== undefined)

  return (
    // `overflow-x-auto` here and `min-w-0` on every ancestor is the whole
    // no-page-overflow strategy. The table may be 1400px wide; the page is not.
    <div className="w-full min-w-0 overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-[hsl(var(--surface-muted))]">
          <tr>
            <th
              scope="col"
              className="w-12 border-b border-[hsl(var(--border-default))] px-2 py-2.5 text-center text-xs font-semibold text-[hsl(var(--fg-secondary))]"
            >
              {t('invoiceBuilder.columns.rowNumber', 'ردیف')}
            </th>

            {shown.map((column) => {
              const selected = column.id === selectedColumnId
              const label = column.labelKey ? t(column.labelKey, column.label) : column.label
              return (
                <th
                  key={column.id}
                  scope="col"
                  className={cn(
                    'border-b border-[hsl(var(--border-default))] p-0 text-start',
                    widthFor(column),
                    selected && 'bg-[hsl(var(--color-primary)/0.12)]',
                  )}
                >
                  {/* A button, not a click handler on the th — column
                      selection has to work by tap and by keyboard, not only
                      by mouse. */}
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelectColumn(selected ? null : column.id)}
                    className={cn(
                      'w-full px-2 py-2.5 text-start text-xs font-semibold',
                      'text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]',
                      'transition-colors duration-150 motion-reduce:transition-none',
                      selected && 'text-[hsl(var(--color-primary))]',
                    )}
                  >
                    <span className="block truncate">{label}</span>
                    {column.currency || column.suffix ? (
                      <span className="mt-0.5 block truncate text-[10px] font-normal text-[hsl(var(--fg-tertiary))]">
                        {column.suffix ??
                          (column.currency
                            ? t(
                                `currency.${(column.currency ?? '').toLowerCase()}`,
                                column.currency,
                              )
                            : '')}
                      </span>
                    ) : null}
                  </button>
                </th>
              )
            })}

            <th
              scope="col"
              className="w-20 border-b border-[hsl(var(--border-default))] px-2 py-2.5 text-center text-xs font-semibold text-[hsl(var(--fg-secondary))]"
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
                  'hover:bg-[hsl(var(--surface-muted)/0.5)]',
                  invalid && 'bg-[hsl(var(--color-destructive)/0.06)]',
                )}
              >
                <td className="px-2 py-1 text-center text-xs tabular-nums text-[hsl(var(--fg-tertiary))]">
                  {formatNumber(rowIndex + 1, locale, 0)}
                </td>

                {shown.map((column, columnIndex) => {
                  const value = row.values[column.id] ?? ''

                  // The computed column shows the line total; a foreign-money
                  // cell shows what it is worth in the invoice currency, so
                  // no conversion is ever invisible.
                  let computedText: string | undefined
                  let hint: string | undefined

                  if (column.type === 'computed') {
                    computedText = fmt(rowTotal(row, columns, ctx), ctx.precision)
                  } else if (
                    column.type === 'currency' &&
                    isForeignMoneyColumn(column, ctx) &&
                    hasCellValue(value)
                  ) {
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
                      />
                    </td>
                  )
                })}

                <td className="px-1 py-1">
                  <div className="flex items-center justify-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onDuplicateRow(row.id)}
                      aria-label={t('invoiceBuilder.grid.duplicateRow', 'تکرار ردیف')}
                      className="rounded p-1.5 text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
                    >
                      <Copy className="size-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveRow(row.id)}
                      aria-label={t('invoiceBuilder.grid.removeRow', 'حذف ردیف')}
                      className="rounded p-1.5 text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))]"
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
            <tr className="bg-[hsl(var(--surface-muted))] font-semibold">
              <td className="px-2 py-2.5 text-center text-xs text-[hsl(var(--fg-secondary))]">
                {/* The count of rows that will actually become invoice items. */}
                {formatNumber(
                  rows.filter((r) => hasCellValue(r.values[COLUMN.description])).length,
                  locale,
                  0,
                )}
              </td>
              {shown.map((column, index) => {
                const total = totals[column.id]
                return (
                  <td
                    key={column.id}
                    className={cn(
                      'px-2 py-2.5 text-xs',
                      column.id === selectedColumnId && 'bg-[hsl(var(--color-primary)/0.08)]',
                    )}
                  >
                    {index === 0 && total === undefined ? (
                      <span className="text-[hsl(var(--fg-secondary))]">
                        {t('invoiceBuilder.grid.columnTotals', 'جمع ستون‌ها')}
                      </span>
                    ) : total === undefined ? null : (
                      <span
                        dir="ltr"
                        className="block tabular-nums text-[hsl(var(--fg-primary))]"
                        style={{ textAlign: 'end' }}
                      >
                        {fmt(total, column.precision)}
                      </span>
                    )}
                  </td>
                )
              })}
              <td />
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  )
})

InvoiceItemsGrid.displayName = 'InvoiceItemsGrid'

/** Exposed for the summary panel so it never re-derives the line rule. */
export function lineTotal(
  row: InvoiceGridRow,
  columns: readonly InvoiceColumn[],
  ctx: GridMoneyContext,
): number {
  return rowTotal(row, columns, ctx)
}

export { rowUnitPrice }
