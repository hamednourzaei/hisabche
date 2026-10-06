// packages/api/src/hooks/activity.ts
//
// ⚠️ HOW THIS FEED STAYS FRESH (corrected 27 Sep 2026). An earlier note here
// said a realtime hook (useRealtimeActivities) kept it live. That hook was
// never mounted anywhere and was not even exported — and it subscribed to
// `activities` with NO workspace filter, i.e. every business's rows. It was
// deleted. What actually refreshes these queries: a remount after staleTime
// (web turns refetch-on-focus off globally), and the invalidations after
// mark-as-read. No polling, and no realtime.
'use client'

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { asList } from '../lib/as-list'
import type { ActorRole } from '../types/activity.types'

export type { ActorRole }

// ═══ Types ═══

export interface ActivityItemDto {
  id: string
  action: string
  title: string
  description?: string
  actor: string
  actorId?: string
  /**
   * The actor's role in the workspace that owns the activity, resolved
   * server-side from `workspace_members`.
   *
   * ⚠️ `null`/absent MEANS UNKNOWN, not «the lowest role». Render it neutral
   * and uncoloured — see `types/activity.types.ts`.
   */
  actorRole?: ActorRole | null
  timestamp: string
  isRead: boolean
  importance: number
}

export interface EntitySummaryDto {
  label: string
  subtitle?: string
  amount?: number
  currency?: string
  status?: string
  /**
   * فقط برای فاکتورها. فید هم فروش و هم خرید را نشان می‌دهد، پس بدون این
   * فیلد یک خرید در فهرست دقیقاً شبیه یک فروش دیده می‌شود.
   */
  transactionType?: 'sale' | 'purchase'
  activityCount: number
  lastActivity: string
  route?: string
}

export interface ActivityGroupDto {
  entityType: string
  entityId: string
  entitySummary: EntitySummaryDto
  activities: ActivityItemDto[]
  unreadCount: number
  priority: 'low' | 'medium' | 'high' | 'urgent'
  latestAt: string
  hasUnread: boolean
}

// Alias برای استفاده در UI
export type ActivityGroup = ActivityGroupDto
export type Activity = ActivityItemDto
export type EntitySummary = EntitySummaryDto

export interface ActivityFilter {
  type?: string
  status?: string
  search?: string
  entityType?: string
  entityId?: string
  startDate?: string
  endDate?: string
  unread?: boolean
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  limit?: number
  cursor?: string | null
}

// ═══ Query Keys ═══

export const activityKeys = {
  all: ['activities'] as const,
  list: (filters?: ActivityFilter) => [...activityKeys.all, 'list', filters] as const,
  infinite: (filters?: ActivityFilter) => [...activityKeys.all, 'infinite', filters] as const,
  unread: () => [...activityKeys.all, 'unread'] as const,
  // Under `unread`: everything that invalidates the unread badge (realtime,
  // mark-read) refreshes the tab counts too.
  counts: () => [...activityKeys.unread(), 'counts'] as const,
  entity: (entityType: string, entityId: string) =>
    [...activityKeys.all, 'entity', entityType, entityId] as const,
  entityActivities: (entityType: string, entityId: string) =>
    [...activityKeys.entity(entityType, entityId), 'activities'] as const,
  entitySummary: (entityType: string, entityId: string) =>
    [...activityKeys.entity(entityType, entityId), 'summary'] as const,
}

// ═══ Hooks ═══

// ─── Get Activities ──────────────────────────────────────────────────────
export function useActivities(
  filters?: ActivityFilter,
  options: { enabled?: boolean | undefined } = {},
) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: activityKeys.list(filters),
    queryFn: async (): Promise<ActivityGroupDto[]> => {
      // ✅ FIX: بک‌اند یک envelope صفحه‌بندی‌شده برمی‌گرداند
      // ({ data, nextCursor, hasMore, total })، نه آرایه‌ی خام. قبلاً همین
      // آبجکت مستقیم به کامپوننت می‌رفت و باعث «flatMap is not a function»
      // می‌شد.
      const { data } = await apiClient.get<{ data?: ActivityGroupDto[] } | ActivityGroupDto[]>(
        '/v1/activities',
        {
          params: filters,
        },
      )
      return Array.isArray(data) ? data : (data?.data ?? [])
    },
    enabled: authReady && options.enabled !== false,
    staleTime: 30_000,
    // No refetchInterval: refreshed on remount after staleTime (see top).
    placeholderData: [],
  })
}

