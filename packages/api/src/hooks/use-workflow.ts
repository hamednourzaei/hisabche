// packages/ui/src/hooks/use-workflow.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "../lib/client";

export interface WorkflowInstance {
  id: string;
  workflow_id: string;
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  status: "pending" | "in_progress" | "approved" | "rejected" | "cancelled";
  current_step: number;
  total_steps: number;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useWorkflowInstance(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ["workflow", "instance", entityType, entityId],
    queryFn: async (): Promise<WorkflowInstance | null> => {
      if (!entityType || !entityId) return null;

      try {
        // ✅ از API استفاده کن، نه Supabase مستقیم
        const response = await apiClient.get<{ data: WorkflowInstance[]; total: number }>(
          "/v1/workflows/instances",
          {
            params: {
              entity_type: entityType,
              entity_id: entityId,
              limit: 1,
            },
          }
        );

        return response.data?.data?.[0] || null;
      } catch (error) {
        console.error("Failed to fetch workflow instance:", error);
        return null;
      }
    },
    enabled: !!entityType && !!entityId,
    staleTime: 60_000,
    retry: false,
  });
}