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

export interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  user_id: string;
  created_at: string;
  ip_address?: string;
  user_name?: string;
  details?: Record<string, unknown>;
}

export interface AuditResponse {
  logs: AuditLog[];
  total: number;
  page?: number;
  limit?: number;
}

function extractAuditData(response: unknown): AuditResponse {
  const data = response as Record<string, unknown>;

  // ✅ 1. Check for response.data.logs
  if (data?.data && typeof data.data === 'object') {
    const nested = data.data as Record<string, unknown>;
    if (nested?.logs && Array.isArray(nested.logs)) {
      return {
        logs: nested.logs as AuditLog[],
        total: (nested.total as number) || nested.logs.length,
      };
    }
  }

  // ✅ 2. Check for response.logs directly
  if (data?.logs && Array.isArray(data.logs)) {
    return {
      logs: data.logs as AuditLog[],
      total: (data.total as number) || data.logs.length,
    };
  }

  // ✅ 3. Check for response.data as array
  if (data?.data && Array.isArray(data.data)) {
    return {
      logs: data.data as AuditLog[],
      total: (data.total as number) || data.data.length,
    };
  }

  // ✅ 4. Fallback: empty
  return {
    logs: [],
    total: 0,
  };
}

export function useAuditLogs(params: UseAuditLogsParams = {}) {
  const { page = 1, limit = 30, ...rest } = params;

  return useQuery({
    queryKey: auditKeys.list({ page, limit, ...rest }),
    queryFn: async (): Promise<AuditResponse> => {
      const response = await apiClient.get("/audit/logs", {
        params: { page, limit, ...rest },
      });

      return extractAuditData(response);
    },
    staleTime: 30000,
    retry: 2,
  });
}