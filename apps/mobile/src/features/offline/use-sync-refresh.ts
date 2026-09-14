// ============================================
// The hook every refreshable screen uses (lists, dashboard, customer detail).
// ============================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { refreshThroughSync } from './sync-refresh'

const NOTICE_MS = 4_000

export interface SyncRefresh {
  /** Drives RefreshControl. Always returns to false — online or offline. */
  refreshing: boolean
  onRefresh: () => void
  /** True for a few seconds after a pull made without a connection. */
  offlineNotice: boolean
}

export function useSyncRefresh(refetch: () => Promise<unknown>): SyncRefresh {
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const [offlineNotice, setOfflineNotice] = useState(false)
  const busy = useRef(false)
  const mounted = useRef(true)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      mounted.current = false
      if (noticeTimer.current) clearTimeout(noticeTimer.current)
    },
    [],
  )

  const onRefresh = useCallback(() => {
    // A second pull while one is running is ignored, not queued.
    if (busy.current) return
    busy.current = true
    setRefreshing(true)

    void refreshThroughSync(queryClient, refetch)
      .then((outcome) => {
        if (!mounted.current) return
        if (outcome === 'offline') {
          setOfflineNotice(true)
          if (noticeTimer.current) clearTimeout(noticeTimer.current)
          noticeTimer.current = setTimeout(() => {
            if (mounted.current) setOfflineNotice(false)
          }, NOTICE_MS)
        } else {
          setOfflineNotice(false)
        }
      })
      .catch(() => undefined)
      .finally(() => {
        busy.current = false
        if (mounted.current) setRefreshing(false)
      })
  }, [queryClient, refetch])

  return { refreshing, onRefresh, offlineNotice }
}
