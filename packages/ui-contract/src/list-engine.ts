// ============================================
// packages/ui-contract/src/list-engine.ts
//
// PHASE 5 — one interaction language for every list in the product.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A REDUCER AND NOT A COMPONENT
//
// §10 asks that every major list share search, filters, sort, grouping,
// columns, density, saved views, bulk actions and paging. The temptation is to
// build one giant `<DataTable>` that does all of it and make every screen use
// it. That fails the moment one screen needs a column the table cannot express,
// and then that screen forks — taking its own private idea of what "sort"
// means with it.
//
// So the BEHAVIOUR lives here, as pure state and pure transitions, and the
// rendering stays with whatever component suits the screen. A fork of the
// visuals is survivable. A fork of "what does the second click on a column
// header do" is how two lists in one product stop agreeing.
//
// ---------------------------------------------------------------------------
// NO DOM, NO REACT, NO DATA
//
// This module never sees a row. It computes the QUERY — what the caller should
// ask the server for — and lets the caller ask. Sorting an array here would
// mean every list quietly became client-side, and a shop with 40,000 products
// would download all of them to show twenty.
// ============================================

export type SortDirection = 'asc' | 'desc'

/** Comfortable is the default; dense is for someone reconciling all afternoon. */
export const DENSITIES = ['comfortable', 'compact', 'dense'] as const
export type Density = (typeof DENSITIES)[number]

export const FILTER_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'greater_than',
  'less_than',
  'between',
  'in',
  'is_empty',
  'is_not_empty',
] as const
export type FilterOperator = (typeof FILTER_OPERATORS)[number]

export interface FilterClause {
  field: string
  operator: FilterOperator
  /** Absent for `is_empty` / `is_not_empty`, which take no operand. */
  value?: string | number | boolean | Array<string | number>
}

export interface ListState {
  search: string
  filters: FilterClause[]
  sortBy: string | null
  sortDirection: SortDirection
  groupBy: string | null
  /** Column keys in display order. An empty list means "the default set". */
  visibleColumns: string[]
  density: Density
  page: number
  pageSize: number
  selectedIds: string[]
}

export const DEFAULT_PAGE_SIZE = 25

/** The page sizes offered. Bounded so a client cannot ask for the whole table. */
export const PAGE_SIZES = [10, 25, 50, 100] as const
export const MAX_PAGE_SIZE = 100

export function initialListState(overrides: Partial<ListState> = {}): ListState {
  return {
    search: '',
    filters: [],
    sortBy: null,
    sortDirection: 'asc',
    groupBy: null,
    visibleColumns: [],
    density: 'comfortable',
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    selectedIds: [],
    ...overrides,
  }
}

export type ListAction =
  | { type: 'search'; value: string }
  | { type: 'addFilter'; clause: FilterClause }
  | { type: 'removeFilter'; index: number }
  | { type: 'clearFilters' }
  | { type: 'sort'; field: string }
  | { type: 'group'; field: string | null }
  | { type: 'columns'; keys: string[] }
  | { type: 'density'; density: Density }
  | { type: 'page'; page: number }
  | { type: 'pageSize'; size: number }
  | { type: 'select'; id: string }
  | { type: 'selectMany'; ids: string[] }
  | { type: 'clearSelection' }
  | { type: 'reset' }

/**
 * Which changes send the reader back to page one.
 *
 * Anything that changes WHICH rows match. Staying on page 7 of a result set
 * that now has two pages shows an empty table and reads as "no results" — the
 * single most common list bug there is.
 *
 * Density, columns and selection are deliberately absent: they change how the
 * same rows look, not which rows they are.
 */
const RESETS_PAGE = new Set<ListAction['type']>([
  'search',
  'addFilter',
  'removeFilter',
  'clearFilters',
  'group',
  'pageSize',
])

export function listReducer(state: ListState, action: ListAction): ListState {
  const next = apply(state, action)
  return RESETS_PAGE.has(action.type) ? { ...next, page: 1 } : next
}

