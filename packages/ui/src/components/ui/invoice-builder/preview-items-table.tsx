// ============================================
// The printable items table for STEP 2.
//
// It reads the SAME column configuration the builder writes to, so the
// promise «if you add وزن خالص you see وزن خالص here, and if you delete عیار
// it is gone» holds without either side knowing about the other. There is one
// source of truth for the layout: the draft store.
//
// It borrows the invoice document's cell styling deliberately — this is meant
// to look like the printed invoice, not like a second spreadsheet.
// ============================================
'use client'

import { memo } from 'react'
import {
  COLUMN,
  columnTotals,
  isForeignMoneyColumn,
  parseCellNumber,
  rowTotal,
  visibleColumns,
  type GridMoneyContext,
  type InvoiceColumn,
  type InvoiceGridRow,
} from '@hisabche/validation'
import { formatNumber } from '@hisabche/formatting'

import { cn } from '../../../lib/utils'

export interface PreviewItemsTableProps {
  t: (key: string, fallback?: string) => string
  locale: string
  columns: readonly InvoiceColumn[]
  rows: readonly InvoiceGridRow[]
  ctx: GridMoneyContext
}

const headCell =
  'border-e border-[hsl(var(--border-default))] px-1.5 py-2 font-medium text-[hsl(var(--fg-secondary))] sm:px-2 sm:py-3'
const bodyCell = 'border-e border-[hsl(var(--border-default))] px-1.5 py-2 sm:px-2 sm:py-3'

function isNumeric(column: InvoiceColumn): boolean {
  return (
    column.type === 'integer' ||
    column.type === 'decimal' ||
    column.type === 'currency' ||
    column.type === 'percent' ||
    column.type === 'computed'
  )
}

export const PreviewItemsTable = memo(function PreviewItemsTable({
  t,
  locale,
  columns,
  rows,
  ctx,
}: PreviewItemsTableProps) {
  // Only rows that will become invoice items are printed — a trailing blank
  // row is a builder affordance, not part of the document.
  const printed = rows.filter((row) => (row.values[COLUMN.description] ?? '').trim())
  const shown = visibleColumns(columns)
  const totals = columnTotals(printed, columns, ctx)
  const hasTotals = shown.some((c) => totals[c.id] !== undefined)

  return (
    <div className="touch-pan-y overflow-x-auto rounded-lg border border-[hsl(var(--border-default))]">
      <table className="w-full min-w-max border-collapse text-[11px] sm:text-sm">
        <thead>
          <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
            <th scope="col" className={cn(headCell, 'text-start')}>
              {t('invoiceBuilder.columns.rowNumber', 'ردیف')}
            </th>
            {shown.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cn(headCell, isNumeric(column) ? 'text-end' : 'text-start')}
              >
                {column.labelKey ? t(column.labelKey, column.label) : column.label}
                {column.currency || column.suffix ? (
                  <span className="ms-1 text-[10px] font-normal text-[hsl(var(--fg-tertiary))]">
                    (
                    {column.suffix ??
                      t(`currency.${(column.currency ?? '').toLowerCase()}`, column.currency ?? '')}
                    )
                  </span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {printed.map((row, index) => (
            <tr key={row.id} className="border-b border-[hsl(var(--border-default))]">
              <td className={cn(bodyCell, 'text-[hsl(var(--fg-tertiary))]')}>
                {formatNumber(index + 1, locale, 0)}
              </td>
              {shown.map((column) => {
                const raw = row.values[column.id] ?? ''

                if (column.type === 'computed') {
                  return (
                    <td
                      key={column.id}
                      dir="ltr"
                      className={cn(
                        bodyCell,
                        'text-end font-medium tabular-nums text-[hsl(var(--fg-primary))]',
                      )}
                    >
                      {formatNumber(rowTotal(row, columns, ctx), locale, ctx.precision)}
                    </td>
                  )
                }

                if (!raw.trim()) {
                  return (
                    <td
                      key={column.id}
                      className={cn(bodyCell, 'text-center text-[hsl(var(--fg-tertiary))]')}
                    >
                      —
                    </td>
                  )
                }

                if (column.type === 'select' && column.id === COLUMN.unit) {
                  return (
                    <td key={column.id} className={cn(bodyCell, 'text-[hsl(var(--fg-secondary))]')}>
                      {t(`unit.${raw}`, raw)}
                    </td>
                  )
                }

                if (column.type === 'boolean') {
                  return (
                    <td key={column.id} className={cn(bodyCell, 'text-center')}>
                      {raw === 'true' ? t('common.yes', 'بله') : t('common.no', 'خیر')}
                    </td>
                  )
                }

                if (isNumeric(column)) {
                  return (
                    <td
                      key={column.id}
                      dir="ltr"
                      className={cn(
                        bodyCell,
                        'text-end tabular-nums text-[hsl(var(--fg-primary))]',
                      )}
                    >
                      {formatNumber(parseCellNumber(raw), locale, column.precision)}
                      {column.type === 'percent' ? '٪' : ''}
                      {/* A foreign amount prints its own currency next to it —
                          it must never be mistaken for the invoice currency. */}
                      {isForeignMoneyColumn(column, ctx) ? (
                        <span className="ms-1 text-[10px] text-[hsl(var(--fg-tertiary))]">
                          {t(
                            `currency.${(column.currency ?? '').toLowerCase()}`,
                            column.currency ?? '',
                          )}
                        </span>
                      ) : null}
                    </td>
                  )
                }

                return (
                  <td key={column.id} className={cn(bodyCell, 'text-[hsl(var(--fg-primary))]')}>
                    {raw}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>

        {hasTotals ? (
          <tfoot>
            <tr className="bg-[hsl(var(--surface-muted))] font-medium">
              <td className={cn(bodyCell, 'text-[hsl(var(--fg-secondary))]')}>
                {t('invoiceBuilder.grid.columnTotals', 'جمع ستون‌ها')}
              </td>
              {shown.map((column) => {
                const total = totals[column.id]
                return (
                  <td
                    key={column.id}
                    dir={total === undefined ? undefined : 'ltr'}
                    className={cn(bodyCell, 'text-end tabular-nums text-[hsl(var(--fg-primary))]')}
                  >
                    {total === undefined ? '' : formatNumber(total, locale, column.precision)}
                  </td>
                )
              })}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  )
})

PreviewItemsTable.displayName = 'PreviewItemsTable'
