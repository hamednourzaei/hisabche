"use client"

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface RealtimeOptions {
  table: string
  queryKey: string[]
}

export function useRealtime({ table, queryKey }: RealtimeOptions) {
  const queryClient = useQueryClient()
  const channelRef = useRef<{ unsubscribe: () => void } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Cleanup previous channel
    channelRef.current?.unsubscribe()

    // ✅ Dynamically import with error handling
    import('../supabase/realtime')
      .then(({ subscribeToChannel }) => {
        subscribeToChannel(table, () => {
          queryClient.invalidateQueries({ queryKey })
        })
        .then((ch: { unsubscribe: () => void }) => {
          channelRef.current = ch
        })
        .catch((err) => {
          console.warn(`[useRealtime] Failed to subscribe to ${table}:`, err.message)
        })
      })
      .catch((err) => {
        console.warn(`[useRealtime] Failed to import realtime module:`, err.message)
      })

    return () => {
      channelRef.current?.unsubscribe()
      channelRef.current = null
    }
  }, [table]) // ← فقط table
}