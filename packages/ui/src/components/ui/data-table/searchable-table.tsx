'use client'

// ============================================
// A list that is simply «these rows, searchable» — the shared DataTable with
// the search it needs, in one component.
//
// A list inside a panel (a customer's payments, the open collections, a plan's
// history) has no state of its own to keep: it wants the same toolbar every
// other list has and nothing else. Each such panel used to wrap DataTable by
// hand; this is that wrapper, once.
//
// Use `DataTable` directly when the page owns the search (it is sent to the
// server) or adds bulk selection.
// ============================================

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'

import { DataTable } from './data-table'
import { matchesSearch } from './match-search'
import type { TableColumn } from './table-types'

export interface SearchableTableProps<T> {
  /** Stable id — persists the user's column choices. */
  tableId: string
  rows: readonly T[]
  columns: readonly TableColumn<T>[]
  rowKey: (row: T, index: number) => string
  onRowClick?: ((row: T) => void) | undefined
  /** What the search looks through. */
  words: (row: T) => Array<string | number | null | undefined>
  /** Filters and other controls for the table's own toolbar. */
  actions?: ReactNode
  /** Shown when no row is left — a sentence, or a whole empty state. */
  empty: ReactNode
  minWidthClass?: string | undefined
}

export function SearchableTable<T>({
  tableId,
  rows,
  columns,
  rowKey,
  onRowClick,
  words,
  actions,
  empty,
  minWidthClass = 'min-w-[420px]',
}: SearchableTableProps<T>) {
  const translate = useTranslations()
  const [search, setSearch] = useState('')
  // A missing key renders its fallback, never the key.
  const t = (key: string, fallback?: string): string => {
    const value = translate(key as never)
    return value && value !== key ? value : (fallback ?? key)
  }

  return (
    <DataTable
      tableId={tableId}
      t={t}
      rows={rows.filter((row) => matchesSearch(search, words(row)))}
      columns={columns}
      rowKey={rowKey}
      onRowClick={onRowClick}
      searchValue={search}
      onSearchChange={setSearch}
      actions={actions}
      minWidthClass={minWidthClass}
      emptyState={
        typeof empty === 'string' ? (
          <p className="py-10 text-center text-sm text-[hsl(var(--fg-secondary))]">{empty}</p>
        ) : (
          empty
        )
      }
    />
  )
}
