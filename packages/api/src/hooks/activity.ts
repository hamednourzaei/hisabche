// packages/api/src/hooks/activity.ts
// FIXED: حذف refetchInterval از هر سه هوک.
//
// چرا: useRealtimeActivities.ts (که در ActivityCenter کنار این
// هوک‌ها استفاده می‌شود) از قبل به‌صورت زنده روی رویداد INSERT
// جدول activities subscribe است و با هر ردیف جدید، مستقیماً
// queryClient.setQueryData را صدا می‌زند (optimistic update) و
// activityKeys.unread() را invalidate می‌کند. یعنی داده همیشه
// از طریق Realtime تازه است؛ refetchInterval های ۱۵ و ۳۰ ثانیه‌ای
// قبلی صرفاً بار اضافه به سرور می‌زدند بدون فایده‌ی واقعی.
//
// توجه: این هوک‌ها به‌تنهایی (بدون useRealtimeActivities در
// کامپوننت والد) دیگر خودشان تازه نمی‌مانند. اگر در آینده جایی
// این هوک بدون useRealtimeActivities استفاده شود، باید یا
// useRealtimeActivities به همان‌جا اضافه شود یا یک staleTime/
// polling محدود برگردانده شود.
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
  entity: (entityType: string, entityId: string) =>
    [...activityKeys.all, 'entity', entityType, entityId] as const,
  entityActivities: (entityType: string, entityId: string) =>
    [...activityKeys.entity(entityType, entityId), 'activities'] as const,
  entitySummary: (entityType: string, entityId: string) =>
    [...activityKeys.entity(entityType, entityId), 'summary'] as const,
}

// ═══ Hooks ═══

// ─── Get Activities ──────────────────────────────────────────────────────
export function useActivities(filters?: ActivityFilter) {
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
    enabled: authReady,
    staleTime: 30_000,
    // ✅ FIX: بدون refetchInterval — Realtime (useRealtimeActivities)
    // این نقش را ایفا می‌کند.
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
    // ✅ FIX: بدون refetchInterval — Realtime (useRealtimeActivities)
    // این نقش را ایفا می‌کند.
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
    // ✅ FIX: بدون refetchInterval — useRealtimeActivities بعد از
    // هر رویداد جدید، مستقیماً activityKeys.unread() را
    // invalidateQueries می‌کند، پس این عدد همیشه تازه می‌ماند.
    placeholderData: 0,
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
