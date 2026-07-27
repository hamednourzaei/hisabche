// ============================================
// backend/src/services/workflow.service.ts — Optimized v2.2
// FIXED: TypeScript undefined checks
// ============================================

import { supabase } from "../db";
import { NotificationService } from "./notification.service";
import { memoryCache } from "../utils/pagination";
import type {
  CreateWorkflowInput, UpdateWorkflowInput,
  CreateWorkflowInstanceInput, CreateWorkflowActionInput,
  Workflow, WorkflowInstance, WorkflowActionRecord,
  WorkflowFilters, InstanceFilters,
} from "@hisabche/validation";
import { DatabaseError, NotFoundError } from "../errors/database.error";
import { ForbiddenError } from "../errors/auth.error";

// ✅ Column Selection Constants
const WORKFLOW_COLUMNS = 'id, workspace_id, name, description, entity_type, is_active, created_at, updated_at, deleted_at'
const WORKFLOW_MINIMAL = 'id, name, entity_type, is_active'

const WORKFLOW_STEP_COLUMNS = 'id, workflow_id, step_order, approver_role, approver_user_id, is_final, created_at'
const WORKFLOW_STEP_MINIMAL = 'id, workflow_id, step_order, approver_role'

const INSTANCE_COLUMNS = 'id, workflow_id, workspace_id, entity_type, entity_id, status, current_step, total_steps, started_at, completed_at, created_at, updated_at'
const INSTANCE_MINIMAL = 'id, workflow_id, entity_type, entity_id, status, current_step'

const ACTION_COLUMNS = 'id, instance_id, step_order, action, actor_user_id, actor_role, comment, created_at'
const ACTION_MINIMAL = 'id, instance_id, action, step_order, created_at'

// ✅ Types for steps map
interface StepWithWorkflowId {
  id: string
  workflow_id: string
  step_order: number
  approver_role: string
}

