// ============================================
// packages/api/src/hooks/projects.ts
// FIXED: اضافه شدن Realtime روی جداول projects و project_tasks.
//
// نکته: چون projects و project_tasks دو جدول کاملاً جدا در
// دیتابیس هستند (نه یک entity با namespace فرعی مثل ledger)، دو
// subscription realtime مستقل لازم است — یکی در useProjects (برای
// جدول projects) و یکی در useProjectTasks (برای جدول project_tasks).
// این با الگوی invoices/products/customers فرق دارد چون آن‌ها
// فقط یک جدول داشتند.
// ============================================
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/client";
import { useAuthReady } from "./useAuthReady";
import { useRealtime } from "./useRealtime";

export const projectKeys = {
  all: ["projects"] as const,
  list: (params?: { status?: string }) => [...projectKeys.all, "list", params] as const,
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
};

export function useProjects(params?: { status?: string } | undefined) {
  const authReady = useAuthReady();

  // ✅ FIX: subscription realtime برای جدول projects — با
  // projectKeys.all، هم لیست‌ها (با هر params) و هم جزئیات یک
  // پروژه‌ی خاص پوشش داده می‌شوند.
  useRealtime({ table: "projects", queryKey: projectKeys.all as unknown as string[] });

  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: async () => {
      const { data } = await apiClient.get("/projects", { params: params ?? undefined });
      return data;
    },
    enabled: authReady,
    staleTime: 30_000,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { data } = await apiClient.post("/projects", values);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/projects/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

// ─── Tasks ──────────────────────────────────────────────────
export const projectTaskKeys = {
  all: ["project-tasks"] as const,
  list: (projectId: string) => [...projectTaskKeys.all, projectId] as const,
};

export function useProjectTasks(projectId: string) {
  const authReady = useAuthReady();

  // ✅ FIX: subscription realtime مستقل برای جدول project_tasks —
  // جدا از projects چون entity/جدول کاملاً متفاوتی است. توجه: اسم
  // جدول در Supabase با underscore است (project_tasks)، در حالی که
  // projectTaskKeys از خط‌تیره در query key استفاده می‌کند
  // ("project-tasks") — این دو با هم بی‌ربط‌اند: اولی اسم جدول
  // دیتابیس برای subscribeToChannel است، دومی صرفاً یک شناسه‌ی
  // داخلی TanStack Query.
  useRealtime({ table: "project_tasks", queryKey: projectTaskKeys.all as unknown as string[] });

  return useQuery({
    queryKey: projectTaskKeys.list(projectId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/projects/${projectId}/tasks`);
      return data;
    },
    enabled: authReady && !!projectId,
  });
}

export function useCreateProjectTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const projectId = values.projectId;
      const { data } = await apiClient.post(`/projects/${projectId}/tasks`, values);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: projectTaskKeys.all }),
  });
}

export function useUpdateProjectTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.patch(`/tasks/${id}`, values);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: projectTaskKeys.all }),
  });
}

export function useDeleteProjectTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/tasks/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: projectTaskKeys.all }),
  });
}

// ─── Single Project ─────────────────────────────────────────
// ⚠️ توجه: این هوک عمداً subscription realtime جدای خودش را ندارد.
// به‌روزرسانی realtime آن از طریق subscription موجود در
// useProjects (که باید در همان صفحه mount باشد) تأمین می‌شود.
export function useProject(id: string) {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get(`/projects/${id}`);
      return data;
    },
    enabled: authReady && !!id,
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.patch(`/projects/${id}`, values);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  });
}