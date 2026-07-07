// ============================================
// backend/src/services/workflow.service.ts
// Hisabche v1.1 — Workflow & Approval Engine
// Uses Supabase client (same pattern as all other services)
// ═══════════════════════════════════════════════════════════════
// ✅ v1.1 — Auto-notification on create/approve/reject
// ═══════════════════════════════════════════════════════════════

import { supabase } from "../db";
import { NotificationService } from "./notification.service";
import type {
  CreateWorkflowInput,
  UpdateWorkflowInput,
  CreateWorkflowInstanceInput,
  CreateWorkflowActionInput,
  Workflow,
  WorkflowInstance,
  WorkflowActionRecord,
  WorkflowFilters,
  InstanceFilters,
} from "@hisabche/validation";
import { DatabaseError } from "../errors/database.error";

export class WorkflowService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /* ── Create workflow template with steps ── */
  async createWorkflow(
    workspaceId: string,
    input: CreateWorkflowInput
  ): Promise<Workflow> {
    const { data: workflow, error: wfError } = await supabase
      .from("workflows")
      .insert({
        workspace_id: workspaceId,
        name: input.name,
        description: input.description ?? null,
        entity_type: input.entity_type,
      })
      .select()
      .single();

    if (wfError || !workflow) {
      throw new DatabaseError("Failed to create workflow", wfError);
    }

    const { error: stepsError } = await supabase.from("workflow_steps").insert(
      input.steps.map((step) => ({
        workflow_id: workflow.id,
        step_order: step.step_order,
        approver_role: step.approver_role,
        approver_user_id: step.approver_user_id ?? null,
        is_final: step.is_final,
      }))
    );

    if (stepsError) {
      throw new DatabaseError("Failed to create workflow steps", stepsError);
    }

    return this.mapWorkflow(workflow);
  }

  /* ── List workflow templates ── */
  async listWorkflows(
    workspaceId: string,
    filters: WorkflowFilters
  ): Promise<{ data: Workflow[]; total: number }> {
    let query = supabase
      .from("workflows")
      .select("*", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null);

    if (filters.entity_type) {
      query = query.eq("entity_type", filters.entity_type);
    }
    if (filters.is_active !== undefined) {
      query = query.eq("is_active", filters.is_active);
    }

    const from = (filters.page - 1) * filters.limit;
    const to = from + filters.limit - 1;

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw new DatabaseError("Failed to list workflows", error);

    return {
      data: (data || []).map((row) => this.mapWorkflow(row)),
      total: count || 0,
    };
  }

  /* ── Get single workflow ── */
  async getWorkflow(workflowId: string): Promise<Workflow> {
    const { data, error } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .is("deleted_at", null)
      .single();

    if (error || !data) throw new DatabaseError("Workflow not found", error);
    return this.mapWorkflow(data);
  }

  /* ── Update workflow ── */
  async updateWorkflow(
    workflowId: string,
    input: UpdateWorkflowInput
  ): Promise<Workflow> {
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.entity_type !== undefined) updates.entity_type = input.entity_type;
    if (input.is_active !== undefined) updates.is_active = input.is_active;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from("workflows")
        .update(updates)
        .eq("id", workflowId);
      if (error) throw new DatabaseError("Failed to update workflow", error);
    }

    if (input.steps) {
      await supabase.from("workflow_steps").delete().eq("workflow_id", workflowId);
      const { error: stepsError } = await supabase.from("workflow_steps").insert(
        input.steps.map((step) => ({
          workflow_id: workflowId,
          step_order: step.step_order,
          approver_role: step.approver_role,
          approver_user_id: step.approver_user_id ?? null,
          is_final: step.is_final,
        }))
      );
      if (stepsError) throw new DatabaseError("Failed to update steps", stepsError);
    }

    return this.getWorkflow(workflowId);
  }

  /* ── Soft delete workflow ── */
  async deleteWorkflow(workflowId: string): Promise<void> {
    const { error } = await supabase
      .from("workflows")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", workflowId);

    if (error) throw new DatabaseError("Failed to delete workflow", error);
  }

  /* ── Start a new approval process ── */
  async startWorkflow(
    workspaceId: string,
    input: CreateWorkflowInstanceInput
  ): Promise<WorkflowInstance> {
    const { data: templateSteps, error: stepsError } = await supabase
      .from("workflow_steps")
      .select("*")
      .eq("workflow_id", input.workflow_id)
      .order("step_order");

    if (stepsError || !templateSteps || templateSteps.length === 0) {
      throw new DatabaseError("Workflow has no steps defined", stepsError);
    }

    const { data: instance, error } = await supabase
      .from("workflow_instances")
      .insert({
        workflow_id: input.workflow_id,
        workspace_id: workspaceId,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        status: "in_progress",
        current_step: 1,
        total_steps: templateSteps.length,
      })
      .select()
      .single();

    if (error || !instance) {
      throw new DatabaseError("Failed to start workflow", error);
    }

    // ✅ v1.1 — Notify on new workflow
    await this.sendNotification(instance, { action: "pending" });

    return this.mapInstance(instance);
  }

  /* ── List pending approvals ── */
  async listInstances(
    workspaceId: string,
    filters: InstanceFilters
  ): Promise<{ data: WorkflowInstance[]; total: number }> {
    let query = supabase
      .from("workflow_instances")
      .select("*", { count: "exact" })
      .eq("workspace_id", workspaceId);

    if (filters.entity_type) query = query.eq("entity_type", filters.entity_type);
    if (filters.entity_id) query = query.eq("entity_id", filters.entity_id);
    if (filters.status) query = query.eq("status", filters.status);

    const from = (filters.page - 1) * filters.limit;
    const to = from + filters.limit - 1;

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw new DatabaseError("Failed to list instances", error);

    return {
      data: (data || []).map((row) => this.mapInstance(row)),
      total: count || 0,
    };
  }

  /* ── Get single instance with full history ── */
  async getInstance(instanceId: string): Promise<{
    instance: WorkflowInstance;
    actions: WorkflowActionRecord[];
  }> {
    const { data: instance, error } = await supabase
      .from("workflow_instances")
      .select("*")
      .eq("id", instanceId)
      .single();

    if (error || !instance) {
      throw new DatabaseError("Workflow instance not found", error);
    }

    const { data: actions } = await supabase
      .from("workflow_actions")
      .select("*")
      .eq("instance_id", instanceId)
      .order("created_at", { ascending: false });

    return {
      instance: this.mapInstance(instance),
      actions: (actions || []).map((row) => this.mapAction(row)),
    };
  }

  /* ── Approve or reject a step ── */
  async performAction(
    userId: string,
    userRole: string,
    input: CreateWorkflowActionInput
  ): Promise<{
    instance: WorkflowInstance;
    action: WorkflowActionRecord;
  }> {
    const { data: instance, error: instanceError } = await supabase
      .from("workflow_instances")
      .select("*")
      .eq("id", input.instance_id)
      .single();

    if (instanceError || !instance) {
      throw new DatabaseError("Workflow instance not found", instanceError);
    }
    if (instance.status !== "in_progress") {
      throw new DatabaseError("Workflow is not in progress");
    }

    const { data: steps, error: stepError } = await supabase
      .from("workflow_steps")
      .select("*")
      .eq("workflow_id", instance.workflow_id)
      .eq("step_order", instance.current_step);

    if (stepError || !steps || steps.length === 0) {
      throw new DatabaseError("Current step not found", stepError);
    }

    const currentStep = steps[0];

    const { data: action, error: actionError } = await supabase
      .from("workflow_actions")
      .insert({
        instance_id: input.instance_id,
        step_order: instance.current_step,
        action: input.action,
        actor_user_id: userId,
        actor_role: userRole,
        comment: input.comment ?? null,
      })
      .select()
      .single();

    if (actionError || !action) {
      throw new DatabaseError("Failed to record action", actionError);
    }

    let newStatus: string;
    let newStep: number;
    let completedAt: string | null = null;

    if (input.action === "approved") {
      if (currentStep.is_final) {
        newStatus = "approved";
        newStep = instance.current_step;
        completedAt = new Date().toISOString();
      } else {
        newStatus = "in_progress";
        newStep = instance.current_step + 1;
      }
    } else if (input.action === "rejected") {
      newStatus = "rejected";
      newStep = instance.current_step;
      completedAt = new Date().toISOString();
    } else if (input.action === "cancelled") {
      newStatus = "cancelled";
      newStep = instance.current_step;
      completedAt = new Date().toISOString();
    } else {
      newStatus = "in_progress";
      newStep = instance.current_step;
    }

    const { data: updated, error: updateError } = await supabase
      .from("workflow_instances")
      .update({
        status: newStatus,
        current_step: newStep,
        completed_at: completedAt,
      })
      .eq("id", input.instance_id)
      .select()
      .single();

    if (updateError || !updated) {
      throw new DatabaseError("Failed to update instance", updateError);
    }

    // ✅ v1.1 — Auto-send notification
    await this.sendNotification(updated, action);

    return {
      instance: this.mapInstance(updated),
      action: this.mapAction(action),
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     NOTIFICATION HOOK (v1.1)
     ═══════════════════════════════════════════════════════════════ */

  private async sendNotification(
    instance: Record<string, unknown>,
    action: Record<string, unknown>
  ): Promise<void> {
    try {
      const actionType = (action.action as string) || "pending";
      const workspaceId = instance.workspace_id as string;
      const entityType = instance.entity_type as string;
      const entityId = instance.entity_id as string;
      const shortId = entityId?.substring(0, 8) || "";

      const config: Record<string, { title: string; type: "info" | "success" | "warning" }> = {
        pending: { title: "درخواست تأیید جدید", type: "info" },
        approved: { title: "درخواست تأیید شد", type: "success" },
        rejected: { title: "درخواست رد شد", type: "warning" },
      };

      const cfg = config[actionType];
      if (!cfg) return;

      // For pending (new workflow), get workspace owner
      let targetUserId = action.actor_user_id as string;
      if (!targetUserId) {
        const { data: members } = await supabase
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_id", workspaceId)
          .eq("role", "owner")
          .limit(1);
        targetUserId = (members?.[0]?.user_id as string) || "";
      }

      if (!targetUserId) return;

      await this.notificationService.create(workspaceId, {
        user_id: targetUserId,
        title: cfg.title,
        body: `${entityType} #${shortId} ${actionType === "pending" ? "نیاز به تأیید دارد" : actionType === "approved" ? "تأیید شد" : "رد شد"}.`,
        type: cfg.type,
        action_url: `/${entityType}s/${entityId}`,
        entity_type: entityType,
        entity_id: entityId,
      });
    } catch (err) {
      console.error("[Workflow] Notification failed:", err);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     MAPPERS — snake_case (DB) → camelCase (API)
     ═══════════════════════════════════════════════════════════════ */

  private mapWorkflow(row: Record<string, unknown>): Workflow {
    return {
      id: row.id as string,
      workspace_id: row.workspace_id as string,
      name: row.name as string,
      description: (row.description as string) ?? undefined,
      entity_type: row.entity_type as Workflow["entity_type"],
      is_active: (row.is_active as boolean) ?? true,
      steps: [],
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      deleted_at: (row.deleted_at as string) ?? null,
    };
  }

  private mapInstance(row: Record<string, unknown>): WorkflowInstance {
    return {
      id: row.id as string,
      workflow_id: row.workflow_id as string,
      workspace_id: row.workspace_id as string,
      entity_type: row.entity_type as WorkflowInstance["entity_type"],
      entity_id: row.entity_id as string,
      status: row.status as WorkflowInstance["status"],
      current_step: row.current_step as number,
      total_steps: row.total_steps as number,
      started_at: row.started_at as string,
      completed_at: (row.completed_at as string) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }

  private mapAction(row: Record<string, unknown>): WorkflowActionRecord {
    return {
      id: row.id as string,
      instance_id: row.instance_id as string,
      action: row.action as WorkflowActionRecord["action"],
      step_order: row.step_order as number,
      actor_user_id: row.actor_user_id as string,
      actor_role: (row.actor_role as string) ?? null,
      comment: (row.comment as string) ?? undefined,
      created_at: row.created_at as string,
    };
  }
}