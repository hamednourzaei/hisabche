// ============================================
// packages/api/src/hooks/entity-sync-state.ts
//
// One entity type's per-row sync state, for a list that has to say which rows
// are still only on this device.
//
// ⚠️ `available: false` IS NOT «everything is confirmed». A browser has no
// outbox: it cannot know, and the screen must say «نامعلوم» rather than
// promise the server accepted something. That is why the flag is returned
// beside the query instead of being folded into an empty array.
// ============================================

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getEntitySyncReader, type EntitySyncEntry } from '../lib/entity-sync-state'

export interface EntitySyncStatesResult {
  readonly entries: readonly EntitySyncEntry[]
  /** False when this host has no outbox to read (the web build). */
  readonly available: boolean
  readonly isLoading: boolean
}

const NO_ENTRIES: readonly EntitySyncEntry[] = []

export function useEntitySyncStates(entityType: string): EntitySyncStatesResult {
  // Registered at module scope by the host, so it does not change during a
  // session; reading it once keeps the query key stable.
  const reader = useMemo(() => getEntitySyncReader(), [])

  const query = useQuery({
    queryKey: ['entity-sync-state', entityType],
    queryFn: async (): Promise<readonly EntitySyncEntry[]> =>
      reader ? reader(entityType) : NO_ENTRIES,
    enabled: reader !== null,
    staleTime: 5_000,
    // The outbox drains in the background: a row that was pending must stop
    // saying so without the person reloading the page.
    refetchInterval: 15_000,
    // ⚠️ React Query PAUSES a query offline by default — and offline is
    // exactly when this answer matters most.
    networkMode: 'always',
  })

  return {
    entries: query.data ?? NO_ENTRIES,
    available: reader !== null,
    isLoading: reader !== null && query.isLoading,
  }
}
