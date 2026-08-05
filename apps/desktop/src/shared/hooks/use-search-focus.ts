// ============================================
// Ctrl+F wiring: the shell bumps a counter, the active page focuses its field.
// ============================================

import { useEffect, type RefObject } from 'react'

import { useUiStore } from '@/shared/stores/ui.store'

export function useSearchFocus(ref: RefObject<HTMLInputElement | null>): void {
  const requestId = useUiStore((s) => s.searchRequestId)

  useEffect(() => {
    if (requestId === 0) return
    ref.current?.focus()
    ref.current?.select()
  }, [ref, requestId])
}
