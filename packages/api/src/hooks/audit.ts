// packages/api/src/hooks/audit.ts
// FIXED: باگ لایه‌ی گم‌شده‌ی .data — بک‌اند مستقیم
// { data: [...], total, page, limit, totalPages } برمی‌گرداند.
// apiClient.get (axios) این بدنه را داخل response.data قرار می‌دهد،
// یعنی آرایه‌ی واقعی logs در response.data.data بود. قبلاً کل
// response (wrapper کامل axios) به extractAuditData پاس داده
// می‌شد، نه response.data — به همین دلیل با اینکه سرور همیشه
// 200 و داده‌ی درست برمی‌گرداند، جدول در فرانت همیشه خالی
// نمایش داده می‌شد.
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/client";
import { useAuthReady } from "./useAuthReady";

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

function extractAuditData(body: unknown): AuditResponse {
  const data = body as Record<string, unknown>;

  // ✅ 1. Check for body.data.logs (بدنه‌ای که خودش یک لایه‌ی nested دارد)
  if (data?.data && typeof data.data === "object" && !Array.isArray(data.data)) {
    const nested = data.data as Record<string, unknown>;
    if (nested?.logs && Array.isArray(nested.logs)) {
      return {
        logs: nested.logs as AuditLog[],
        total: (nested.total as number) || nested.logs.length,
      };
    }
  }

  // ✅ 2. Check for body.logs directly
  if (data?.logs && Array.isArray(data.logs)) {
    return {
      logs: data.logs as AuditLog[],
      total: (data.total as number) || data.logs.length,
    };
  }

  // ✅ 3. Check for body.data as array — این دقیقاً فرمت واقعی
  // بک‌اند فعلی است: { data: AuditLog[], total, page, limit, totalPages }
  if (data?.data && Array.isArray(data.data)) {
    return {
      logs: data.data as AuditLog[],
      total: (data.total as number) || data.data.length,
    };
  }

  // ✅ 4. Fallback: خود body یک آرایه است
  if (Array.isArray(data)) {
    return {
      logs: data as unknown as AuditLog[],
      total: (data as unknown as AuditLog[]).length,
    };
  }

  // ✅ 5. Fallback: empty
  return {
    logs: [],
    total: 0,
  };
}

// ✅ گیت شده با authReady
export function useAuditLogs(params: UseAuditLogsParams = {}) {
  const authReady = useAuthReady();
  const { page = 1, limit = 30, ...rest } = params;

  return useQuery({
    queryKey: auditKeys.list({ page, limit, ...rest }),
    queryFn: async (): Promise<AuditResponse> => {
      const response = await apiClient.get("/audit/logs", {
        params: { page, limit, ...rest },
      });

      // ✅ FIX: response.data (نه خود response) بدنه‌ی واقعی JSON
      // است که بک‌اند برگردانده.
      return extractAuditData(response.data);
    },
    enabled: authReady,
    staleTime: 30000,
    retry: 2,
  });
}