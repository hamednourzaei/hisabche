// ============================================
// backend/src/services/ai/pipeline/pipeline.repository.ts
//
// The pipeline's own three tables — and nothing else.
//
// ⚠️ THIS IS THE ONLY DATABASE ACCESS THE PIPELINE HAS. It reads and writes
// `ai_pipeline_settings`, `ai_pipeline_runs` and `ai_pipeline_steps`. It never
// touches an invoice, a payment, a customer or a product: those are read and
// written through their own routes (pipeline.service → own-route).
//
// Every query carries `workspace_id`. A run id from another business is simply
// not found.
// ============================================

import { supabase } from '../../../db'
import { BaseError } from '../../../errors/base.error'
import { DatabaseError } from '../../../errors/database.error'
import type { TenancyContext } from '../../tenancy.service'

import {
  DEFAULT_PIPELINE_SETTINGS,
  type PipelineCommand,
  type PipelineDraft,
  type PipelineEntity,
  type PipelineOperation,
  type PipelineProposal,
  type PipelineQuestion,
  type PipelineSettings,
  type PipelineStage,
} from './pipeline.domain'

export type PipelineRunStatus =
  | 'understanding'
  | 'needs_input'
  | 'proposed'
  | 'approved'
  | 'executed'
  | 'failed'
  | 'needs_review'
  | 'rejected'
  | 'refused'

export interface PipelineRun {
  id: string
  workspaceId: string
  requestedBy: string
  requestText: string
  dryRun: boolean
  operation: PipelineOperation | null
  status: PipelineRunStatus
  draft: PipelineDraft
  questions: PipelineQuestion[]
  command: PipelineCommand | null
  proposal: PipelineProposal | null
  reasonCode: string | null
  approvedBy: string | null
  approvedAt: string | null
  autoApproved: boolean
  resultStatus: number | null
  result: Record<string, unknown> | null
  entityType: PipelineEntity | null
  entityId: string | null
  createdAt: string
  updatedAt: string
}

export interface PipelineStep {
  id: string
  stage: PipelineStage
  outcome: 'ok' | 'stopped' | 'failed'
  actorId: string | null
  detail: Record<string, unknown>
  createdAt: string
}

/** The migration has not been run: the feature is unavailable, not broken. */
export class PipelineNotMigratedError extends BaseError {
  constructor() {
    super('AI_PIPELINE_MIGRATION_REQUIRED', 503)
    this.name = 'PipelineNotMigratedError'
  }
}

const MISSING_SCHEMA = new Set(['42P01', '42703', 'PGRST204', 'PGRST205'])
const isMissingSchema = (error: { code?: string } | null | undefined): boolean =>
  MISSING_SCHEMA.has(error?.code ?? '')

const RUN_COLUMNS =
  'id, workspace_id, requested_by, request_text, dry_run, operation, status, draft, questions, ' +
  'command, proposal, reason_code, approved_by, approved_at, auto_approved, result_status, result, ' +
  'entity_type, entity_id, created_at, updated_at'

/** A row as PostgREST returns it: untyped until it is mapped. */
type Row = Record<string, unknown>

const str = (value: unknown): string => (typeof value === 'string' ? value : '')
const strOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null)

function mapRun(raw: Row): PipelineRun {
  return {
    id: str(raw.id),
    workspaceId: str(raw.workspace_id),
    requestedBy: str(raw.requested_by),
    requestText: str(raw.request_text),
    dryRun: raw.dry_run === true,
    operation: (strOrNull(raw.operation) as PipelineOperation | null) ?? null,
    status: str(raw.status) as PipelineRunStatus,
    draft: (raw.draft ?? {}) as PipelineDraft,
    questions: Array.isArray(raw.questions) ? (raw.questions as PipelineQuestion[]) : [],
    command: (raw.command ?? null) as PipelineCommand | null,
    proposal: (raw.proposal ?? null) as PipelineProposal | null,
    reasonCode: strOrNull(raw.reason_code),
    approvedBy: strOrNull(raw.approved_by),
    approvedAt: strOrNull(raw.approved_at),
    autoApproved: raw.auto_approved === true,
    resultStatus: typeof raw.result_status === 'number' ? raw.result_status : null,
    result: (raw.result ?? null) as Record<string, unknown> | null,
    entityType: strOrNull(raw.entity_type) as PipelineEntity | null,
    entityId: strOrNull(raw.entity_id),
    createdAt: str(raw.created_at),
    updatedAt: str(raw.updated_at),
  }
}

