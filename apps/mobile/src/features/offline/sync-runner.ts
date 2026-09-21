// ============================================
// Sync runner — replays the queue against the API.
//
// ⚠️ ONE QUEUE, AND IT IS SQLITE'S.
//
// This used to drain a zustand store persisted to AsyncStorage, while the
// shared UI queued its writes through `db.enqueue` — which is SQLite. Two
// queues is not a duplication of effort, it is an invoice that nobody sends
// (queued in the store the drain does not read) or one that is sent twice.
// `migrateLegacyOutbox()` moves whatever the old store still holds, once,
// before the first drain.
//
// ⚠️ IT ALSO KNOWS NOTHING ABOUT A QUERY CACHE. The UI lives in a WebView
// Android can tear down at any moment; a runner holding that page's
// QueryClient would be holding one that may already be gone. It announces
// that it finished and the host forwards the announcement.
//
// Conflict handling: a 4xx (other than 408/429) means the server rejected the
// payload permanently, so the entry is marked failed and kept for the person
// to resolve. Network / 5xx errors stay pending and are retried on the next
// connectivity change.
// ============================================

import NetInfo from '@react-native-community/netinfo'
import type { ApiError } from '@hisabche/api'
import { routeFor, stripFinancialFields, type QueueEntry } from '@hisabche/app-bridge'

import { apiClient } from '../../shared/lib/api'
import * as localDb from '../../host/local-db'

const MAX_ATTEMPTS = 5

/**
 * Where each entity is pushed.
 *
 * ⚠️ THESE ARE THE DOMAIN ROUTES, not a generic table writer. Creating an
 * invoice moves stock, books a ledger entry and takes an invoice number; a
 * queue that wrote rows directly would produce an invoice that sold nothing.
 */
const ENDPOINT_BY_ENTITY: Record<string, string> = {
  invoice: '/invoices',
  customer: '/customers',
  product: '/products',
  transaction: '/transactions',
}

function isPermanent(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429
}

async function pushEntry(entry: QueueEntry): Promise<void> {
  // ⚠️ THE SAME ROUTING THE DESKTOP USES, from the contract. A host that
  // decided for itself would be one build away from sending an invoice down
  // the road that writes the row without moving any stock.
  if (
    routeFor({ entity: entry.entity, operation: entry.operation, payload: entry.payload }) ===
    'versioned'
  ) {
    await pushVersioned(entry)
    return
  }

  const endpoint = ENDPOINT_BY_ENTITY[entry.entity]
  if (!endpoint) throw new Error(`NO_ENDPOINT:${entry.entity}`)

  // The clientId is also the server's deduplication key: a replay of a request
  // whose RESPONSE was lost returns the invoice it already created instead of
  // creating a second one.
  const headers = { 'Idempotency-Key': entry.clientId }

  if (entry.operation === 'create') {
    await apiClient.post(endpoint, entry.payload, { headers })
    return
  }

  if (entry.operation === 'update') {
    await apiClient.patch(`${endpoint}/${String(entry.payload.id)}`, entry.payload, { headers })
    return
  }

  try {
    await apiClient.delete(`${endpoint}/${String(entry.payload.id)}`, { headers })
  } catch (error) {
    // A replayed delete whose first attempt already landed finds nothing to
    // delete. The goal — the row is gone — is met; it is not a failure.
    if ((error as Partial<ApiError>).status === 404) return
    throw error
  }
}

/**
 * A descriptive edit, carrying the version this device believed.
 *
 * Without it the server has nothing to compare and two devices editing one
 * customer resolve as last-write-wins, silently.
 */
async function pushVersioned(entry: QueueEntry): Promise<void> {
  const local = entry.payload as { id?: unknown; version?: unknown }
  const entityId = String(local.id ?? '')
  if (!entityId) throw new Error(`NO_ENTITY_ID:${entry.entity}`)

  const version = Number(local.version ?? 0)

  await apiClient.post('/sync/push', {
    mutations: [
      {
        mutationId: entry.clientId,
        entityType: entry.entity,
        entityId,
        operation: entry.operation,
        payload: stripFinancialFields(entry.payload),
        ...(version > 0 ? { expectedVersion: version } : {}),
      },
    ],
  })
}

/**
 * Called after a drain that actually sent something.
 *
 * ⚠️ A LISTENER, NOT A CACHE HANDLE — see the file header.
 */
type SyncListener = () => void

const listeners = new Set<SyncListener>()

export function onSynced(listener: SyncListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

let inflight: Promise<void> | null = null

/**
 * Drain the queue. Safe to call concurrently: a call made while a drain is
 * running JOINS that drain instead of starting a second pass. Two passes over
 * one queue is how one entry gets sent twice.
 */
export function runSync(): Promise<void> {
  if (inflight) return inflight
  inflight = drain().finally(() => {
    inflight = null
  })
  return inflight
}

async function drain(): Promise<void> {
  // ⚠️ No cache, no queue. Refusing here is right: pretending the queue is
  // empty would report «everything is synced» to somebody whose writes are
  // sitting in a database that never opened.
  if (!localDb.isReady()) return

  const queued = await localDb.queue()
  const pending = queued.filter((entry) => entry.attempts < MAX_ATTEMPTS)
  if (pending.length === 0) return

  const { isConnected } = await NetInfo.fetch()
  if (!isConnected) return

  let sent = 0

  for (const entry of pending) {
    try {
      await pushEntry(entry)
      await localDb.resolveQueue(entry.clientId, 'done')
      sent += 1
    } catch (error) {
      const apiError = error as Partial<ApiError>
      await localDb.resolveQueue(entry.clientId, 'failed', apiError.message ?? 'SYNC_FAILED')

      // A permanent rejection must not be retried automatically — burn the
      // remaining attempts so only an explicit retry can revive it.
      if (apiError.status && isPermanent(apiError.status)) {
        await localDb.burnAttempts(entry.clientId, MAX_ATTEMPTS)
      }
    }
  }

  if (sent > 0) {
    for (const listener of listeners) listener()
  }
}

/** Retry a single failed entry, from the sync screen in the shared UI. */
export async function retryEntry(clientId: string): Promise<void> {
  await localDb.resetAttempts(clientId)
  await runSync()
}
