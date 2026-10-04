// ============================================
// backend/src/services/workflow.service.ts — Optimized v2.2
// FIXED: TypeScript undefined checks
// ============================================

import { supabase } from '../db'
import type { TenancyContext } from './tenancy.service'
import { NotificationService } from './notification.service'
import { memoryCache } from '../utils/pagination'
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
} from '@hisabche/validation'
import { ConflictError, DatabaseError, NotFoundError } from '../errors/database.error'
import { ForbiddenError } from '../errors/auth.error'
import { escalationService } from './workflow/escalation.service'
import { ValidationError } from '../errors/validation.error'
import {
  validateDefinition,
  type DefinitionProblem,
  type WorkflowDefinition,
} from './workflow/builder.domain'

// ✅ Column Selection Constants
const WORKFLOW_COLUMNS =
  'id, workspace_id, name, description, entity_type, is_active, created_at, updated_at, deleted_at'
const WORKFLOW_MINIMAL = 'id, name, entity_type, is_active'

const WORKFLOW_STEP_COLUMNS =
  'id, workflow_id, step_order, approver_role, approver_user_id, is_final, created_at'
const WORKFLOW_STEP_MINIMAL = 'id, workflow_id, step_order, approver_role'

const INSTANCE_COLUMNS =
  'id, workflow_id, workspace_id, entity_type, entity_id, status, current_step, total_steps, started_at, completed_at, created_at, updated_at'
const INSTANCE_MINIMAL = 'id, workflow_id, entity_type, entity_id, status, current_step'

const ACTION_COLUMNS =
  'id, instance_id, step_order, action, actor_user_id, actor_role, comment, created_at'
const ACTION_MINIMAL = 'id, instance_id, action, step_order, created_at'

// ✅ Types for steps map
interface StepWithWorkflowId {
  id: string
  workflow_id: string
  step_order: number
  approver_role: string
}

/**
 * What is wrong with a template BEFORE it is saved (#144).
 *
 * A template is a chain of approvals. It is read as the builder's own
 * definition — each step an approval that leads to the next, the last one
 * ending the workflow — and checked with the builder's rules, so a template
 * with no step, two steps in the same position, or a step nobody is named to
 * approve is refused when it is made. Found later, it is a document frozen in
 * «awaiting approval» with nobody able to approve it.
 */
export function templateProblems(input: {
  name: string
  entity_type: string
  steps: ReadonlyArray<{ step_order: number; approver_role?: string | null }>
}): DefinitionProblem[] {
  const ordered = [...input.steps].sort((a, b) => a.step_order - b.step_order)
  const definition: WorkflowDefinition = {
    key: 'template',
    name: input.name,
    version: 1,
    enabled: true,
    appliesTo: input.entity_type as WorkflowDefinition['appliesTo'],
    steps: ordered.map((step, index) => {
      const next = ordered[index + 1]
      return {
        id: String(step.step_order),
        name: String(step.step_order),
        kind: 'approval' as const,
        // The builder only asks whether a role is named; which roles exist is
        // the schema's rule. An empty role is passed through as «none».
        ...(step.approver_role
          ? { requiredRole: step.approver_role as 'owner' | 'manager' | 'seller' }
          : {}),
        nextOnApproval: next ? String(next.step_order) : null,
        nextOnRefusal: null,
      }
    }),
  }
  return [...new Set(validateDefinition(definition))]
}

export class WorkflowService {
  private notificationService: NotificationService

  constructor() {
    this.notificationService = new NotificationService()
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
    // Checked before anything is written: the template and its steps are two
    // inserts, and a refused template must leave neither behind.
    const problems = templateProblems(input)
    if (problems.length > 0) throw new ValidationError(`WORKFLOW_${problems[0]}`)

    const { data: workflow, error: wfError } = await supabase
      .from('workflows')
      .insert({
        workspace_id: workspaceId,
        name: input.name,
        description: input.description ?? null,
        entity_type: input.entity_type,
      })
      .select(WORKFLOW_COLUMNS)
      .single()

    if (wfError || !workflow) throw new DatabaseError('Failed to create workflow', wfError)

    const { error: stepsError } = await supabase.from('workflow_steps').insert(
      input.steps.map((step) => ({
        workflow_id: workflow.id,
        step_order: step.step_order,
        approver_role: step.approver_role,
        approver_user_id: step.approver_user_id ?? null,
        is_final: step.is_final,
      })),
    )

    if (stepsError) throw new DatabaseError('Failed to create workflow steps', stepsError)

    await this.invalidateWorkflowCache(workspaceId)

    return this.mapWorkflow(workflow)
  }

