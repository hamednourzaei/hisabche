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
  details?: Record<string, any>;
}

export interface AuditResponse {
  logs: AuditLog[];
  total: number;
  page?: number;
  limit?: number;
}

function extractAuditData(response: any): AuditResponse {
  if (response?.data?.logs) {
    return {
      logs: response.data.logs,
      total: response.data.total || response.data.logs.length,
    };
  }
  
  if (response?.data?.data) {
    return {
      logs: response.data.data,
      total: response.data.total || response.data.data.length,
    };
  }
  
  if (Array.isArray(response?.data)) {
    return {
      logs: response.data,
      total: response.data.length,
    };
  }
  
  if (response?.logs) {
    return {
      logs: response.logs,
      total: response.total || response.logs.length,
    };
  }
  
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
      // ✅ FIX: Remove /api/ from path (baseURL already has it)
      const response = await apiClient.get("/audit/logs", { 
        params: { page, limit, ...rest } 
      });
      
      return extractAuditData(response);
    },
    staleTime: 30000,
    retry: 2,
  });
}