// ============================================
// Sales Follow-up Hooks — TanStack Query
// ============================================

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/client";
import { useAuthReady } from "./useAuthReady";
import { useRealtime } from "./useRealtime";

// ─── Keys ───────────────────────────────────────────────────

export const salesFollowupKeys = {
  all: ["sales_followups"] as const,
  list: (params: Record<string, unknown>) => [...salesFollowupKeys.all, "list", params] as const,
  detail: (id: string) => [...salesFollowupKeys.all, "detail", id] as const,
};

// ─── Types ───────────────────────────────────────────────────

export interface FollowUp {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  assigned_to_id: string;
  assigned_to_name: string;
  type: "call" | "email" | "meeting" | "note";
  status:
    | "new"
    | "contacted"
    | "meeting_scheduled"
    | "won"
    | "lost"
    | "pending";
  next_action_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
  reminder?: boolean;
  employee_id?: string;
  workspace_id?: string;
}

export interface CreateFollowUpInput {
  customer_id: string;
  assigned_to_id: string;
  type: FollowUp["type"];
  status?: FollowUp["status"];
  next_action_date?: string;
  notes?: string;
  reminder?: boolean;
  employee_id?: string;
  workspace_id?: string;
}

export interface UpdateFollowUpInput {
  customer_id?: string;
  assigned_to_id?: string;
  type?: FollowUp["type"];
  status?: FollowUp["status"];
  next_action_date?: string;
  notes?: string;
  reminder?: boolean;
  employee_id?: string;
  workspace_id?: string;
}

export interface FollowUpFilters {
  status?: FollowUp["status"];
  customer_id?: string;
  assigned_to_id?: string;
  type?: FollowUp["type"];
  employee_id?: string;
  workspace_id?: string;
  page?: number;
  limit?: number;
  search?: string;
}

// ─── Hooks ──────────────────────────────────────────────────

export function useSalesFollowups(filters: FollowUpFilters = {}) {
  const authReady = useAuthReady();

  // ✅ Realtime subscription for sales_followups table
  useRealtime({
    table: 'sales_followups',
    queryKey: salesFollowupKeys.all as unknown as string[]
  });

  return useQuery({
    queryKey: salesFollowupKeys.list(filters as unknown as Record<string, unknown>),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: FollowUp[]; total: number }>('/sales-followups', {
        params: filters,
      });
      return data;
    },
    enabled: authReady,
    staleTime: 30_000,
  });
}

export function useFollowup(id: string | undefined) {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: salesFollowupKeys.detail(id!),
    queryFn: async () => {
      const { data } = await apiClient.get<FollowUp>(`/sales-followups/${id}`);
      return data;
    },
    enabled: authReady && !!id,
    staleTime: 30_000,
  });
}

export function useCreateFollowup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: CreateFollowUpInput) => {
      const { data } = await apiClient.post<FollowUp>('/sales-followups', values);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesFollowupKeys.all });
    },
  });
}

export function useUpdateFollowup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & UpdateFollowUpInput) => {
      const { data } = await apiClient.patch<FollowUp>(`/sales-followups/${id}`, values);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesFollowupKeys.all });
    },
  });
}

export function useDeleteFollowup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/sales-followups/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesFollowupKeys.all });
    },
  });
}

export function useEmployees() {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: ["employees"] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<{ employees: { id: string; name: string }[] }>('/employees');
      return data;
    },
    enabled: authReady,
    staleTime: 30_000,
  });
}

export function useCustomers() {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: ["customers"] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<{ customers: { id: string; name: string; email?: string; phone?: string }[] }>('/customers');
      return data;
    },
    enabled: authReady,
    staleTime: 30_000,
  });
}

export function useWorkspaces() {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: ["workspaces"] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<{ workspaces: { id: string; name: string }[] }>('/workspaces');
      return data;
    },
    enabled: authReady,
    staleTime: 30_000,
  });
}