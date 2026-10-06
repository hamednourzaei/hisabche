// ============================================
// The last answers, on this device — shown at once, then refreshed.
//
// ONE module for every renderer: the Windows/mobile shell and the web app.
// ⚠️ NOT exported from the package barrel, on purpose. It pulls in the two
// persister libraries; from the barrel they would ride in the bundle of every
// page, the public landing included. Import it by its own path:
//   import(...) from '@hisabche/api/src/lib/persisted-query-cache'
//
// Opening the app used to start every number at a skeleton: the query cache
// lived only in memory, so each launch waited on the network before showing
// anything, even though nothing may have changed since yesterday. Now the
// last SUCCESSFUL answers are written to local storage; on the next launch
// they are on screen immediately, and the normal refetch (plus realtime,
// when another employee changes something) replaces them as fresh data
// arrives. Stale numbers are shown as what they are — the previous state —
// and are never the end of the story: every restored query still refetches.
//
// ⚠️ OWNERSHIP IS THE WHOLE DESIGN.
//
// The cache holds one person's view of one business. It is written under an
// owner key — `user:workspace` — and:
//   - a restore for a different owner discards it (the persister's `buster`);
//   - signing out wipes it, from memory AND from storage;
//   - switching user or workspace clears memory first, so the previous
//     owner's answers are never written under the new owner's key.
// `workspace_id` is the security boundary (راهنمای سشن §۱٫۱); the user is in
// the key too because two people in one business may be allowed to see
// different things.
//
// Only successful queries are written (TanStack's default). An error is never
// persisted and never served as data (§۷٫۳).
// ============================================

import { defaultShouldDehydrateQuery, type Query, type QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
  removeOldestQuery,
  type Persister,
} from '@tanstack/react-query-persist-client'

/** Bump when the shape of cached data changes incompatibly. */
const CACHE_VERSION = 'v1'

/**
 * How old a saved cache may be and still be shown. The query client's
 * `gcTime` must be at least this, or a screen not visited in this session is
 * dropped from memory — and then from storage on the next save.
 */
export const PERSISTED_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7

export const PERSISTED_CACHE_KEY = 'hisabche-query-cache'

/**
 * What may be written to the device.
 *
 * ⚠️ NOT A FIGURE SOMEBODY DECIDES ON. «Is there enough stock to sell this?»
 * must be the server's answer of this minute: another employee may have sold
 * the last one since this device last looked. A query marked
 * `meta: { persist: false }` is never saved and so never restored — on top of
 * the default rule (successful queries only; an error is never persisted).
 */
export function shouldPersistQuery(query: Query): boolean {
  return defaultShouldDehydrateQuery(query) && query.meta?.persist !== false
}

export function createQueryCachePersister(storage: Storage | undefined): Persister {
  return createSyncStoragePersister({
    storage,
    key: PERSISTED_CACHE_KEY,
    // A full storage quota must not stop the app: drop the oldest query and
    // try again, rather than throwing and losing the whole cache.
    retry: removeOldestQuery,
  })
}

/** `user:workspace`, or null when either is not known yet. */
export function cacheOwner(
  userId: string | null | undefined,
  workspaceId: string | null | undefined,
): string | null {
  return userId && workspaceId ? `${userId}:${workspaceId}` : null
}

/**
 * Follows the signed-in owner. Call `setOwner` whenever the user or workspace
 * may have changed; it is idempotent for an unchanged owner.
 */
export function createPersistedQueryCache(client: QueryClient, persister: Persister) {
  let owner: string | null = null
  let unsubscribe: (() => void) | null = null
  let generation = 0

  async function setOwner(next: string | null): Promise<void> {
    if (next === owner) return

    const previous = owner
    owner = next
    const mine = ++generation

    unsubscribe?.()
    unsubscribe = null

    if (previous !== null) {
      // A different person or business is now on this device. Nothing from
      // the previous owner may stay in memory — it would be shown, and then
      // saved under the new owner's key.
      client.clear()
    }

    if (next === null) {
      if (previous !== null) await persister.removeClient()
      return
    }

    const buster = `${CACHE_VERSION}:${next}`

    // A cache saved by someone else is discarded (and removed) here, never
    // shown: the buster is part of what was saved.
    await persistQueryClientRestore({
      queryClient: client,
      persister,
      buster,
      maxAge: PERSISTED_CACHE_MAX_AGE_MS,
    })

    // The owner changed again while restoring — the newer call owns the cache.
    if (mine !== generation) return

    unsubscribe = persistQueryClientSubscribe({
      queryClient: client,
      persister,
      buster,
      dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
    })
  }

  return { setOwner }
}
