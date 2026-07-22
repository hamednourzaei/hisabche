// packages/api/src/hooks/useInfiniteActivities.ts
"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import apiClient from "../lib/client";
import { useAuthReady } from "./useAuthReady";
import type { ActivityGroupDto } from "../types/activity.types";

interface InfiniteActivitiesResponse {
  data: ActivityGroupDto[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function useInfiniteActivities(filters?: { 
  type?: string; 
  status?: string;
  search?: string;  // ✅ اضافه شد
}) {
  const authReady = useAuthReady();

  return useInfiniteQuery({
    queryKey: ["activities", "infinite", filters],
    queryFn: async ({ pageParam = null as string | null }): Promise<InfiniteActivitiesResponse> => {
      const { data } = await apiClient.get<InfiniteActivitiesResponse>("/v1/activities", {
        params: {
          ...filters,
          cursor: pageParam,
          limit: 20,
        },
      });
      return data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    enabled: authReady,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}