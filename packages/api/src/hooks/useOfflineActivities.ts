'use client'

// ============================================
// packages/api/src/hooks/useOfflineActivities.ts
//
// V65: this file was copied from `packages/ui/src/hooks/activity/` and kept a
// header pointing at that path — a comment that named a different file, and a
// second implementation of the same hook living beside it. There is now ONE
// implementation; the UI path re-exports this one.
//
// ⚠️ THE NAME IS THE ONLY THING «OFFLINE» ABOUT IT. There is no local activity
// store: the old one was a `Map` in memory whose every method was a TODO, so it
// returned nothing, lost everything on refresh, and made the feed look empty
// offline instead of saying it could not be read (docs/HISABCHE_ARCHITECTURE.md
// §652 records the same finding). This hook therefore reports connectivity and
// reads the real server feed; it does NOT claim the feed works offline.
//
// `activity.ts` owns the query and the mark-read mutations — this file adds no
// second fetch path, no second cache, and no placeholder user id.
// ============================================

import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import {
  activityKeys,
  useActivities,
  useMarkAllAsRead,
  useMarkAsRead,
  useUnreadCount,
  type ActivityFilter,
  type ActivityGroupDto,
} from './activity'

export interface OfflineActivitySyncStatus {
  isSyncing: boolean
  /** When a sync actually completed. `null` = never in this session. */
  lastSynced: Date | null
}

export interface OfflineActivitiesResult {
  activities: ActivityGroupDto[]
  isLoading: boolean
  isOffline: boolean
  syncStatus: OfflineActivitySyncStatus
  sync: () => Promise<void>
  markAsRead: (ids: string[]) => Promise<void>
  markAllAsRead: () => Promise<void>
  /** `null` = not read yet or the read failed. Never `0` for an unknown count. */
  unreadCount: number | null
}

/** Connectivity as the browser reports it. Not a queue, not a cache. */
function useIsOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}

/**
 * The activity feed, plus an honest answer about connectivity.
 *
 * The feed refreshes on remount after `staleTime` and after a mark-as-read (see
 * the note at the top of `activity.ts` — this repository deliberately does not
 * poll it). `sync` is the same refresh, callable by hand or when the browser
 * comes back online.
 */
export function useOfflineActivities(filters?: ActivityFilter): OfflineActivitiesResult {
  const queryClient = useQueryClient()
  const online = useIsOnline()
  const { data: activities = [], isLoading, refetch } = useActivities(filters)
  // The counted source is the server's, not a sum over whatever page is loaded.
  const { data: unread } = useUnreadCount()
  const { mutateAsync: markRead } = useMarkAsRead()
  const { mutateAsync: markAllRead } = useMarkAllAsRead()

  const [syncStatus, setSyncStatus] = useState<OfflineActivitySyncStatus>({
    isSyncing: false,
    lastSynced: null,
  })

  const sync = useCallback(async () => {
    setSyncStatus((previous) => ({ ...previous, isSyncing: true }))
    try {
      // `unread` and the tab counts hang under `all`, so one invalidation
      // refreshes the badge and the lists together.
      await queryClient.invalidateQueries({ queryKey: activityKeys.all })
      await refetch()
      setSyncStatus({ isSyncing: false, lastSynced: new Date() })
    } catch {
      setSyncStatus((previous) => ({ ...previous, isSyncing: false }))
    }
  }, [queryClient, refetch])

  useEffect(() => {
    // Registered unconditionally: while the browser is offline this listener is
    // the one that must exist. (Gating it on `online` meant it was attached only
    // after the reconnect event had already fired, so nothing ever refreshed.)
    const goOnline = () => {
      void sync()
    }
    window.addEventListener('online', goOnline)
    return () => window.removeEventListener('online', goOnline)
  }, [sync])

  // A failed mark-as-read propagates to the caller: it is not silently dropped,
  // and it is not retried into a local queue that does not exist.
  const markAsRead = useCallback(
    async (ids: string[]) => {
      await markRead(ids)
    },
    [markRead],
  )

  const markAllAsRead = useCallback(async () => {
    await markAllRead(undefined)
  }, [markAllRead])

  return {
    activities,
    isLoading,
    isOffline: !online,
    syncStatus,
    sync,
    markAsRead,
    markAllAsRead,
    unreadCount: unread ?? null,
  }
}
