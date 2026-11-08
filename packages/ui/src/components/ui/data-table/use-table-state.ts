// ============================================
// Table state — column visibility and sorting.
//
// Visibility is persisted per table id so a user's column choices survive a
// reload. Sorting stays in memory: it is a transient view concern.
// ============================================

'use client'

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'

import { compareValues, type SortDirection, type TableColumn } from './table-types'

const STORAGE_PREFIX = 'hisabche.table.columns.'

// Column choices are an external store (localStorage + this tab's own copy),
// read with useSyncExternalStore: the server and hydration see «nothing
// hidden», then the stored choice — without a setState inside an effect.
const memory = new Map<string, string>()
const listeners = new Set<() => void>()

function subscribeHidden(onChange: () => void): () => void {
  listeners.add(onChange)
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith(STORAGE_PREFIX)) onChange()
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(onChange)
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

function rawHidden(tableId: string): string | null {
  const key = STORAGE_PREFIX + tableId
  const local = memory.get(key)
  if (local !== undefined) return local
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function parseHidden(raw: string | null): string[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function writeHidden(tableId: string, next: readonly string[]): void {
  const key = STORAGE_PREFIX + tableId
  const raw = JSON.stringify(next)
  memory.set(key, raw)
  try {
    window.localStorage.setItem(key, raw)
  } catch {
    // A full or blocked storage must not break the toggle; this tab keeps it.
  }
  for (const listener of listeners) listener()
}

export interface TableState<T> {
  /** Columns the user has chosen to show, in declaration order. */
  visibleColumns: TableColumn<T>[]
  hiddenIds: string[]
  toggleColumn: (id: string) => void
  sortId: string | null
  sortDirection: SortDirection
  toggleSort: (id: string) => void
  sortRows: (rows: readonly T[]) => T[]
  applyLook: (look: {
    hiddenIds: readonly string[]
    sortId: string | null
    sortDirection: SortDirection
  }) => void
}

export function useTableState<T>(
  tableId: string,
  columns: readonly TableColumn<T>[],
): TableState<T> {
  const raw = useSyncExternalStore(
    subscribeHidden,
    () => rawHidden(tableId),
    () => null,
  )
  const hiddenIds = useMemo(() => parseHidden(raw), [raw])
  const [sortId, setSortId] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const toggleColumn = useCallback(
    (id: string) => {
      const current = parseHidden(rawHidden(tableId))
      const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
      writeHidden(tableId, next)
    },
    [tableId],
  )

  // Clicking the active column flips direction; a new column starts descending.
  const toggleSort = useCallback((id: string) => {
    setSortId((currentId) => {
      if (currentId === id) {
        setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
        return currentId
      }
      setSortDirection('desc')
      return id
    })
  }, [])

  const visibleColumns = useMemo(
    () => columns.filter((column) => column.locked || !hiddenIds.includes(column.id)),
    [columns, hiddenIds],
  )

  const sortRows = useCallback(
    (rows: readonly T[]): T[] => {
      const column = columns.find((item) => item.id === sortId)
      if (!column?.sortValue) return [...rows]

      const read = column.sortValue
      return [...rows].sort((a, b) => compareValues(read(a), read(b), sortDirection))
    },
    [columns, sortDirection, sortId],
  )

  /**
   * Put the table into a saved look (capability #87): which columns are hidden
   * and what it is sorted by. A column id the table no longer has is simply
   * ignored — a view saved before a column was removed must not break the
   * table. Hidden columns are persisted like any other column choice.
   */
  const applyLook = useCallback(
    (look: {
      hiddenIds: readonly string[]
      sortId: string | null
      sortDirection: SortDirection
    }) => {
      const known = new Set(columns.map((column) => column.id))
      const nextHidden = look.hiddenIds.filter((id) => known.has(id))
      writeHidden(tableId, nextHidden)
      setSortId(look.sortId !== null && known.has(look.sortId) ? look.sortId : null)
      setSortDirection(look.sortDirection)
    },
    [columns, tableId],
  )

  return {
    visibleColumns,
    hiddenIds,
    toggleColumn,
    sortId,
    sortDirection,
    toggleSort,
    sortRows,
    applyLook,
  }
}
