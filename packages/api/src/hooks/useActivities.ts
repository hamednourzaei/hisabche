// packages/src/hooks/useActivities.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "../lib/client";
import { useAuthReady } from "./useAuthReady";
import type { ActivityGroupDto } from "../types/activity.types";

export const activityKeys = {
  all: ["activities"] as const,
  list: (filters?: Record<string, unknown>) => [...activityKeys.all, "list", filters] as const,
  unread: () => [...activityKeys.all, "unread"] as const,
};

export function useActivities(filters?: { type?: string; status?: string; search?: string }) {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: activityKeys.list(filters),
    queryFn: async (): Promise<ActivityGroupDto[]> => {
      const { data } = await apiClient.get<ActivityGroupDto[]>("/v1/activities", {
        params: filters,
      });
      return data;
    },
    enabled: authReady,
    staleTime: 30_000,
    refetchInterval: 15_000,
    placeholderData: [],
  });
}

export function useUnreadActivityCount() {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: activityKeys.unread(),
    queryFn: async (): Promise<number> => {
      const { data } = await apiClient.get<{ count: number }>("/v1/activities/unread-count");
      return data.count;
    },
    enabled: authReady,
    staleTime: 30_000,
    refetchInterval: 15_000,
    placeholderData: 0,
  });
}