  /* ─── List workflow templates — با کش ─── */
  async listWorkflows(
    workspaceId: string,
    filters: WorkflowFilters,
  ): Promise<{ data: Workflow[]; total: number }> {
    const cacheKey = this.getWorkflowsCacheKey(workspaceId, filters)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as { data: Workflow[]; total: number }

    let query = supabase
      .from('workflows')
      .select(WORKFLOW_MINIMAL, { count: 'estimated' })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)

    if (filters.entity_type) query = query.eq('entity_type', filters.entity_type)
    if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active)

    const from = (filters.page - 1) * filters.limit
    const to = from + filters.limit - 1

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw new DatabaseError('Failed to list workflows', error)

    // ✅ گرفتن steps به صورت موازی
    const workflowIds = (data || []).map((w) => w.id)
    const stepsMap: Record<string, any[]> = {}

    if (workflowIds.length > 0) {
      const { data: steps } = await supabase
        .from('workflow_steps')
        .select(WORKFLOW_STEP_MINIMAL)
        .in('workflow_id', workflowIds)
        .order('step_order')

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

    // ✅ FIX: برخلاف listWorkflows (که فقط تمپلیت‌های فعال را نشان می‌دهد)،
    // این متد باید حتی تمپلیت soft-delete شده را هم برگرداند — چون
    // workflow_instances قبلی هنوز به این workflow_id ارجاع می‌دهند و صفحه‌ی
    // approvals برای رندر کردن مراحل (steps) هر instance نیاز به همین متد دارد.
    // فیلتر deleted_at اینجا باعث ۴۰۴ همیشگی برای هر instance می‌شد که
    // تمپلیتش بعداً حذف شده بود (کارت آن روی صفحه تا ابد در حالت لودینگ می‌ماند).
    const { data, error } = await supabase
      .from('workflows')
      .select(WORKFLOW_COLUMNS)
      .eq('id', workflowId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch workflow', error)
    if (!data) throw new NotFoundError('Workflow')

    const result = this.mapWorkflow(data)
    await memoryCache.set(cacheKey, result, 300)
    return result
  }

  /* ─── Update workflow ─── */
  async updateWorkflow(workflowId: string, input: UpdateWorkflowInput): Promise<Workflow> {
    const updates: Record<string, unknown> = {}
    if (input.name !== undefined) updates.name = input.name
    if (input.description !== undefined) updates.description = input.description
    if (input.entity_type !== undefined) updates.entity_type = input.entity_type
    if (input.is_active !== undefined) updates.is_active = input.is_active

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('workflows').update(updates).eq('id', workflowId)
      if (error) throw new DatabaseError('Failed to update workflow', error)
    }

    if (input.steps) {
      await supabase.from('workflow_steps').delete().eq('workflow_id', workflowId)
      const { error: stepsError } = await supabase.from('workflow_steps').insert(
        input.steps.map((step) => ({
          workflow_id: workflowId,
          step_order: step.step_order,
          approver_role: step.approver_role,
          approver_user_id: step.approver_user_id ?? null,
          is_final: step.is_final,
        })),
      )
      if (stepsError) throw new DatabaseError('Failed to update steps', stepsError)
    }

    await memoryCache.invalidate(this.getWorkflowCacheKey(workflowId))
    await memoryCache.invalidate(this.getWorkflowStepsCacheKey(workflowId))

    return this.getWorkflow(workflowId)
  }

  /* ─── Soft delete workflow ─── */
  async deleteWorkflow(workflowId: string): Promise<void> {
    const { error } = await supabase
      .from('workflows')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', workflowId)
    if (error) throw new DatabaseError('Failed to delete workflow', error)

    await memoryCache.invalidate(this.getWorkflowCacheKey(workflowId))
  }

  /* ─── Start a new approval process ─── */
  async startWorkflow(
    workspaceId: string,
    input: CreateWorkflowInstanceInput,
  ): Promise<WorkflowInstance> {
    const stepsCacheKey = this.getWorkflowStepsCacheKey(input.workflow_id)
    let templateSteps = (await memoryCache.get(stepsCacheKey)) as any[]

    if (!templateSteps) {
      const { data: steps, error } = await supabase
        .from('workflow_steps')
        .select(WORKFLOW_STEP_COLUMNS)
        .eq('workflow_id', input.workflow_id)
        .order('step_order')

      if (error || !steps || steps.length === 0) {
        throw new DatabaseError('Workflow has no steps defined', error)
      }
      templateSteps = steps
      await memoryCache.set(stepsCacheKey, templateSteps, 300)
    }

    const { data: instance, error } = await supabase
      .from('workflow_instances')
      .insert({
        workflow_id: input.workflow_id,
        workspace_id: workspaceId,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        status: 'in_progress',
        current_step: 1,
        total_steps: templateSteps.length,
      })
      .select(INSTANCE_COLUMNS)
      .single()

    if (error || !instance) throw new DatabaseError('Failed to start workflow', error)

    this.sendNotification(instance, { action: 'pending' }).catch((err) =>
      console.error('Notification failed:', err),
    )

    await this.invalidateInstanceCache(workspaceId)

    return this.mapInstance(instance)
  }

  /* ─── List pending approvals ─── */
  async listInstances(
    workspaceId: string,
    filters: InstanceFilters,
  ): Promise<{ data: WorkflowInstance[]; total: number }> {
    const cacheKey = this.getInstancesCacheKey(workspaceId, filters)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as { data: WorkflowInstance[]; total: number }

    let query = supabase
      .from('workflow_instances')
      .select(INSTANCE_MINIMAL, { count: 'estimated' })
      .eq('workspace_id', workspaceId)

    if (filters.entity_type) query = query.eq('entity_type', filters.entity_type)
    if (filters.entity_id) query = query.eq('entity_id', filters.entity_id)
    if (filters.status) query = query.eq('status', filters.status)

    const from = (filters.page - 1) * filters.limit
    const to = from + filters.limit - 1

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw new DatabaseError('Failed to list instances', error)

    const instances = (data || []).map((row) => this.mapInstance(row))

    // ✅ FIX (N+1): صفحه‌ی approvals برای هر کارت جداگانه
    // GET /workflows/instances/:id می‌زد — در لاگ پروداکشن ۱۰ کارت یعنی ۱۰
    // درخواست موازی که هرکدام ۸۰۰-۹۱۳ms طول می‌کشید (چون پشت یک CPU صف
    // می‌شدند). حالا اکشن‌های همه‌ی نمونه‌ها با **یک** کوئری گرفته و ضمیمه
    // می‌شوند تا کلاینت به آن درخواست‌ها نیازی نداشته باشد.
    const ids = instances.map((i) => i.id).filter(Boolean)
    const actionsByInstance = new Map<string, WorkflowActionRecord[]>()

    if (ids.length > 0) {
      const { data: actionRows } = await supabase
        .from('workflow_actions')
        .select(ACTION_MINIMAL)
        .in('instance_id', ids)
        .order('created_at', { ascending: false })

      for (const row of actionRows || []) {
        const action = this.mapAction(row)
        const list = actionsByInstance.get(action.instance_id) ?? []
        list.push(action)
        actionsByInstance.set(action.instance_id, list)
      }
    }

    const result = {
      data: instances.map((instance) => ({
        ...instance,
        actions: actionsByInstance.get(instance.id) ?? [],
      })),
      total: count || 0,
    }

    await memoryCache.set(cacheKey, result, 30)
    return result
  }

  /* ─── Get single instance with full history ─── */
  async getInstance(
    instanceId: string,
  ): Promise<{ instance: WorkflowInstance; actions: WorkflowActionRecord[] }> {
    const cacheKey = this.getInstanceCacheKey(instanceId)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as { instance: WorkflowInstance; actions: WorkflowActionRecord[] }

    const [instanceResult, actionsResult] = await Promise.all([
      supabase.from('workflow_instances').select(INSTANCE_COLUMNS).eq('id', instanceId).single(),
      supabase
        .from('workflow_actions')
        .select(ACTION_MINIMAL)
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: false }),
    ])

    if (instanceResult.error || !instanceResult.data) {
      throw new DatabaseError('Workflow instance not found', instanceResult.error)
    }

    const result = {
      instance: this.mapInstance(instanceResult.data),
      actions: (actionsResult.data || []).map((row) => this.mapAction(row)),
    }

    await memoryCache.set(cacheKey, result, 120)
    return result
  }

  /* ─── Approve or reject a step ─── */
  /**
   * Approve or reject the current step.
   *
   * Takes a `TenancyContext`, not a bare `userId` + `userRole`.
   *
   * TWO DEFECTS THAT CAME FROM THE OLD SIGNATURE
   *
   * 1. `userRole` arrived from `request.userRole`, which `auth.middleware.ts`
   *    populates ONLY when the caller belongs to exactly one workspace — with
   *    two or more it is the empty string, deliberately, because there is no
   *    single answer. So `canAct` below compared '' against the step's
   *    approver role, every approve and every reject was refused, and anyone
   *    working across two shops simply could not approve anything.
   *
   * 2. The instance was fetched by id with NO workspace filter, so an id from
   *    another business resolved and was acted on. `ctx.workspaceId` closes
   *    that, and it is the same boundary every other service uses.
   */
  async performAction(
    ctx: TenancyContext,
    input: CreateWorkflowActionInput,
  ): Promise<{ instance: WorkflowInstance; action: WorkflowActionRecord }> {
    const userId = ctx.userId
    const userRole = ctx.role

    const { data: instance, error: instanceError } = await supabase
      .from('workflow_instances')
      .select(INSTANCE_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', input.instance_id)
      .single()

    // Every check below is a client condition, not a database failure.
    // Throwing DatabaseError gave them all a 500, so pressing approve on a
    // stale row read as a server crash instead of "this no longer applies".
    if (instanceError || !instance) {
      throw new NotFoundError('Workflow instance')
    }

    if (instance.status !== 'in_progress') {
      throw new ConflictError('This workflow is no longer in progress')
    }

    const currentStepNumber = instance.current_step as number
    if (!currentStepNumber || currentStepNumber < 1) {
      throw new ConflictError('This workflow has no current step')
    }

    const workflowId = instance.workflow_id as string
    if (!workflowId) {
      throw new NotFoundError('Workflow definition')
    }

    const stepsCacheKey = this.getWorkflowStepsCacheKey(workflowId)
    let steps = (await memoryCache.get(stepsCacheKey)) as any[]

    if (!steps) {
      const { data: s, error } = await supabase
        .from('workflow_steps')
        .select(WORKFLOW_STEP_COLUMNS)
        .eq('workflow_id', workflowId)
        .order('step_order')

      if (error) throw new DatabaseError('Failed to fetch steps', error)
      steps = s || []
      await memoryCache.set(stepsCacheKey, steps, 300)
    }

    const currentStep = steps.find((s) => s.step_order === currentStepNumber)
    // Reached when the workflow definition was deleted while an instance still
    // referenced it — the case behind the reported 500s (the log shows
    // GET /workflows/:id returning 404 immediately before the failing action).
    if (!currentStep) {
      throw new NotFoundError('Workflow step')
    }

    // ✅ FIX: قبلاً هیچ‌جا چک نمی‌شد که userRole با approver_role همین
    // مرحله مطابقت دارد یا نه — یعنی هر کاربر authenticated (member،
    // viewer، ...) می‌توانست هر مرحله‌ی approval را تأیید/رد کند.
    // "owner"/"admin" (نقش‌های workspace) همیشه override دارند؛ در غیر
    // این صورت نقش کاربر باید دقیقاً همان approver_role مرحله باشد.
    // ⚠️ SECURITY — `userRole === 'admin'` used to be a third branch here.
    //
    // 'admin' is not a workspace role: the model is owner | manager | seller,
    // and a census of workspace_members found zero rows carrying it. The only
    // way to hold it was auth.middleware.ts's `membership?.role || 'admin'`,
    // which handed it to users with NO membership at all — so the branch was
    // unreachable for legitimate members and an approval bypass for strangers.
    // The default is gone; so is the branch that made it dangerous.
    //
    // Owner keeps its override because owner IS a real workspace role.
    let canAct = userRole === 'owner' || userRole === (currentStep.approver_role as string)

    // Capability #68: a step that waited past its workflow's policy gains a
    // second role allowed to act on it. Asked only when the actor's own role
    // does not match, so an approval by the step's own role costs no extra
    // read — and on a database without the escalation columns the answer is
    // simply «none».
    if (!canAct) {
      const escalatedRole = await escalationService.escalatedRoleFor(
        ctx.workspaceId,
        input.instance_id,
        currentStepNumber,
      )
      canAct = escalatedRole !== null && escalatedRole === userRole
    }

    if (!canAct) {
      throw new ForbiddenError(
        `Only a "${currentStep.approver_role}" (or the workspace owner) can act on this step`,
      )
    }

    const { data: action, error: actionError } = await supabase
      .from('workflow_actions')
      .insert({
        instance_id: input.instance_id,
        step_order: currentStepNumber,
        action: input.action,
        actor_user_id: userId,
        actor_role: userRole,
        comment: input.comment ?? null,
      })
      .select(ACTION_COLUMNS)
      .single()

    if (actionError || !action) {
      throw new DatabaseError('Failed to record action', actionError)
    }

    let newStatus: string
    let newStep: number
    let completedAt: string | null = null

    const isFinal = currentStep.is_final as boolean

    if (input.action === 'approved') {
      if (isFinal) {
        newStatus = 'approved'
        newStep = currentStepNumber
        completedAt = new Date().toISOString()
      } else {
        newStatus = 'in_progress'
        newStep = currentStepNumber + 1
      }
    } else if (input.action === 'rejected') {
      newStatus = 'rejected'
      newStep = currentStepNumber
      completedAt = new Date().toISOString()
    } else if (input.action === 'cancelled') {
      newStatus = 'cancelled'
      newStep = currentStepNumber
      completedAt = new Date().toISOString()
    } else {
      newStatus = 'in_progress'
      newStep = currentStepNumber
    }

    const { data: updated, error: updateError } = await supabase
      .from('workflow_instances')
      .update({
        status: newStatus,
        current_step: newStep,
        completed_at: completedAt,
      })
      .eq('id', input.instance_id)
      .select(INSTANCE_COLUMNS)
      .single()

    if (updateError || !updated) {
      throw new DatabaseError('Failed to update instance', updateError)
    }

    // ─── G6 — AN APPROVAL THAT APPROVES SOMETHING ────────────────────────────
    //
    // This used to end here: the instance moved to `approved` and nothing was
    // done to the document. Approval changed a status column, and the ledger
    // entry had already been booked at creation time anyway — so the whole
    // feature was decorative.
    //
    // Now creation HOLDS the financial effect (see approval-gate.domain.ts) and
    // this is where it is released.
    //
    // ⚠️ AWAITED, and its failure is reported to the caller rather than logged
    // and dropped. An instance marked `approved` whose document never posted is
    // the worst outcome available: it looks complete on every screen and the
    // money is not in the books. Better to fail the approve action so the
    // person can retry — the posting is idempotent per (sourceType, sourceId),
    // so a retry books nothing twice.
    if (newStatus === 'approved') {
      await this.postApprovedDocument(
        instance.workspace_id as string,
        action.actor_user_id as string,
        updated.entity_type as string,
        updated.entity_id as string,
      )
    }

    this.sendNotification(updated, action).catch((err) =>
      console.error('Notification failed:', err),
    )

    await this.invalidateInstanceCache(instance.workspace_id as string, input.instance_id)

    return {
      instance: this.mapInstance(updated),
      action: this.mapAction(action),
    }
  }

  /**
   * G6 — release the financial effect a document has been holding.
   *
   * ⚠️ IMPORTED LAZILY, on purpose.
   *
   * `InvoiceService` already imports `WorkflowService` at the top of its file.
   * Importing it back statically closes the cycle, and a circular import
   * between two service modules resolves to `undefined` at construction time
   * depending on which is loaded first — a crash that appears only in
   * production, only sometimes, and reads as "workflowService is not a
   * constructor".
   *
   * The dynamic import defers resolution to call time, by which point both
   * modules are fully evaluated.
   */
  private async postApprovedDocument(
    workspaceId: string,
    actorId: string,
    entityType: string,
    entityId: string,
  ): Promise<void> {
    // Only the document kinds that actually hold something. An approval on
    // anything else is a workflow with no financial effect to release, which is
    // fine — it is not an error.
    if (entityType !== 'invoice') return

    const { InvoiceService } = await import('./invoice.service')

    // The approver's own tenancy. `role` is not read by the posting path, but
    // the context shape requires it; `manager` is the least privilege that can
    // post, and anyone who reached a final approval step holds at least that.
    await new InvoiceService().postApprovedInvoice(
      { workspaceId, userId: actorId, role: 'manager' },
      entityId,
    )
  }

  /* ─── Notification Hook ─── */
  private async sendNotification(
    instance: Record<string, unknown>,
    action: Record<string, unknown>,
  ): Promise<void> {
    try {
      const actionType = (action.action as string) || 'pending'
      const workspaceId = instance.workspace_id as string
      const entityType = instance.entity_type as string
      const entityId = instance.entity_id as string
      const instanceId = instance.id as string
      const shortId = entityId?.substring(0, 8) || ''

      const config: Record<string, { title: string; type: 'info' | 'success' | 'warning' }> = {
        pending: { title: 'درخواست تأیید جدید', type: 'info' },
        approved: { title: 'درخواست تأیید شد', type: 'success' },
        rejected: { title: 'درخواست رد شد', type: 'warning' },
      }

      const cfg = config[actionType]
      if (!cfg) return

      let targetUserId = action.actor_user_id as string
      if (!targetUserId) {
        const { data: members } = await supabase
          .from('workspace_members')
          .select('user_id')
          .eq('workspace_id', workspaceId)
          .eq('role', 'owner')
          .limit(1)
        targetUserId = (members?.[0]?.user_id as string) || ''
      }

      if (!targetUserId) return

      await this.notificationService.create(workspaceId, {
        user_id: targetUserId,
        title: cfg.title,
        body: `${entityType} #${shortId} ${actionType === 'pending' ? 'نیاز به تأیید دارد' : actionType === 'approved' ? 'تأیید شد' : 'رد شد'}.`,
        type: cfg.type,
        action_url: `/${entityType}s/${entityId}`,
        entity_type: entityType,
        entity_id: entityId,
        metadata: { workflow_instance_id: instanceId },
      })
    } catch (err) {
      console.error('[Workflow] Notification failed:', err)
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
      entity_type: row.entity_type as Workflow['entity_type'],
      is_active: (row.is_active as boolean) ?? true,
      steps: [],
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      deleted_at: (row.deleted_at as string) ?? null,
    }
  }

  private mapInstance(row: Record<string, unknown>): WorkflowInstance {
    return {
      id: row.id as string,
      workflow_id: row.workflow_id as string,
      workspace_id: row.workspace_id as string,
      entity_type: row.entity_type as WorkflowInstance['entity_type'],
      entity_id: row.entity_id as string,
      status: row.status as WorkflowInstance['status'],
      current_step: row.current_step as number,
      total_steps: row.total_steps as number,
      started_at: row.started_at as string,
      completed_at: (row.completed_at as string) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    }
  }

  private mapAction(row: Record<string, unknown>): WorkflowActionRecord {
    return {
      id: row.id as string,
      instance_id: row.instance_id as string,
      action: row.action as WorkflowActionRecord['action'],
      step_order: row.step_order as number,
      actor_user_id: row.actor_user_id as string,
      actor_role: (row.actor_role as string) ?? null,
      comment: (row.comment as string) ?? undefined,
      created_at: row.created_at as string,
    }
  }
}

export default WorkflowService