/** The columns a run may be moved forward with. */
export interface RunPatch {
  status: PipelineRunStatus
  operation?: PipelineOperation | undefined
  draft?: PipelineDraft | undefined
  questions?: PipelineQuestion[] | undefined
  command?: PipelineCommand | undefined
  proposal?: PipelineProposal | undefined
  reasonCode?: string | undefined
  approvedBy?: string | undefined
  autoApproved?: boolean | undefined
  resultStatus?: number | undefined
  result?: Record<string, unknown> | undefined
  entityType?: PipelineEntity | undefined
  entityId?: string | undefined
}

export class PipelineRepository {
  // ─── The switch ───────────────────────────────────────────────────────────

  /**
   * `available: false` when the migration has not run — which reads as «off»,
   * and is said separately so the screen can tell an owner WHY it is off.
   */
  async getSettings(
    workspaceId: string,
  ): Promise<{ settings: PipelineSettings; available: boolean }> {
    const { data, error } = await supabase
      .from('ai_pipeline_settings')
      .select('enabled, auto_approve_non_financial')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (error) {
      if (isMissingSchema(error)) return { settings: DEFAULT_PIPELINE_SETTINGS, available: false }
      throw new DatabaseError('Failed to read the AI pipeline settings', error)
    }
    const row = data as { enabled?: boolean; auto_approve_non_financial?: boolean } | null
    return {
      available: true,
      settings: {
        enabled: row?.enabled === true,
        autoApproveNonFinancial: row?.auto_approve_non_financial === true,
      },
    }
  }