function apply(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case 'search':
      return { ...state, search: action.value }

    case 'addFilter': {
      // Re-filtering the same field with the same operator REPLACES rather
      // than stacking. Two `status equals` clauses can never both be true, and
      // a list that silently returns nothing after a second click teaches the
      // user that filters are broken.
      const without = state.filters.filter(
        (clause) =>
          !(clause.field === action.clause.field && clause.operator === action.clause.operator),
      )
      return { ...state, filters: [...without, action.clause] }
    }

    case 'removeFilter':
      return { ...state, filters: state.filters.filter((_, index) => index !== action.index) }

    case 'clearFilters':
      return { ...state, filters: [] }

    case 'sort': {
      // Click once to sort ascending, again to reverse, a third time to stop.
      // The third click matters: without it there is no way back to the
      // server's own meaningful default order, which for invoices is "newest
      // first" and is what the user actually wanted.
      if (state.sortBy !== action.field) {
        return { ...state, sortBy: action.field, sortDirection: 'asc' }
      }
      if (state.sortDirection === 'asc') return { ...state, sortDirection: 'desc' }
      return { ...state, sortBy: null, sortDirection: 'asc' }
    }

    case 'group':
      return { ...state, groupBy: action.field }

    case 'columns':
      return { ...state, visibleColumns: action.keys }

    case 'density':
      return { ...state, density: action.density }

    case 'page':
      return { ...state, page: Math.max(1, Math.trunc(action.page)) }

    case 'pageSize': {
      const size = PAGE_SIZES.includes(action.size as (typeof PAGE_SIZES)[number])
        ? action.size
        : DEFAULT_PAGE_SIZE
      return { ...state, pageSize: size }
    }

    case 'select': {
      const selected = state.selectedIds.includes(action.id)
        ? state.selectedIds.filter((id) => id !== action.id)
        : [...state.selectedIds, action.id]
      return { ...state, selectedIds: selected }
    }

    case 'selectMany':
      return { ...state, selectedIds: [...new Set(action.ids)] }

    case 'clearSelection':
      return { ...state, selectedIds: [] }

    case 'reset':
      // Density and columns survive a reset. They are how this person prefers
      // to read a table, not part of the query they are undoing.
      return initialListState({ density: state.density, visibleColumns: state.visibleColumns })

    default:
      return state
  }
}

/* ─── Turning state into a request ────────────────────────────────────────── */

export interface ListQuery {
  search?: string
  filters?: FilterClause[]
  sortBy?: string
  sortDirection?: SortDirection
  groupBy?: string
  limit: number
  offset: number
}

/**
 * The request the caller should make.
 *
 * `limit` is clamped here rather than trusted from state, because state can be
 * restored from a saved view that was written when the cap was different.
 */
export function toQuery(state: ListState): ListQuery {
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, state.pageSize))

  return {
    ...(state.search.trim() ? { search: state.search.trim() } : {}),
    ...(state.filters.length ? { filters: state.filters } : {}),
    ...(state.sortBy ? { sortBy: state.sortBy, sortDirection: state.sortDirection } : {}),
    ...(state.groupBy ? { groupBy: state.groupBy } : {}),
    limit,
    offset: (Math.max(1, state.page) - 1) * limit,
  }
}

/** How many pages a total implies. Zero rows is one (empty) page, not zero. */
export function pageCount(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1
  return Math.max(1, Math.ceil(total / pageSize))
}

/**
 * Is the current page beyond the end of the results?
 *
 * Callers use this after a fetch to correct a stale page rather than showing
 * an empty table. It cannot be prevented in the reducer, because the reducer
 * does not know the total until the server answers.
 */
export function isPageOutOfRange(state: ListState, total: number): boolean {
  return state.page > pageCount(total, state.pageSize)
}

/* ─── Saved views ─────────────────────────────────────────────────────────── */

export interface SavedView {
  id: string
  name: string
  /** Only the query-shaping part. Selection is never saved. */
  state: Omit<ListState, 'selectedIds' | 'page'>
}

/**
 * A saved view captures the QUERY, not the position and not the selection.
 *
 * Restoring somebody's selection from last Tuesday and then offering "delete
 * selected" is how a saved view becomes a data-loss bug.
 */
export function toSavedView(id: string, name: string, state: ListState): SavedView {
  const { selectedIds: _selected, page: _page, ...rest } = state
  return { id, name, state: rest }
}

export function applySavedView(view: SavedView): ListState {
  return { ...view.state, selectedIds: [], page: 1 }
}

/** Whether the list is showing anything other than its defaults. */
export function isFiltered(state: ListState): boolean {
  return state.search.trim() !== '' || state.filters.length > 0 || state.groupBy !== null
}
