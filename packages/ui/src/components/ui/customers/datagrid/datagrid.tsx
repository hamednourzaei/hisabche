// packages/ui/src/components/ui/customers/datagrid/datagrid.tsx
"use client"

import { useState, useMemo, useCallback, useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ChevronUp, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"

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
  searchable?: boolean
  onRowClick?: (row: T) => void
  bulkActions?: BulkAction[]
  emptyMessage?: string
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fa-IR').format(value)
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('fa-IR')
}

function getBadgeClass(status: string): string {
  const map: Record<string, string> = {
    paid: "bg-[hsl(var(--color-success)/0.1)] text-[hsl(var(--color-success))]",
    pending: "bg-[hsl(var(--color-warning)/0.1)] text-[hsl(var(--color-warning))]",
    overdue: "bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]",
    completed: "bg-[hsl(var(--color-success)/0.1)] text-[hsl(var(--color-success))]",
    active: "bg-[hsl(var(--color-success)/0.1)] text-[hsl(var(--color-success))]",
  }
  return map[status] || "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]"
}

function renderCell<T>(column: ColumnDef<T>, row: T): React.ReactNode {
  const value = column.accessor(row)
  if (column.render) return column.render(value, row)
  
  switch (column.type) {
    case 'currency':
      return <span className="tabular-nums font-medium">{formatCurrency(Number(value) || 0)} AFN</span>
    case 'date':
      return <span className="text-sm">{value ? formatDate(String(value)) : '-'}</span>
    case 'badge':
      return (
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", getBadgeClass(String(value)))}>
          {value}
        </span>
      )
    default:
      return <span className="text-sm">{value || '-'}</span>
  }
}

export function DataGrid<T extends { id: string }>(props: DataGridProps<T>) {
  const {
    t, columns, data, isLoading, searchable, onRowClick,
    bulkActions, emptyMessage,
  } = props

  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const parentRef = useRef<HTMLDivElement>(null)

  const sortedData = useMemo(() => {
    if (!sortKey) return data
    const col = columns.find(c => c.id === sortKey)
    if (!col) return data
    return [...data].sort((a, b) => {
      const va = col.accessor(a), vb = col.accessor(b)
      if (va == null) return 1
      if (vb == null) return -1
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir, columns])

  const filteredData = useMemo(() => {
    let result = sortedData
    if (search) {
      const term = search.toLowerCase()
      result = result.filter(row =>
        columns.some(col => {
          const val = col.accessor(row)
          return String(val || '').toLowerCase().includes(term)
        })
      )
    }
    return result
  }, [sortedData, search, columns])

  const virtualizer = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  })

  const toggleSort = useCallback((colId: string) => {
    if (sortKey === colId) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(colId)
      setSortDir('asc')
    }
  }, [sortKey])

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredData.map(r => r.id)))
    }
  }, [filteredData, selectedIds])

  const toggleSelect = useCallback((id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }, [selectedIds])

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-[hsl(var(--surface-muted))] skeleton-shimmer" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {searchable && (
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("common.search", "جستجو...")}
              className={cn(
                "w-full rounded-xl ps-9 pe-4 py-2 text-sm",
                "border border-[hsl(var(--border-default))]",
                "bg-[hsl(var(--surface-base))]",
                "text-[hsl(var(--fg-primary))]",
                "placeholder:text-[hsl(var(--fg-tertiary))]",
                "focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]",
              )}
            />
          </div>
        )}
        
        {bulkActions && selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[hsl(var(--fg-secondary))]">
              {selectedIds.size} {t("common.selected", "انتخاب شده")}
            </span>
            {bulkActions.map(action => (
              <button
                key={action.id}
                type="button"
                onClick={() => action.onClick(Array.from(selectedIds))}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"
              >
                <action.icon className="size-3.5" />
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[hsl(var(--border-default))] overflow-hidden">
        {/* Header */}
        <div className="flex items-center bg-[hsl(var(--surface-muted))] border-b border-[hsl(var(--border-default))] px-4 py-2">
          {bulkActions && (
            <input
              type="checkbox"
              checked={selectedIds.size === filteredData.length && filteredData.length > 0}
              onChange={toggleSelectAll}
              className="mr-2 size-4"
            />
          )}
          {columns.map(col => (
            <div
              key={col.id}
              className={cn(
                "flex items-center gap-1 px-3 py-2 text-xs font-medium text-[hsl(var(--fg-secondary))] cursor-pointer select-none",
                col.width ? `w-[${col.width}px]` : "flex-1",
                col.align === 'right' && "justify-end",
                col.align === 'center' && "justify-center",
              )}
              onClick={() => col.sortable !== false && toggleSort(col.id)}
            >
              {col.header}
              {sortKey === col.id && (
                sortDir === 'asc' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div ref={parentRef} className="max-h-[500px] overflow-auto">
          {filteredData.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-[hsl(var(--fg-tertiary))]">
              {emptyMessage || t("common.noData", "داده‌ای یافت نشد")}
            </div>
          ) : (
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
              {virtualizer.getVirtualItems().map(virtualRow => {
                const row = filteredData[virtualRow.index]
                if (!row) return null // ✅ Fix: row is possibly undefined
                const isSelected = selectedIds.has(row.id)
                return (
                  <div
                    key={row.id}
                    className={cn(
                      "flex items-center absolute w-full border-b border-[hsl(var(--border-default))] last:border-0 transition-colors",
                      "hover:bg-[hsl(var(--surface-muted))]",
                      isSelected && "bg-[hsl(var(--color-primary)/0.05)]",
                      onRowClick && "cursor-pointer",
                    )}
                    style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                    onClick={() => onRowClick?.(row)}
                  >
                    {bulkActions && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => { e.stopPropagation(); toggleSelect(row.id) }}
                        className="ml-4 mr-2 size-4"
                      />
                    )}
                    {columns.map(col => (
                      <div
                        key={col.id}
                        className={cn(
                          "px-3 py-2",
                          col.width ? `w-[${col.width}px]` : "flex-1",
                          col.align === 'right' && "text-end",
                          col.align === 'center' && "text-center",
                        )}
                      >
                        {renderCell(col, row)}
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
        <span>{filteredData.length} {t("common.records", "رکورد")}</span>
      </div>
    </div>
  )
}