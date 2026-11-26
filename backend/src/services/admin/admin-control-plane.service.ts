// ============================================
// backend/src/services/admin/admin-control-plane.service.ts
//
// V100 Admin Control Plane Service:
// Cross-workspace operational visibility and atomic controls reusing single-core
// domain services & atomic Postgres RPCs (`transition_support_ticket`,
// `sweepSupportTicketSlas`, `reconcileWorkspaceCrossCore`, `decide_project_change_order_v2`).
// ============================================

import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { AdminSecurityService } from './admin-security.service'
import { reconcileWorkspaceCrossCore } from '../accounting/cross-core-reconcile'
import { sweepSupportTicketSlas } from '../workflow/support-sla.service'
import { baseCurrencyOf } from '../base-currency'
import { FRACTION_DIGITS, type KnownCurrency } from '@hisabche/formatting'
import {
  CAPABILITIES,
  ENGINES,
  industryKeysWithProfiles,
  type CapabilityStatus,
} from '@hisabche/validation'

export interface AdminSupportTicketItem {
  id: string
  workspace_id: string
  workspace_name: string | null
  ticket_code: string | null
  subject: string
  priority: string
  category: string
  status: string
  sla_hours: number | null
  response_due_at: string | null
  escalation_level: number
  assigned_to: string | null
  slaBreached: boolean
  created_at: string
  updated_at: string | null
}

export interface AdminGatewayEventItem {
  id: string
  workspace_id: string | null
  payment_id: string | null
  provider: string
  event_id: string | null
  event_type: string | null
  amount_minor: number | null
  currency: string | null
  signature_valid: boolean
  processing_status: string
  delivery_attempts: number
  last_error: string | null
  created_at: string
}

export interface AdminChangeOrderItem {
  id: string
  workspace_id: string
  workspace_name: string | null
  project_id: string
  project_name: string | null
  project_currency: string | null
  project_version: number
  title: string
  delta_budget: number
  status: 'pending_approval' | 'approved' | 'rejected'
  reason: string | null
  decided_at: string | null
  created_at: string
}

async function workspaceNameMap(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return new Map()
  const { data } = await supabase.from('workspaces').select('id, name').in('id', unique)
  const map = new Map<string, string>()
  for (const row of (data ?? []) as Array<{ id: string; name?: string | null }>) {
    if (row.name) map.set(row.id, row.name)
  }
  return map
}

