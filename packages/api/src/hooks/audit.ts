// ============================================
// packages/api/src/hooks/audit.ts
// ============================================
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/client";

export const auditKeys = {
  all: ["audit"] as const,
  list: (params: Record<string, unknown>) => [...auditKeys.all, "list", params] as const,
};

export function useAuditLogs(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: auditKeys.list(params),
    queryFn: async () => {
      const { data } = await apiClient.get("/audit/logs", { params });
      return data;
    },
    staleTime: 15_000,
  });
}