export class WorkflowService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  // ─── Cache Keys ──────────────────────────────────────────────
  private getWorkflowCacheKey(workflowId: string) {
    return `workflow:${workflowId}`
  }

  private getWorkflowsCacheKey(workspaceId: string, filters: WorkflowFilters) {
    return `workflows:${workspaceId}:${JSON.stringify(filters)}`
  }

  private getInstanceCacheKey(instanceId: string) {
    return `workflow:instance:${instanceId}`
  }

  private getInstancesCacheKey(workspaceId: string, filters: InstanceFilters) {
    return `workflow:instances:${workspaceId}:${JSON.stringify(filters)}`
  }

  private getWorkflowStepsCacheKey(workflowId: string) {
    return `workflow:steps:${workflowId}`
  }

  /* ─── Create workflow template with steps ─── */
  async createWorkflow(workspaceId: string, input: CreateWorkflowInput): Promise<Workflow> {
    const { data: workflow, error: wfError } = await supabase
      .from("workflows")
      .insert({
        workspace_id: workspaceId,
        name: input.name,
        description: input.description ?? null,
        entity_type: input.entity_type,
      })
      .select(WORKFLOW_COLUMNS)
      .single();

    if (wfError || !workflow) throw new DatabaseError("Failed to create workflow", wfError);

    const { error: stepsError } = await supabase.from("workflow_steps").insert(
      input.steps.map((step) => ({
        workflow_id: workflow.id,
        step_order: step.step_order,
        approver_role: step.approver_role,
        approver_user_id: step.approver_user_id ?? null,
        is_final: step.is_final,
      }))
    );

    if (stepsError) throw new DatabaseError("Failed to create workflow steps", stepsError);

    await this.invalidateWorkflowCache(workspaceId)
    
    return this.mapWorkflow(workflow);
  }

  /* ─── List workflow templates — با کش ─── */
  async listWorkflows(workspaceId: string, filters: WorkflowFilters): Promise<{ data: Workflow[]; total: number }> {
    const cacheKey = this.getWorkflowsCacheKey(workspaceId, filters)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as { data: Workflow[]; total: number }

    let query = supabase
      .from("workflows")
      .select(WORKFLOW_MINIMAL, { count: "estimated" })
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null);

    if (filters.entity_type) query = query.eq("entity_type", filters.entity_type);
    if (filters.is_active !== undefined) query = query.eq("is_active", filters.is_active);

    const from = (filters.page - 1) * filters.limit;
    const to = from + filters.limit - 1;

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw new DatabaseError("Failed to list workflows", error);

    // ✅ گرفتن steps به صورت موازی
    const workflowIds = (data || []).map(w => w.id)
    const stepsMap: Record<string, any[]> = {}
    
    if (workflowIds.length > 0) {
      const { data: steps } = await supabase
        .from("workflow_steps")
        .select(WORKFLOW_STEP_MINIMAL)
        .in("workflow_id", workflowIds)
        .order("step_order")
      
      // ✅ FIX: استفاده از forEach با چک undefined
      if (steps) {
        for (const step of steps as StepWithWorkflowId[]) {
          const workflowId = step.workflow_id
          // ✅ چک کردن وجود workflowId
          if (workflowId) {
            if (!stepsMap[workflowId]) {
              stepsMap[workflowId] = []
            }
            stepsMap[workflowId].push(step)
          }
        }
      }
    }

    const result = {
      data: (data || []).map((row) => ({
        ...this.mapWorkflow(row),
        // ✅ استفاده از stepsMap[row.id] || [] که همیشه آرایه است
        steps: stepsMap[row.id] || [],
      })),
      total: count || 0,
    }

    await memoryCache.set(cacheKey, result, 60)
    return result
  }

  /* ─── Get single workflow ─── */
  async getWorkflow(workflowId: string): Promise<Workflow> {
    const cacheKey = this.getWorkflowCacheKey(workflowId)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as Workflow

    const { data, error } = await supabase
      .from("workflows")
      .select(WORKFLOW_COLUMNS)
      .eq("id", workflowId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw new DatabaseError("Failed to fetch workflow", error);
    if (!data) throw new NotFoundError("Workflow");

    const result = this.mapWorkflow(data)
    await memoryCache.set(cacheKey, result, 300)
    return result
  }

  /* ─── Update workflow ─── */
  async updateWorkflow(workflowId: string, input: UpdateWorkflowInput): Promise<Workflow> {
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

    await memoryCache.invalidate(this.getWorkflowCacheKey(workflowId))
    await memoryCache.invalidate(this.getWorkflowStepsCacheKey(workflowId))

    return this.getWorkflow(workflowId);
  }

  /* ─── Soft delete workflow ─── */
  async deleteWorkflow(workflowId: string): Promise<void> {
    const { error } = await supabase
      .from("workflows")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", workflowId);
    if (error) throw new DatabaseError("Failed to delete workflow", error);

    await memoryCache.invalidate(this.getWorkflowCacheKey(workflowId))
  }

  /* ─── Start a new approval process ─── */
  async startWorkflow(workspaceId: string, input: CreateWorkflowInstanceInput): Promise<WorkflowInstance> {
    const stepsCacheKey = this.getWorkflowStepsCacheKey(input.workflow_id)
    let templateSteps = await memoryCache.get(stepsCacheKey) as any[]
    
    if (!templateSteps) {
      const { data: steps, error } = await supabase
        .from("workflow_steps")
        .select(WORKFLOW_STEP_COLUMNS)
        .eq("workflow_id", input.workflow_id)
        .order("step_order")

      if (error || !steps || steps.length === 0) {
        throw new DatabaseError("Workflow has no steps defined", error);
      }
      templateSteps = steps
      await memoryCache.set(stepsCacheKey, templateSteps, 300)
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
      .select(INSTANCE_COLUMNS)
      .single();

    if (error || !instance) throw new DatabaseError("Failed to start workflow", error);

    this.sendNotification(instance, { action: "pending" }).catch(err =>
      console.error('Notification failed:', err)
    );

    await this.invalidateInstanceCache(workspaceId)

    return this.mapInstance(instance);
  }

  /* ─── List pending approvals ─── */
  async listInstances(workspaceId: string, filters: InstanceFilters): Promise<{ data: WorkflowInstance[]; total: number }> {
    const cacheKey = this.getInstancesCacheKey(workspaceId, filters)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as { data: WorkflowInstance[]; total: number }

    let query = supabase
      .from("workflow_instances")
      .select(INSTANCE_MINIMAL, { count: "estimated" })
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

    const result = {
      data: (data || []).map((row) => this.mapInstance(row)),
      total: count || 0,
    }

    await memoryCache.set(cacheKey, result, 30)
    return result
  }

  /* ─── Get single instance with full history ─── */
  async getInstance(instanceId: string): Promise<{ instance: WorkflowInstance; actions: WorkflowActionRecord[] }> {
    const cacheKey = this.getInstanceCacheKey(instanceId)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as { instance: WorkflowInstance; actions: WorkflowActionRecord[] }

    const [instanceResult, actionsResult] = await Promise.all([
      supabase.from("workflow_instances").select(INSTANCE_COLUMNS).eq("id", instanceId).single(),
      supabase.from("workflow_actions").select(ACTION_MINIMAL).eq("instance_id", instanceId).order("created_at", { ascending: false }),
    ]);

    if (instanceResult.error || !instanceResult.data) {
      throw new DatabaseError("Workflow instance not found", instanceResult.error);
    }

    const result = {
      instance: this.mapInstance(instanceResult.data),
      actions: (actionsResult.data || []).map((row) => this.mapAction(row)),
    }

    await memoryCache.set(cacheKey, result, 120)
    return result
  }

  /* ─── Approve or reject a step ─── */
  async performAction(userId: string, userRole: string, input: CreateWorkflowActionInput): Promise<{ instance: WorkflowInstance; action: WorkflowActionRecord }> {
    const { data: instance, error: instanceError } = await supabase
      .from("workflow_instances")
      .select(INSTANCE_COLUMNS)
      .eq("id", input.instance_id)
      .single();

    if (instanceError || !instance) {
      throw new DatabaseError("Workflow instance not found", instanceError);
    }

    if (instance.status !== "in_progress") {
      throw new DatabaseError("Workflow is not in progress");
    }

    const currentStepNumber = instance.current_step as number;
    if (!currentStepNumber || currentStepNumber < 1) {
      throw new DatabaseError("Invalid current step");
    }

    const workflowId = instance.workflow_id as string;
    if (!workflowId) {
      throw new DatabaseError("Invalid workflow reference");
    }

    const stepsCacheKey = this.getWorkflowStepsCacheKey(workflowId)
    let steps = await memoryCache.get(stepsCacheKey) as any[]
    
    if (!steps) {
      const { data: s, error } = await supabase
        .from("workflow_steps")
        .select(WORKFLOW_STEP_COLUMNS)
        .eq("workflow_id", workflowId)
        .order("step_order")
      
      if (error) throw new DatabaseError("Failed to fetch steps", error)
      steps = s || []
      await memoryCache.set(stepsCacheKey, steps, 300)
    }

    const currentStep = steps.find(s => s.step_order === currentStepNumber)
    if (!currentStep) {
      throw new DatabaseError("Current step not found");
    }

    // ✅ FIX: قبلاً هیچ‌جا چک نمی‌شد که userRole با approver_role همین
    // مرحله مطابقت دارد یا نه — یعنی هر کاربر authenticated (member،
    // viewer، ...) می‌توانست هر مرحله‌ی approval را تأیید/رد کند.
    // "owner"/"admin" (نقش‌های workspace) همیشه override دارند؛ در غیر
    // این صورت نقش کاربر باید دقیقاً همان approver_role مرحله باشد.
    const canAct =
      userRole === "owner" ||
      userRole === "admin" ||
      userRole === (currentStep.approver_role as string);

    if (!canAct) {
      throw new ForbiddenError(
        `Only a "${currentStep.approver_role}" (or workspace admin/owner) can act on this step`
      );
    }

    const { data: action, error: actionError } = await supabase
      .from("workflow_actions")
      .insert({
        instance_id: input.instance_id,
        step_order: currentStepNumber,
        action: input.action,
        actor_user_id: userId,
        actor_role: userRole,
        comment: input.comment ?? null,
      })
      .select(ACTION_COLUMNS)
      .single();

    if (actionError || !action) {
      throw new DatabaseError("Failed to record action", actionError);
    }

    let newStatus: string;
    let newStep: number;
    let completedAt: string | null = null;

    const isFinal = currentStep.is_final as boolean;

    if (input.action === "approved") {
      if (isFinal) {
        newStatus = "approved";
        newStep = currentStepNumber;
        completedAt = new Date().toISOString();
      } else {
        newStatus = "in_progress";
        newStep = currentStepNumber + 1;
      }
    } else if (input.action === "rejected") {
      newStatus = "rejected";
      newStep = currentStepNumber;
      completedAt = new Date().toISOString();
    } else if (input.action === "cancelled") {
      newStatus = "cancelled";
      newStep = currentStepNumber;
      completedAt = new Date().toISOString();
    } else {
      newStatus = "in_progress";
      newStep = currentStepNumber;
    }

    const { data: updated, error: updateError } = await supabase
      .from("workflow_instances")
      .update({
        status: newStatus,
        current_step: newStep,
        completed_at: completedAt,
      })
      .eq("id", input.instance_id)
      .select(INSTANCE_COLUMNS)
      .single();

    if (updateError || !updated) {
      throw new DatabaseError("Failed to update instance", updateError);
    }

    this.sendNotification(updated, action).catch(err =>
      console.error('Notification failed:', err)
    );

    await this.invalidateInstanceCache(instance.workspace_id as string, input.instance_id)

    return {
      instance: this.mapInstance(updated),
      action: this.mapAction(action),
    };
  }

  /* ─── Notification Hook ─── */
  private async sendNotification(instance: Record<string, unknown>, action: Record<string, unknown>): Promise<void> {
    try {
      const actionType = (action.action as string) || "pending";
      const workspaceId = instance.workspace_id as string;
      const entityType = instance.entity_type as string;
      const entityId = instance.entity_id as string;
      const instanceId = instance.id as string;
      const shortId = entityId?.substring(0, 8) || "";

      const config: Record<string, { title: string; type: "info" | "success" | "warning" }> = {
        pending: { title: "درخواست تأیید جدید", type: "info" },
        approved: { title: "درخواست تأیید شد", type: "success" },
        rejected: { title: "درخواست رد شد", type: "warning" },
      };

      const cfg = config[actionType];
      if (!cfg) return;

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
        metadata: { workflow_instance_id: instanceId },
      });
    } catch (err) {
      console.error("[Workflow] Notification failed:", err);
    }
  }

  /* ─── Invalidate Cache ─────────────────────────────────────── */
  private async invalidateWorkflowCache(workspaceId: string) {
    await memoryCache.invalidate(`workflows:${workspaceId}:*`)
    await memoryCache.invalidate(`workflow:steps:*`)
  }

  private async invalidateInstanceCache(workspaceId: string, instanceId?: string) {
    await memoryCache.invalidate(`workflow:instances:${workspaceId}:*`)
    if (instanceId) {
      await memoryCache.invalidate(this.getInstanceCacheKey(instanceId))
    }
  }

  /* ─── MAPPERS ─── */
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

export default WorkflowService