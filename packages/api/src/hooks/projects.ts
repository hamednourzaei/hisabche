// ============================================
// packages/api/src/hooks/projects.ts
// ============================================
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/client";
import { useAuthReady } from "./useAuthReady";

export const projectKeys = {
  all: ["projects"] as const,
  list: (params?: { status?: string }) => [...projectKeys.all, "list", params] as const,
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
};

export function useProjects(params?: { status?: string } | undefined) {
  const authReady = useAuthReady();

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