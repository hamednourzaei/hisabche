// ============================================
// packages/validation/src/schemas/workflow.schema.ts
// Hisabche v1.1 — Workflow & Approval Engine
// Zod schemas for all workflow CRUD operations
// ============================================

import { z } from "zod";

/* ═══════════════════════════════════════════════════════════════════
   ENUMS
   ═══════════════════════════════════════════════════════════════════ */

export const workflowStatusEnum = z.enum([
  "pending",
  "in_progress",
  "approved",
  "rejected",
  "cancelled",
]);

export const workflowActionEnum = z.enum([
  "approved",
  "rejected",
  "forwarded",
  "cancelled",
]);

export const entityTypeEnum = z.enum([
  "invoice",
  "purchase_order",
  "expense",
]);

export const approverRoleEnum = z.enum([
  "sales_manager",
  "finance_manager",
  "ceo",
  "admin",
]);

/* ═══════════════════════════════════════════════════════════════════
   TYPES (derived from enums)
   ═══════════════════════════════════════════════════════════════════ */

export type WorkflowStatus = z.infer<typeof workflowStatusEnum>;
export type WorkflowAction = z.infer<typeof workflowActionEnum>;
export type EntityType = z.infer<typeof entityTypeEnum>;
export type ApproverRole = z.infer<typeof approverRoleEnum>;

/* ═══════════════════════════════════════════════════════════════════
   WORKFLOW TEMPLATE
   ═══════════════════════════════════════════════════════════════════ */

export const workflowStepSchema = z.object({
  step_order: z.number().int().min(1),
  approver_role: approverRoleEnum,
  approver_user_id: z.string().uuid().nullable().optional(),
  is_final: z.boolean().default(false),
});

export const createWorkflowSchema = z.object({
  name: z.string().min(2, "workflow.nameRequired").max(100),
  description: z.string().max(500).optional(),
  entity_type: entityTypeEnum,
  steps: z
    .array(workflowStepSchema)
    .min(1, "workflow.atLeastOneStep")
    .refine(
      (steps) => steps.some((s) => s.is_final),
      "workflow.mustHaveFinalStep"
    )
    .refine(
      (steps) => {
        const orders = steps.map((s) => s.step_order);
        return new Set(orders).size === orders.length;
      },
      "workflow.duplicateStepOrder"
    ),
});

export const updateWorkflowSchema = createWorkflowSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const workflowSchema = createWorkflowSchema.extend({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable().optional(),
});

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;
export type Workflow = z.infer<typeof workflowSchema>;

/* ═══════════════════════════════════════════════════════════════════
   WORKFLOW INSTANCE
   ═══════════════════════════════════════════════════════════════════ */

export const createWorkflowInstanceSchema = z.object({
  workflow_id: z.string().uuid(),
  entity_type: entityTypeEnum,
  entity_id: z.string().uuid(),
});

export const workflowInstanceSchema = createWorkflowInstanceSchema.extend({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  status: workflowStatusEnum,
  current_step: z.number().int().min(1),
  total_steps: z.number().int().min(1),
  started_at: z.string(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CreateWorkflowInstanceInput = z.infer<typeof createWorkflowInstanceSchema>;
export type WorkflowInstance = z.infer<typeof workflowInstanceSchema>;

/* ═══════════════════════════════════════════════════════════════════
   WORKFLOW ACTION (Approve / Reject)
   ═══════════════════════════════════════════════════════════════════ */

export const createWorkflowActionSchema = z.object({
  instance_id: z.string().uuid(),
  action: workflowActionEnum,
  comment: z.string().max(1000).optional(),
});

export const workflowActionSchema = createWorkflowActionSchema.extend({
  id: z.string().uuid(),
  step_order: z.number().int().min(1),
  actor_user_id: z.string().uuid(),
  actor_role: z.string().nullable(),
  created_at: z.string(),
});

export type CreateWorkflowActionInput = z.infer<typeof createWorkflowActionSchema>;
export type WorkflowActionRecord = z.infer<typeof workflowActionSchema>;

/* ═══════════════════════════════════════════════════════════════════
   QUERY PARAMS
   ═══════════════════════════════════════════════════════════════════ */

export const workflowFiltersSchema = z.object({
  entity_type: entityTypeEnum.optional(),
  is_active: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const instanceFiltersSchema = z.object({
  entity_type: entityTypeEnum.optional(),
  entity_id: z.string().uuid().optional(),
  status: workflowStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type WorkflowFilters = z.infer<typeof workflowFiltersSchema>;
export type InstanceFilters = z.infer<typeof instanceFiltersSchema>;