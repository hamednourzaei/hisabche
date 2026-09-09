// packages/api/src/hooks/entity.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { asList } from '../lib/as-list'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EntitySummary {
  id: string
  type: 'invoice' | 'customer' | 'product' | 'payment'
  label: string
  subtitle?: string
  amount?: number
  currency?: string
  status?: string
  statusLabel?: string
  statusColor?: string
  lastActivity?: {
    title: string
    time: string
  } | null
  activityCount: number
  hasUnread: boolean
  unreadCount: number
}

export interface Activity {
  id: string
  type: 'created' | 'updated' | 'status_changed' | 'payment' | 'approved' | 'rejected'
  title: string
  description?: string
  timestamp: string
  actor?: string
}

// ─── Keys ────────────────────────────────────────────────────────────────────

export const entityKeys = {
  all: ['entity'] as const,
  summary: (entityType: string, entityId: string) =>
    [...entityKeys.all, 'summary', entityType, entityId] as const,
  activities: (entityType: string, entityId: string) =>
    [...entityKeys.all, 'activities', entityType, entityId] as const,
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * دریافت خلاصه اطلاعات یک Entity (فاکتور، مشتری، محصول، ...)
 */
export function useEntitySummary(entityType: string, entityId: string) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: entityKeys.summary(entityType, entityId),
    queryFn: async (): Promise<EntitySummary | null> => {
      if (!entityType || !entityId) return null

      const { data } = await apiClient.get<EntitySummary>(
        `/api/v1/entities/${entityType}/${entityId}/summary`,
      )
      return data
    },
    enabled: authReady && !!entityType && !!entityId,
    staleTime: 60_000,
    refetchInterval: 30_000,
  })
}

/**
 * دریافت تاریخچه فعالیت‌های یک Entity
 */
export function useEntityActivities(entityType: string, entityId: string) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: entityKeys.activities(entityType, entityId),
    queryFn: async (): Promise<Activity[]> => {
      if (!entityType || !entityId) return []

      const { data } = await apiClient.get<Activity[]>(
        `/api/v1/entities/${entityType}/${entityId}/activities`,
      )
      return asList<Activity>(data)
    },
    enabled: authReady && !!entityType && !!entityId,
    staleTime: 60_000,
    refetchInterval: 30_000,
  })
}
