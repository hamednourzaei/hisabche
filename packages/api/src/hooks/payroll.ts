// ============================================
// packages/api/src/hooks/payroll.ts
// پرداخت‌های حقوق (Salary Payments) — روی جدول payrolls موجود ساخته شده
// ============================================
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/client";
import { useAuthReady } from "./useAuthReady";

// ─── Keys ───────────────────────────────────────────────────
export const payrollKeys = {
  all: ["payrolls"] as const,
  list: (employeeId?: string) => [...payrollKeys.all, "list", employeeId ?? "all"] as const,
  summary: () => [...payrollKeys.all, "summary"] as const,
};

// ─── Hooks ──────────────────────────────────────────────────
export function usePayrolls(employeeId?: string) {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: payrollKeys.list(employeeId),
    queryFn: async () => {
      const { data } = await apiClient.get("/payrolls", { params: employeeId ? { employeeId } : {} });
      return data;
    },
    enabled: authReady && !!employeeId,
    staleTime: 30_000,
  });
}

export function usePayrollSummary() {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: payrollKeys.summary(),
    queryFn: async () => {
      const { data } = await apiClient.get("/payrolls/summary");
      return data as { total: number; byEmployee: Record<string, number> };
    },
    enabled: authReady,
    staleTime: 30_000,
  });
}

export function useCreatePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { data } = await apiClient.post("/payrolls", values);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.all }),
  });
}
