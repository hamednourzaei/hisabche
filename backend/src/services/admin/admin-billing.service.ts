// ============================================
// backend/src/services/admin/admin-billing.service.ts
//
// Admin Billing & Monetization Service:
// - Versioned plan pricing (IRR stored, Toman shown)
// - Platform billing ledger (immutable accounting entries)
// - Maker-Checker workflow (proposer != approver)
// - Subscription lifecycle transitions audit
// - Dunning and communications log
// ============================================

import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ForbiddenError } from '../../errors/auth.error'
import { AdminSecurityService } from './admin-security.service'

export interface PlanPriceItem {
  id: string
  plan: string
  amount_irr: number
  effective_from: string
  effective_until: string | null
  created_at: string
  created_by: string
}

export interface BillingLedgerItem {
  id: string
  workspace_id: string
  entry_type: 'CHARGE' | 'PAYMENT' | 'REFUND' | 'ADJUSTMENT' | 'CREDIT' | 'UPGRADE_CREDIT'
  amount_irr: number
  description: string
  actor_email: string
  idempotency_key: string | null
  created_at: string
}

export interface AdminActionRequestItem {
  id: string
  action_type: 'REFUND' | 'LEDGER_ADJUSTMENT' | 'PRICE_CHANGE' | 'DOWNGRADE' | 'LICENSE_TRANSFER'
  payload: Record<string, unknown>
  diff_preview: Record<string, unknown>
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  proposed_by: string
  approved_by: string | null
  rejection_reason: string | null
  created_at: string
  decided_at: string | null
}

export class AdminBillingService {
  /**
   * Lists versioned plan prices.
   */
  static async listPlanPrices(): Promise<PlanPriceItem[]> {
    const { data, error } = await supabase
      .from('plan_prices')
      .select('*')
      .order('effective_from', { ascending: false })

    if (error) throw new DatabaseError(error.message)
    return (data ?? []).map((p) => ({
      ...p,
      amount_irr: Number(p.amount_irr),
    }))
  }

  /**
   * Sets a versioned plan price.
   */
  static async setPlanPrice(params: {
    plan: string
    amountIrr: number
    effectiveFrom?: string | undefined
    effectiveUntil?: string | null | undefined
    createdBy: string
  }): Promise<PlanPriceItem> {
    const { data, error } = await supabase
      .from('plan_prices')
      .insert({
        plan: params.plan,
        amount_irr: params.amountIrr,
        effective_from: params.effectiveFrom ?? new Date().toISOString(),
        effective_until: params.effectiveUntil ?? null,
        created_by: params.createdBy,
      })
      .select()
      .single()

    if (error) throw new DatabaseError(error.message)

    await AdminSecurityService.logSecurityEvent({
      eventType: 'PLAN_PRICE_SET',
      adminEmail: params.createdBy,
      details: { plan: params.plan, amountIrr: params.amountIrr },
    })

    return {
      ...data,
      amount_irr: Number(data.amount_irr),
    }
  }

  /**
   * Lists platform billing ledger entries.
   */
  static async listLedger(
    params: {
      workspaceId?: string | undefined
      limit?: number | undefined
      offset?: number | undefined
    } = {},
  ): Promise<{ entries: BillingLedgerItem[]; total: number }> {
    let query = supabase
      .from('billing_ledger_entries')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (params.workspaceId) {
      query = query.eq('workspace_id', params.workspaceId)
    }

    const limit = Math.min(Math.max(params.limit ?? 50, 1), 100)
    const offset = Math.max(params.offset ?? 0, 0)
    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query
    if (error) throw new DatabaseError(error.message)

    return {
      entries: (data ?? []).map((e) => ({
        ...e,
        amount_irr: Number(e.amount_irr),
      })),
      total: count ?? data?.length ?? 0,
    }
  }

