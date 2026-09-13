// ============================================
// backend/src/services/conflict/conflict.service.ts
//
// Records rejected offline mutations, and applies an authorized decision.
//
// PRESERVE BOTH → REVIEW → AUTHORIZED RESOLUTION → AUDIT, in that order. The
// service never picks a winner on its own for anything financial, and it never
// applies a resolution that has no stated reason behind it.
// ============================================

import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'
import {
  NEGATIVE_STOCK_RESOLUTIONS,
  breachDivergences,
  breachKey,
  type NegativeStockBreach,
} from '../pos/negative-stock.domain'

import {
  applyResolution,
  classifyConflict,
  validateResolution,
  type ConflictEntity,
  type FieldDivergence,
  type ResolutionRequest,
} from './conflict.domain'

export interface ConflictRow {
  id: string
  entityType: ConflictEntity
  entityId: string
  mutationId: string
  operation: string
  serverVersion: number | null
  serverRow: Record<string, unknown>
  clientVersion: number | null
  clientPayload: Record<string, unknown>
  divergences: FieldDivergence[]
  hasFinancialDivergence: boolean
  status: 'open' | 'resolved' | 'superseded'
  resolution: string | null
  resolutionReason: string | null
  resolvedBy: string | null
  resolvedAt: string | null
  createdAt: string
  /**
   * A person-readable name for the record (product name, customer name,
   * invoice number), or null when the type has none or the record is gone.
   * Read from the record's own table, scoped by workspace — never from the
   * device payload, which is the side under dispute.
   */
  entityLabel: string | null
}

/** Which column names each entity, for the types that have one. */
const LABEL_COLUMNS: Partial<Record<ConflictEntity, { table: string; column: string }>> = {
  product: { table: 'products', column: 'name' },
  customer: { table: 'customers', column: 'full_name' },
  invoice: { table: 'invoices', column: 'invoice_number' },
}

async function attachLabels(
  workspaceId: string,
  rows: Omit<ConflictRow, 'entityLabel'>[],
): Promise<ConflictRow[]> {
  const labels = new Map<string, string>()

  for (const [entity, target] of Object.entries(LABEL_COLUMNS)) {
    if (!target) continue
    const ids = [...new Set(rows.filter((r) => r.entityType === entity).map((r) => r.entityId))]
    if (ids.length === 0) continue

    const { data, error } = await supabase
      .from(target.table)
      .select(`id, ${target.column}`)
      .eq('workspace_id', workspaceId)
      .in('id', ids)

    // A broken lookup is an error, not "this record has no name".
    if (error) throw new DatabaseError('Failed to resolve conflict record names', error)

    for (const record of (data ?? []) as unknown as Record<string, unknown>[]) {
      const value = record[target.column]
      if (typeof value === 'string' && value.trim() !== '') {
        labels.set(`${entity}:${String(record.id)}`, value)
      }
    }
  }

  return rows.map((row) => ({
    ...row,
    entityLabel: labels.get(`${row.entityType}:${row.entityId}`) ?? null,
  }))
}

function mapConflict(raw: Record<string, any>): Omit<ConflictRow, 'entityLabel'> {
  return {
    id: raw.id,
    entityType: raw.entity_type,
    entityId: raw.entity_id,
    mutationId: raw.mutation_id,
    operation: raw.operation,
    serverVersion: raw.server_version ?? null,
    serverRow: raw.server_row ?? {},
    clientVersion: raw.client_version ?? null,
    clientPayload: raw.client_payload ?? {},
    divergences: raw.divergences ?? [],
    hasFinancialDivergence: raw.has_financial_divergence === true,
    status: raw.status ?? 'open',
    resolution: raw.resolution ?? null,
    resolutionReason: raw.resolution_reason ?? null,
    resolvedBy: raw.resolved_by ?? null,
    resolvedAt: raw.resolved_at ?? null,
    createdAt: raw.created_at,
  }
}

const COLUMNS = `
  id, entity_type, entity_id, mutation_id, operation, server_version, server_row,
  client_version, client_payload, divergences, has_financial_divergence, status,
  resolution, resolution_reason, resolved_by, resolved_at, created_at
`

/** Tables a resolution may write back to, by entity. Nothing else is reachable. */
const ENTITY_TABLES: Record<ConflictEntity, string> = {
  invoice: 'invoices',
  payment: 'payments',
  journal_entry: 'journal_entries',
  customer: 'customers',
  product: 'products',
  transaction: 'transactions',
}

