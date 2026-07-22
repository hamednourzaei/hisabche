// packages/api/src/hooks/notifications.ts
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../lib/client";
import { useAuthReady } from "./useAuthReady";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  title: string;
  body?: string | null;
  type: "info" | "success" | "warning" | "approval_required";
  action_url?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  is_read: boolean;
  created_at: string;
  // ✅ اضافه کردن metadata برای اطلاعات فاکتور و سایر Entity‌ها
  metadata?: {
    invoice_number?: string;
    customer_name?: string;
    total?: number;
    currency?: string;
    status?: string;
    product_name?: string;
    quantity?: number;
    payment_amount?: number;
    [key: string]: unknown;
  };
}

// ✅ تایپ پاسخ Backend
interface NotificationsResponse {
  data: Notification[];
  total: number;
}

interface UnreadCountResponse {
  count: number;
}

// ─── Keys ────────────────────────────────────────────────────────────────────

export const notificationKeys = {
  all: ["notifications"] as const,
  list: () => [...notificationKeys.all, "list"] as const,
  unread: () => [...notificationKeys.all, "unread"] as const,
};

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
  const authReady = useAuthReady();

  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: async (): Promise<Notification[]> => {
      try {
        const response = await apiClient.get<NotificationsResponse>(
          "/api/v1/notifications"
        );
        
        // ✅ استخراج آرایه از response.data.data
        if (response.data?.data && Array.isArray(response.data.data)) {
          return response.data.data;
        }
        
        // Fallback: اگر داده به شکل دیگری بود
        if (Array.isArray(response.data)) {
          return response.data;
        }
        
        return [];
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
        return [];
      }
    },
    enabled: authReady,
    staleTime: 30_000,
    refetchInterval: 15_000,
    placeholderData: [],
  });
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
  const authReady = useAuthReady();

  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: async (): Promise<number> => {
      try {
        const response = await apiClient.get<UnreadCountResponse>(
          "/api/v1/notifications/unread-count"
        );
        
        // ✅ استخراج count از response.data.count
        if (response.data?.count !== undefined && typeof response.data.count === 'number') {
          return response.data.count;
        }
        
        return 0;
      } catch (error) {
        console.error("Failed to fetch unread count:", error);
        return 0;
      }
    },
    enabled: authReady,
    staleTime: 30_000,
    refetchInterval: 15_000,
    placeholderData: 0,
  });
}

/**
 * علامت‌گذاری نوتیفیکیشن‌ها به‌عنوان خوانده‌شده
 * 
 * Backend: PATCH /api/v1/notifications/mark-read
 * Body: { "ids": string[] }
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids || ids.length === 0) return;
      await apiClient.patch("/api/v1/notifications/mark-read", { ids });
    },
    onSuccess: () => {
      // ✅ Invalidating هر دو کوئری
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
    },
    onError: (error) => {
      console.error("Failed to mark notifications as read:", error);
    },
  });
}

/**
 * علامت‌گذاری همه‌ی نوتیفیکیشن‌ها به‌عنوان خوانده‌شده
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiClient.patch("/api/v1/notifications/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
    },
    onError: (error) => {
      console.error("Failed to mark all notifications as read:", error);
    },
  });
}