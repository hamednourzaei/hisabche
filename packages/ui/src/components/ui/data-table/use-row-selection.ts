// ============================================
// React binding for the shared selection contract.
//
// The semantics live in `@hisabche/ui-contract/selection` so the native mobile
// lists behave identically; this file only wires them to React state.
// ============================================

'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  emptySelection,
  pruneSelection,
  toggleAll as toggleAllIds,
  toggleId,
  type SelectionState,
} from '@hisabche/ui-contract'

export interface RowSelection {
  selectedIds: SelectionState
  selectedCount: number
  isSelected: (id: string) => boolean
  toggleRow: (id: string) => void
  /** Toggles a whole page of rows — see the contract for what "all" means. */
  toggleAll: (ids: readonly string[]) => void
  clear: () => void
  /** Drop ids that no longer exist, so a stale id cannot be acted on. */
  prune: (availableIds: readonly string[]) => void
}

export function useRowSelection(): RowSelection {
  const [selectedIds, setSelectedIds] = useState<SelectionState>(emptySelection)

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((current) => toggleId(current, id))
  }, [])

  const toggleAll = useCallback((ids: readonly string[]) => {
    setSelectedIds((current) => toggleAllIds(current, ids))
  }, [])

  const clear = useCallback(() => setSelectedIds(emptySelection), [])

  const prune = useCallback((availableIds: readonly string[]) => {
    setSelectedIds((current) => pruneSelection(current, availableIds))
  }, [])

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  return useMemo(
    () => ({
      selectedIds,
      selectedCount: selectedIds.size,
      isSelected,
      toggleRow,
      toggleAll,
      clear,
      prune,
    }),
    [selectedIds, isSelected, toggleRow, toggleAll, clear, prune],
  )
}