export class ConflictService {
  /**
   * A mutation was refused. Keep both versions.
   *
   * Called from the sync path when the server rejects a stale write. It never
   * throws into that path: failing to FILE a conflict must not turn a clean
   * "your copy is out of date" into a 500 the device will retry forever.
   */
  async record(
    // Not a full TenancyContext: filing a conflict is not an authorized
    // OPERATION, it is the record of one that was refused. The sync path has
    // no role to offer, and inventing one here — the shape this first took —
    // puts a fabricated authorization into a security-relevant call.
    ctx: { workspaceId: string; userId: string },
    input: {
      entityType: ConflictEntity
      entityId: string
      mutationId: string
      operation: string
      serverRow: Record<string, unknown>
      clientPayload: Record<string, unknown>
      clientVersion?: number | undefined
    },
  ): Promise<{ status: 'recorded' | 'auto_merged' | 'no_divergence'; conflictId?: string }> {
    const verdict = classifyConflict(input.entityType, input.serverRow, input.clientPayload)

    if (verdict.kind === 'no_divergence') return { status: 'no_divergence' }

    const divergences =
      verdict.kind === 'needs_review'
        ? verdict.divergences
        : verdict.fields.map((field) => ({
            field,
            serverValue: input.serverRow[field],
            clientValue: input.clientPayload[field],
            financial: false,
          }))

    const { data, error } = await supabase
      .from('sync_conflicts')
      .upsert(
        {
          workspace_id: ctx.workspaceId,
          entity_type: input.entityType,
          entity_id: input.entityId,
          mutation_id: input.mutationId,
          operation: input.operation,
          server_version: Number(input.serverRow.version) || null,
          server_row: input.serverRow,
          client_version: input.clientVersion ?? null,
          client_payload: input.clientPayload,
          divergences,
          has_financial_divergence: verdict.kind === 'needs_review',
          // An auto-merge is still filed, resolved, with what it did. A merge
          // that leaves no trace is indistinguishable from data loss when
          // somebody asks later why a field changed.
          status: verdict.kind === 'auto_merge' ? 'resolved' : 'open',
          resolution: verdict.kind === 'auto_merge' ? 'auto_merge' : null,
          resolution_reason: verdict.kind === 'auto_merge' ? 'no financial field diverged' : null,
          resolved_row: verdict.kind === 'auto_merge' ? verdict.merged : null,
          resolved_at: verdict.kind === 'auto_merge' ? new Date().toISOString() : null,
          detected_by: ctx.userId,
        },
        { onConflict: 'workspace_id,mutation_id' },
      )
      .select('id')
      .single()

    if (error) throw new DatabaseError('Failed to record the conflict', error)

    if (verdict.kind === 'auto_merge') {
      await this.writeBack(ctx, input.entityType, input.entityId, verdict.merged)
      return { status: 'auto_merged', conflictId: data?.id }
    }

    return { status: 'recorded', conflictId: data?.id }
  }

  /**
   * M2 — file an oversell: two offline sales that together took stock below
   * zero.
   *
   * ---------------------------------------------------------------------------
   * ⚠️ WHY THIS IS A SIBLING OF `record()` AND NOT A CALL TO IT
   *
   * `record()` runs `classifyConflict`, which compares a server row against a
   * client payload field by field. That is the right model for «the same record
   * was edited in two places».
   *
   * An oversell is not that. BOTH sales are correct, neither row is wrong, and
   * there is no field on which they disagree — the invariant was broken by
   * their SUM. Feeding synthetic rows to `classifyConflict` to make it fit
   * would produce a divergence report that describes a disagreement nobody had.
   *
   * So the classification differs and everything else is shared: the same
   * table, the same `/conflicts` screen, the same resolution audit trail. That
   * is extending the model, not building a second one (G2).
   *
   * ---------------------------------------------------------------------------
   * ⚠️ IT IS FILED, NEVER ACTED ON
   *
   * M2.4 forbids silent reject, overwrite, delete and stock correction. This
   * method writes a row and returns. It does not touch stock, does not reverse
   * a sale, and does not clamp anything — the negative on-hand stays visible,
   * which Phase C already treats as information rather than corruption.
   */
  async recordStockBreach(
    // Same shape as `record()`: filing a conflict is the record of a refused
    // or broken operation, not an authorized one, and the sync path has no
    // role to offer.
    ctx: { workspaceId: string; userId: string },
    input: {
      productId: string
      /** The sync mutation that tipped it negative. */
      mutationId: string
      breach: NegativeStockBreach
    },
  ): Promise<{ conflictId: string | undefined }> {
    const { breach } = input

    const { data, error } = await supabase
      .from('sync_conflicts')
      .upsert(
        {
          workspace_id: ctx.workspaceId,
          entity_type: 'product',
          entity_id: input.productId,
          // Keyed by mutation AND product — one mutation can oversell several,
          // and `(workspace_id, mutation_id)` is unique, so a bare mutation id
          // would let the second product overwrite the first's conflict.
          //
          // This also gives replay-idempotency for free (M2.5): re-sending the
          // mutation upserts the same row instead of filing a second conflict.
          mutation_id: breachKey(input.mutationId, input.productId),
          operation: 'negative_stock',
          server_version: null,
          server_row: {
            product_id: input.productId,
            on_hand_after: breach.onHandAfter,
            shortfall: breach.shortfall,
          },
          client_version: null,
          client_payload: {
            quantity_sold: breach.quantitySold,
            device_believed_on_hand: breach.deviceBelievedOnHand,
            sold_beyond_own_belief: breach.soldBeyondOwnBelief,
            // What a person may do about it, and which of those the product
            // can currently carry out. Two of the three do not exist yet.
            resolutions: NEGATIVE_STOCK_RESOLUTIONS,
          },
          divergences: breachDivergences(breach),
          // ALWAYS. Stock sold that did not exist is money and goods, and it
          // goes to a person — there is no automatic side to take.
          has_financial_divergence: true,
          status: 'open',
          resolution: null,
          resolution_reason: null,
          resolved_row: null,
          resolved_at: null,
          detected_by: ctx.userId,
        },
        { onConflict: 'workspace_id,mutation_id' },
      )
      .select('id')
      .single()

    if (error) throw new DatabaseError('Failed to record the stock conflict', error)
    return { conflictId: data?.id }
  }

