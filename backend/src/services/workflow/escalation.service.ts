// ============================================
// backend/src/services/workflow/escalation.service.ts
//
// Capability #68 — escalation of an approval nobody answered.
//
//   escalation.domain.ts   WHETHER a waiting step escalates, and to whom. Pure.
//   this file              reads the waiting documents, asks the domain, and
//                          records the answer.
//
// ⚠️ ESCALATION WIDENS AND TELLS. IT NEVER DECIDES. A step that has waited too
// long gains a second role allowed to act on it, and the people holding that
// role are notified. It is not approved, not rejected and not skipped — an
// approval that fires because nobody answered is a document moving money on the
// basis of a calendar.
//
// ⚠️ AND IT NEVER ESCALATES INTO AN EMPTY ROOM. When the policy's role holds
// nobody, nothing changes on the document; the fact is recorded once and the
// owner is told, so «stuck» is visible rather than logged as «moved».
//
// The policy is OFF until a person sets it (`escalate_after_hours` is NULL).
// ============================================

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { WorkspaceRole } from '../authorization/authorization.domain'
import { logBusinessEvent } from '../event-log.service'
import { NotificationService } from '../notification.service'
import type { TenancyContext } from '../tenancy.service'
import { decideEscalation, type EscalationPolicy } from './escalation.domain'

/** PostgREST/Postgres codes for «the escalation migration has not been run». */
const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])

export class EscalationNotConfiguredError extends BaseError {
  constructor() {
    super('ESCALATION_MIGRATION_PENDING', 503)
    this.name = 'EscalationNotConfiguredError'
  }
}

export interface EscalationPolicyView {
  /** null = escalation is off for this workflow. */
  afterHours: number | null
  toRole: 'manager' | 'owner' | null
  maxTimes: number
}

export interface EscalationRecord {
  id: string
  instanceId: string
  stepOrder: number
  fromRole: string
  toRole: string
  outcome: 'escalated' | 'no_one'
  hoursWaiting: number
  createdAt: string
}

interface WorkflowPolicyRow {
  id: string
  workspace_id: string
  name: string
  escalate_after_hours: number | string | null
  escalate_to_role: string | null
  escalate_max_times: number | null
}

interface WaitingInstanceRow {
  id: string
  workflow_id: string
  workspace_id: string
  entity_type: string
  entity_id: string
  current_step: number
  started_at: string
  updated_at: string
  escalated_role: string | null
  escalations: number | null
  escalated_step: number | null
}

const policyOf = (row: WorkflowPolicyRow): EscalationPolicy | null => {
  const afterHours = Number(row.escalate_after_hours)
  if (!row.escalate_to_role || !(afterHours > 0)) return null
  return {
    afterHours,
    toRole: row.escalate_to_role as WorkspaceRole,
    maxTimes: row.escalate_max_times ?? 1,
  }
}

export class EscalationService {
  private readonly notifications = new NotificationService()

  private failure(message: string, error: { code?: string }): BaseError {
    if (MISSING_SCHEMA.has(error.code ?? '')) return new EscalationNotConfiguredError()
    return new DatabaseError(message, error)
  }

  // ─── The policy of one workflow ──────────────────────────────

  async getPolicy(ctx: TenancyContext, workflowId: string): Promise<EscalationPolicyView> {
    const { data, error } = await supabase
      .from('workflows')
      .select('id, escalate_after_hours, escalate_to_role, escalate_max_times')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', workflowId)
      .maybeSingle()
    if (error) throw this.failure('Failed to read the escalation policy', error)
    if (!data) throw new NotFoundError('Workflow')

    return {
      afterHours: data.escalate_after_hours === null ? null : Number(data.escalate_after_hours),
      toRole: (data.escalate_to_role as EscalationPolicyView['toRole']) ?? null,
      maxTimes: (data.escalate_max_times as number | null) ?? 1,
    }
  }

