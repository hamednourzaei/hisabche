// ============================================
// Sync runner — replays the outbox against the API.
//
// Conflict handling: a 4xx (other than 408/429) means the server rejected
// the payload permanently, so the entry is marked failed and kept for the
// user to resolve in the sync centre. Network / 5xx errors stay pending
// and are retried on the next connectivity change.
// ============================================

import NetInfo from '@react-native-community/netinfo'
import type { QueryClient } from '@tanstack/react-query'
import { invoiceKeys, dashboardKeys, type ApiError } from '@hisabche/api'

import { apiClient } from '../../shared/lib/api'
import { useOutboxStore, type OutboxEntry } from './outbox.store'

const MAX_ATTEMPTS = 5

function isPermanent(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429
}

async function pushEntry(entry: OutboxEntry): Promise<void> {
  await apiClient.post('/invoices', entry.payload, {
    headers: { 'Idempotency-Key': entry.clientId },
  })
}

let inflight: Promise<void> | null = null

/**
 * Drain the outbox. Safe to call concurrently: a call made while a drain is
 * running JOINS that drain (awaits the same promise) instead of starting a
 * second pass. Two passes over one queue is how one entry gets sent twice —
 * and a caller that returned immediately (pull-to-refresh) would read the
 * server before its own pending writes had landed.
 */
export function runSync(queryClient: QueryClient): Promise<void> {
  if (inflight) return inflight
  inflight = drain(queryClient).finally(() => {
    inflight = null
  })
  return inflight
}

async function drain(queryClient: QueryClient): Promise<void> {
  const state = useOutboxStore.getState()
  const queue = state.entries.filter((e) => e.status !== 'syncing' && e.attempts < MAX_ATTEMPTS)
  if (queue.length === 0) return

  const { isConnected } = await NetInfo.fetch()
  if (!isConnected) return

  for (const entry of queue) {
    useOutboxStore.getState().markSyncing(entry.clientId)
    try {
      // Sent with its clientId as Idempotency-Key: a replay of a request that
      // already landed returns that invoice instead of creating a second one.
      await pushEntry(entry)
      useOutboxStore.getState().remove(entry.clientId)
    } catch (error) {
      const apiError = error as Partial<ApiError>
      const message = apiError.message ?? 'SYNC_FAILED'

      useOutboxStore.getState().markFailed(entry.clientId, message)

      // A permanent rejection must not be retried automatically — burn the
      // remaining attempts so only an explicit user retry can revive it.
      if (apiError.status && isPermanent(apiError.status)) {
        useOutboxStore.setState((s) => ({
          entries: s.entries.map((e) =>
            e.clientId === entry.clientId ? { ...e, attempts: MAX_ATTEMPTS } : e,
          ),
        }))
      }
    }
  }

  useOutboxStore.getState().setLastSyncedAt(new Date().toISOString())
  await queryClient.invalidateQueries({ queryKey: invoiceKeys.all })
  await queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
}

/** Retry a single failed entry from the sync centre. */
export function retryEntry(clientId: string, queryClient: QueryClient): void {
  useOutboxStore.setState((state) => ({
    entries: state.entries.map((e) =>
      e.clientId === clientId ? { ...e, status: 'pending', attempts: 0 } : e,
    ),
  }))
  void runSync(queryClient)
}