  /**
   * Records a billing ledger entry (with idempotency protection).
   */
  static async recordLedgerEntry(params: {
    workspaceId: string
    entryType: BillingLedgerItem['entry_type']
    amountIrr: number
    description: string
    actorEmail: string
    idempotencyKey?: string | undefined
  }): Promise<BillingLedgerItem> {
    const { data, error } = await supabase
      .from('billing_ledger_entries')
      .insert({
        workspace_id: params.workspaceId,
        entry_type: params.entryType,
        amount_irr: params.amountIrr,
        description: params.description,
        actor_email: params.actorEmail,
        idempotency_key: params.idempotencyKey ?? null,
      })
      .select()
      .single()

    if (error) throw new DatabaseError(error.message)
    return {
      ...data,
      amount_irr: Number(data.amount_irr),
    }
  }

  /**
   * Lists maker-checker action requests.
   */
  static async listActionRequests(status?: string | undefined): Promise<AdminActionRequestItem[]> {
    let query = supabase
      .from('admin_action_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) throw new DatabaseError(error.message)
    return data ?? []
  }

  /**
   * Proposes a maker-checker action request.
   */
  static async proposeActionRequest(params: {
    actionType: AdminActionRequestItem['action_type']
    payload: Record<string, unknown>
    diffPreview: Record<string, unknown>
    proposedBy: string
  }): Promise<AdminActionRequestItem> {
    const { data, error } = await supabase
      .from('admin_action_requests')
      .insert({
        action_type: params.actionType,
        payload: params.payload,
        diff_preview: params.diffPreview,
        proposed_by: params.proposedBy,
        status: 'PENDING',
      })
      .select()
      .single()

    if (error) throw new DatabaseError(error.message)

    await AdminSecurityService.logSecurityEvent({
      eventType: 'ACTION_REQUEST_PROPOSED',
      adminEmail: params.proposedBy,
      details: { id: data.id, actionType: params.actionType },
    })

    return data
  }

  /**
   * Decides a maker-checker action request (server enforces proposer != approver).
   */
  static async decideActionRequest(params: {
    requestId: string
    approved: boolean
    approverEmail: string
    rejectionReason?: string | undefined
  }): Promise<AdminActionRequestItem> {
    const { data: existing, error: getError } = await supabase
      .from('admin_action_requests')
      .select('*')
      .eq('id', params.requestId)
      .maybeSingle()

    if (getError) throw new DatabaseError(getError.message)
    if (!existing) throw new NotFoundError('Action request not found')

    if (existing.status !== 'PENDING') {
      throw new ForbiddenError('Action request has already been decided')
    }

    // Crucial Maker-Checker rule: Proposer CANNOT approve own request
    if (params.approved && existing.proposed_by === params.approverEmail) {
      throw new ForbiddenError(
        'Maker-Checker violation: Proposer cannot approve their own action request',
      )
    }

    const nextStatus = params.approved ? 'APPROVED' : 'REJECTED'
    const { data, error: updateError } = await supabase
      .from('admin_action_requests')
      .update({
        status: nextStatus,
        approved_by: params.approved ? params.approverEmail : null,
        rejection_reason: params.rejectionReason ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq('id', params.requestId)
      .select()
      .single()

    if (updateError) throw new DatabaseError(updateError.message)

    await AdminSecurityService.logSecurityEvent({
      eventType: `ACTION_REQUEST_${nextStatus}`,
      adminEmail: params.approverEmail,
      details: { id: params.requestId, actionType: existing.action_type },
    })

    return data
  }

  /**
   * Lists subscription history.
   */
  static async listSubscriptionHistory(workspaceId: string) {
    const { data, error } = await supabase
      .from('subscription_history')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) throw new DatabaseError(error.message)
    return data ?? []
  }

  /**
   * Lists dunning logs.
   */
  static async listDunningLogs(workspaceId?: string | undefined) {
    let query = supabase
      .from('dunning_logs')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(50)

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId)
    }

    const { data, error } = await query
    if (error) throw new DatabaseError(error.message)
    return data ?? []
  }
}
