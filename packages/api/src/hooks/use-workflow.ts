// packages/api/src/hooks/use-workflow.ts
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../lib/client";
import { useAuthReady } from "./useAuthReady";
import { useRealtime } from "./useRealtime";

// ═══ Types ═══
// این تایپ‌ها آینه‌ی دقیق backend/src/routes/workflow.routes.ts و
// packages/validation/src/schemas/workflow.schema.ts هستند — حدس زده نشدند.

export type WorkflowEntityType = "invoice" | "purchase_order" | "expense";
export type WorkflowStatus = "pending" | "in_progress" | "approved" | "rejected" | "cancelled";
export type WorkflowActionType = "approved" | "rejected" | "forwarded" | "cancelled";
export type ApproverRole = "sales_manager" | "finance_manager" | "ceo" | "admin";

export interface WorkflowStep {
  step_order: number;
  approver_role: ApproverRole;
  approver_user_id?: string | null;
  is_final: boolean;
}

export interface Workflow {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  entity_type: WorkflowEntityType;
  steps: WorkflowStep[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowInstance {
  id: string;
  workflow_id: string;
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  status: WorkflowStatus;
  current_step: number;
  total_steps: number;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowActionRecord {
  id: string;
  instance_id: string;
  step_order: number;
  action: WorkflowActionType;
  actor_user_id: string;
  actor_role: string | null;
  comment?: string;
  created_at: string;
}

export interface WorkflowFilters {
  entity_type?: WorkflowEntityType;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

export interface InstanceFilters {
  entity_type?: WorkflowEntityType;
  entity_id?: string;
  status?: WorkflowStatus;
  page?: number;
  limit?: number;
}

// ═══ Query Keys ═══
export const workflowKeys = {
  all: ["workflow"] as const,
  templates: () => [...workflowKeys.all, "templates"] as const,
  templateList: (filters?: WorkflowFilters) => [...workflowKeys.templates(), "list", filters] as const,
  template: (id: string) => [...workflowKeys.templates(), id] as const,
  instances: () => [...workflowKeys.all, "instances"] as const,
  instanceList: (filters?: InstanceFilters) => [...workflowKeys.instances(), "list", filters] as const,
  instance: (id: string) => [...workflowKeys.instances(), id] as const,
}

// ═══ Workflow Templates ═══

export function useWorkflows(filters?: WorkflowFilters) {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: workflowKeys.templateList(filters),
    queryFn: async (): Promise<{ data: Workflow[]; total: number }> => {
      const { data } = await apiClient.get("/v1/workflows", { params: filters });
      return data;
    },
    enabled: authReady,
    staleTime: 120_000,
  });
}

export function useWorkflow(id: string) {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: workflowKeys.template(id),
    queryFn: async (): Promise<Workflow> => {
      const { data } = await apiClient.get(`/v1/workflows/${id}`);
      return data;
    },
    enabled: authReady && !!id,
    staleTime: 120_000,
    retry: false,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string; entity_type: WorkflowEntityType; steps: WorkflowStep[] }) => {
      const { data } = await apiClient.post("/v1/workflows", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.templates() });
    },
  });
}

// ═══ Workflow Instances ═══

export function useWorkflowInstances(filters?: InstanceFilters) {
  const authReady = useAuthReady();

  // ✅ همان الگوی سایر ماژول‌ها (crm.ts، manufacturing.ts): با هر تغییر
  // روی جدول workflow_instances، لیست approvals بدون رفرش دستی به‌روز شود.
  useRealtime({ table: "workflow_instances", queryKey: workflowKeys.instances() as unknown as string[] });

  return useQuery({
    queryKey: workflowKeys.instanceList(filters),
    queryFn: async (): Promise<{ data: WorkflowInstance[]; total: number }> => {
      const { data } = await apiClient.get("/v1/workflows/instances", { params: filters });
      return data;
    },
    enabled: authReady,
    staleTime: 60_000,
  });
}

/** یک instance را با تاریخچه‌ی کامل اکشن‌هایش برمی‌گرداند — برای رندر ApprovalCard لازم است (instance + actions). */
export function useWorkflowInstanceDetail(id: string) {
  const authReady = useAuthReady();

  return useQuery({
    queryKey: workflowKeys.instance(id),
    queryFn: async (): Promise<{ instance: WorkflowInstance; actions: WorkflowActionRecord[] }> => {
      const { data } = await apiClient.get(`/v1/workflows/instances/${id}`);
      return data;
    },
    enabled: authReady && !!id,
    staleTime: 30_000,
  });
}

/** یک instance مشخص را برای یک entity واحد برمی‌گرداند (مثلاً برای نشان دادن نشان «در انتظار تأیید» روی خودِ فاکتور). */
export function useWorkflowInstance(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ["workflow", "instance", "byEntity", entityType, entityId],
    queryFn: async (): Promise<WorkflowInstance | null> => {
      if (!entityType || !entityId) return null;

      try {
        const response = await apiClient.get<{ data: WorkflowInstance[]; total: number }>(
          "/v1/workflows/instances",
          {
            params: {
              entity_type: entityType,
              entity_id: entityId,
              limit: 1,
            },
          }
        );

        return response.data?.data?.[0] || null;
      } catch (error) {
        console.error("Failed to fetch workflow instance:", error);
        return null;
      }
    },
    enabled: !!entityType && !!entityId,
    staleTime: 60_000,
    retry: false,
  });
}

export function useStartWorkflowInstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { workflow_id: string; entity_type: WorkflowEntityType; entity_id: string }) => {
      const { data } = await apiClient.post("/v1/workflows/instances", input);
      return data as WorkflowInstance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.instances() });
    },
  });
}

/** تأیید/رد/ارجاع/لغو یک instance — همان اکشنی که approval-actions.tsx باید صدا بزند. */
export function usePerformWorkflowAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ instanceId, action, comment }: { instanceId: string; action: WorkflowActionType; comment?: string }) => {
      const { data } = await apiClient.post(`/v1/workflows/instances/${instanceId}/action`, { action, comment });
      return data as { instance: WorkflowInstance; action: WorkflowActionRecord };
    },
    onSuccess: (_data, { instanceId }) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.instance(instanceId) });
      queryClient.invalidateQueries({ queryKey: workflowKeys.instances() });
    },
  });
}
