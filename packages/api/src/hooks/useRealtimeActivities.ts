// packages/api/src/hooks/useRealtimeActivities.ts
'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabaseClient } from '@hisabche/auth'
import { activityKeys } from './useActivities'
import type { ActivityGroupDto } from '../types/activity.types'

interface RealtimeActivityPayload {
  id: string
  entity_type: string
  entity_id: string
  action: string
  title: string
  description?: string
  actor_id: string
  actor_name: string
  metadata: Record<string, unknown>
  importance: number
  is_read: boolean
  created_at: string
}

export function useRealtimeActivities() {
  const queryClient = useQueryClient()
  const channelRef = useRef<any>(null)
  const isSubscribed = useRef(false)

  // ─── Handle new activity ──────────────────────────────────────────────────
  const handleNewActivity = useCallback(
    (payload: RealtimeActivityPayload) => {
      console.log('🔄 [Realtime] New activity received:', payload)

      // ─── Optimistic update ──────────────────────────────────────────────
      queryClient.setQueryData<ActivityGroupDto[]>(activityKeys.list(), (oldData = []) => {
        // ─── Find or create group ──────────────────────────────────────
        const groupKey = `${payload.entity_type}:${payload.entity_id}`
        const existingGroupIndex = oldData.findIndex(
          (g) => `${g.entityType}:${g.entityId}` === groupKey,
        )

        const newActivity = {
          id: payload.id,
          action: payload.action as ActivityGroupDto['activities'][number]['action'],
          title: payload.title,
          ...(payload.description ? { description: payload.description } : {}),
          actor: payload.actor_name,
          actorId: payload.actor_id,
          actorName: payload.actor_name,
          entityType: payload.entity_type as ActivityGroupDto['entityType'],
          entityId: payload.entity_id,
          metadata: payload.metadata,
          createdAt: payload.created_at,
          timestamp: payload.created_at,
          isRead: payload.is_read,
          importance: payload.importance,
        }

        if (existingGroupIndex >= 0) {
          // ─── Update existing group ──────────────────────────────────
          const updatedGroups = [...oldData]
          const group = updatedGroups[existingGroupIndex]
          if (!group) return oldData

          updatedGroups[existingGroupIndex] = {
            ...group,
            activities: [newActivity, ...group.activities],
            unreadCount: payload.is_read ? group.unreadCount : group.unreadCount + 1,
            latestAt: payload.created_at,
            hasUnread: group.hasUnread || !payload.is_read,
          }

          return updatedGroups
        } else {
          // ─── Create new group ────────────────────────────────────────
          const newGroup: ActivityGroupDto = {
            entityType: payload.entity_type as any,
            entityId: payload.entity_id,
            entitySummary: {
              label: payload.title,
              subtitle: (payload.metadata?.customer_name as string) || '',
              amount: payload.metadata?.total as number,
              currency: payload.metadata?.currency as string,
              status: payload.metadata?.status as string,
              activityCount: 1,
              lastActivity: payload.created_at,
              route: `/${payload.entity_type}s/${payload.entity_id}`,
            },
            activities: [newActivity],
            unreadCount: payload.is_read ? 0 : 1,
            priority: payload.importance > 3 ? 'high' : 'medium',
            latestAt: payload.created_at,
            hasUnread: !payload.is_read,
          }

          return [newGroup, ...oldData]
        }
      })

      // ─── Invalidate queries ────────────────────────────────────────────
      queryClient.invalidateQueries({ queryKey: activityKeys.unread() })
    },
    [queryClient],
  )

  // ─── Subscribe to Realtime ────────────────────────────────────────────────
  useEffect(() => {
    if (isSubscribed.current) return
    isSubscribed.current = true

    const channel = supabaseClient
      .channel('activities:all')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activities',
        },
        (payload: any) => {
          handleNewActivity(payload.new as RealtimeActivityPayload)
        },
      )
      .subscribe((status) => {
        console.log('🔌 [Realtime] Activity channel status:', status)
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabaseClient.removeChannel(channelRef.current)
        channelRef.current = null
        isSubscribed.current = false
      }
    }
  }, [handleNewActivity])

  // ─── Force reconnect ─────────────────────────────────────────────────────
  const reconnect = useCallback(() => {
    if (channelRef.current) {
      supabaseClient.removeChannel(channelRef.current)
      channelRef.current = null
      isSubscribed.current = false
    }
    // Re-subscribe
    const channel = supabaseClient
      .channel('activities:all')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activities',
        },
        (payload: any) => {
          handleNewActivity(payload.new as RealtimeActivityPayload)
        },
      )
      .subscribe()

    channelRef.current = channel
    isSubscribed.current = true
  }, [handleNewActivity])

  return {
    reconnect,
    isConnected: isSubscribed.current,
  }
}
