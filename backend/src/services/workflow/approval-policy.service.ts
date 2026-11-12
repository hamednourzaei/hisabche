import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'
import {
  matchApprovalPolicy,
  validateApprovalDecision,
  type ApprovalEvaluationContext,
  type ApprovalPolicyRule,
  type ApprovalPolicyStep,
} from '@hisabche/validation'
import { decideApproval, type ApprovalOutcome } from './approval-gate.domain'

export class ApprovalPolicyService {
  async listPolicies(tenancy: TenancyContext) {
    const { data, error } = await supabase
      .from('approval_policies')
      .select('*')
      .eq('workspace_id', tenancy.workspaceId)
      .order('created_at', { ascending: false })

    if (error) throw new DatabaseError('Failed to list approval policies', error)
    return data ?? []
  }

  async upsertPolicy(
    tenancy: TenancyContext,
    input: {
      id?: string | undefined
      document_type: string
      name: string
      min_amount_minor?: number | null | undefined
      reasons?: string[] | null | undefined
      warehouse_ids?: string[] | null | undefined
      steps: ApprovalPolicyStep[]
      is_active?: boolean | undefined
    },
  ) {
    const payload = {
      workspace_id: tenancy.workspaceId,
      document_type: input.document_type,
      name: input.name,
      min_amount_minor: input.min_amount_minor ?? null,
      reasons: input.reasons ?? null,
      warehouse_ids: input.warehouse_ids ?? null,
      steps: input.steps,
      is_active: input.is_active ?? true,
      updated_at: new Date().toISOString(),
    }

    if (input.id) {
      const { data, error } = await supabase
        .from('approval_policies')
        .update(payload)
        .eq('id', input.id)
        .eq('workspace_id', tenancy.workspaceId)
        .select('*')
        .single()
      if (error || !data) throw new DatabaseError('Failed to update approval policy', error)
      return data
    }

    const { data, error } = await supabase
      .from('approval_policies')
      .insert(payload)
      .select('*')
      .single()
    if (error || !data) throw new DatabaseError('Failed to create approval policy', error)
    return data
  }

  async evaluateDocument(
    tenancy: TenancyContext,
    ctx: ApprovalEvaluationContext,
  ): Promise<{ outcome: ApprovalOutcome; policy: ApprovalPolicyRule | null }> {
    const { data, error } = await supabase
      .from('approval_policies')
      .select('*')
      .eq('workspace_id', tenancy.workspaceId)
      .eq('document_type', ctx.documentType)
      .eq('is_active', true)

    if (error) throw new DatabaseError('Failed to load approval policies', error)
    const policy = matchApprovalPolicy((data ?? []) as ApprovalPolicyRule[], ctx)
    const outcome = decideApproval({
      requiresApproval: policy !== null,
      workflowIds: policy ? [policy.id] : [],
    })
    return { outcome, policy }
  }

  async createRequestIfRequired(
    tenancy: TenancyContext,
    ctx: ApprovalEvaluationContext & { documentId: string },
  ) {
    const { outcome, policy } = await this.evaluateDocument(tenancy, ctx)
    if (outcome.kind === 'post_now' || !policy) {
      return { outcome, request: null }
    }

    const { data, error } = await supabase
      .from('approval_policy_requests')
      .upsert(
        {
          workspace_id: tenancy.workspaceId,
          policy_id: policy.id,
          document_type: ctx.documentType,
          document_id: ctx.documentId,
          requester_id: tenancy.userId,
          current_step: 1,
          total_steps: policy.steps.length,
          status: 'pending',
          amount_minor: ctx.amountMinor ?? null,
          reason: ctx.reason ?? null,
          warehouse_id: ctx.warehouseId ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,document_type,document_id' },
      )
      .select('*')
      .single()

    if (error || !data) throw new DatabaseError('Failed to create approval request', error)
    return { outcome, request: data }
  }

  async listRequests(tenancy: TenancyContext, status?: string) {
    let q = supabase
      .from('approval_policy_requests')
      .select('*')
      .eq('workspace_id', tenancy.workspaceId)
      .order('created_at', { ascending: false })
    if (status) q = q.eq('status', status)
    const { data, error } = await q
    if (error) throw new DatabaseError('Failed to list approval requests', error)
    return data ?? []
  }

  async actOnRequest(
    tenancy: TenancyContext,
    requestId: string,
    input: { decision: 'approved' | 'rejected'; note?: string | undefined },
  ) {
    const { data: reqRow, error: reqErr } = await supabase
      .from('approval_policy_requests')
      .select('*')
      .eq('id', requestId)
      .eq('workspace_id', tenancy.workspaceId)
      .single()

    if (reqErr || !reqRow) throw new NotFoundError('Approval request not found')

    const { data: policyRow, error: polErr } = await supabase
      .from('approval_policies')
      .select('*')
      .eq('id', reqRow.policy_id)
      .eq('workspace_id', tenancy.workspaceId)
      .single()

    if (polErr || !policyRow) throw new NotFoundError('Approval policy not found')

    const steps = (policyRow.steps ?? []) as ApprovalPolicyStep[]
    const check = validateApprovalDecision({
      requesterId: reqRow.requester_id,
      actorId: tenancy.userId,
      actorRole: tenancy.role,
      requestStatus: reqRow.status,
      currentStep: reqRow.current_step,
      steps,
    })

    if (!check.ok) {
      throw new ValidationError(check.code)
    }

    const { error: eventErr } = await supabase.from('approval_policy_events').insert({
      workspace_id: tenancy.workspaceId,
      request_id: reqRow.id,
      step_number: reqRow.current_step,
      actor_id: tenancy.userId,
      actor_role: tenancy.role,
      decision: input.decision,
      note: input.note ?? null,
    })
    if (eventErr) throw new DatabaseError('Failed to append approval event', eventErr)

    const nextStatus = input.decision === 'rejected' ? 'rejected' : check.nextStatus
    const nextStep = input.decision === 'rejected' ? reqRow.current_step : check.nextStep

    const { data: updated, error: updErr } = await supabase
      .from('approval_policy_requests')
      .update({
        status: nextStatus,
        current_step: nextStep,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reqRow.id)
      .eq('workspace_id', tenancy.workspaceId)
      .select('*')
      .single()

    if (updErr || !updated) throw new DatabaseError('Failed to update approval request', updErr)
    return updated
  }
}
