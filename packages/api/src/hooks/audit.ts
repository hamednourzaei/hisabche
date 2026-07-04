// packages/api/src/hooks/audit.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/client";

export const auditKeys = {
  all: ["audit"] as const,
  list: (params: Record<string, unknown>) => [...auditKeys.all, "list", params] as const,
};

interface UseAuditLogsParams {
  page?: number;
  limit?: number;
  action?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export function useAuditLogs(params: UseAuditLogsParams = {}) {
  const { page = 1, limit = 30, ...rest } = params;

  return useQuery({
    queryKey: auditKeys.list({ page, limit, ...rest }),
    queryFn: async () => {
      const response = await apiClient.get("/audit/logs", { 
        params: { page, limit, ...rest } 
      });
      
      // Handle different response structures
      if (response.data?.data) {
        return {
          data: response.data.data,
          total: response.data.total || 0,
        };
      }
      
      // If response is array directly
      if (Array.isArray(response.data)) {
        return {
          data: response.data,
          total: response.data.length,
        };
      }
      
      return {
        data: response.data?.logs || response.data || [],
        total: response.data?.total || 0,
      };
    },
    staleTime: 30000, // 30 seconds
    retry: 2,
  });
}