"use client"

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface RealtimeOptions {
  table: string
  queryKey: string[]
}

export function useRealtime({ table, queryKey }: RealtimeOptions) {
  const queryClient = useQueryClient()

  useEffect(() => {
    // فقط توی browser اجرا بشه
    if (typeof window === 'undefined') return

    import('../supabase/realtime').then(({ subscribeToChannel }) => {
      const channel = subscribeToChannel(table, () => {
        queryClient.invalidateQueries({ queryKey })
      })

      return () => {
        channel?.unsubscribe?.()
      }
    })
  }, [table, queryKey, queryClient])
}