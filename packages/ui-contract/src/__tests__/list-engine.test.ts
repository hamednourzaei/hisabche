// ============================================
// One interaction language for every list.
//
// Each case is a decision that used to be made per-screen. Pinning them means
// two lists in one product cannot quietly disagree about what a second click
// on a column header does.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  applySavedView,
  initialListState,
  isFiltered,
  isPageOutOfRange,
  listReducer,
  pageCount,
  toQuery,
  toSavedView,
  type ListAction,
  type ListState,
} from '../list-engine'

const run = (state: ListState, ...actions: ListAction[]) =>
  actions.reduce<ListState>((current, action) => listReducer(current, action), state)

describe('sorting', () => {
  it('goes ascending, then descending, then back to the default order', () => {
    // The third click matters. Without it there is no way back to the
    // server's own meaningful order — "newest first" for invoices — which is
    // what the user actually wanted.
    let state = initialListState()

    state = listReducer(state, { type: 'sort', field: 'name' })
    expect(state).toMatchObject({ sortBy: 'name', sortDirection: 'asc' })

    state = listReducer(state, { type: 'sort', field: 'name' })
    expect(state).toMatchObject({ sortBy: 'name', sortDirection: 'desc' })

    state = listReducer(state, { type: 'sort', field: 'name' })
    expect(state.sortBy).toBeNull()
  })

  it('starts ascending on a different column rather than inheriting a direction', () => {
    const state = run(
      initialListState(),
      { type: 'sort', field: 'name' },
      { type: 'sort', field: 'name' },
      { type: 'sort', field: 'total' },
    )
    expect(state).toMatchObject({ sortBy: 'total', sortDirection: 'asc' })
  })

  it('does NOT send the reader back to page one', () => {
    // Re-ordering keeps the same rows. Jumping to page one would lose the
    // reader's place for no reason.
    const state = run(initialListState({ page: 4 }), { type: 'sort', field: 'name' })
    expect(state.page).toBe(4)
  })
})

describe('anything that changes which rows match returns to page one', () => {
  it.each([
    ['search', { type: 'search', value: 'ali' }],
    [
      'a filter',
      { type: 'addFilter', clause: { field: 'status', operator: 'equals', value: 'paid' } },
    ],
    ['clearing filters', { type: 'clearFilters' }],
    ['grouping', { type: 'group', field: 'category' }],
    ['page size', { type: 'pageSize', size: 50 }],
  ] as const)('%s', (_name, action) => {
    // Staying on page 7 of a two-page result shows an empty table, which reads
    // as "no results" — the commonest list bug there is.
    const state = run(initialListState({ page: 7 }), action as ListAction)
    expect(state.page).toBe(1)
  })

  it('but density and columns do not — they change how the same rows look', () => {
    const state = run(
      initialListState({ page: 3 }),
      { type: 'density', density: 'dense' },
      { type: 'columns', keys: ['name'] },
    )
    expect(state.page).toBe(3)
  })
})

describe('filters', () => {
  it('replaces rather than stacks the same field and operator', () => {
    // Two `status equals` clauses can never both be true. Stacking them
    // returns nothing and teaches the user that filters are broken.
    const state = run(
      initialListState(),
      { type: 'addFilter', clause: { field: 'status', operator: 'equals', value: 'paid' } },
      { type: 'addFilter', clause: { field: 'status', operator: 'equals', value: 'draft' } },
    )
    expect(state.filters).toHaveLength(1)
    expect(state.filters[0]?.value).toBe('draft')
  })

  it('keeps two different operators on one field', () => {
    // `amount > 100` and `amount < 500` is a range, and both belong.
    const state = run(
      initialListState(),
      { type: 'addFilter', clause: { field: 'amount', operator: 'greater_than', value: 100 } },
      { type: 'addFilter', clause: { field: 'amount', operator: 'less_than', value: 500 } },
    )
    expect(state.filters).toHaveLength(2)
  })
})

describe('paging', () => {
  it('never produces a page below one', () => {
    expect(listReducer(initialListState(), { type: 'page', page: -3 }).page).toBe(1)
  })

  it('refuses a page size that is not offered', () => {
    // Otherwise a crafted request pulls the whole table.
    expect(listReducer(initialListState(), { type: 'pageSize', size: 100_000 }).pageSize).toBe(
      DEFAULT_PAGE_SIZE,
    )
  })

  it('counts an empty result as one page, not zero', () => {
    expect(pageCount(0, 25)).toBe(1)
  })

  it('spots a stale page after the result set shrank', () => {
    expect(isPageOutOfRange(initialListState({ page: 7, pageSize: 25 }), 30)).toBe(true)
    expect(isPageOutOfRange(initialListState({ page: 2, pageSize: 25 }), 30)).toBe(false)
  })
})

describe('the request it produces', () => {
  it('clamps the limit even when state says otherwise', () => {
    // State can be restored from a saved view written when the cap differed.
    const query = toQuery(initialListState({ pageSize: 5_000 }))
    expect(query.limit).toBe(MAX_PAGE_SIZE)
  })

  it('computes the offset from the page', () => {
    expect(toQuery(initialListState({ page: 3, pageSize: 25 })).offset).toBe(50)
  })

  it('omits an empty search rather than sending a blank filter', () => {
    expect(toQuery(initialListState({ search: '   ' })).search).toBeUndefined()
  })

  it('omits sort entirely when the third click cleared it', () => {
    const query = toQuery(initialListState())
    expect(query.sortBy).toBeUndefined()
    expect(query.sortDirection).toBeUndefined()
  })
})

describe('selection', () => {
  it('toggles', () => {
    const state = run(initialListState(), { type: 'select', id: 'a' }, { type: 'select', id: 'a' })
    expect(state.selectedIds).toEqual([])
  })

  it('de-duplicates a bulk selection', () => {
    const state = listReducer(initialListState(), { type: 'selectMany', ids: ['a', 'b', 'a'] })
    expect(state.selectedIds).toEqual(['a', 'b'])
  })
})

describe('saved views', () => {
  it('never saves the selection or the page', () => {
    // Restoring last Tuesday's selection and then offering "delete selected"
    // is how a saved view becomes a data-loss bug.
    const state = initialListState({ selectedIds: ['a', 'b'], page: 5, search: 'ali' })
    const view = toSavedView('v1', 'Unpaid', state)

    expect(view.state).not.toHaveProperty('selectedIds')
    expect(view.state).not.toHaveProperty('page')

    const restored = applySavedView(view)
    expect(restored.selectedIds).toEqual([])
    expect(restored.page).toBe(1)
    expect(restored.search).toBe('ali')
  })
})

describe('reset', () => {
  it('clears the query but keeps how this person reads a table', () => {
    const state = run(
      initialListState({ density: 'dense', visibleColumns: ['name', 'total'] }),
      { type: 'search', value: 'ali' },
      { type: 'reset' },
    )
    expect(state.search).toBe('')
    expect(state.density).toBe('dense')
    expect(state.visibleColumns).toEqual(['name', 'total'])
  })
})

describe('isFiltered', () => {
  it('is false for a fresh list and true once anything narrows it', () => {
    expect(isFiltered(initialListState())).toBe(false)
    expect(isFiltered(initialListState({ search: 'x' }))).toBe(true)
    // Density is not a narrowing.
    expect(isFiltered(initialListState({ density: 'dense' }))).toBe(false)
  })
})
