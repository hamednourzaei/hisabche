// ============================================
// Native selection mode.
//
// Semantics come from `@hisabche/ui-contract` — the same module the web tables
// bind to — so "select all" and pruning behave identically on both platforms.
// Only the interaction differs: a long-press enters selection mode instead of a
// permanent checkbox column, which would waste row space on a phone.
//
// The transitions live in a pure reducer so they can be tested without a React
// renderer; the hook below is only the `useReducer` wiring.
// ============================================

import { useCallback, useMemo, useReducer } from 'react'
import {
  emptySelection,
  pruneSelection,
  toggleAll as toggleAllIds,
  toggleId,
  type SelectionState,
} from '@hisabche/ui-contract'

export interface SelectionModeState {
  /** True once the user has long-pressed a row. Rows tap-to-toggle while on. */
  active: boolean
  selectedIds: SelectionState
}

export type SelectionModeAction =
  | { type: 'begin'; id: string }
  | { type: 'toggle'; id: string }
  | { type: 'toggleAll'; ids: readonly string[] }
  | { type: 'prune'; availableIds: readonly string[] }
  | { type: 'exit' }

export const initialSelectionMode: SelectionModeState = {
  active: false,
  selectedIds: emptySelection,
}

/**
 * Every transition that empties the selection also leaves selection mode.
 * Without that rule the user is stranded in a mode with an empty toolbar and
 * no obvious way back.
 */
function settle(selectedIds: SelectionState): SelectionModeState {
  return { active: selectedIds.size > 0, selectedIds }
}

export function selectionModeReducer(
  state: SelectionModeState,
  action: SelectionModeAction,
): SelectionModeState {
  switch (action.type) {
    case 'begin':
      // Long-press means "enter selection mode", not "toggle" — pressing a row
      // that is already selected must not undo it.
      return {
        active: true,
        selectedIds: state.selectedIds.has(action.id)
          ? state.selectedIds
          : toggleId(state.selectedIds, action.id),
      }

    case 'toggle':
      return settle(toggleId(state.selectedIds, action.id))

    case 'toggleAll':
      return settle(toggleAllIds(state.selectedIds, action.ids))

    case 'prune': {
      const next = pruneSelection(state.selectedIds, action.availableIds)
      // Identity is preserved when nothing was dropped, so avoid churning state.
      return next === state.selectedIds ? state : settle(next)
    }

    case 'exit':
      return initialSelectionMode
  }
}

export interface SelectionMode extends SelectionModeState {
  selectedCount: number
  isSelected: (id: string) => boolean
  /** Long-press handler — enters selection mode and selects the row. */
  begin: (id: string) => void
  toggle: (id: string) => void
  toggleAll: (ids: readonly string[]) => void
  /** Leaves selection mode and drops the selection. */
  exit: () => void
  prune: (availableIds: readonly string[]) => void
}

export function useSelectionMode(): SelectionMode {
  const [state, dispatch] = useReducer(selectionModeReducer, initialSelectionMode)

  const begin = useCallback((id: string) => dispatch({ type: 'begin', id }), [])
  const toggle = useCallback((id: string) => dispatch({ type: 'toggle', id }), [])
  const toggleAll = useCallback(
    (ids: readonly string[]) => dispatch({ type: 'toggleAll', ids }),
    [],
  )
  const exit = useCallback(() => dispatch({ type: 'exit' }), [])
  const prune = useCallback(
    (availableIds: readonly string[]) => dispatch({ type: 'prune', availableIds }),
    [],
  )

  const isSelected = useCallback((id: string) => state.selectedIds.has(id), [state.selectedIds])

  return useMemo(
    () => ({
      active: state.active,
      selectedIds: state.selectedIds,
      selectedCount: state.selectedIds.size,
      isSelected,
      begin,
      toggle,
      toggleAll,
      exit,
      prune,
    }),
    [state, isSelected, begin, toggle, toggleAll, exit, prune],
  )
}
