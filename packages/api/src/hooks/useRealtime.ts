"use client"

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { subscribeToChannel } from '../supabase/realtime'

interface RealtimeOptions {
  table: string
  queryKey: string[]
}

export function useRealtime({ table, queryKey }: RealtimeOptions) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = subscribeToChannel(table, () => {
      queryClient.invalidateQueries({ queryKey })
    })

    return () => {
      channel?.unsubscribe?.()
    }
  }, [table, queryKey, queryClient])
}