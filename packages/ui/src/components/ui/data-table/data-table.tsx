// ============================================
// DataTable — one table implementation for every dashboard page.
//
// Gives every table: collapsible search, column settings, sortable headers,
// responsive column hiding, and no-wrap cells.
// ============================================

'use client'

import { memo, useMemo, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
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
}: DataTableProps<T>) {
  const state = useTableState(tableId, columns)
  const sorted = useMemo(() => state.sortRows(rows), [rows, state])

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
              {sorted.map((row, index) => {
                const key = rowKey(row, index)
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
    </div>
  )
}

export const DataTable = memo(DataTableInner) as typeof DataTableInner
