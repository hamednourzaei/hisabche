// ============================================
// Pull-to-refresh, routed through the existing sync — not a separate fetch.
//
//   online   1. drain the outbox (runSync — joins a drain already running)
//            2. refetch the screen's own queries from the server
//            → the list re-renders from what the sync produced
//
//   offline  no sync, no network. The screen already renders the local copy
//            (the persisted read cache + the outbox); the caller shows
//            «آفلاین — داده محلی نمایش داده شد». Resolves at once: no spinner
//            waiting on a request that cannot be made.
//
// ⚠️ NO FINANCIAL WRITE IS SENT TWICE BY PULLING
//
// A refresh never creates a write. It can only cause queued writes to be SENT,
// and each goes with its clientId as Idempotency-Key, which the server answers
// with the row it already created (docs/invoice-idempotency-migration.sql).
// Two pulls in a row join one drain instead of racing two.
// ============================================

import NetInfo from '@react-native-community/netinfo'
import type { QueryClient } from '@tanstack/react-query'

import { runSync } from './sync-runner'

export type RefreshOutcome = 'synced' | 'offline'

export async function refreshThroughSync(
  queryClient: QueryClient,
  refetch: () => Promise<unknown>,
): Promise<RefreshOutcome> {
  const { isConnected } = await NetInfo.fetch()
  if (isConnected === false) return 'offline'

  await runSync(queryClient)
  // The screen's own queries, awaited: the spinner ends when the list is fresh.
  // A failed refetch keeps the data already shown; the query reports its error.
  await refetch().catch(() => undefined)
  return 'synced'
}
