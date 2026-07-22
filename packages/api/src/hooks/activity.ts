// packages/api/src/hooks/activity.ts
"use client";

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import apiClient from "../lib/client";
import { useAuthReady } from "./useAuthReady";

// ═══ Types ═══

export interface ActivityItemDto {
  id: string;
  action: string;
  title: string;
  description?: string;
  actor: string;
  actorId?: string;
  timestamp: string;
  isRead: boolean;
  importance: number;
}

export interface EntitySummaryDto {
  label: string;
  subtitle?: string;
  amount?: number;
  currency?: string;
  status?: string;
  activityCount: number;
  lastActivity: string;
  route?: string;
}

export interface ActivityGroupDto {
  entityType: string;
  entityId: string;
  entitySummary: EntitySummaryDto;
  activities: ActivityItemDto[];
  unreadCount: number;
  priority: "low" | "medium" | "high" | "urgent";
  latestAt: string;
  hasUnread: boolean;
}

// Alias برای استفاده در UI
export type ActivityGroup = ActivityGroupDto;
export type Activity = ActivityItemDto;
export type EntitySummary = EntitySummaryDto;

export interface ActivityFilter {
  type?: string;
  status?: string;
  search?: string;
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  unread?: boolean;
  priority?: "low" | "medium" | "high" | "urgent";
  limit?: number;
  cursor?: string | null;
}

// ═══ Query Keys ═══

export const activityKeys = {
  all: ["activities"] as const,
  list: (filters?: ActivityFilter) => [...activityKeys.all, "list", filters] as const,
  infinite: (filters?: ActivityFilter) => [...activityKeys.all, "infinite", filters] as const,
  unread: () => [...activityKeys.all, "unread"] as const,
  entity: (entityType: string, entityId: string) =>
    [...activityKeys.all, "entity", entityType, entityId] as const,
  entityActivities: (entityType: string, entityId: string) =>
    [...activityKeys.entity(entityType, entityId), "activities"] as const,
  entitySummary: (entityType: string, entityId: string) =>
    [...activityKeys.entity(entityType, entityId), "summary"] as const,
};

// ═══ Hooks ═══

// ─── Get Activities ──────────────────────────────────────────────────────
export function useActivities(filters?: ActivityFilter) {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: activityKeys.list(filters),
    queryFn: async (): Promise<ActivityGroupDto[]> => {
      const { data } = await apiClient.get<ActivityGroupDto[]>("/activities", {
        params: filters,
      });
      return data;
    },
    enabled: authReady,
    staleTime: 30_000,
    refetchInterval: 30_000,
    placeholderData: [],
  });
}

// ─── Get Infinite Activities ────────────────────────────────────────────
export function useInfiniteActivities(filters?: ActivityFilter) {
  const authReady = useAuthReady();

  return useInfiniteQuery({
    queryKey: activityKeys.infinite(filters),
    queryFn: async ({ pageParam = null }) => {
      const { data } = await apiClient.get("/activities", {
        params: {
          ...filters,
          cursor: pageParam,
          limit: 20,
        },
      });
      return data;
    },
    getNextPageParam: (lastPage: any) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    enabled: authReady,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

// ─── Get Unread Count ────────────────────────────────────────────────────
export function useUnreadCount() {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: activityKeys.unread(),
    queryFn: async (): Promise<number> => {
      const { data } = await apiClient.get<{ count: number }>("/activities/unread-count");
      return data.count;
    },
    enabled: authReady,
    staleTime: 30_000,
    refetchInterval: 30_000,
    placeholderData: 0,
  });
}

// ─── Mark As Read ────────────────────────────────────────────────────────
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids || ids.length === 0) return;
      await apiClient.patch("/activities/mark-read", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.unread() });
    },
    onError: (error) => {
      console.error("Failed to mark activity as read:", error);
    },
  });
}

// ─── Mark All As Read ────────────────────────────────────────────────────
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiClient.patch("/activities/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.unread() });
    },
    onError: (error) => {
      console.error("Failed to mark all activities as read:", error);
    },
  });
}

// ─── Get Entity Activities ──────────────────────────────────────────────
export function useEntityActivities(entityType: string, entityId: string) {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: activityKeys.entityActivities(entityType, entityId),
    queryFn: async (): Promise<ActivityItemDto[]> => {
      const { data } = await apiClient.get<ActivityItemDto[]>(
        `/activities/entity/${entityType}/${entityId}`
      );
      return data;
    },
    enabled: authReady && !!entityType && !!entityId,
    staleTime: 30_000,
    placeholderData: [],
  });
}

// ─── Get Entity Summary ─────────────────────────────────────────────────
export function useEntitySummary(entityType: string, entityId: string) {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: activityKeys.entitySummary(entityType, entityId),
    queryFn: async (): Promise<EntitySummaryDto> => {
      const { data } = await apiClient.get<EntitySummaryDto>(
        `/activities/entity/${entityType}/${entityId}/summary`
      );
      return data;
    },
    enabled: authReady && !!entityType && !!entityId,
    staleTime: 30_000,
  });
}