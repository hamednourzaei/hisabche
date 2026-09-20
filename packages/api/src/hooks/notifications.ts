// packages/src/hooks/notifications.ts
// FIXED: حذف refetchInterval و جایگزینی با Realtime واقعی روی
// جدول notifications.
//
// چرا: این سیستم بر خلاف activities هیچ Realtime subscription
// نداشت — فقط polling هر ۱۵ ثانیه. با useRealtime (که در پروژه
// از قبل با subscribeToChannel روی event: '*' پیاده‌سازی شده)
// حالا هر تغییر (INSERT/UPDATE/DELETE) در notifications بلافاصله
// queryKey های مرتبط را invalidate می‌کند.
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { useRealtime } from './useRealtime'
import { asList } from '../lib/as-list'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Notification {
  id: string
  title: string
  body?: string | null
  type: 'info' | 'success' | 'warning' | 'approval_required'
  action_url?: string | null
  entity_type?: string | null
  entity_id?: string | null
  is_read: boolean
  created_at: string
  // ✅ اضافه کردن metadata برای اطلاعات فاکتور و سایر Entity‌ها
  metadata?: {
    invoice_number?: string
    customer_name?: string
    total?: number
    currency?: string
    status?: string
    product_name?: string
    quantity?: number
    payment_amount?: number
    [key: string]: unknown
  }
}

// ✅ تایپ پاسخ Backend
interface NotificationsResponse {
  data: Notification[]
  total: number
}

interface UnreadCountResponse {
  count: number
}

// ─── Keys ────────────────────────────────────────────────────────────────────

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
  unread: () => [...notificationKeys.all, 'unread'] as const,
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * دریافت لیست نوتیفیکیشن‌ها
 *
 * Backend Response:
 * {
 *   "data": Notification[],
 *   "total": number
 * }
 */
export function useNotifications() {
  const authReady = useAuthReady()

  // ✅ FIX: به‌جای refetchInterval، subscribe مستقیم به جدول
  // notifications — با هر تغییر، لیست بلافاصله invalidate می‌شود.
  useRealtime({ table: 'notifications', queryKey: notificationKeys.list() as unknown as string[] })

  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: async (): Promise<Notification[]> => {
      try {
        const response = await apiClient.get<NotificationsResponse>('/v1/notifications')

        // ✅ استخراج آرایه از response.data.data
        if (response.data?.data && Array.isArray(response.data.data)) {
          return asList<Notification>(response.data.data)
        }

        // Fallback: اگر داده به شکل دیگری بود
        if (Array.isArray(response.data)) {
          return response.data
        }

        return []
      } catch (error) {
        console.error('Failed to fetch notifications:', error)
        return []
      }
    },
    enabled: authReady,
    staleTime: 60_000,
    // ✅ FIX: بدون refetchInterval — Realtime جایگزین شده.
    placeholderData: [],
  })
}

/**
 * دریافت تعداد نوتیفیکیشن‌های خوانده‌نشده
 *
 * Backend Response:
 * {
 *   "count": number
 * }
 */
export function useUnreadCount() {
  const authReady = useAuthReady()

  // ✅ FIX: همان جدول notifications، همان منطق —
  // یک تغییر (مثلاً mark-as-read) هم شمارش را بلافاصله به‌روز می‌کند.
  useRealtime({
    table: 'notifications',
    queryKey: notificationKeys.unread() as unknown as string[],
  })

  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: async (): Promise<number> => {
      try {
        const response = await apiClient.get<UnreadCountResponse>('/v1/notifications/unread-count')

        // ✅ استخراج count از response.data.count
        if (response.data?.count !== undefined && typeof response.data.count === 'number') {
          return response.data.count
        }

        return 0
      } catch (error) {
        console.error('Failed to fetch unread count:', error)
        return 0
      }
    },
    enabled: authReady,
    staleTime: 60_000,
    // ✅ FIX: بدون refetchInterval — Realtime جایگزین شده.
    placeholderData: 0,
  })
}

/**
 * علامت‌گذاری نوتیفیکیشن‌ها به‌عنوان خوانده‌شده
 *
 * Backend: PATCH /v1/notifications/mark-read
 * Body: { "ids": string[] }
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    // ⚠️ Named so the global mutation cache can tell its own writes apart.
    // Without it, marking one notification read would invalidate the
    // notification queries twice — once here, once there.
    mutationKey: notificationKeys.all,
    mutationFn: async (ids: string[]) => {
      if (!ids || ids.length === 0) return
      await apiClient.patch('/v1/notifications/mark-read', { ids })
    },
    onSuccess: () => {
      // ✅ Invalidating هر دو کوئری
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() })
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread() })
    },
    onError: (error) => {
      console.error('Failed to mark notifications as read:', error)
    },
  })
}

/**
 * علامت‌گذاری همه‌ی نوتیفیکیشن‌ها به‌عنوان خوانده‌شده
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: notificationKeys.all,
    mutationFn: async () => {
      await apiClient.patch('/v1/notifications/mark-all-read')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() })
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread() })
    },
    onError: (error) => {
      console.error('Failed to mark all notifications as read:', error)
    },
  })
}
