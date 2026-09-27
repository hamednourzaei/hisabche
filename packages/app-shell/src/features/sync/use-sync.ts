// ============================================
// Sync hooks — queue visibility plus background draining.
// ============================================

import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { bridge } from '@/shared/lib/bridge'
import { runSync, startSyncStream } from './sync-engine'
import type { QueueEntry } from '@hisabche/app-bridge'

const QUEUE_KEY = ['desktop', 'sync', 'queue'] as const
const BACKGROUND_INTERVAL_MS = 60_000

export function useSyncQueue() {
  return useQuery<QueueEntry[]>({
    queryKey: QUEUE_KEY,
    queryFn: async () => (await bridge()?.db.queue()) ?? [],
    refetchInterval: 5_000,
  })
}

export interface SyncStatus {
  pendingCount: number
  failedCount: number
  isOffline: boolean
  isSyncing: boolean
  sync: () => Promise<void>
}

export function useSyncStatus(): SyncStatus {
  const queryClient = useQueryClient()
  const queue = useSyncQueue()
  const [isSyncing, setIsSyncing] = useState(false)
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine)

  useEffect(() => {
    const online = () => setIsOffline(false)
    const offline = () => setIsOffline(true)

    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [])

  const sync = useCallback(async () => {
    setIsSyncing(true)
    try {
      await runSync(queryClient)
      await queryClient.invalidateQueries({ queryKey: QUEUE_KEY })
    } finally {
      setIsSyncing(false)
    }
  }, [queryClient])

  const entries = queue.data ?? []

  return {
    pendingCount: entries.length,
    failedCount: entries.filter((entry) => entry.status === 'failed').length,
    isOffline,
    isSyncing,
    sync,
  }
}

/**
 * Drains the queue and refreshes the device database: on mount, when the
 * workspace becomes known, on reconnect, and on a slow background timer.
 *
 * ⚠️ `workspaceId` is a dependency on purpose. The first run after sign-in
 * usually happens BEFORE the workspace has loaded, so its pull cannot record a
 * cursor; the run the workspace's arrival triggers is the one that fills the
 * device with the stock and customers an offline invoice needs.
 */
export function useBackgroundSync(workspaceId: string | null): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    const trigger = () => void runSync(queryClient)

    trigger()
    window.addEventListener('online', trigger)
    const timer = window.setInterval(trigger, BACKGROUND_INTERVAL_MS)
    // Near-realtime: another device's sale reaches this one within seconds.
    // The interval above stays as the floor — the stream only makes it sooner.
    const stream = workspaceId ? startSyncStream(workspaceId, trigger) : null

    return () => {
      window.removeEventListener('online', trigger)
      window.clearInterval(timer)
      stream?.stop()
    }
  }, [queryClient, workspaceId])
}

/**
 * Keep the local SQLite cache pointed at the active workspace.
 *
 * The cached tables hold no workspace column of their own — they are filled
 * from REST endpoints already scoped to the caller's authorized workspace. So
 * every row is correct for whichever workspace was active AT PULL TIME, and
 * stays on disk when the user switches to another one. Without this, switching
 * workspace shows the previous business's invoices, offline and with no
 * network involved at all.
 *
 * The purge is refused while unsynced mutations are queued: those exist
 * nowhere but this device, and discarding them would destroy work a shopkeeper
 * did offline. In that case this reports and leaves the cache alone — the
 * caller should flush the queue and try again.
 */
export function useWorkspaceCache(workspaceId: string | null): {
  blockedByPendingMutations: number
} {
  const queryClient = useQueryClient()
  const [blocked, setBlocked] = useState(0)

  useEffect(() => {
    if (!workspaceId) return

    let cancelled = false

    void (async () => {
      const result = await bridge()?.db.setWorkspace(workspaceId)
      if (cancelled || !result) return

      setBlocked(result.blockedByPendingMutations)

      // A purge empties every cached table, so anything already rendered from
      // the old workspace is now stale in React Query's cache too.
      if (result.purged) {
        await queryClient.invalidateQueries()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [workspaceId, queryClient])

  return { blockedByPendingMutations: blocked }
}
