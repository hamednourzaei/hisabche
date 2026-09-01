'use client'

// ============================================
// packages/ui/src/hooks/use-list-engine.ts
//
// The React binding for `@hisabche/ui-contract`'s list engine.
//
// ---------------------------------------------------------------------------
// THE HOOK HOLDS NO RULES
//
// Every decision — what a third click on a column header does, which changes
// return you to page one, whether a saved view carries your selection — lives
// in the contract, where it is pure and tested. This file is `useReducer`, a
// memoised query, and one effect. If a rule ever appears here, it has escaped
// the place it can be tested and will drift from the other lists.
// ============================================

import { useCallback, useEffect, useMemo, useReducer } from 'react'
import {
  initialListState,
  isFiltered,
  isPageOutOfRange,
  listReducer,
  pageCount,
  toQuery,
  type Density,
  type FilterClause,
  type ListQuery,
  type ListState,
  type SortDirection,
} from '@hisabche/ui-contract'

export interface UseListEngineOptions {
  /** Starting state — a saved view, or a screen's own sensible default. */
  initial?: Partial<ListState>
  /** Total row count from the server, once known. Drives page correction. */
  total?: number | undefined
}

export interface ListEngine {
  state: ListState
  /** What to send the server. Stable between renders unless the query changes. */
  query: ListQuery
  /** A stable cache key for that query — density and selection are absent
   *  from it, so ticking a checkbox does not refetch the list. */
  queryKey: string
  pageCount: number
  isFiltered: boolean

  setSearch: (value: string) => void
  addFilter: (clause: FilterClause) => void
  removeFilter: (index: number) => void
  clearFilters: () => void
  toggleSort: (field: string) => void
  setGroup: (field: string | null) => void
  setColumns: (keys: string[]) => void
  setDensity: (density: Density) => void
  goToPage: (page: number) => void
  setPageSize: (size: number) => void
  toggleSelect: (id: string) => void
  selectMany: (ids: string[]) => void
  clearSelection: () => void
  reset: () => void

  sortIndicator: (field: string) => SortDirection | null
  isSelected: (id: string) => boolean
}

export function useListEngine(options: UseListEngineOptions = {}): ListEngine {
  const [state, dispatch] = useReducer(listReducer, options.initial, initialListState)

  // ⚠️ The dependency is the SERIALISED query, not `state`. Density, column
  // order and selection all live in state and none of them changes what the
  // server should return — keying a fetch on `state` would refetch the whole
  // list every time somebody ticked a checkbox.
  const query = useMemo(() => toQuery(state), [state])
  const queryKey = useMemo(() => JSON.stringify(query), [query])

  const total = options.total

  // A page can go stale without any action from the user: a colleague deletes
  // rows, or a filter narrows the set. The reducer cannot see this — it does
  // not know the total until the server answers — so the correction happens
  // here, once the answer arrives.
  useEffect(() => {
    if (total === undefined) return
    if (isPageOutOfRange(state, total)) {
      dispatch({ type: 'page', page: pageCount(total, state.pageSize) })
    }
  }, [total, state])

  return {
    state,
    query,
    pageCount: total === undefined ? 1 : pageCount(total, state.pageSize),
    isFiltered: isFiltered(state),

    setSearch: useCallback((value: string) => dispatch({ type: 'search', value }), []),
    addFilter: useCallback((clause: FilterClause) => dispatch({ type: 'addFilter', clause }), []),
    removeFilter: useCallback((index: number) => dispatch({ type: 'removeFilter', index }), []),
    clearFilters: useCallback(() => dispatch({ type: 'clearFilters' }), []),
    toggleSort: useCallback((field: string) => dispatch({ type: 'sort', field }), []),
    setGroup: useCallback((field: string | null) => dispatch({ type: 'group', field }), []),
    setColumns: useCallback((keys: string[]) => dispatch({ type: 'columns', keys }), []),
    setDensity: useCallback((density: Density) => dispatch({ type: 'density', density }), []),
    goToPage: useCallback((page: number) => dispatch({ type: 'page', page }), []),
    setPageSize: useCallback((size: number) => dispatch({ type: 'pageSize', size }), []),
    toggleSelect: useCallback((id: string) => dispatch({ type: 'select', id }), []),
    selectMany: useCallback((ids: string[]) => dispatch({ type: 'selectMany', ids }), []),
    clearSelection: useCallback(() => dispatch({ type: 'clearSelection' }), []),
    reset: useCallback(() => dispatch({ type: 'reset' }), []),

    sortIndicator: useCallback(
      (field: string) => (state.sortBy === field ? state.sortDirection : null),
      [state.sortBy, state.sortDirection],
    ),
    isSelected: useCallback((id: string) => state.selectedIds.includes(id), [state.selectedIds]),

    queryKey,
  }
}
