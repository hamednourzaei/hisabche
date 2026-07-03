// ============================================
// packages/api/src/hooks/employees.ts
// ============================================
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/client";

// ─── Keys ───────────────────────────────────────────────────
export const employeeKeys = {
  all: ["employees"] as const,
  list: (params: { page?: number; limit?: number }) => [...employeeKeys.all, "list", params] as const,
  detail: (id: string) => [...employeeKeys.all, "detail", id] as const,
};

// ─── Hooks ──────────────────────────────────────────────────
export function useEmployees(params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: async () => {
      // baseURL = .../api → فقط /employees
      const { data } = await apiClient.get("/employees", { params });
      return data;
    },
    staleTime: 30_000,
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get(`/employees/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { data } = await apiClient.post("/employees", values);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeKeys.all }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.patch(`/employees/${id}`, values);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeKeys.all }),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/employees/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeKeys.all }),
  });
}