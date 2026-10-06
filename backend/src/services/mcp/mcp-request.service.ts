// ============================================
// backend/src/services/mcp/mcp-request.service.ts
//
// THE approval queue: every action an AI assistant asked for that a PERSON
// must approve — whether it came from an outside assistant with an API key
// (the MCP gateway) or from the in-app assistant (a pipeline run).
// docs/ai-action-requests-01-migration.sql,
// docs/ai-pipeline-02-one-approval-queue-migration.sql
//
// ⚠️ THERE IS ONE QUEUE. The in-app pipeline once had its own claim and its own
// approve route; two queues meant two rules for «who may approve». Both origins
// are rows of this table, claimed by `decide`, judged by `mayDecideRequest`.
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
import { holds, roleAtLeast, type Capability } from '../authorization'
import type { ApiKeyPrincipal } from '../developer/developer.service'
import type { TenancyContext } from '../tenancy.service'

const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])
const COLUMNS =
  'id, key_id, run_id, requested_by, tool, risk, arguments, status, result_status, result, decided_by, decided_at, created_at'
/** Before migration 02: the same row without its origin column. */
const COLUMNS_BEFORE_RUNS = COLUMNS.replace(' run_id,', '')
/** NOT NULL on `key_id`, or the old risk check: migration 02 has not run. */
const QUEUE_NOT_READY_FOR_RUNS = new Set(['23502', '23514', ...MISSING_SCHEMA])

/** A request nobody decided in this long can no longer be approved. */
export const AI_REQUEST_TTL_HOURS = 24

export class AiRequestsNotConfiguredError extends BaseError {
  constructor() {
    super('AI_REQUESTS_MIGRATION_PENDING', 503)
    this.name = 'AiRequestsNotConfiguredError'
  }
}

export type AiRequestStatus = 'pending' | 'approved' | 'executed' | 'failed' | 'rejected'
/** `write` is queued only for the in-app assistant; through MCP it runs at once. */
export type AiRequestRisk = 'write' | 'financial' | 'destructive'

export interface AiActionRequest {
  id: string
  /** The API key that asked — null for the in-app assistant. */
  keyId: string | null
  /** The in-app pipeline run it belongs to — null for an API key. */
  runId: string | null
  requestedBy: string
  tool: string
  risk: AiRequestRisk
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
  key_id: string | null
  run_id?: string | null
  requested_by: string
  tool: string
  risk: AiRequestRisk
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
  keyId: row.key_id ?? null,
  runId: row.run_id ?? null,
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

/**
 * Run a statement that returns request rows, with or without `run_id`.
 *
 * ⚠️ `run_id` arrives with migration 02. The MCP queue predates it and must
 * not go dark on a database where only the first migration has run — so a
 * statement refused for that one missing column is sent again without it.
 * (PostgREST refuses the whole statement, so nothing was written the first
 * time.) Only the two methods that NEED the column do not go through this.
 */
/** Rows are untyped until `toRequest` maps them: the column list is a runtime string. */
interface Answer {
  data: unknown
  error: { code?: string; message: string } | null
}

async function tolerant(statement: (columns: string) => PromiseLike<Answer>): Promise<Answer> {
  const first = await statement(COLUMNS)
  const missingColumn = first.error?.code === '42703' || first.error?.code === 'PGRST204'
  return missingColumn ? statement(COLUMNS_BEFORE_RUNS) : first
}

function fail(error: { code?: string; message: string }, what: string): never {
  if (MISSING_SCHEMA.has(error.code ?? '')) throw new AiRequestsNotConfiguredError()
  throw new DatabaseError(what, error)
}

/**
 * May this person approve or reject this request? THE rule, for both origins.
 *
 *   a manager or owner  any request of the business — provided their own
 *                       role holds the capability the action needs;
 *   anybody else        only their OWN in-app request, and only when they
 *                       could have done the same thing by hand.
 *
 * A request made with an API key is never self-approved: the key acts for a
 * person, and «the assistant asked, the assistant's owner said yes» with no
 * second look is what the queue exists to prevent.
 *
 * `capability` is what the action itself needs (known for an in-app
 * operation; null for an MCP tool, whose route checks its own). The existing
 * permission model decides — role, the business's overrides, a custom role,
 * personal blocks — through `holds`.
 */
export function mayDecideRequest(
  ctx: Pick<TenancyContext, 'userId' | 'role' | 'capabilities'>,
  request: Pick<AiActionRequest, 'keyId' | 'requestedBy'>,
  capability: Capability | null,
): boolean {
  if (capability && !holds(ctx, capability)) return false
  if (roleAtLeast(ctx.role, 'manager')) return true
  return request.keyId === null && capability !== null && request.requestedBy === ctx.userId
}

export class McpRequestService {
  /**
   * Queue what the in-app assistant proposed. Runs nothing.
   *
   * `arguments` is the pipeline's frozen command; `tool` is its operation.
   */
  async createForRun(
    ctx: TenancyContext,
    input: { runId: string; tool: string; risk: AiRequestRisk; arguments: Record<string, unknown> },
  ): Promise<AiActionRequest> {
    const { data, error } = await supabase
      .from('ai_action_requests')
      .insert({
        workspace_id: ctx.workspaceId,
        run_id: input.runId,
        requested_by: ctx.userId,
        tool: input.tool,
        risk: input.risk,
        arguments: input.arguments,
      })
      .select(COLUMNS)
      .single()
    if (error) {
      if (QUEUE_NOT_READY_FOR_RUNS.has(error.code ?? '')) throw new AiRequestsNotConfiguredError()
      throw new DatabaseError('Failed to store the request', error)
    }
    return toRequest(data as RequestRow)
  }

