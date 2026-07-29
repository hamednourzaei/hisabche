// ============================================
// packages/api/src/hooks/workspace.ts
// FIXED: اضافه شدن Realtime روی جداول workspaces و workspace_members.
//
// نکته: چون workspaces و workspace_members دو جدول جدا در دیتابیس
// هستند، دو subscription مستقل لازم است — یکی در useWorkspaces
// (برای جدول workspaces) و یکی در useWorkspaceMembers (برای جدول
// workspace_members). دومی اهمیت بیشتری دارد چون تغییرات عضویت
// (دعوت عضو جدید، تغییر نقش، حذف عضو) باید بلافاصله برای بقیه‌ی
// اعضای همان workspace دیده شود.
// ============================================
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/client";
import { useAuthReady } from "./useAuthReady";
import { useRealtime } from "./useRealtime";

export const workspaceKeys = {
  all: ["workspaces"] as const,
  list: () => [...workspaceKeys.all, "list"] as const,
  detail: (id: string) => [...workspaceKeys.all, "detail", id] as const,
  members: (id: string) => [...workspaceKeys.all, "members", id] as const,
};

export function useWorkspaces() {
  const authReady = useAuthReady();

  // ✅ FIX: subscription realtime برای جدول workspaces.
  useRealtime({ table: "workspaces", queryKey: workspaceKeys.all as unknown as string[] });

  return useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get("/workspaces");
      return data;
    },
    enabled: authReady,
  });
}

export function useWorkspaceMembers(workspaceId: string) {
  const authReady = useAuthReady();

  // ✅ FIX: subscription realtime مستقل برای جدول workspace_members
  // — با هر دعوت/حذف/تغییر نقش عضو، این هوک بلافاصله invalidate
  // می‌شود، صرف‌نظر از این‌که useWorkspaces در همان صفحه mount
  // باشد یا نه (چون این دو جدول کاملاً جدا هستند).
  useRealtime({ table: "workspace_members", queryKey: workspaceKeys.all as unknown as string[] });

  return useQuery({
    queryKey: workspaceKeys.members(workspaceId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/workspaces/${workspaceId}/members`);
      return data;
    },
    enabled: authReady && !!workspaceId,
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

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string; [key: string]: unknown }) => {
      const { data } = await apiClient.patch(`/workspaces/${id}`, values);
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

// ✅ Update member role
export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, memberId, role }: { workspaceId: string; memberId: string; role: string }) => {
      await apiClient.patch(`/workspaces/${workspaceId}/members/role`, { memberId, role });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.all }),
  });
}