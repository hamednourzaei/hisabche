"use client"

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthReady } from './useAuthReady'

interface RealtimeOptions {
  table: string
  queryKey: string[]
}

// ✅ گیت شده با authReady: قبل از آماده شدن session، subscribe نمی‌کند
// (جلوگیری از تلاش برای اتصال realtime با یک client که هنوز session ندارد)
export function useRealtime({ table, queryKey }: RealtimeOptions) {
  const queryClient = useQueryClient()
  const authReady = useAuthReady()
  const channelRef = useRef<{ unsubscribe: () => void } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!authReady) return

    // Cleanup previous channel
    channelRef.current?.unsubscribe()

    let cancelled = false

    // ✅ Dynamically import with error handling
    import('../supabase/realtime')
      .then(({ subscribeToChannel }) => {
        subscribeToChannel(table, () => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, authReady]) // ← queryClient و queryKey عمداً حذف شده‌اند (به دلیل رفرنس ناپایدار)
}