  /** One request of this business, whoever asked. */
  async get(ctx: TenancyContext, id: string): Promise<AiActionRequest> {
    const { data, error } = await supabase
      .from('ai_action_requests')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .maybeSingle()
    if (error) fail(error, 'Failed to read the request')
    if (!data) throw new NotFoundError('Request')
    return toRequest(data as RequestRow)
  }

  /** The request of each of these runs (a run has at most one). */
  async byRuns(
    ctx: TenancyContext,
    runIds: readonly string[],
  ): Promise<Map<string, AiActionRequest>> {
    const found = new Map<string, AiActionRequest>()
    if (runIds.length === 0) return found
    const { data, error } = await supabase
      .from('ai_action_requests')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .in('run_id', [...runIds])
    if (error) {
      // Before migration 02 no run has a request — which is a fact, not a fault.
      if (MISSING_SCHEMA.has(error.code ?? '')) return found
      throw new DatabaseError('Failed to read requests', error)
    }
    for (const row of (data ?? []) as RequestRow[]) {
      if (row.run_id) found.set(row.run_id, toRequest(row))
    }
    return found
  }

  /** Store what an integration asked for. Runs nothing. */
  async create(
    key: ApiKeyPrincipal,
    input: { tool: string; risk: 'financial' | 'destructive'; arguments: Record<string, unknown> },
  ): Promise<AiActionRequest> {
    const { data, error } = await tolerant((columns) =>
      supabase
        .from('ai_action_requests')
        .insert({
          workspace_id: key.workspaceId,
          key_id: key.id,
          requested_by: key.createdBy,
          tool: input.tool,
          risk: input.risk,
          arguments: input.arguments,
        })
        .select(columns)
        .single(),
    )
    if (error) fail(error, 'Failed to store the request')
    return toRequest(data as RequestRow)
  }

  /** What an integration may read back: only a request made with ITS key. */
  async getForKey(key: ApiKeyPrincipal, id: string): Promise<AiActionRequest> {
    const { data, error } = await tolerant((columns) =>
      supabase
        .from('ai_action_requests')
        .select(columns)
        .eq('workspace_id', key.workspaceId)
        .eq('key_id', key.id)
        .eq('id', id)
        .maybeSingle(),
    )
    if (error) fail(error, 'Failed to read the request')
    if (!data) throw new NotFoundError('Request')
    return toRequest(data as RequestRow)
  }

  /** The queue a person sees: newest first. */
  async list(
    ctx: TenancyContext,
    options: { pendingOnly?: boolean } = {},
  ): Promise<AiActionRequest[]> {
    const { data, error } = await tolerant((columns) => {
      let query = supabase
        .from('ai_action_requests')
        .select(columns)
        .eq('workspace_id', ctx.workspaceId)
      if (options.pendingOnly) query = query.eq('status', 'pending')
      return query
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .limit(200)
    })
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
    const { data: current, error: readError } = await tolerant((columns) =>
      supabase
        .from('ai_action_requests')
        .select(columns)
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', id)
        .maybeSingle(),
    )
    if (readError) fail(readError, 'Failed to read the request')
    if (!current) throw new NotFoundError('Request')
    if ((current as RequestRow).status !== 'pending')
      throw new ConflictError('AI_REQUEST_ALREADY_DECIDED')
    // An old request describes a situation that may no longer hold.
    if (to === 'approved' && isExpired(current as RequestRow))
      throw new ConflictError('AI_REQUEST_EXPIRED')

    const { data, error } = await tolerant((columns) =>
      supabase
        .from('ai_action_requests')
        .update({ status: to, decided_by: ctx.userId, decided_at: new Date().toISOString() })
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', id)
        // The claim: only a request that is STILL pending is taken.
        .eq('status', 'pending')
        .select(columns)
        .maybeSingle(),
    )
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
    const { data, error } = await tolerant((columns) =>
      supabase
        .from('ai_action_requests')
        .update({
          status: outcome.ok ? 'executed' : 'failed',
          result_status: outcome.httpStatus,
          result: outcome.body ?? null,
        })
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', id)
        .eq('status', 'approved')
        .select(columns)
        .maybeSingle(),
    )
    if (error) fail(error, 'Failed to record the result')
    if (!data) throw new ConflictError('AI_REQUEST_ALREADY_DECIDED')
    return toRequest(data as RequestRow)
  }
}

export const mcpRequestService = new McpRequestService()
