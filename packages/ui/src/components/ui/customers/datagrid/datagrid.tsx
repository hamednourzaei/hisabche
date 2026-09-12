// packages/ui/src/components/ui/customers/datagrid/datagrid.tsx
'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { useIntlLocale } from '../../../../hooks/use-intl-locale'

// ═══ Types ═══
export interface ColumnDef<T> {
  id: string
  header: string
  accessor: (row: T) => any
  type?: 'text' | 'number' | 'currency' | 'date' | 'badge' | 'icon'
  width?: number
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  render?: (value: any, row: T) => React.ReactNode
}

export interface BulkAction {
  id: string
  label: string
  icon: any
  onClick: (selectedIds: string[]) => void
}

interface DataGridProps<T extends { id: string }> {
  t: (key: string, fallback?: string) => string
  columns: ColumnDef<T>[]
  data: T[]
  isLoading?: boolean
  onRowClick?: (row: T) => void
  bulkActions?: BulkAction[]
  emptyMessage?: string
}

// The currency code is intentionally omitted: the user picks their currency
// once at onboarding, so repeating it in every cell is noise.
function formatCurrency(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value)
}

function formatDate(value: string, locale: string): string {
  try {
    return new Date(value).toLocaleDateString(locale)
  } catch {
    return value || '-'
  }
}

function getBadgeClass(status: string): string {
  const map: Record<string, string> = {
    paid: 'bg-[hsl(var(--color-success)/0.1)] text-[hsl(var(--color-success))]',
    pending: 'bg-[hsl(var(--color-warning)/0.1)] text-[hsl(var(--color-warning))]',
    overdue: 'bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]',
    completed: 'bg-[hsl(var(--color-success)/0.1)] text-[hsl(var(--color-success))]',
    active: 'bg-[hsl(var(--color-success)/0.1)] text-[hsl(var(--color-success))]',
    debtor: 'bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]',
    settled: 'bg-[hsl(var(--color-success)/0.1)] text-[hsl(var(--color-success))]',
  }
  return map[status] || 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]'
}

function renderCell<T>(column: ColumnDef<T>, row: T, locale: string): React.ReactNode {
  const value = column.accessor(row)
  if (column.render) return column.render(value, row)

  switch (column.type) {
    case 'currency':
      return (
        <span className="tabular-nums font-medium">
          {formatCurrency(Number(value) || 0, locale)}
        </span>
      )
    case 'date':
      return <span className="text-sm">{value ? formatDate(String(value), locale) : '-'}</span>
    case 'badge':
      return (
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            getBadgeClass(String(value)),
          )}
        >
          {String(value || '-')}
        </span>
      )
    default:
      return <span className="text-sm">{value ?? '-'}</span>
  }
}

export function DataGrid<T extends { id: string }>(props: DataGridProps<T>) {
  const { t, columns, data, isLoading, onRowClick, bulkActions, emptyMessage } = props
  const locale = useIntlLocale()

  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const parentRef = useRef<HTMLDivElement>(null)

  const sortedData = useMemo(() => {
    if (!sortKey || !data.length) return data
    const col = columns.find((c) => c.id === sortKey)
    if (!col) return data
    return [...data].sort((a, b) => {
      const va = col.accessor(a),
        vb = col.accessor(b)
      if (va == null) return 1
      if (vb == null) return -1
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir, columns])

  const virtualizer = useVirtualizer({
    count: sortedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  })

  const toggleSort = useCallback(
    (colId: string) => {
      if (sortKey === colId) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortKey(colId)
        setSortDir('asc')
      }
    },
    [sortKey],
  )

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === sortedData.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sortedData.map((r) => r.id)))
    }
  }, [sortedData, selectedIds])

  const toggleSelect = useCallback(
    (id: string) => {
      const next = new Set(selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setSelectedIds(next)
    },
    [selectedIds],
  )

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-12 rounded-lg bg-[hsl(var(--surface-muted))] skeleton-shimmer"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Bulk Actions Bar */}
      {bulkActions && selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.05)] px-4 py-2">
          <span className="text-sm font-medium text-[hsl(var(--color-primary))]">
            {selectedIds.size} {t('common.selected', 'انتخاب شده')}
          </span>
          <div className="flex-1" />
          {bulkActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => action.onClick(Array.from(selectedIds))}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border border-[hsl(var(--color-primary)/0.2)] text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.1)] transition-colors"
            >
              <action.icon className="size-3.5" />
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[hsl(var(--border-default))] overflow-hidden">
        {/* Header */}
        <div className="flex items-center bg-[hsl(var(--surface-muted))] border-b border-[hsl(var(--border-default))] px-4 py-2">
          {bulkActions && (
            <input
              type="checkbox"
              checked={selectedIds.size === sortedData.length && sortedData.length > 0}
              onChange={toggleSelectAll}
              className="me-2 size-4 accent-[hsl(var(--color-primary))]"
            />
          )}
          {columns.map((col) => (
            <div
              key={col.id}
              className={cn(
                'flex items-center gap-1 px-3 py-2 text-xs font-medium text-[hsl(var(--fg-secondary))] select-none',
                col.sortable !== false && 'cursor-pointer hover:text-[hsl(var(--fg-primary))]',
                col.width ? `w-[${col.width}px]` : 'flex-1',
                col.align === 'right' && 'justify-end',
                col.align === 'center' && 'justify-center',
              )}
              onClick={() => col.sortable !== false && toggleSort(col.id)}
            >
              {col.header}
              {sortKey === col.id &&
                (sortDir === 'asc' ? (
                  <ChevronUp className="size-3 text-[hsl(var(--color-primary))]" />
                ) : (
                  <ChevronDown className="size-3 text-[hsl(var(--color-primary))]" />
                ))}
            </div>
          ))}
        </div>

        {/* Body */}
        <div ref={parentRef} className="max-h-[500px] overflow-auto">
          {sortedData.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-[hsl(var(--fg-tertiary))]">
              {emptyMessage || t('common.noData', 'داده‌ای یافت نشد')}
            </div>
          ) : (
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = sortedData[virtualRow.index]
                if (!row) return null
                const isSelected = selectedIds.has(row.id)
                return (
                  <div
                    key={row.id}
                    className={cn(
                      'flex items-center absolute w-full border-b border-[hsl(var(--border-default))] last:border-0 transition-colors',
                      'hover:bg-[hsl(var(--surface-muted))]',
                      isSelected && 'bg-[hsl(var(--color-primary)/0.05)]',
                      onRowClick && 'cursor-pointer',
                    )}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    onClick={() => onRowClick?.(row)}
                  >
                    {bulkActions && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation()
                          toggleSelect(row.id)
                        }}
                        className="ms-4 me-2 size-4 accent-[hsl(var(--color-primary))]"
                      />
                    )}
                    {columns.map((col) => (
                      <div
                        key={col.id}
                        className={cn(
                          'px-3 py-2',
                          col.width ? `w-[${col.width}px]` : 'flex-1',
                          col.align === 'right' && 'text-end',
                          col.align === 'center' && 'text-center',
                        )}
                      >
                        {renderCell(col, row, locale)}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[hsl(var(--fg-tertiary))]">
        <span>
          {sortedData.length} {t('common.records', 'رکورد')}
        </span>
      </div>
    </div>
  )
}
