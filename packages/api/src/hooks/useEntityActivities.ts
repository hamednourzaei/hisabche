// packages/api/src/hooks/useEntityActivities.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "../lib/client";
import { useAuthReady } from "./useAuthReady";

export interface Activity {
  id: string;
  type: "created" | "updated" | "status_changed" | "payment" | "approved" | "rejected";
  title: string;
  description?: string;
  timestamp: string;
  actor?: string;
}

export function useEntityActivities(entityType: string, entityId: string) {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: ["entity", "activities", entityType, entityId],
    queryFn: async (): Promise<Activity[]> => {
      if (!entityType || !entityId) return [];

      const { data } = await apiClient.get(
        `/v1/entities/${entityType}/${entityId}/activities`
      );
      return data || [];
    },
    enabled: authReady && !!entityType && !!entityId,
    staleTime: 60_000,
  });
}