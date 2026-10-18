// ============================================
// DataTable as cards — below tablet width (owner, 18 Oct 2026: «زیر اندازه‌ی
// آیپد هر جدولی مثل /activities کارت شود»; then the owner's Android mock-up:
// title on the right, the values as label-over-value cells with a line down
// the middle and between rows, a coloured edge for the row's state).
//
// The SAME columns, the SAME rows and the SAME render functions as the table
// — no second definition per page. A card reads:
//
//   ┃ <first column, bold>                         [actions] │
//   ┃ واحد: <unit column>                                    │
//   ┃ ─────────────────────────────────────────────────────── │
//   ┃  label              │  label                           │
//   ┃  value              │  value                           │
//   ┃ ─────────────────────────────────────────────────────── │
//   ┃  label              │  label                           │
//   ┃  value              │  value                           │
//   ┃ ─────────────────────────────────────────────────────── │
//   ┃ <status badge>                              بیشتر  ⌄  │
//   └ the right edge takes the row's tone (cardTone), when the page gives one
//
// Roles come from the column ids every table already uses: \`actions\`,
// \`unit\`, and \`status\`/\`stockStatus\`. No product image, no icon column: a
// card is a record, information first (owner's brief).
// ============================================

'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '../../../lib/utils'
import type { TableColumn } from './table-types'

/** How many cells sit in the grid before the chevron (two rows of two). */
const GRID_CELLS = 4

/** The state a row is in — the card's right edge. */
export type CardTone = 'success' | 'warning' | 'destructive'

const TONE_EDGE: Record<CardTone, string> = {
  success: 'border-s-[hsl(var(--color-success))]',
  warning: 'border-s-[hsl(var(--color-warning))]',
  destructive: 'border-s-[hsl(var(--color-destructive))]',
}

export interface DataTableCardsProps<T> {
  t: (key: string, fallback?: string) => string
  rows: readonly T[]
  columns: readonly TableColumn<T>[]
  rowKey: (row: T, index: number) => string
  /** Index of each row in the full sorted list — keeps `rowKey` stable across pages. */
  offset: number
  onRowClick?: ((row: T) => void) | undefined
  selectedIds?: ReadonlySet<string> | undefined
  onToggleRow?: ((id: string) => void) | undefined
  /** The row's state, for the card's edge. Omitted = a neutral card. */
  cardTone?: ((row: T) => CardTone | undefined) | undefined
  /** Column ids to put first in the card's grid; the rest keep the table's order. */
  cardOrder?: readonly string[] | undefined
}

const STATUS_IDS = new Set(['status', 'stockStatus'])

/** Split the columns the way a card reads them. Exported for the guard test. */
export function cardLayout<T>(
  columns: readonly TableColumn<T>[],
  cardOrder: readonly string[] = [],
) {
  const actions = columns.filter((column) => column.id === 'actions')
  const status = columns.filter((column) => STATUS_IDS.has(column.id))
  const subtitle = columns.find((column) => column.id === 'unit') ?? null
  const content = columns.filter(
    (column) => column.id !== 'actions' && column.id !== 'unit' && !STATUS_IDS.has(column.id),
  )
  const rest = content.slice(1)
  const rank = (id: string) => {
    const at = cardOrder.indexOf(id)
    return at < 0 ? cardOrder.length : at
  }
  // A stable sort: named ids first, in their order; the others as in the table.
  const ordered = rest
    .map((column, index) => ({ column, index }))
    .sort((a, b) => rank(a.column.id) - rank(b.column.id) || a.index - b.index)
    .map(({ column }) => column)
  return {
    title: content[0] ?? null,
    subtitle,
    grid: ordered.slice(0, GRID_CELLS),
    more: ordered.slice(GRID_CELLS),
    status,
    actions,
  }
}

/** One cell: the label over its value. */
function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 px-3 py-2.5">
      <dt className="text-[11px] leading-5 text-[hsl(var(--fg-tertiary))]">{label}</dt>
      <dd className="truncate text-sm font-semibold leading-6 text-[hsl(var(--fg-primary))]">
        {children}
      </dd>
    </div>
  )
}

