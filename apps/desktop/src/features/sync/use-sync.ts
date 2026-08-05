// ============================================
// Sync hooks — queue visibility plus background draining.
// ============================================

import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { bridge } from '@/shared/lib/bridge'
import { runSync } from './sync-engine'
import type { QueueEntry } from '../../../electron/shared/ipc-contract'

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

/** Drains the queue on mount, on reconnect, and on a slow background timer. */
export function useBackgroundSync(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    const trigger = () => void runSync(queryClient)

    trigger()
    window.addEventListener('online', trigger)
    const timer = window.setInterval(trigger, BACKGROUND_INTERVAL_MS)

    return () => {
      window.removeEventListener('online', trigger)
      window.clearInterval(timer)
    }
  }, [queryClient])
}
