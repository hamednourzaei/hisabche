// packages/api/src/hooks/useMarkActivityAsRead.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../lib/client";
import { activityKeys } from "./useActivities";

export function useMarkActivityAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids || ids.length === 0) return;
      await apiClient.patch("/v1/activities/mark-read", { ids });
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