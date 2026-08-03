// ============================================
// DataTable — dense, virtualized, keyboard navigable.
//
// Only the visible rows are mounted (@tanstack/react-virtual), so a 50k-row
// ledger scrolls at 60 FPS and stays inside the memory budget.
// ============================================

import React, { useCallback, useRef, useState, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

import { cn, Skeleton } from './primitives'

const ROW_HEIGHT = 40
const OVERSCAN = 12

export interface Column<T> {
  key: string
  header: string
  /** Grid track size, e.g. "1fr" or "120px". */
  width: string
  align?: 'start' | 'end' | undefined
  render: (row: T) => ReactNode
}

export interface DataTableProps<T> {
  rows: readonly T[]
  columns: readonly Column<T>[]
  rowKey: (row: T, index: number) => string
  loading?: boolean
  emptyLabel: string
  onRowActivate?: ((row: T) => void) | undefined
  onRowContextMenu?: ((row: T, position: { x: number; y: number }) => void) | undefined
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading = false,
  emptyLabel,
  onRowActivate,
  onRowContextMenu,
}: DataTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  })

  const template = columns.map((column) => column.width).join(' ')

  // Arrow keys move the selection; Enter opens the row.
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (rows.length === 0) return

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const next = Math.min(rows.length - 1, Math.max(0, activeIndex + (event.key === 'ArrowDown' ? 1 : -1)))
        setActiveIndex(next)
        virtualizer.scrollToIndex(next)
        return
      }

      if (event.key === 'Enter' && onRowActivate) {
        const row = rows[activeIndex]
        if (row) onRowActivate(row)
      }
    },
    [activeIndex, onRowActivate, rows, virtualizer]
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-1 p-2">
        {Array.from({ length: 12 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        role="row"
        className="grid shrink-0 items-center gap-3 border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--fg-tertiary))]"
        style={{ gridTemplateColumns: template }}
      >
        {columns.map((column) => (
          <div key={column.key} className={column.align === 'end' ? 'text-end' : 'text-start'}>
            {column.header}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-[hsl(var(--fg-tertiary))]">
          {emptyLabel}
        </div>
      ) : (
        <div
          ref={scrollRef}
          tabIndex={0}
          role="grid"
          onKeyDown={onKeyDown}
          className="min-h-0 flex-1 overflow-auto outline-none"
        >
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index]
              if (!row) return null

              return (
                <div
                  key={rowKey(row, virtualRow.index)}
                  role="row"
                  aria-selected={virtualRow.index === activeIndex}
                  onDoubleClick={() => onRowActivate?.(row)}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    onRowContextMenu?.(row, { x: event.clientX, y: event.clientY })
                  }}
                  className={cn(
                    'absolute inset-x-0 grid cursor-default items-center gap-3 px-4 text-sm',
                    'border-b border-[hsl(var(--border-default)/0.5)] text-[hsl(var(--fg-primary))]',
                    'hover:bg-[hsl(var(--surface-muted))]',
                    virtualRow.index === activeIndex && 'bg-[hsl(var(--surface-muted))]'
                  )}
                  style={{
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                    gridTemplateColumns: template,
                  }}
                >
                  {columns.map((column) => (
                    <div
                      key={column.key}
                      className={cn('truncate', column.align === 'end' && 'text-end tabular-nums')}
                    >
                      {column.render(row)}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
