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

    // اگه channel قبلی هنوز زنده‌ست، اول unsubscribe کن
    channelRef.current?.unsubscribe()

    import('../supabase/realtime').then(({ subscribeToChannel }) => {
      subscribeToChannel(table, () => {
        queryClient.invalidateQueries({ queryKey })
      }).then((ch: { unsubscribe: () => void }) => {
        channelRef.current = ch
      })
    })

    return () => {
      channelRef.current?.unsubscribe()
      channelRef.current = null
    }
  }, [table]) // ← فقط table، نه queryKey و queryClient
}