/** Cells two by two, a line down the middle and between rows. */
function CellGrid({ children }: { children: ReactNode[] }) {
  const rows: ReactNode[][] = []
  for (let i = 0; i < children.length; i += 2) rows.push(children.slice(i, i + 2))
  return (
    <dl className="divide-y divide-[hsl(var(--border-default))] border-y border-[hsl(var(--border-default))]">
      {rows.map((pair, index) => (
        <div key={index} className="grid grid-cols-2">
          <div>{pair[0]}</div>
          {/* In RTL the second cell sits on the LEFT; its start edge is the middle line. */}
          <div className="border-s border-[hsl(var(--border-default))]">{pair[1] ?? null}</div>
        </div>
      ))}
    </dl>
  )
}

export function DataTableCards<T>({
  t,
  rows,
  columns,
  rowKey,
  offset,
  onRowClick,
  selectedIds,
  onToggleRow,
  cardTone,
  cardOrder,
}: DataTableCardsProps<T>) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const layout = cardLayout(columns, cardOrder)
  const label = (column: TableColumn<T>) => t(column.labelKey, column.labelFallback)

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <ul className="space-y-3" data-table-cards>
      {rows.map((row, index) => {
        const key = rowKey(row, offset + index)
        const isOpen = open.has(key)
        const isSelected = selectedIds?.has(key) ?? false
        const tone = cardTone?.(row)

        return (
          <li
            key={key}
            data-card-tone={tone ?? 'none'}
            className={cn(
              'overflow-hidden rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] shadow-sm',
              tone && cn('border-s-[3px]', TONE_EDGE[tone]),
              'transition-colors duration-150 motion-reduce:transition-none',
              isSelected && 'bg-[hsl(var(--color-primary)/0.06)]',
            )}
          >
            {/* Title on the right, actions on the left. */}
            <div className="flex items-start gap-2 px-4 pb-3 pt-3.5">
              {selectedIds !== undefined && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleRow?.(key)}
                  aria-label={t('common.selectRow', 'انتخاب ردیف')}
                  className="mt-1 size-4 shrink-0 cursor-pointer accent-[hsl(var(--color-primary))]"
                />
              )}
              <div
                className={cn('min-w-0 flex-1', onRowClick && 'cursor-pointer')}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {layout.title && (
                  <div className="truncate text-base font-semibold leading-7 text-[hsl(var(--fg-primary))]">
                    {layout.title.render(row)}
                  </div>
                )}
                {layout.subtitle && (
                  <div className="truncate text-xs leading-5 text-[hsl(var(--fg-tertiary))]">
                    {label(layout.subtitle)}: {layout.subtitle.render(row)}
                  </div>
                )}
              </div>
              {layout.actions.length > 0 && (
                <div className="flex shrink-0 items-center gap-1">
                  {layout.actions.map((column) => (
                    <div key={column.id}>{column.render(row)}</div>
                  ))}
                </div>
              )}
            </div>

            {layout.grid.length > 0 && (
              <div
                className={cn(onRowClick && 'cursor-pointer')}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                <CellGrid>
                  {layout.grid.map((column) => (
                    <Cell key={column.id} label={label(column)}>
                      {column.render(row)}
                    </Cell>
                  ))}
                </CellGrid>
              </div>
            )}

            {isOpen && layout.more.length > 0 && (
              <CellGrid>
                {layout.more.map((column) => (
                  <Cell key={column.id} label={label(column)}>
                    {column.render(row)}
                  </Cell>
                ))}
              </CellGrid>
            )}

            {layout.status.length > 0 || layout.more.length > 0 ? (
              <div className="flex items-center justify-between gap-2 px-4 py-2.5">
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
                  {layout.status.map((column) => (
                    <div key={column.id}>{column.render(row)}</div>
                  ))}
                </div>
                {layout.more.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    aria-expanded={isOpen}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))]"
                  >
                    {isOpen ? t('common.showLess', 'بستن') : t('common.showMore', 'بیشتر')}
                    <ChevronDown
                      className={cn(
                        'size-4 transition-transform duration-150 motion-reduce:transition-none',
                        isOpen && 'rotate-180',
                      )}
                      aria-hidden="true"
                    />
                  </button>
                )}
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