// ─── Get Infinite Activities ────────────────────────────────────────────
export function useInfiniteActivities(filters?: ActivityFilter) {
  const authReady = useAuthReady()

  return useInfiniteQuery({
    queryKey: activityKeys.infinite(filters),
    queryFn: async ({ pageParam = null }) => {
      const { data } = await apiClient.get('/v1/activities', {
        params: {
          ...filters,
          cursor: pageParam,
          limit: 20,
        },
      })
      return data
    },
    getNextPageParam: (lastPage: any) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    enabled: authReady,
    staleTime: 30_000,
    // No refetchInterval: refreshed on remount after staleTime (see top).
  })
}

// ─── Get Unread Count ────────────────────────────────────────────────────
export function useUnreadCount() {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: activityKeys.unread(),
    queryFn: async (): Promise<number> => {
      const { data } = await apiClient.get<{ count: number }>('/v1/activities/unread-count')
      return data.count
    },
    enabled: authReady,
    staleTime: 30_000,
    // No refetchInterval: refreshed on remount after staleTime, and
    // invalidated by the mark-as-read mutations (see top).
    placeholderData: 0,
  })
}

export interface ActivityFilterCounts {
  all: number
  unread: number
  invoices: number
  payments: number
  customers: number
}

/**
 * Exact badge counts for the /activities tabs — from the server, not the
 * length of the pages loaded so far.
 */
export function useActivityFilterCounts() {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: activityKeys.counts(),
    queryFn: async ({ signal }): Promise<ActivityFilterCounts> => {
      const { data } = await apiClient.get<ActivityFilterCounts>('/v1/activities/counts', {
        signal,
      })
      return data
    },
    enabled: authReady,
    staleTime: 30_000,
  })
}

// ─── Mark As Read ────────────────────────────────────────────────────────
export function useMarkAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids || ids.length === 0) return
      await apiClient.patch('/v1/activities/mark-read', { ids })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityKeys.all })
      queryClient.invalidateQueries({ queryKey: activityKeys.unread() })
    },
    onError: (error) => {
      console.error('Failed to mark activity as read:', error)
    },
  })
}

// ─── Mark All As Read ────────────────────────────────────────────────────
export function useMarkAllAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await apiClient.patch('/v1/activities/mark-all-read')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityKeys.all })
      queryClient.invalidateQueries({ queryKey: activityKeys.unread() })
    },
    onError: (error) => {
      console.error('Failed to mark all activities as read:', error)
    },
  })
}

// ─── Get Entity Activities ──────────────────────────────────────────────
export function useEntityActivities(entityType: string, entityId: string) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: activityKeys.entityActivities(entityType, entityId),
    queryFn: async (): Promise<ActivityItemDto[]> => {
      const { data } = await apiClient.get<ActivityItemDto[]>(
        `/v1/activities/entity/${entityType}/${entityId}`,
      )
      return asList<ActivityItemDto>(data)
    },
    enabled: authReady && !!entityType && !!entityId,
    staleTime: 30_000,
    placeholderData: [],
  })
}

// ─── Get Entity Summary ─────────────────────────────────────────────────
export function useEntitySummary(entityType: string, entityId: string) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: activityKeys.entitySummary(entityType, entityId),
    queryFn: async (): Promise<EntitySummaryDto> => {
      const { data } = await apiClient.get<EntitySummaryDto>(
        `/v1/activities/entity/${entityType}/${entityId}/summary`,
      )
      return data
    },
    enabled: authReady && !!entityType && !!entityId,
    staleTime: 30_000,
  })
}
