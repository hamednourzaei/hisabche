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

// ✅ Helper to safely extract logs and total from any response
function extractAuditData(response: any): AuditResponse {
  // If response has data.logs structure
  if (response?.data?.logs) {
    return {
      logs: response.data.logs,
      total: response.data.total || response.data.logs.length,
    };
  }
  
  // If response has data.data structure (our API format)
  if (response?.data?.data) {
    return {
      logs: response.data.data,
      total: response.data.total || response.data.data.length,
    };
  }
  
  // If response itself is an array
  if (Array.isArray(response?.data)) {
    return {
      logs: response.data,
      total: response.data.length,
    };
  }
  
  // If response has logs directly
  if (response?.logs) {
    return {
      logs: response.logs,
      total: response.total || response.logs.length,
    };
  }
  
  // Fallback: empty response
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
        params: { page, limit, ...rest } 
      });
      
      return extractAuditData(response);
    },
    staleTime: 30000,
    retry: 2,
  });
}