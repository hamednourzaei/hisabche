// packages/api/src/hooks/useEntitySummary.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "../lib/client";
import { useAuthReady } from "./useAuthReady";

export interface EntitySummary {
  id: string;
  type: "invoice" | "customer" | "product" | "payment";
  label: string;
  subtitle?: string;
  amount?: number;
  currency?: string;
  status?: string;
  statusLabel?: string;
  statusColor?: string;
  lastActivity: {
    title: string;
    time: string;
  };
  activityCount: number;
  hasUnread: boolean;
  unreadCount: number;
}

export function useEntitySummary(entityType: string, entityId: string) {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: ["entity", "summary", entityType, entityId],
    queryFn: async (): Promise<EntitySummary | null> => {
      if (!entityType || !entityId) return null;

      const { data } = await apiClient.get(
        `/v1/entities/${entityType}/${entityId}/summary`
      );
      return data;
    },
    enabled: authReady && !!entityType && !!entityId,
    staleTime: 60_000,
  });
}