// ============================================
// backend/src/services/mcp/mcp-request.service.ts
//
// The confirmation step of the MCP gateway: actions an AI assistant asked for
// that a PERSON must approve (docs/ai-action-requests-01-migration.sql).
//
// ⚠️ THIS IS A QUEUE, NOT A SECOND WAY TO DO THINGS. It stores what was asked
// (tool name and arguments) and who decided. Running an approved request is
// the gateway's job, and the gateway runs it through the Public API route — as
// the person who approved it.
//
// ⚠️ NO CREDENTIAL IS EVER STORED. The key that asked is recorded by id.
//
// ⚠️ A REQUEST IS CLAIMED WITH ONE CONDITIONAL UPDATE (`status = 'pending'`),
// so of two people approving at the same moment exactly one runs it. The
// database also refuses any backwards move.
// ============================================

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import type { ApiKeyPrincipal } from '../developer/developer.service'
import type { TenancyContext } from '../tenancy.service'

const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])
const COLUMNS =
  'id, key_id, requested_by, tool, risk, arguments, status, result_status, result, decided_by, decided_at, created_at'

/** A request nobody decided in this long can no longer be approved. */
export const AI_REQUEST_TTL_HOURS = 24

export class AiRequestsNotConfiguredError extends BaseError {
  constructor() {
    super('AI_REQUESTS_MIGRATION_PENDING', 503)
    this.name = 'AiRequestsNotConfiguredError'
  }
}

export type AiRequestStatus = 'pending' | 'approved' | 'executed' | 'failed' | 'rejected'

export interface AiActionRequest {
  id: string
  keyId: string
  requestedBy: string
  tool: string
  risk: 'financial' | 'destructive'
  arguments: Record<string, unknown>
  /** `expired` is derived: still pending after AI_REQUEST_TTL_HOURS. */
  status: AiRequestStatus | 'expired'
  resultStatus: number | null
  result: unknown
  decidedBy: string | null
  decidedAt: string | null
  createdAt: string
}

interface RequestRow {
  id: string
  key_id: string
  requested_by: string
  tool: string
  risk: 'financial' | 'destructive'
  arguments: Record<string, unknown>
  status: AiRequestStatus
  result_status: number | null
  result: unknown
  decided_by: string | null
  decided_at: string | null
  created_at: string
}

const isExpired = (row: RequestRow, now = Date.now()) =>
  row.status === 'pending' && now - Date.parse(row.created_at) > AI_REQUEST_TTL_HOURS * 3_600_000

const toRequest = (row: RequestRow): AiActionRequest => ({
  id: row.id,
  keyId: row.key_id,
  requestedBy: row.requested_by,
  tool: row.tool,
  risk: row.risk,
  arguments: row.arguments,
  status: isExpired(row) ? 'expired' : row.status,
  resultStatus: row.result_status,
  result: row.result,
  decidedBy: row.decided_by,
  decidedAt: row.decided_at,
  createdAt: row.created_at,
})

function fail(error: { code?: string; message: string }, what: string): never {
  if (MISSING_SCHEMA.has(error.code ?? '')) throw new AiRequestsNotConfiguredError()
  throw new DatabaseError(what, error)
}

export class McpRequestService {
  /** Store what an integration asked for. Runs nothing. */
  async create(
    key: ApiKeyPrincipal,
    input: { tool: string; risk: 'financial' | 'destructive'; arguments: Record<string, unknown> },
  ): Promise<AiActionRequest> {
    const { data, error } = await supabase
      .from('ai_action_requests')
      .insert({
        workspace_id: key.workspaceId,
        key_id: key.id,
        requested_by: key.createdBy,
        tool: input.tool,
        risk: input.risk,
        arguments: input.arguments,
      })
      .select(COLUMNS)
      .single()
    if (error) fail(error, 'Failed to store the request')
    return toRequest(data as RequestRow)
  }

  /** What an integration may read back: only a request made with ITS key. */
  async getForKey(key: ApiKeyPrincipal, id: string): Promise<AiActionRequest> {
    const { data, error } = await supabase
      .from('ai_action_requests')
      .select(COLUMNS)
      .eq('workspace_id', key.workspaceId)
      .eq('key_id', key.id)
      .eq('id', id)
      .maybeSingle()
    if (error) fail(error, 'Failed to read the request')
    if (!data) throw new NotFoundError('Request')
    return toRequest(data as RequestRow)
  }

  /** The queue a person sees: newest first. */
  async list(
    ctx: TenancyContext,
    options: { pendingOnly?: boolean } = {},
  ): Promise<AiActionRequest[]> {
    let query = supabase
      .from('ai_action_requests')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
    if (options.pendingOnly) query = query.eq('status', 'pending')
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(200)
    if (error) fail(error, 'Failed to read requests')
    return ((data ?? []) as RequestRow[]).map(toRequest)
  }

  /**
   * Take a pending request for execution. Exactly one caller gets it.
   *
   * `to` is `approved` (the caller will now run it) or `rejected`.
   */
  async decide(
    ctx: TenancyContext,
    id: string,
    to: 'approved' | 'rejected',
  ): Promise<AiActionRequest> {
    const { data: current, error: readError } = await supabase
      .from('ai_action_requests')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .maybeSingle()
    if (readError) fail(readError, 'Failed to read the request')
    if (!current) throw new NotFoundError('Request')
    if ((current as RequestRow).status !== 'pending')
      throw new ConflictError('AI_REQUEST_ALREADY_DECIDED')
    // An old request describes a situation that may no longer hold.
    if (to === 'approved' && isExpired(current as RequestRow))
      throw new ConflictError('AI_REQUEST_EXPIRED')

    const { data, error } = await supabase
      .from('ai_action_requests')
      .update({ status: to, decided_by: ctx.userId, decided_at: new Date().toISOString() })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      // The claim: only a request that is STILL pending is taken.
      .eq('status', 'pending')
      .select(COLUMNS)
      .maybeSingle()
    if (error) fail(error, 'Failed to decide the request')
    if (!data) throw new ConflictError('AI_REQUEST_ALREADY_DECIDED')
    return toRequest(data as RequestRow)
  }

  /** Record what the route answered. */
  async finish(
    ctx: TenancyContext,
    id: string,
    outcome: { ok: boolean; httpStatus: number; body: unknown },
  ): Promise<AiActionRequest> {
    const { data, error } = await supabase
      .from('ai_action_requests')
      .update({
        status: outcome.ok ? 'executed' : 'failed',
        result_status: outcome.httpStatus,
        result: outcome.body ?? null,
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .eq('status', 'approved')
      .select(COLUMNS)
      .maybeSingle()
    if (error) fail(error, 'Failed to record the result')
    if (!data) throw new ConflictError('AI_REQUEST_ALREADY_DECIDED')
    return toRequest(data as RequestRow)
  }
}

export const mcpRequestService = new McpRequestService()
