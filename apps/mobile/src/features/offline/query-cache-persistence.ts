// ============================================
// Read cache that survives an app restart — the "local data" offline screens show.
//
// ---------------------------------------------------------------------------
// WHY
//
// The query cache lived only in memory. Close the app, open it without a
// connection, and invoices, customers and products were empty: the only local
// data was the outbox of unsent invoices. «Offline — showing local data» had no
// local data to show.
//
// HOW (no new dependency)
//
// TanStack Query's own `dehydrate` / `hydrate` plus AsyncStorage. Only
// SUCCESSFUL reads of the list families below are written — never an error,
// never a mutation — throttled, and restored once at start.
//
// ⚠️ SCOPED TO ONE WORKSPACE AND ONE SIGNED-IN SESSION
//
// Stored under the workspace id, restored only for that workspace, and every
// stored cache is deleted on sign-out. A shared phone must not show the next
// person the previous person's customers.
// ============================================

import AsyncStorage from '@react-native-async-storage/async-storage'
import { dehydrate, hydrate, type Query, type QueryClient } from '@tanstack/react-query'

export const PERSISTED_ROOTS = [
  'invoices',
  'customers',
  'products',
  'transactions',
  'dashboard',
] as const

const PREFIX = 'hisabche.queryCache.v1:'
const WRITE_THROTTLE_MS = 2_000
/** Older than this, a stored copy is not trusted even as a placeholder. */
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7

export const storageKey = (workspaceId: string) => `${PREFIX}${workspaceId}`

export function shouldPersist(query: Pick<Query, 'queryKey' | 'state'>): boolean {
  const root = query.queryKey[0]
  return (
    query.state.status === 'success' &&
    typeof root === 'string' &&
    (PERSISTED_ROOTS as readonly string[]).includes(root)
  )
}

interface Stored {
  savedAt: number
  state: ReturnType<typeof dehydrate>
}

/** Restore this workspace's stored reads into the client. Returns queries restored. */
export async function restoreQueryCache(client: QueryClient, workspaceId: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(workspaceId))
    if (!raw) return 0
    const stored = JSON.parse(raw) as Stored
    if (!stored?.state || Date.now() - Number(stored.savedAt) > MAX_AGE_MS) {
      await AsyncStorage.removeItem(storageKey(workspaceId))
      return 0
    }
    // hydrate never overwrites a query the client already holds newer data for.
    hydrate(client, stored.state)
    return stored.state.queries.length
  } catch {
    // A corrupt entry is dropped, never allowed to break start-up.
    await AsyncStorage.removeItem(storageKey(workspaceId)).catch(() => undefined)
    return 0
  }
}

export async function saveQueryCache(client: QueryClient, workspaceId: string): Promise<void> {
  const state = dehydrate(client, { shouldDehydrateQuery: shouldPersist })
  const payload: Stored = { savedAt: Date.now(), state }
  await AsyncStorage.setItem(storageKey(workspaceId), JSON.stringify(payload))
}

/** Keep the stored copy current while this workspace is open. Returns an unsubscribe. */
export function persistQueryCache(client: QueryClient, workspaceId: string): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || !shouldPersist(event.query)) return
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      void saveQueryCache(client, workspaceId).catch(() => undefined)
    }, WRITE_THROTTLE_MS)
  })

  return () => {
    unsubscribe()
    if (timer) clearTimeout(timer)
  }
}

/** The scope stored reads belong to: the workspace when known, else the user. */
export function cacheScope(
  session: { user: { id: string }; workspace?: { workspaceId: string } | undefined } | null,
): string | null {
  if (!session) return null
  return session.workspace?.workspaceId ?? `user-${session.user.id}`
}

/** Sign-out: every workspace's stored reads go. */
export async function clearPersistedQueryCaches(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys()
  const ours = keys.filter((key) => key.startsWith(PREFIX))
  if (ours.length > 0) await AsyncStorage.multiRemove(ours)
}