  /** `afterHours: null` switches escalation off. */
  async setPolicy(
    ctx: TenancyContext,
    workflowId: string,
    input: { afterHours: number | null; toRole: 'manager' | 'owner' | null; maxTimes: number },
  ): Promise<EscalationPolicyView> {
    const off = input.afterHours === null
    // Both or neither: half a policy never escalates and looks as if it would.
    if (!off && !input.toRole) throw new ValidationError('ESCALATION_ROLE_REQUIRED')

    const { data, error } = await supabase
      .from('workflows')
      .update({
        escalate_after_hours: off ? null : input.afterHours,
        escalate_to_role: off ? null : input.toRole,
        escalate_max_times: input.maxTimes,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', workflowId)
      .select('id')
      .maybeSingle()
    if (error) throw this.failure('Failed to save the escalation policy', error)
    if (!data) throw new NotFoundError('Workflow')

    logBusinessEvent({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: 'workflow',
      entityId: workflowId,
      action: off ? 'escalation_disabled' : 'escalation_set',
      title: off ? 'ارجاع خودکار خاموش شد' : 'ارجاع خودکار تنظیم شد',
      metadata: { ...input },
      notify: false,
    }).catch((err) => console.error('[EscalationService] logBusinessEvent failed:', err))

    return this.getPolicy(ctx, workflowId)
  }

  async recent(ctx: TenancyContext, limit = 50): Promise<EscalationRecord[]> {
    const { data, error } = await supabase
      .from('workflow_escalations')
      .select('id, instance_id, step_order, from_role, to_role, outcome, hours_waiting, created_at')
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw this.failure('Failed to read escalations', error)

    return (data ?? []).map((row) => ({
      id: row.id as string,
      instanceId: row.instance_id as string,
      stepOrder: Number(row.step_order),
      fromRole: row.from_role as string,
      toRole: row.to_role as string,
      outcome: row.outcome as EscalationRecord['outcome'],
      hoursWaiting: Number(row.hours_waiting) || 0,
      createdAt: row.created_at as string,
    }))
  }

  /**
   * The role an escalation added to a document's CURRENT step, if any.
   *
   * Asked by the approval action only when the actor's own role does not match
   * the step — so approvals keep working unchanged on a database where the
   * migration has not run (the answer is then «none»).
   */
  async escalatedRoleFor(
    workspaceId: string,
    instanceId: string,
    currentStep: number,
  ): Promise<string | null> {
    const { data, error } = await supabase
      .from('workflow_instances')
      .select('escalated_role, escalated_step')
      .eq('workspace_id', workspaceId)
      .eq('id', instanceId)
      .maybeSingle()
    if (error) {
      if (MISSING_SCHEMA.has(error.code ?? '')) return null
      throw new DatabaseError('Failed to read the escalation state', error)
    }
    // An escalation belongs to the step it was made on; the next step starts clean.
    if (!data || Number(data.escalated_step) !== currentStep) return null
    return (data.escalated_role as string | null) ?? null
  }

  // ─── The hourly pass ─────────────────────────────────────────

  async runDue(now: Date = new Date()): Promise<{
    checked: number
    escalated: number
    noOne: number
  }> {
    const totals = { checked: 0, escalated: 0, noOne: 0 }

    const { data: workflows, error } = await supabase
      .from('workflows')
      .select('id, workspace_id, name, escalate_after_hours, escalate_to_role, escalate_max_times')
      .not('escalate_after_hours', 'is', null)
      .eq('is_active', true)
    if (error) {
      if (MISSING_SCHEMA.has(error.code ?? '')) return totals
      throw new DatabaseError('Failed to read escalation policies', error)
    }

    for (const workflow of (workflows ?? []) as unknown as WorkflowPolicyRow[]) {
      const policy = policyOf(workflow)
      if (!policy) continue
      try {
        await this.runWorkflow(workflow, policy, now, totals)
      } catch (err) {
        // One workflow failing never stops the others.
        console.error(`[escalation] ${workflow.workspace_id}/${workflow.id} failed:`, err)
      }
    }
    return totals
  }

  private async runWorkflow(
    workflow: WorkflowPolicyRow,
    policy: EscalationPolicy,
    now: Date,
    totals: { checked: number; escalated: number; noOne: number },
  ): Promise<void> {
    const { data: instances, error } = await supabase
      .from('workflow_instances')
      .select(
        'id, workflow_id, workspace_id, entity_type, entity_id, current_step, started_at, updated_at, escalated_role, escalations, escalated_step',
      )
      .eq('workspace_id', workflow.workspace_id)
      .eq('workflow_id', workflow.id)
      .eq('status', 'in_progress')
    if (error) throw new DatabaseError('Failed to read waiting documents', error)

    const waiting = (instances ?? []) as unknown as WaitingInstanceRow[]
    if (waiting.length === 0) return

    const { data: steps, error: stepError } = await supabase
      .from('workflow_steps')
      .select('step_order, approver_role')
      .eq('workflow_id', workflow.id)
    if (stepError) throw new DatabaseError('Failed to read workflow steps', stepError)
    const roleOfStep = new Map(
      (steps ?? []).map((step) => [Number(step.step_order), step.approver_role as string]),
    )

    const holders = await this.holders(workflow.workspace_id)

    for (const instance of waiting) {
      totals.checked += 1
      const stepRole = roleOfStep.get(instance.current_step)
      if (!stepRole) continue

      const onThisStep = instance.escalated_step === instance.current_step
      const currentRole = (
        onThisStep && instance.escalated_role ? instance.escalated_role : stepRole
      ) as WorkspaceRole

      const verdict = decideEscalation({
        currentRole,
        holdersOf: (role) => holders.get(role)?.length ?? 0,
        // The step has been waiting since the document last moved.
        waitingSince: instance.updated_at ?? instance.started_at,
        now,
        policy,
        escalationsSoFar: onThisStep ? (instance.escalations ?? 0) : 0,
      })

      if (verdict.escalate) {
        const done = await this.escalate(workflow, instance, currentRole, verdict, holders)
        if (done) totals.escalated += 1
      } else if (verdict.reason === 'NO_ONE_TO_ESCALATE_TO') {
        const reported = await this.reportNoOne(
          workflow,
          instance,
          currentRole,
          verdict.toRole,
          holders,
        )
        if (reported) totals.noOne += 1
      }
    }
  }

  /** Who holds each role in a workspace, among members who still have access. */
  private async holders(workspaceId: string): Promise<Map<string, string[]>> {
    const { data, error } = await supabase
      .from('workspace_members')
      .select('user_id, role')
      .eq('workspace_id', workspaceId)
      .eq('has_access', true)
      .is('suspended_at', null)
    if (error) throw new DatabaseError('Failed to read workspace members', error)

    const byRole = new Map<string, string[]>()
    for (const row of data ?? []) {
      const role = row.role as string
      byRole.set(role, [...(byRole.get(role) ?? []), row.user_id as string])
    }
    return byRole
  }

  private async escalate(
    workflow: WorkflowPolicyRow,
    instance: WaitingInstanceRow,
    fromRole: string,
    verdict: { toRole: WorkspaceRole; hoursWaiting: number },
    holders: Map<string, string[]>,
  ): Promise<boolean> {
    // The record first: its unique index is what makes a retried or concurrent
    // pass a no-op, so nobody is told twice.
    const { error: recordError } = await supabase.from('workflow_escalations').insert({
      workspace_id: instance.workspace_id,
      instance_id: instance.id,
      step_order: instance.current_step,
      from_role: fromRole,
      to_role: verdict.toRole,
      outcome: 'escalated',
      hours_waiting: Math.round(verdict.hoursWaiting * 100) / 100,
    })
    if (recordError) {
      if (recordError.code === '23505') return false
      throw new DatabaseError('Failed to record the escalation', recordError)
    }

    const onThisStep = instance.escalated_step === instance.current_step
    const { error: updateError } = await supabase
      .from('workflow_instances')
      // ⚠️ `updated_at` is deliberately NOT touched: it is the «waiting since»
      // of the step, and moving it would make the document look freshly
      // submitted.
      .update({
        escalated_role: verdict.toRole,
        escalated_step: instance.current_step,
        escalations: (onThisStep ? (instance.escalations ?? 0) : 0) + 1,
        escalated_at: new Date().toISOString(),
      })
      .eq('workspace_id', instance.workspace_id)
      .eq('id', instance.id)
      .eq('status', 'in_progress')
      .eq('current_step', instance.current_step)
    if (updateError) throw new DatabaseError('Failed to escalate the document', updateError)

    const hours = Math.floor(verdict.hoursWaiting)
    for (const userId of holders.get(verdict.toRole) ?? []) {
      // A notification that fails must not undo an escalation that happened.
      await this.notifications
        .create(instance.workspace_id, {
          user_id: userId,
          title: 'تأییدی که بی‌پاسخ مانده به شما ارجاع شد',
          body: `«${workflow.name}» بیش از ${hours} ساعت منتظر تأیید است. اکنون شما هم می‌توانید آن را تأیید یا رد کنید.`,
          type: 'warning',
          action_url: '/approvals',
          entity_type: instance.entity_type,
          entity_id: instance.entity_id,
          metadata: { workflow_instance_id: instance.id, escalated_from: fromRole },
        })
        .catch((err: unknown) => console.error('[escalation] notification failed:', err))
    }
    return true
  }

  private async reportNoOne(
    workflow: WorkflowPolicyRow,
    instance: WaitingInstanceRow,
    fromRole: string,
    toRole: string,
    holders: Map<string, string[]>,
  ): Promise<boolean> {
    const { error } = await supabase.from('workflow_escalations').insert({
      workspace_id: instance.workspace_id,
      instance_id: instance.id,
      step_order: instance.current_step,
      from_role: fromRole,
      to_role: toRole,
      outcome: 'no_one',
      hours_waiting: 0,
    })
    if (error) {
      // Already reported for this step: once is the point.
      if (error.code === '23505') return false
      throw new DatabaseError('Failed to record the escalation', error)
    }

    for (const userId of holders.get('owner') ?? []) {
      await this.notifications
        .create(instance.workspace_id, {
          user_id: userId,
          title: 'تأییدی منتظر مانده و کسی برای ارجاع نیست',
          body: `«${workflow.name}» منتظر تأیید است، ولی هیچ‌کس نقش ارجاع‌شونده را ندارد. نقش را به کسی بدهید یا خودتان تأیید کنید.`,
          type: 'warning',
          action_url: '/approvals',
          entity_type: instance.entity_type,
          entity_id: instance.entity_id,
          metadata: { workflow_instance_id: instance.id, missing_role: toRole },
        })
        .catch((err: unknown) => console.error('[escalation] notification failed:', err))
    }
    return true
  }
}

export const escalationService = new EscalationService()
