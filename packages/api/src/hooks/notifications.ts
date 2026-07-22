// packages/src/hooks/notifications.ts
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
}

// ─── Keys ────────────────────────────────────────────────────────────────────

export const notificationKeys = {
  all: ["notifications"] as const,
  list: () => [...notificationKeys.all, "list"] as const,
  unread: () => [...notificationKeys.all, "unread"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useNotifications() {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: async (): Promise<Notification[]> => {
      try {
        const response = await apiClient.get("/v1/notifications");
        // ✅ بررسی ساختار پاسخ
        if (response.data && Array.isArray(response.data)) {
          return response.data;
        }
        if (response.data?.data && Array.isArray(response.data.data)) {
          return response.data.data;
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
    // ✅ fallback data برای جلوگیری از خطا
    placeholderData: [],
  });
}

export function useUnreadCount() {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: async (): Promise<number> => {
      try {
        const response = await apiClient.get("/v1/notifications/unread-count");
        // ✅ بررسی ساختار پاسخ
        if (response.data?.count !== undefined) {
          return response.data.count;
        }
        if (typeof response.data === 'number') {
          return response.data;
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

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      await apiClient.patch("/v1/notifications/mark-read", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
    },
    onError: (error) => {
      console.error("Failed to mark notifications as read:", error);
    },
  });
}