export class AdminControlPlaneService {
  static async listSupportTickets(filters: {
    workspaceId?: string | undefined
    status?: string | undefined
    priority?: string | undefined
    limit?: number | undefined
  }): Promise<AdminSupportTicketItem[]> {
    let query = supabase
      .from('support_tickets')
      .select(
        'id, workspace_id, ticket_code, subject, priority, category, status, sla_hours, response_due_at, escalation_level, assigned_to, created_at, updated_at',
      )
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(filters.limit ?? 50, 1), 100))

    if (filters.workspaceId) query = query.eq('workspace_id', filters.workspaceId)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.priority) query = query.eq('priority', filters.priority)

    const { data, error } = await query
    if (error) throw new DatabaseError(error.message)

    const rows = (data ?? []) as Array<Record<string, unknown>>
    const names = await workspaceNameMap(rows.map((r) => String(r.workspace_id ?? '')))
    const nowMs = Date.now()

    return rows.map((r) => {
      const status = String(r.status ?? 'open')
      const dueRaw = r.response_due_at ? String(r.response_due_at) : null
      const dueMs = dueRaw ? new Date(dueRaw).getTime() : NaN
      const slaBreached =
        status !== 'resolved' && status !== 'closed' && Number.isFinite(dueMs) && nowMs > dueMs
      const wsId = String(r.workspace_id ?? '')
      return {
        id: String(r.id),
        workspace_id: wsId,
        workspace_name: names.get(wsId) ?? null,
        ticket_code: r.ticket_code ? String(r.ticket_code) : null,
        subject: String(r.subject ?? ''),
        priority: String(r.priority ?? 'normal'),
        category: String(r.category ?? 'other'),
        status,
        sla_hours: typeof r.sla_hours === 'number' ? r.sla_hours : null,
        response_due_at: dueRaw,
        escalation_level: Number(r.escalation_level ?? 0),
        assigned_to: r.assigned_to ? String(r.assigned_to) : null,
        slaBreached,
        created_at: String(r.created_at),
        updated_at: r.updated_at ? String(r.updated_at) : null,
      }
    })
  }

  static async transitionSupportTicket(params: {
    ticketId: string
    status: 'acknowledged' | 'escalated' | 'resolved' | 'closed'
    note?: string | undefined
    actorId: string
    actorEmail: string
  }): Promise<Record<string, unknown>> {
    const { data: existing, error: readErr } = await supabase
      .from('support_tickets')
      .select('id, workspace_id, status')
      .eq('id', params.ticketId)
      .maybeSingle()
    if (readErr) throw new DatabaseError(readErr.message)
    if (!existing) throw new NotFoundError('Support ticket not found')

    const wsId = String((existing as { workspace_id: string }).workspace_id)
    const { data, error } = await supabase.rpc('transition_support_ticket', {
      p_workspace_id: wsId,
      p_ticket_id: params.ticketId,
      p_actor_id: params.actorId,
      p_next_status: params.status,
      p_rca_summary: null,
      p_reason: params.note ?? null,
      p_correlation_id: null,
    })
    if (error || !data) {
      throw new DatabaseError(error?.message ?? 'Failed to transition support ticket')
    }

    await AdminSecurityService.logSecurityEvent({
      eventType: 'ADMIN_SUPPORT_TICKET_STATUS_UPDATED',
      adminEmail: params.actorEmail,
      details: { ticketId: params.ticketId, workspaceId: wsId, status: params.status },
    })

    return data as Record<string, unknown>
  }

  static async runSupportSlaSweep(params: {
    workspaceId?: string | undefined
    actorId: string
    actorEmail: string
  }) {
    const result = await sweepSupportTicketSlas({
      workspaceId: params.workspaceId ?? null,
      actorId: params.actorId,
    })
    await AdminSecurityService.logSecurityEvent({
      eventType: 'ADMIN_SUPPORT_SLA_SWEEP_RUN',
      adminEmail: params.actorEmail,
      details: {
        workspaceId: params.workspaceId ?? null,
        evaluatedCount: result.evaluatedCount,
        escalatedCount: result.escalatedTicketIds.length,
      },
    })
    return result
  }

  static async listGatewayEvents(filters: {
    workspaceId?: string | undefined
    provider?: string | undefined
    status?: string | undefined
    limit?: number | undefined
  }): Promise<AdminGatewayEventItem[]> {
    // Explicit column allow-list: NEVER return raw webhook payload/signatures/secrets.
    let query = supabase
      .from('payment_gateway_events')
      .select(
        'id, workspace_id, payment_id, gateway_name, event_id, event_type, amount_minor, currency, signature_verified, processing_status, delivery_attempts, last_error, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(filters.limit ?? 50, 1), 100))

    if (filters.workspaceId) query = query.eq('workspace_id', filters.workspaceId)
    if (filters.provider) query = query.eq('gateway_name', filters.provider)
    if (filters.status) query = query.eq('processing_status', filters.status)

    const { data, error } = await query
    if (error) throw new DatabaseError(error.message)

    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      workspace_id: r.workspace_id ? String(r.workspace_id) : null,
      payment_id: r.payment_id ? String(r.payment_id) : null,
      provider: String(r.gateway_name ?? ''),
      event_id: r.event_id ? String(r.event_id) : null,
      event_type: r.event_type ? String(r.event_type) : null,
      amount_minor: typeof r.amount_minor === 'number' ? r.amount_minor : null,
      currency: r.currency ? String(r.currency) : null,
      signature_valid: Boolean(r.signature_verified),
      processing_status: String(r.processing_status ?? 'recorded'),
      delivery_attempts: Number(r.delivery_attempts ?? 1),
      last_error: r.last_error ? String(r.last_error) : null,
      created_at: String(r.created_at),
    }))
  }

  static async reconcileWorkspace(params: { workspaceId: string; actorEmail: string }) {
    const { data: ws, error } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('id', params.workspaceId)
      .maybeSingle()
    if (error) throw new DatabaseError(error.message)
    if (!ws) throw new NotFoundError('Workspace not found')

    const report = await reconcileWorkspaceCrossCore(params.workspaceId)
    await AdminSecurityService.logSecurityEvent({
      eventType: 'ADMIN_WORKSPACE_RECONCILE_RUN',
      adminEmail: params.actorEmail,
      details: {
        workspaceId: params.workspaceId,
        status: report.status,
        exceptionCount: report.exceptions.length,
      },
    })
    return report
  }

  static async listChangeOrders(filters: {
    workspaceId?: string | undefined
    status?: string | undefined
    limit?: number | undefined
  }): Promise<AdminChangeOrderItem[]> {
    let query = supabase
      .from('project_change_orders')
      .select(
        'id, workspace_id, project_id, title, delta_minor, status, decision_reason, decided_at, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(filters.limit ?? 50, 1), 100))

    if (filters.workspaceId) query = query.eq('workspace_id', filters.workspaceId)
    if (filters.status) query = query.eq('status', filters.status)

    const { data, error } = await query
    if (error) throw new DatabaseError(error.message)

    const rows = (data ?? []) as Array<Record<string, unknown>>
    const projectIds = [...new Set(rows.map((r) => String(r.project_id ?? '')).filter(Boolean))]
    const names = await workspaceNameMap(rows.map((r) => String(r.workspace_id ?? '')))

    const projectMap = new Map<
      string,
      { name: string | null; currency: string | null; version: number }
    >()
    if (projectIds.length > 0) {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name, currency, budget_version')
        .in('id', projectIds)
      for (const p of (projects ?? []) as Array<Record<string, unknown>>) {
        projectMap.set(String(p.id), {
          name: p.name ? String(p.name) : null,
          currency: p.currency ? String(p.currency) : null,
          version: Number(p.budget_version ?? 1),
        })
      }
    }

    return rows.map((r) => {
      const wsId = String(r.workspace_id ?? '')
      const projId = String(r.project_id ?? '')
      const proj = projectMap.get(projId)
      const projCurrency = proj?.currency ?? null
      const scale = projCurrency ? 10 ** (FRACTION_DIGITS[projCurrency as KnownCurrency] ?? 2) : 100
      return {
        id: String(r.id),
        workspace_id: wsId,
        workspace_name: names.get(wsId) ?? null,
        project_id: projId,
        project_name: proj?.name ?? null,
        project_currency: projCurrency,
        project_version: proj?.version ?? 1,
        title: String(r.title ?? ''),
        delta_budget: Number(r.delta_minor ?? 0) / scale,
        status: String(r.status ?? 'pending_approval') as AdminChangeOrderItem['status'],
        reason: r.decision_reason ? String(r.decision_reason) : null,
        decided_at: r.decided_at ? String(r.decided_at) : null,
        created_at: String(r.created_at),
      }
    })
  }

  static async decideChangeOrder(params: {
    orderId: string
    decision: 'approved' | 'rejected'
    reason?: string | undefined
    expectedVersion?: number | undefined
    actorId: string
    actorEmail: string
  }) {
    const { data: order, error: readErr } = await supabase
      .from('project_change_orders')
      .select('id, workspace_id, project_id, status')
      .eq('id', params.orderId)
      .maybeSingle()
    if (readErr) throw new DatabaseError(readErr.message)
    if (!order) throw new NotFoundError('Change order not found')

    const wsId = String((order as { workspace_id: string }).workspace_id)
    const projectId = String((order as { project_id: string }).project_id)

    const { data: proj, error: projErr } = await supabase
      .from('projects')
      .select('id, currency')
      .eq('id', projectId)
      .eq('workspace_id', wsId)
      .maybeSingle()
    if (projErr) throw new DatabaseError(projErr.message)
    if (!proj) throw new NotFoundError('Project not found')

    const projCurrency =
      (proj as { currency?: string | null }).currency || (await baseCurrencyOf(wsId))
    const scale = 10 ** (FRACTION_DIGITS[projCurrency as KnownCurrency] ?? 2)

    const rpcRes = await supabase.rpc('decide_project_change_order_v2', {
      p_workspace_id: wsId,
      p_project_id: projectId,
      p_order_id: params.orderId,
      p_decision: params.decision,
      p_actor_id: params.actorId,
      p_scale: scale,
      p_expected_original_budget_minor: null,
      p_expected_version: params.expectedVersion ?? null,
      p_reason: params.reason ?? null,
    })

    if (rpcRes.error || !rpcRes.data) {
      const msg = String(rpcRes.error?.message ?? '')
      if (msg.includes('CHANGE_ORDER_NOT_PENDING') || msg.includes('STALE_PROJECT')) {
        throw new ConflictError(msg)
      }
      throw new DatabaseError(msg || 'Failed to decide change order')
    }

    await AdminSecurityService.logSecurityEvent({
      eventType: 'ADMIN_CHANGE_ORDER_DECIDED',
      adminEmail: params.actorEmail,
      details: {
        orderId: params.orderId,
        projectId,
        workspaceId: wsId,
        decision: params.decision,
      },
    })

    return rpcRes.data
  }

  static getCapabilitiesSnapshot() {
    const engines = Object.values(ENGINES).map((e) => ({
      key: e.key,
      pack: e.pack,
      offlineStatus: e.offlineStatus,
      offline: e.offline,
      structure: e.structure,
      hasLocalEngine: Boolean(e.localEngine),
      hasClientHook: Boolean(e.clientHook),
      hasUiHost: Boolean(e.uiHost),
    }))

    const capabilities = Object.entries(CAPABILITIES).map(([key, c]) => ({
      key,
      status: c.status as CapabilityStatus,
      limitations: [...c.limitations],
      requires: Object.keys(c.requires ?? {}),
    }))

    const statusCounts = {
      available: capabilities.filter((c) => c.status === 'available').length,
      partial: capabilities.filter((c) => c.status === 'partial').length,
      planned: capabilities.filter((c) => c.status === 'planned').length,
    }

    return {
      industryCount: industryKeysWithProfiles().length,
      engineCount: engines.length,
      statusCounts,
      engines,
      capabilities,
    }
  }
}