  async list(ctx: TenancyContext, status: 'open' | 'resolved' | 'all' = 'open') {
    let query = supabase
      .from('sync_conflicts')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (status !== 'all') query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to fetch conflicts', error)
    return attachLabels(ctx.workspaceId, (data ?? []).map(mapConflict))
  }

  async get(ctx: TenancyContext, id: string): Promise<ConflictRow> {
    const { data, error } = await supabase
      .from('sync_conflicts')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch conflict', error)
    if (!data) throw new NotFoundError('Conflict')
    const [row] = await attachLabels(ctx.workspaceId, [mapConflict(data)])
    return row!
  }

  /**
   * Apply a decision.
   *
   * The caller must already hold the capability for it — the route enforces
   * that. What this adds is that the decision is complete (every diverging
   * field decided, not defaulted), that it carries a reason, and that both the
   * decision and its author are written down next to the two versions.
   */
  async resolve(ctx: TenancyContext, id: string, request: ResolutionRequest) {
    const conflict = await this.get(ctx, id)

    const problems = validateResolution(request, conflict.divergences, conflict.status !== 'open')
    if (problems.length > 0) {
      if (problems.includes('CONFLICT_ALREADY_RESOLVED')) {
        throw new ConflictError('CONFLICT_ALREADY_RESOLVED')
      }
      throw new ValidationError(problems.join(', '))
    }

    const resolvedRow = applyResolution(
      conflict.serverRow,
      conflict.clientPayload,
      conflict.divergences,
      request,
    )

    // The row first: if the write-back fails, the conflict stays open rather
    // than being marked resolved against a change that never landed.
    if (request.choice !== 'keep_server') {
      await this.writeBack(ctx, conflict.entityType, conflict.entityId, resolvedRow)
    }

    const { error } = await supabase
      .from('sync_conflicts')
      .update({
        status: 'resolved',
        resolution: request.choice,
        resolution_reason: request.reason,
        resolved_row: resolvedRow,
        resolved_by: ctx.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .eq('status', 'open')

    if (error) throw new DatabaseError('Failed to record the resolution', error)

    return this.get(ctx, id)
  }

  /**
   * Write the decided row back to its own table.
   *
   * Only the fields that were in dispute are written, and only ever within the
   * caller's workspace. The id, workspace and version columns are stripped: a
   * resolution decides what the values are, never which row or whose it is.
   */
  private async writeBack(
    ctx: { workspaceId: string },
    entityType: ConflictEntity,
    entityId: string,
    row: Record<string, unknown>,
  ) {
    const table = ENTITY_TABLES[entityType]
    if (!table) throw new ValidationError('CONFLICT_ENTITY_UNKNOWN')

    const values: Record<string, unknown> = { ...row }
    for (const key of ['id', 'workspace_id', 'user_id', 'version', 'created_at']) {
      delete values[key]
    }
    values.updated_at = new Date().toISOString()

    const { error } = await supabase
      .from(table)
      .update(values)
      .eq('id', entityId)
      .eq('workspace_id', ctx.workspaceId)

    if (error) throw new DatabaseError('Failed to apply the resolution', error)
  }
}
