// ============================================
// Mobile selection mode. The shared set semantics are tested in
// @hisabche/ui-contract; what is pinned here is the native-only behaviour —
// entering the mode, and above all leaving it, so a user can never be stranded
// in a selection mode with nothing selected.
// ============================================

import {
  initialSelectionMode,
  selectionModeReducer,
  type SelectionModeAction,
  type SelectionModeState,
} from '../use-selection-mode'

const run = (
  actions: readonly SelectionModeAction[],
  from: SelectionModeState = initialSelectionMode,
): SelectionModeState => actions.reduce(selectionModeReducer, from)

describe('selectionModeReducer', () => {
  it('starts inactive with nothing selected', () => {
    expect(initialSelectionMode.active).toBe(false)
    expect(initialSelectionMode.selectedIds.size).toBe(0)
  })

  it('enters selection mode on long-press and selects that row', () => {
    const state = run([{ type: 'begin', id: 'a' }])

    expect(state.active).toBe(true)
    expect(state.selectedIds.has('a')).toBe(true)
  })

  it('does not deselect when long-pressing an already selected row', () => {
    // Long-press means "enter selection mode", not "toggle".
    const state = run([
      { type: 'begin', id: 'a' },
      { type: 'begin', id: 'a' },
    ])

    expect(state.selectedIds.has('a')).toBe(true)
    expect(state.selectedIds.size).toBe(1)
  })

  it('toggles additional rows while active', () => {
    const state = run([
      { type: 'begin', id: 'a' },
      { type: 'toggle', id: 'b' },
    ])

    expect(state.selectedIds.size).toBe(2)
  })

  it('leaves selection mode when the last row is deselected', () => {
    const state = run([
      { type: 'begin', id: 'a' },
      { type: 'toggle', id: 'a' },
    ])

    expect(state.selectedIds.size).toBe(0)
    expect(state.active).toBe(false)
  })

  it('stays active while any row remains selected', () => {
    const state = run([
      { type: 'begin', id: 'a' },
      { type: 'toggle', id: 'b' },
      { type: 'toggle', id: 'a' },
    ])

    expect(state.active).toBe(true)
    expect(state.selectedIds.size).toBe(1)
  })

  it('exits and clears on demand', () => {
    const state = run([{ type: 'begin', id: 'a' }, { type: 'toggle', id: 'b' }, { type: 'exit' }])

    expect(state.active).toBe(false)
    expect(state.selectedIds.size).toBe(0)
  })

  it('drops ids that vanish from the list', () => {
    const state = run([
      { type: 'begin', id: 'a' },
      { type: 'toggle', id: 'b' },
      { type: 'prune', availableIds: ['a'] },
    ])

    expect(state.selectedIds.size).toBe(1)
    expect(state.selectedIds.has('b')).toBe(false)
    expect(state.active).toBe(true)
  })

  it('leaves selection mode when pruning removes everything', () => {
    const state = run([
      { type: 'begin', id: 'a' },
      { type: 'prune', availableIds: [] },
    ])

    expect(state.active).toBe(false)
  })

  it('returns the identical state when pruning drops nothing', () => {
    // Guards against a re-render on every list refetch.
    const selected = run([{ type: 'begin', id: 'a' }])
    const pruned = selectionModeReducer(selected, {
      type: 'prune',
      availableIds: ['a', 'b'],
    })

    expect(pruned).toBe(selected)
  })

  it('selects a whole page and clears it on the second toggle', () => {
    const afterSelectAll = run([
      { type: 'begin', id: 'a' },
      { type: 'toggleAll', ids: ['a', 'b', 'c'] },
    ])
    expect(afterSelectAll.selectedIds.size).toBe(3)

    const afterClear = selectionModeReducer(afterSelectAll, {
      type: 'toggleAll',
      ids: ['a', 'b', 'c'],
    })
    expect(afterClear.selectedIds.size).toBe(0)
    expect(afterClear.active).toBe(false)
  })

  it('does not mutate the state it is given', () => {
    const before = run([{ type: 'begin', id: 'a' }])
    selectionModeReducer(before, { type: 'toggle', id: 'b' })

    expect(before.selectedIds.size).toBe(1)
  })
})
