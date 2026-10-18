// ============================================
// DataTable — one table implementation for every dashboard page.
//
// Gives every table: collapsible search, column settings, sortable headers,
// responsive column hiding, no-wrap cells — and (18 Oct 2026, owner):
//   · below tablet width (md) the rows are CARDS, like /activities
//     (`data-table-cards.tsx`, same columns and render functions);
//   · a pager: previous / page / next and the page size, the same look as the
//     product list. Shown only when there is more than one page; a page that
//     pages its rows itself passes `paginate={false}`.
// ============================================

'use client'

import { memo, useEffect, useMemo, useState, type ReactNode } from 'react'
import { PAGE_SIZES } from '@hisabche/ui-contract'

import { cn } from '../../../lib/utils'
import { ActionButton, Badge, SelectField } from '../capability/capability-kit'
import { DataTableCards, type CardTone } from './data-table-cards'
import { SavedViewsMenu } from './saved-views-menu'
import { SortableHeader } from './sortable-header'
import { TableToolbar } from './table-toolbar'
import { VISIBILITY_CLASS, type TableColumn } from './table-types'
import { useTableState } from './use-table-state'

export interface DataTableProps<T> {
  /** Stable id — persists the user's column choices. */
  tableId: string
  t: (key: string, fallback?: string) => string
  rows: readonly T[]
  columns: readonly TableColumn<T>[]
  rowKey: (row: T, index: number) => string
  onRowClick?: ((row: T) => void) | undefined
  /** Omit both for a table with no search control. */
  searchValue?: string | undefined
  onSearchChange?: ((value: string) => void) | undefined
  /** Export buttons, rendered next to the search and column icons. */
  actions?: ReactNode
  emptyState?: ReactNode
  /** Minimum table width before horizontal scrolling kicks in. */
  minWidthClass?: string

  // ─── Selection (opt-in) ───
  // Omitting `selectedIds` leaves the table exactly as it was: no checkbox
  // column, no behaviour change for the pages that do not support bulk work.
  /** Keys of the currently selected rows. Presence turns selection on. */
  selectedIds?: ReadonlySet<string> | undefined
  onToggleRow?: ((id: string) => void) | undefined
  /** Receives every currently visible row key — respects the active filter. */
  onToggleAll?: ((ids: readonly string[]) => void) | undefined
  /** Rendered above the table when at least one row is selected. */
  bulkBar?: ReactNode
  /**
   * The built-in pager. Default on; `false` for a page that already pages
   * its rows (server pages, its own pager) — two pagers would split a page.
   */
  paginate?: boolean | undefined
  /** Below tablet width: the row's state, as the card's coloured edge. */
  cardTone?: ((row: T) => CardTone | undefined) | undefined
  /** Column ids to put first in the card's grid (the table's order is untouched). */
  cardOrder?: readonly string[] | undefined
}

/** Below the `md` breakpoint (tablet). */
const CARDS_QUERY = '(max-width: 767px)'

/**
 * Cards or table — ONE of them is rendered, never both hidden by CSS (that
 * drew every row twice: twice the DOM, and two of every button). The server
 * and the first paint render the table; the effect switches to cards on a
 * narrow screen, so there is no hydration mismatch (CLAUDE.md §8, React 19).
 */
function useCards(): boolean {
  const [cards, setCards] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(CARDS_QUERY)
    setCards(media.matches)
    const onChange = (event: MediaQueryListEvent) => setCards(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return cards
}

/** Which slice of the rows a page shows. Exported for the guard test. */
export function pageSlice(total: number, page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), pageCount)
  const start = (current - 1) * pageSize
  return { page: current, pageCount, start, end: Math.min(total, start + pageSize) }
}

