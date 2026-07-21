// ============================================
// packages/api/src/hooks/permissions.ts
// ============================================
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/client";
import { useAuthReady } from "./useAuthReady";

export const permissionKeys = {
  all: ["permissions"] as const,
  roles: () => [...permissionKeys.all, "roles"] as const,
  permissions: () => [...permissionKeys.all, "list"] as const,
};

export function useRoles() {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: permissionKeys.roles(),
    queryFn: async () => {
      const { data } = await apiClient.get("/roles");
      return data;
    },
    enabled: authReady,
  });
}

export function usePermissions() {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: permissionKeys.permissions(),
    queryFn: async () => {
      const { data } = await apiClient.get("/permissions");
      return data;
    },
    enabled: authReady,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { data } = await apiClient.post("/roles", values);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: permissionKeys.all }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/roles/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: permissionKeys.all }),
  });
}