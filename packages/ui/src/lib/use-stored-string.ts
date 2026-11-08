// ============================================
// packages/ui/src/lib/use-stored-string.ts
//
// A per-viewer view choice kept in localStorage, read as an external store:
// the server and hydration see `null`, then the stored value — no setState
// inside an effect, and every component reading the same key stays in step.
// A blocked storage (private window) still works for this tab.
// ============================================

import { useCallback, useSyncExternalStore } from 'react'

const memory = new Map<string, string | null>()
const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  const onStorage = () => onChange()
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(onChange)
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

function read(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function useStoredString(key: string): [string | null, (next: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  )
  const write = useCallback(
    (next: string | null) => {
      memory.set(key, next)
      try {
        if (next === null) window.localStorage.removeItem(key)
        else window.localStorage.setItem(key, next)
      } catch {
        // Not persisted — still applied for this visit.
      }
      for (const listener of listeners) listener()
    },
    [key],
  )
  return [value, write]
}
