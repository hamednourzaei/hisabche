'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getActiveWorkspaceId, onActiveWorkspaceChange } from '../lib/active-workspace'
import { useAuthReady } from './useAuthReady'

interface RealtimeOptions {
  table: string
  queryKey: string[]
}

/**
 * Subscribe to the active workspace, re-rendering when it changes.
 *
 * `useSyncExternalStore` is deliberate: the value lives outside React, and a
 * `useState` + effect pairing would miss a change that happened between render
 * and effect — the window in which a workspace switch would leave a
 * subscription pointed at the previous business.
 */
export function useActiveWorkspaceId(): string | null {
  return useSyncExternalStore(
    onActiveWorkspaceChange,
    getActiveWorkspaceId,
    // Server render: no workspace, therefore no subscription.
    () => null,
  )
}

// ✅ گیت شده با authReady: قبل از آماده شدن session، subscribe نمی‌کند
// (جلوگیری از تلاش برای اتصال realtime با یک client که هنوز session ندارد)
export function useRealtime({ table, queryKey }: RealtimeOptions) {
  const queryClient = useQueryClient()
  const authReady = useAuthReady()
  // The active workspace scopes the subscription. Without it the client
  // subscribed to every row on the table, for every business on the platform.
  //
  // Read through the registry rather than the store, because `@hisabche/store`
  // depends on `@hisabche/api` and importing it back would be a cycle — see
  // lib/active-workspace.ts.
  const workspaceId = useActiveWorkspaceId()
  const channelRef = useRef<{ unsubscribe: () => void } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!authReady) return
    // No workspace yet (signing in, or still loading) — subscribe to nothing
    // rather than to everything. The effect re-runs when it arrives.
    if (!workspaceId) return

    // Cleanup previous channel
    channelRef.current?.unsubscribe()

    let cancelled = false

    // ✅ Dynamically import with error handling
    import('../supabase/realtime')
      .then(({ subscribeToChannel }) => {
        subscribeToChannel(table, workspaceId, () => {
          queryClient.invalidateQueries({ queryKey })
        })
          .then((ch: { unsubscribe: () => void }) => {
            if (cancelled) {
              ch.unsubscribe()
              return
            }
            channelRef.current = ch
          })
          .catch((err: Error) => {
            console.warn(`[useRealtime] Failed to subscribe to ${table}:`, err.message)
          })
      })
      .catch((err: Error) => {
        console.warn(`[useRealtime] Failed to import realtime module:`, err.message)
      })

    return () => {
      cancelled = true
      channelRef.current?.unsubscribe()
      channelRef.current = null
    }
    // `workspaceId` MUST stay in this list. Without it, switching workspace
    // leaves the previous workspace's channel subscribed for the life of the
    // tab — the user keeps receiving wake-ups for a book they no longer have
    // open, and after leaving that workspace, for one they are no longer a
    // member of.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, authReady, workspaceId]) // ← queryClient و queryKey عمداً حذف شده‌اند (به دلیل رفرنس ناپایدار)
}
