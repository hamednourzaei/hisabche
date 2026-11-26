// ============================================
// backend/src/services/workflow/support-sla.service.ts
//
// V100 P0 (4.4) — Single shared automated SLA evaluation service used by both
// the HTTP route (`POST /api/v1/support-tickets/evaluate-sla`) and the
// Fastify background job scheduler (`jobSchedulerPlugin`).
// ============================================

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'

export interface SupportSlaSweepResult {
  evaluatedCount: number
  escalatedTicketIds: string[]
  notificationFailures: number
  checkedAt: string
}

export async function sweepSupportTicketSlas(params: {
  workspaceId?: string | null
  actorId?: string | null
  correlationId?: string | null
}): Promise<SupportSlaSweepResult> {
  const { data, error } = await supabase.rpc('sweep_support_ticket_slas', {
    p_workspace_id: params.workspaceId ?? null,
    p_actor_id: params.actorId ?? null,
    p_correlation_id: params.correlationId ?? null,
  })

  if (error || !data) {
    throw new DatabaseError(
      'Failed to execute atomic SLA sweep',
      error ?? new Error('EMPTY_RPC_RESULT'),
    )
  }

  const res = data as {
    evaluatedCount?: unknown
    escalatedTicketIds?: unknown
    notificationFailures?: unknown
    checkedAt?: unknown
  }

  return {
    evaluatedCount: Number(res.evaluatedCount ?? 0),
    escalatedTicketIds: Array.isArray(res.escalatedTicketIds)
      ? res.escalatedTicketIds.map(String)
      : [],
    notificationFailures: Number(res.notificationFailures ?? 0),
    checkedAt: String(res.checkedAt ?? new Date().toISOString()),
  }
}
