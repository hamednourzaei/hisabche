// ============================================
// packages/api/src/hooks/workspace.ts
// ============================================
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/client";

export const workspaceKeys = {
  all: ["workspaces"] as const,
  list: () => [...workspaceKeys.all, "list"] as const,
  detail: (id: string) => [...workspaceKeys.all, "detail", id] as const,
  members: (id: string) => [...workspaceKeys.all, "members", id] as const,
};

export function useWorkspaces() {
  return useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get("/workspaces");
      return data;
    },
  });
}

export function useWorkspaceMembers(workspaceId: string) {
  return useQuery({
    queryKey: workspaceKeys.members(workspaceId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/workspaces/${workspaceId}/members`);
      return data;
    },
    enabled: !!workspaceId,
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { data } = await apiClient.post("/workspaces", values);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.all }),
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, ...values }: { workspaceId: string; email: string; role: string }) => {
      const { data } = await apiClient.post(`/workspaces/${workspaceId}/invites`, values);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.all }),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, memberId }: { workspaceId: string; memberId: string }) => {
      await apiClient.delete(`/workspaces/${workspaceId}/members/${memberId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.all }),
  });
}