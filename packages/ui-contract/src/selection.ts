// ============================================
// Multi-select semantics.
//
// Pure state transitions with no React and no DOM, so the web tables and the
// native mobile lists share one definition of what selection *means* while each
// binds it to its own renderer. Without this the two would drift on the
// question that actually matters: what "select all" does to rows you cannot
// currently see.
// ============================================

export type SelectionState = ReadonlySet<string>

export const emptySelection: SelectionState = new Set<string>()

export function isSelected(state: SelectionState, id: string): boolean {
  return state.has(id)
}

export function selectionCount(state: SelectionState): number {
  return state.size
}

/** Add `id` if absent, remove it if present. */
export function toggleId(state: SelectionState, id: string): SelectionState {
  const next = new Set(state)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/**
 * Toggle a page of ids as a group: select them all unless every one is already
 * selected, in which case clear them.
 *
 * Only the supplied ids are touched. A selection made on another page — or on
 * rows hidden by the current filter — survives, because a header checkbox
 * should not silently discard work the user cannot see.
 */
export function toggleAll(state: SelectionState, ids: readonly string[]): SelectionState {
  // An empty page is a no-op, not a clear: "every one of zero rows is
  // selected" is vacuously true and would wipe the selection.
  if (ids.length === 0) return state

  const everySelected = ids.every((id) => state.has(id))

  const next = new Set(state)
  for (const id of ids) {
    if (everySelected) next.delete(id)
    else next.add(id)
  }
  return next
}

/**
 * Drop ids that are no longer available.
 *
 * Call after a delete, a refetch or a filter change so a stale id cannot be
 * submitted to a later bulk action. Returns the original set when nothing
 * changed, so consumers can skip re-rendering on every list refresh.
 */
export function pruneSelection(
  state: SelectionState,
  availableIds: readonly string[],
): SelectionState {
  const available = new Set(availableIds)

  const next = new Set<string>()
  for (const id of state) {
    if (available.has(id)) next.add(id)
  }

  return next.size === state.size ? state : next
}

/** True when every supplied id is selected and there is at least one. */
export function areAllSelected(state: SelectionState, ids: readonly string[]): boolean {
  return ids.length > 0 && ids.every((id) => state.has(id))
}

/** True when some — but not all — of the supplied ids are selected. */
export function areSomeSelected(state: SelectionState, ids: readonly string[]): boolean {
  return !areAllSelected(state, ids) && ids.some((id) => state.has(id))
}