function DataTableInner<T>({
  tableId,
  t,
  rows,
  columns,
  rowKey,
  onRowClick,
  searchValue,
  onSearchChange,
  actions,
  emptyState,
  minWidthClass = 'min-w-[640px] sm:min-w-[720px]',
  selectedIds,
  onToggleRow,
  onToggleAll,
  bulkBar,
  paginate = true,
  cardTone,
  cardOrder,
}: DataTableProps<T>) {
  const state = useTableState(tableId, columns)
  const sorted = useMemo(() => state.sortRows(rows), [rows, state])

  const cards = useCards()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0])
  // A filter that shrinks the rows clamps the page instead of showing nothing.
  const view = paginate
    ? pageSlice(sorted.length, page, pageSize)
    : { page: 1, pageCount: 1, start: 0, end: sorted.length }
  const pageRows = useMemo(() => sorted.slice(view.start, view.end), [sorted, view.start, view.end])

  const selectable = selectedIds !== undefined

  const visibleIds = useMemo(() => sorted.map((row, index) => rowKey(row, index)), [sorted, rowKey])

  // "All" means all rows the user can currently see, not everything on the
  // server — selecting rows hidden behind a filter would be a trap.
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds?.has(id))
  const someSelected = !allSelected && visibleIds.some((id) => selectedIds?.has(id))

  return (
    <div className="w-full">
      <TableToolbar
        t={t}
        columns={columns}
        hiddenIds={state.hiddenIds}
        onToggleColumn={state.toggleColumn}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        actions={
          <>
            <SavedViewsMenu
              t={t}
              tableId={tableId}
              current={{
                hiddenIds: state.hiddenIds,
                sortId: state.sortId,
                sortDirection: state.sortDirection,
                search: searchValue ?? '',
              }}
              onApply={(look) => {
                state.applyLook(look)
                // A table whose search lives elsewhere has no handler; the
                // view's columns and sort still apply.
                onSearchChange?.(look.search)
              }}
            />
            {actions}
          </>
        }
      />

      {bulkBar}

      {rows.length === 0 && emptyState ? (
        emptyState
      ) : (
        <>
          {cards ? (
            <DataTableCards
              t={t}
              rows={pageRows}
              columns={state.visibleColumns}
              rowKey={rowKey}
              offset={view.start}
              onRowClick={onRowClick}
              selectedIds={selectedIds}
              onToggleRow={onToggleRow}
              cardTone={cardTone}
              cardOrder={cardOrder}
            />
          ) : (
            <div className="w-full overflow-x-auto rounded-2xl border border-[hsl(var(--border-default))]">
              <table className={cn('w-full text-sm', minWidthClass)}>
                <thead>
                  <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                    {selectable && (
                      <th scope="col" className="w-10 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(node) => {
                            // Indeterminate is DOM-only state — React has no prop
                            // for it, so it must be written on the node.
                            if (node) node.indeterminate = someSelected
                          }}
                          onChange={() => onToggleAll?.(visibleIds)}
                          aria-label={t('common.selectAll', 'انتخاب همه')}
                          className="size-4 cursor-pointer accent-[hsl(var(--color-primary))]"
                        />
                      </th>
                    )}
                    {state.visibleColumns.map((column) => (
                      <SortableHeader
                        key={column.id}
                        column={column}
                        label={t(column.labelKey, column.labelFallback)}
                        sortId={state.sortId}
                        sortDirection={state.sortDirection}
                        onToggleSort={state.toggleSort}
                      />
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {pageRows.map((row, index) => {
                    const key = rowKey(row, view.start + index)
                    const isSelected = selectedIds?.has(key) ?? false

                    return (
                      <tr
                        key={key}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                        className={cn(
                          'border-b border-[hsl(var(--border-default))] last:border-0',
                          'transition-colors duration-150 motion-reduce:transition-none',
                          onRowClick && 'cursor-pointer hover:bg-[hsl(var(--surface-muted)/0.5)]',
                          isSelected && 'bg-[hsl(var(--color-primary)/0.06)]',
                        )}
                      >
                        {selectable && (
                          <td className="w-10 px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              // The row itself navigates; without this a click on the
                              // checkbox would also open the record.
                              onClick={(event) => event.stopPropagation()}
                              onChange={() => onToggleRow?.(key)}
                              aria-label={t('common.selectRow', 'انتخاب ردیف')}
                              className="size-4 cursor-pointer accent-[hsl(var(--color-primary))]"
                            />
                          </td>
                        )}
                        {state.visibleColumns.map((column) => (
                          <td
                            key={column.id}
                            className={cn(
                              'whitespace-nowrap px-3 py-2.5',
                              column.align === 'end' ? 'text-end' : 'text-start',
                              VISIBILITY_CLASS[column.showFrom ?? 'always'],
                            )}
                          >
                            {column.render(row)}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {paginate && sorted.length > PAGE_SIZES[0] ? (
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3" data-table-pager>
              <div className="flex items-center gap-2">
                <ActionButton
                  variant="quiet"
                  disabled={view.page <= 1}
                  onClick={() => setPage(view.page - 1)}
                >
                  {t('common.previous', 'قبلی')}
                </ActionButton>
                <Badge>
                  <span dir="ltr" className="tabular-nums">
                    {view.page} / {view.pageCount}
                  </span>
                </Badge>
                <ActionButton
                  variant="quiet"
                  disabled={view.page >= view.pageCount}
                  onClick={() => setPage(view.page + 1)}
                >
                  {t('common.next', 'بعدی')}
                </ActionButton>
              </div>
              <div className="flex items-end gap-3">
                <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                  {t('common.total', 'مجموع')}:{' '}
                  <span dir="ltr" className="tabular-nums">
                    {sorted.length}
                  </span>
                </p>
                <div className="w-28">
                  <SelectField
                    label={t('common.page_size', 'تعداد در صفحه')}
                    value={String(pageSize)}
                    onChange={(value) => {
                      setPageSize(Number(value))
                      setPage(1)
                    }}
                    options={PAGE_SIZES.map((size) => ({
                      value: String(size),
                      label: String(size),
                    }))}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export const DataTable = memo(DataTableInner) as typeof DataTableInner
