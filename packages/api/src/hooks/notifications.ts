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
      const { data } = await apiClient.get<Notification[]>("/notifications");
      return data;
    },
    enabled: authReady,
    staleTime: 30_000,
    refetchInterval: 15_000,
  });
}

export function useUnreadCount() {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: async (): Promise<number> => {
      const { data } = await apiClient.get<{ count: number }>("/notifications/unread");
      return data.count;
    },
    enabled: authReady,
    staleTime: 30_000,
    refetchInterval: 15_000,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      await apiClient.patch("/notifications/read", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
    },
  });
}