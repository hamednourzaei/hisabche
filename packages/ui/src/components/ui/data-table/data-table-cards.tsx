// ============================================
// DataTable as cards — below tablet width (owner, 18 Oct 2026: «زیر اندازه‌ی
// آیپد هر جدولی مثل /activities کارت شود»).
//
// The SAME columns, the SAME rows and the SAME render functions as the table
// — no second definition per page. A card reads:
//
//   ┌──────────────────────────────────────┐
//   │ ☐  <first column, bold>          ⌄   │
//   │    label · value   (next 3 columns)  │
//   │    [actions]                         │
//   ├── opened: every remaining column ────┤
//   └──────────────────────────────────────┘
//
// Column visibility (`showFrom`) does not apply here: a card has room for
// every column, the ones that do not fit the summary sit behind the chevron.
// ============================================

'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '../../../lib/utils'
import type { TableColumn } from './table-types'

/** How many columns after the title show without opening the card. */
const SUMMARY_COLUMNS = 3

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
}

/** Split the columns the way a card reads them. Exported for the guard test. */
export function cardLayout<T>(columns: readonly TableColumn<T>[]) {
  const actions = columns.filter((column) => column.id === 'actions')
  const content = columns.filter((column) => column.id !== 'actions')
  return {
    title: content[0] ?? null,
    summary: content.slice(1, 1 + SUMMARY_COLUMNS),
    more: content.slice(1 + SUMMARY_COLUMNS),
    actions,
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 text-xs">
      <dt className="shrink-0 text-[hsl(var(--fg-tertiary))]">{label}</dt>
      <dd className="min-w-0 truncate text-end text-[hsl(var(--fg-secondary))]">{children}</dd>
    </div>
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
}: DataTableCardsProps<T>) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const layout = cardLayout(columns)
  const label = (column: TableColumn<T>) => t(column.labelKey, column.labelFallback)

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <ul className="space-y-2" data-table-cards>
      {rows.map((row, index) => {
        const key = rowKey(row, offset + index)
        const isOpen = open.has(key)
        const isSelected = selectedIds?.has(key) ?? false

        return (
          <li
            key={key}
            className={cn(
              'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-3',
              'transition-colors duration-150 motion-reduce:transition-none',
              isSelected &&
                'border-[hsl(var(--color-primary)/0.5)] bg-[hsl(var(--color-primary)/0.06)]',
            )}
          >
            <div className="flex items-start gap-2">
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
                  <div className="truncate text-sm font-semibold text-[hsl(var(--fg-primary))]">
                    {layout.title.render(row)}
                  </div>
                )}
                {layout.summary.length > 0 && (
                  <dl className="mt-1.5 space-y-1">
                    {layout.summary.map((column) => (
                      <Field key={column.id} label={label(column)}>
                        {column.render(row)}
                      </Field>
                    ))}
                  </dl>
                )}
              </div>

              {layout.more.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-expanded={isOpen}
                  aria-label={isOpen ? t('common.showLess', 'بستن') : t('common.showMore', 'بیشتر')}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))]"
                >
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

            {isOpen && layout.more.length > 0 && (
              <dl className="mt-2 space-y-1 border-t border-[hsl(var(--border-default))] pt-2">
                {layout.more.map((column) => (
                  <Field key={column.id} label={label(column)}>
                    {column.render(row)}
                  </Field>
                ))}
              </dl>
            )}

            {layout.actions.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                {layout.actions.map((column) => (
                  <div key={column.id}>{column.render(row)}</div>
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