  async saveSettings(ctx: TenancyContext, settings: PipelineSettings): Promise<PipelineSettings> {
    const { error } = await supabase.from('ai_pipeline_settings').upsert(
      {
        workspace_id: ctx.workspaceId,
        enabled: settings.enabled,
        auto_approve_non_financial: settings.autoApproveNonFinancial,
        updated_by: ctx.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id' },
    )
    if (error) {
      if (isMissingSchema(error)) throw new PipelineNotMigratedError()
      throw new DatabaseError('Failed to save the AI pipeline settings', error)
    }
    return settings
  }

  // ─── Runs ─────────────────────────────────────────────────────────────────

  async createRun(ctx: TenancyContext, requestText: string, dryRun: boolean): Promise<PipelineRun> {
    const { data, error } = await supabase
      .from('ai_pipeline_runs')
      .insert({
        workspace_id: ctx.workspaceId,
        requested_by: ctx.userId,
        request_text: requestText,
        dry_run: dryRun,
      })
      .select(RUN_COLUMNS)
      .single()
    if (error || !data) {
      if (isMissingSchema(error)) throw new PipelineNotMigratedError()
      throw new DatabaseError('Failed to start the AI run', error ?? undefined)
    }
    return mapRun(data as unknown as Row)
  }

  async getRun(workspaceId: string, id: string): Promise<PipelineRun | null> {
    const { data, error } = await supabase
      .from('ai_pipeline_runs')
      .select(RUN_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .maybeSingle()
    if (error) {
      if (isMissingSchema(error)) throw new PipelineNotMigratedError()
      throw new DatabaseError('Failed to read the AI run', error)
    }
    return data ? mapRun(data as unknown as Row) : null
  }

  /** These runs of this business, in no particular order. */
  async getRuns(workspaceId: string, ids: readonly string[]): Promise<PipelineRun[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('ai_pipeline_runs')
      .select(RUN_COLUMNS)
      .eq('workspace_id', workspaceId)
      .in('id', [...ids])
    if (error) {
      // No table yet means no runs yet.
      if (isMissingSchema(error)) return []
      throw new DatabaseError('Failed to read the AI runs', error)
    }
    return ((data ?? []) as unknown as Row[]).map(mapRun)
  }
  /**
   * Move a run forward — only from one of `from`.
   *
   * ⚠️ THE STATUS IS IN THE WHERE CLAUSE. Two approvals arriving together both
   * see «proposed»; only one UPDATE matches a row, and the other gets null.
   * That single winner is what makes «executed once» true. The database
   * trigger refuses anything this condition would let through by mistake.
   */
  async move(
    workspaceId: string,
    id: string,
    from: readonly PipelineRunStatus[],
    patch: RunPatch,
  ): Promise<PipelineRun | null> {
    const row: Record<string, unknown> = { status: patch.status }
    if (patch.operation !== undefined) row.operation = patch.operation
    if (patch.draft !== undefined) row.draft = patch.draft
    if (patch.questions !== undefined) row.questions = patch.questions
    if (patch.command !== undefined) row.command = patch.command
    if (patch.proposal !== undefined) row.proposal = patch.proposal
    if (patch.reasonCode !== undefined) row.reason_code = patch.reasonCode
    if (patch.approvedBy !== undefined) {
      row.approved_by = patch.approvedBy
      row.approved_at = new Date().toISOString()
    }
    if (patch.autoApproved !== undefined) row.auto_approved = patch.autoApproved
    if (patch.resultStatus !== undefined) row.result_status = patch.resultStatus
    if (patch.result !== undefined) row.result = patch.result
    if (patch.entityType !== undefined) row.entity_type = patch.entityType
    if (patch.entityId !== undefined) row.entity_id = patch.entityId

    const { data, error } = await supabase
      .from('ai_pipeline_runs')
      .update(row)
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .in('status', [...from])
      .select(RUN_COLUMNS)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to update the AI run', error)
    return data ? mapRun(data as unknown as Row) : null
  }

  // ─── The audit trail ──────────────────────────────────────────────────────

  async addStep(
    run: Pick<PipelineRun, 'id' | 'workspaceId'>,
    stage: PipelineStage,
    outcome: PipelineStep['outcome'],
    actorId: string,
    detail: Record<string, unknown> = {},
  ): Promise<void> {
    const { error } = await supabase.from('ai_pipeline_steps').insert({
      run_id: run.id,
      workspace_id: run.workspaceId,
      stage,
      outcome,
      actor_id: actorId,
      detail,
    })
    if (error) throw new DatabaseError('Failed to write the AI audit trail', error)
  }

  async steps(workspaceId: string, runId: string): Promise<PipelineStep[]> {
    const { data, error } = await supabase
      .from('ai_pipeline_steps')
      .select('id, stage, outcome, actor_id, detail, created_at')
      .eq('workspace_id', workspaceId)
      .eq('run_id', runId)
      .order('created_at', { ascending: true })
    if (error) throw new DatabaseError('Failed to read the AI audit trail', error)
    return ((data ?? []) as unknown as Row[]).map((raw) => ({
      id: str(raw.id),
      stage: str(raw.stage) as PipelineStage,
      outcome: str(raw.outcome) as PipelineStep['outcome'],
      actorId: strOrNull(raw.actor_id),
      detail: (raw.detail ?? {}) as Record<string, unknown>,
      createdAt: str(raw.created_at),
    }))
  }

  // ─── Usage: one run is one question of the monthly allowance ──────────────

  /**
   * ⚠️ ONE ROW PER RUN, however many times the model is called inside it.
   * The allowance is COUNTED from `ai_query_log` (AiQuotaService), so writing
   * exactly one row here is what makes «a run costs one» true — there is no
   * second counter to drift.
   */
  async logUsage(
    ctx: TenancyContext,
    entry: {
      runId: string
      requestText: string
      provider: string
      model: string
      latencyMs: number
    },
  ): Promise<void> {
    const { error } = await supabase.from('ai_query_log').insert({
      workspace_id: ctx.workspaceId,
      actor_id: ctx.userId,
      question_text: entry.requestText,
      answer_text: `pipeline run ${entry.runId}`,
      resolved_views_or_functions: ['pipeline.run'],
      model_provider: entry.provider,
      model_name: entry.model,
      latency_ms: entry.latencyMs,
    })
    // Not swallowed silently: this row is the quota counter.
    if (error) console.error('[PipelineRepository] failed to write ai_query_log:', error)
  }
}
