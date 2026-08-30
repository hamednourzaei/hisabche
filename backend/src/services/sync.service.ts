// ============================================
// backend/src/services/sync.service.ts
//
// The authoritative sync engine.
//
// WHAT THIS REPLACES
//
// The previous /sync/push took a table name from the request body and passed
// it straight to `supabase.from(table)`. Any authenticated client could read
// or write any table in the database, with no validation, no versioning and no
// idempotency — a retry after a lost response created a second invoice, and a
// stale client silently overwrote a newer one. Errors were logged and
// swallowed, so a failed push looked identical to a successful one.
//
// WHAT THIS DOES INSTEAD
//
//   * A closed set of entities, each with its own handler and rules.
//   * Idempotency by mutation_id, enforced by a PRIMARY KEY rather than by an
//     in-memory map, so it survives a restart and two concurrent replicas.
//   * Optimistic concurrency: the client sends the version it believes, the
//     server rejects a stale write instead of applying it.
//   * A per-mutation result, so one bad row never discards the batch.
//   * A monotonic cursor, so a client can resume exactly where it stopped.
//
// The change log itself is written by a database trigger, in the same
// transaction as the row it describes — see docs/sync-engine-migration.sql for
// why that is a trigger and not application code.
// ============================================

import { conflicts, type ConflictEntity } from './conflict'
import {
  LEASE_TTL_SECONDS,
  isRetryable,
  type SyncChange,
  type SyncEntity,
  type SyncErrorCode,
  type SyncMutation,
  type SyncMutationResult,
  type SyncPullResponse,
} from '@hisabche/validation'

import { supabase } from '../db'

/** Physical table behind each protocol entity. Nothing else is reachable. */
const ENTITY_TABLE: Record<SyncEntity, string> = {
  invoice: 'invoices',
  customer: 'customers',
  product: 'products',
  transaction: 'transactions',
}

/**
 * Columns a client may write, per entity.
 *
 * An allow-list, not a deny-list. A payload key that is not here is dropped
 * silently rather than rejected, because a newer client sending a field this
 * server does not know about should still succeed on the fields it does.
 *
 * Note what is ABSENT everywhere: `workspace_id`, `user_id`, `version`,
 * `created_at`, `finalized_at`. Those are the server's to decide; accepting
 * them from a client is how a row ends up in someone else's workspace.
 */
const WRITABLE: Record<SyncEntity, readonly string[]> = {
  invoice: [
    'id',
    'invoice_number',
    'type',
    'customer_id',
    'supplier_id',
    'date',
    'due_date',
    'subtotal',
    'discount_total',
    'tax_total',
    'total',
    'paid_amount',
    'currency',
    'payment_method',
    'status',
    'notes',
    'reference',
  ],
  customer: ['id', 'name', 'phone', 'email', 'address', 'type', 'notes', 'credit_limit'],
  product: [
    'id',
    'name',
    'barcode',
    'sku',
    'category',
    'quantity',
    'unit',
    'buy_price',
    'sell_price',
    'min_stock_level',
    'description',
  ],
  transaction: [
    'id',
    'customer_id',
    'supplier_id',
    'invoice_id',
    'type',
    'amount',
    'currency',
    'payment_method',
    'date',
    'notes',
  ],
}

export interface SyncActor {
  userId: string
  workspaceId: string
  deviceId: string
}

class SyncError extends Error {
  constructor(
    readonly code: SyncErrorCode,
    message: string,
    readonly serverState?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'SyncError'
  }
}

function pickWritable(entity: SyncEntity, payload: Record<string, unknown>) {
  const allowed = WRITABLE[entity]
  const out: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in payload) out[key] = payload[key]
  }
  return out
}

export class SyncService {
  /* ═══════════════════════════════════════════════════════════════════════
     PUSH
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Apply a batch, one mutation at a time, and report each independently.
   *
   * Sequential rather than parallel on purpose: mutations in a batch can
   * depend on each other (a customer created, then an invoice referencing it),
   * and the client sends them in dependency order. Running them concurrently
   * would break that ordering for a marginal latency win.
   */
  async push(
    actor: SyncActor,
    mutations: SyncMutation[],
  ): Promise<{ results: SyncMutationResult[]; currentCursor: number }> {
    const results: SyncMutationResult[] = []

    for (const mutation of mutations) {
      results.push(await this.applyOne(actor, mutation))
    }

    return { results, currentCursor: await this.currentCursor(actor.workspaceId) }
  }

  private async applyOne(actor: SyncActor, mutation: SyncMutation): Promise<SyncMutationResult> {
    // ── Idempotency, before anything else touches money ──────────────────
    const replay = await this.findRecordedMutation(mutation.mutationId)
    if (replay) return replay

    try {
      const applied = await this.execute(actor, mutation)

      await this.recordMutation(actor, mutation, {
        status: 'applied',
        result: applied,
      })

      return {
        mutationId: mutation.mutationId,
        status: 'applied',
        entityVersion: applied.entityVersion,
        ...(applied.syncVersion !== undefined ? { syncVersion: applied.syncVersion } : {}),
        duplicate: false,
        retryable: false,
      }
    } catch (cause) {
      const code: SyncErrorCode = cause instanceof SyncError ? cause.code : 'server_error'
      const message = cause instanceof Error ? cause.message : 'unknown error'
      const retryable = isRetryable(code)

      // A retryable failure is NOT recorded: the client will send this exact
      // mutation_id again, and recording it now would make the retry replay a
      // failure forever instead of succeeding.
      if (!retryable) {
        await this.recordMutation(actor, mutation, { status: 'rejected', errorCode: code })
      }

      return {
        mutationId: mutation.mutationId,
        status: 'rejected',
        duplicate: false,
        errorCode: code,
        errorMessage: message,
        retryable,
        ...(cause instanceof SyncError && cause.serverState
          ? { serverState: cause.serverState }
          : {}),
      }
    }
  }

  /** A previously recorded outcome, replayed verbatim. */
  private async findRecordedMutation(mutationId: string): Promise<SyncMutationResult | null> {
    const { data } = await supabase
      .from('sync_mutations')
      .select('mutation_id, status, result, error_code, sync_version')
      .eq('mutation_id', mutationId)
      .maybeSingle()

    if (!data) return null

    const stored = (data.result ?? {}) as { entityVersion?: number }

    return {
      mutationId: data.mutation_id as string,
      status: data.status as 'applied' | 'rejected',
      ...(data.sync_version ? { syncVersion: Number(data.sync_version) } : {}),
      ...(stored.entityVersion ? { entityVersion: stored.entityVersion } : {}),
      // The flag exists for observability. The client MUST treat this exactly
      // like a first-time result — that is what makes a lost response safe.
      duplicate: true,
      ...(data.error_code ? { errorCode: data.error_code as SyncErrorCode } : {}),
      retryable: false,
    }
  }

  private async recordMutation(
    actor: SyncActor,
    mutation: SyncMutation,
    outcome: {
      status: 'applied' | 'rejected'
      result?: { entityVersion?: number; syncVersion?: number }
      errorCode?: SyncErrorCode
    },
  ): Promise<void> {
    const { error } = await supabase.from('sync_mutations').insert({
      mutation_id: mutation.mutationId,
      workspace_id: actor.workspaceId,
      user_id: actor.userId,
      device_id: actor.deviceId,
      entity_type: mutation.entityType,
      entity_id: mutation.entityId,
      operation: mutation.operation,
      status: outcome.status,
      result: outcome.result ?? null,
      error_code: outcome.errorCode ?? null,
      sync_version: outcome.result?.syncVersion ?? null,
    })

    // A duplicate key here means a concurrent request for the same mutation_id
    // won the race. That is the ledger doing its job, not a failure.
    if (error && error.code !== '23505') {
      console.error('[SyncService] failed to record mutation', error)
    }
  }

  /** Route to the entity's rules and perform the write. */
  private async execute(
    actor: SyncActor,
    mutation: SyncMutation,
  ): Promise<{ entityVersion: number; syncVersion?: number }> {
    const table = ENTITY_TABLE[mutation.entityType]

    if (mutation.operation === 'delete') {
      await this.assertOwned(table, mutation.entityId, actor.workspaceId)
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', mutation.entityId)
        .eq('workspace_id', actor.workspaceId)
      if (error) throw new SyncError('server_error', error.message)
      return { entityVersion: 0 }
    }

    const values = pickWritable(mutation.entityType, mutation.payload)

    if (mutation.operation === 'create') {
      const { data, error } = await supabase
        .from(table)
        .insert({
          ...values,
          id: mutation.entityId,
          // Derived from the verified token, never from the payload.
          workspace_id: actor.workspaceId,
          user_id: actor.userId,
        })
        .select('version')
        .single()

      if (error) {
        // The row already exists. With a stable mutation_id this can only
        // happen if the ledger row was lost, so treat it as applied rather
        // than telling the client its invoice failed.
        if (error.code === '23505') {
          const current = await this.readVersion(table, mutation.entityId, actor.workspaceId)
          return { entityVersion: current ?? 1 }
        }
        throw new SyncError('validation_failed', error.message)
      }

      return { entityVersion: Number(data?.version ?? 1) }
    }

    // ── update ──────────────────────────────────────────────────────────
    const current = await this.readRow(table, mutation.entityId, actor.workspaceId)
    if (!current) throw new SyncError('not_found', `${mutation.entityType} not found`)

    if (mutation.entityType === 'invoice' && current.finalized_at) {
      throw new SyncError(
        'immutable',
        'A finalized invoice cannot be modified; issue a correction document instead.',
      )
    }

    if (
      mutation.expectedVersion !== undefined &&
      Number(current.version ?? 1) !== mutation.expectedVersion
    ) {
      // The whole point of optimistic concurrency: refuse, and hand back the
      // server's row so the client can merge rather than guess.
      //
      // Before refusing, FILE the attempt. Until this existed the rejected
      // payload survived only in that device's outbox: clear the app, reinstall
      // it, or tap discard, and an hour of offline work was gone with no record
      // that it had ever been attempted.
      //
      // Filing also decides whether a person needs to look at it at all. Two
      // people editing a customer's notes are not in conflict; two people
      // disagreeing about an invoice total are, and that one is never settled
      // by whichever device reconnected second.
      await this.fileConflict(actor, mutation, current)

      throw new SyncError(
        'version_conflict',
        `expected version ${mutation.expectedVersion}, server has ${current.version}`,
        current,
      )
    }

    if (this.leaseHeldByOther(current, actor.userId)) {
      throw new SyncError('locked', 'Another user is editing this record.')
    }

    const { data, error } = await supabase
      .from(table)
      .update(values)
      .eq('id', mutation.entityId)
      .eq('workspace_id', actor.workspaceId)
      .select('version')
      .single()

    if (error) {
      // The finalized-invoice guard trigger raises this.
      if (error.code === '23001' || /finalized/i.test(error.message)) {
        throw new SyncError('immutable', error.message)
      }
      throw new SyncError('validation_failed', error.message)
    }

    return { entityVersion: Number(data?.version ?? 1) }
  }

  /**
   * Preserve both versions of a refused write.
   *
   * Deliberately swallows its own failures. Being unable to FILE a conflict
   * must not turn a clean "your copy is out of date" into a 500 that the
   * device retries forever — the refusal itself is still correct and is still
   * reported to the client.
   */
  private async fileConflict(
    actor: SyncActor,
    mutation: SyncMutation,
    current: Record<string, unknown>,
  ): Promise<void> {
    try {
      await conflicts.record(
        { workspaceId: actor.workspaceId, userId: actor.userId },
        {
          entityType: mutation.entityType as ConflictEntity,
          entityId: mutation.entityId,
          mutationId: mutation.mutationId,
          operation: mutation.operation,
          serverRow: current,
          clientPayload: mutation.payload,
          clientVersion: mutation.expectedVersion,
        },
      )
    } catch (err) {
      console.error('[SyncService] failed to file a conflict:', err)
    }
  }

  private leaseHeldByOther(row: Record<string, unknown>, userId: string): boolean {
    const holder = row.locked_by_user_id as string | null | undefined
    const expiry = row.lock_expires_at as string | null | undefined
    if (!holder || holder === userId || !expiry) return false
    // An expired lease is no lease. A client that crashed mid-edit must not
    // hold an invoice forever.
    return new Date(expiry).getTime() > Date.now()
  }

  private async readRow(
    table: string,
    id: string,
    workspaceId: string,
  ): Promise<Record<string, unknown> | null> {
    const { data } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    return (data as Record<string, unknown> | null) ?? null
  }

  private async readVersion(
    table: string,
    id: string,
    workspaceId: string,
  ): Promise<number | null> {
    const row = await this.readRow(table, id, workspaceId)
    return row ? Number(row.version ?? 1) : null
  }

  private async assertOwned(table: string, id: string, workspaceId: string): Promise<void> {
    const row = await this.readRow(table, id, workspaceId)
    if (!row) throw new SyncError('not_found', 'record not found in this workspace')
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PULL
     ═══════════════════════════════════════════════════════════════════════ */

  async currentCursor(workspaceId: string): Promise<number> {
    const { data } = await supabase
      .from('sync_change_log')
      .select('sync_version')
      .eq('workspace_id', workspaceId)
      .order('sync_version', { ascending: false })
      .limit(1)
      .maybeSingle()

    return Number(data?.sync_version ?? 0)
  }

  /**
   * Everything after `cursor`, in order, bounded.
   *
   * The response carries the row DATA, not just the fact that something
   * changed: a client that had to fetch each changed row separately would make
   * one request per change, which is the architecture this replaces.
   */
  async pull(
    workspaceId: string,
    cursor: number,
    limit: number,
    excludeDevice?: string,
  ): Promise<SyncPullResponse> {
    // A cursor older than the oldest surviving log row cannot be replayed —
    // the changes it missed have been pruned. Saying so is the only honest
    // answer; silently returning what remains would skip data forever.
    if (cursor > 0 && (await this.isBehindHorizon(workspaceId, cursor))) {
      return { changes: [], nextCursor: cursor, hasMore: false, mustRehydrate: true }
    }

    // One extra row is fetched purely to learn whether more exist, without a
    // second COUNT query over the same range.
    const { data: log, error } = await supabase
      .from('sync_change_log')
      .select('sync_version, entity_type, entity_id, operation, entity_version, origin_device')
      .eq('workspace_id', workspaceId)
      .gt('sync_version', cursor)
      .order('sync_version', { ascending: true })
      .limit(limit + 1)

    if (error) throw new Error(`sync pull failed: ${error.message}`)

    const rows = log ?? []
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows

    if (page.length === 0) {
      return { changes: [], nextCursor: cursor, hasMore: false, mustRehydrate: false }
    }

    const changes = await this.hydrate(workspaceId, page, excludeDevice)

    return {
      changes,
      // The cursor advances past everything examined, including changes filtered
      // out as this device's own echoes — they HAVE been accounted for, and not
      // advancing past them would replay them on every pull forever.
      nextCursor: Number(page[page.length - 1]?.sync_version ?? cursor),
      hasMore,
      mustRehydrate: false,
    }
  }

  private async isBehindHorizon(workspaceId: string, cursor: number): Promise<boolean> {
    const { data } = await supabase
      .from('sync_change_log')
      .select('sync_version')
      .eq('workspace_id', workspaceId)
      .order('sync_version', { ascending: true })
      .limit(1)
      .maybeSingle()

    const oldest = Number(data?.sync_version ?? 0)
    // `cursor + 1 < oldest` means at least one change between them is gone.
    return oldest > 0 && cursor + 1 < oldest
  }

  /**
   * Attach each changed row's current state.
   *
   * Batched by entity type — one query per type, not one per change. A delete
   * carries `data: null`; so does a row that has since been removed, which is
   * the same instruction to the client either way.
   */
  private async hydrate(
    workspaceId: string,
    entries: Array<Record<string, unknown>>,
    excludeDevice?: string,
  ): Promise<SyncChange[]> {
    const wanted = entries.filter((e) => !excludeDevice || e.origin_device !== excludeDevice)

    const byType = new Map<SyncEntity, Set<string>>()
    for (const entry of wanted) {
      if (entry.operation === 'delete') continue
      const type = entry.entity_type as SyncEntity
      if (!ENTITY_TABLE[type]) continue
      const set = byType.get(type) ?? new Set<string>()
      set.add(entry.entity_id as string)
      byType.set(type, set)
    }

    const loaded = new Map<string, Record<string, unknown>>()
    for (const [type, ids] of byType) {
      const { data } = await supabase
        .from(ENTITY_TABLE[type])
        .select('*')
        .eq('workspace_id', workspaceId)
        .in('id', [...ids])

      for (const row of (data ?? []) as Record<string, unknown>[]) {
        loaded.set(`${type}:${row.id as string}`, row)
      }
    }

    return wanted.map((entry) => {
      const type = entry.entity_type as SyncEntity
      const id = entry.entity_id as string
      const isDelete = entry.operation === 'delete'

      return {
        syncVersion: Number(entry.sync_version),
        entityType: type,
        entityId: id,
        operation: entry.operation as SyncChange['operation'],
        entityVersion: Number(entry.entity_version ?? 0),
        data: isDelete ? null : (loaded.get(`${type}:${id}`) ?? null),
      }
    })
  }

  /* ═══════════════════════════════════════════════════════════════════════
     DRAFT EDITING LEASE
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Take or renew the editing lease on a draft.
   *
   * A collaboration signal, not a database lock: it tells the other user's UI
   * to go read-only. It cannot protect money on its own — the version check
   * does that — which is why both exist.
   */
  async acquireLease(
    actor: SyncActor,
    entityType: SyncEntity,
    entityId: string,
  ): Promise<{ granted: boolean; expiresAt?: string; heldByUserId?: string }> {
    const table = ENTITY_TABLE[entityType]
    const row = await this.readRow(table, entityId, actor.workspaceId)
    if (!row) throw new SyncError('not_found', 'record not found')

    if (this.leaseHeldByOther(row, actor.userId)) {
      return {
        granted: false,
        heldByUserId: row.locked_by_user_id as string,
      }
    }

    const expiresAt = new Date(Date.now() + LEASE_TTL_SECONDS * 1000).toISOString()

    const { error } = await supabase
      .from(table)
      .update({ locked_by_user_id: actor.userId, lock_expires_at: expiresAt })
      .eq('id', entityId)
      .eq('workspace_id', actor.workspaceId)

    if (error) throw new SyncError('server_error', error.message)

    return { granted: true, expiresAt }
  }

  async releaseLease(actor: SyncActor, entityType: SyncEntity, entityId: string): Promise<void> {
    // Scoped to the holder, so releasing cannot steal someone else's lease.
    await supabase
      .from(ENTITY_TABLE[entityType])
      .update({ locked_by_user_id: null, lock_expires_at: null })
      .eq('id', entityId)
      .eq('workspace_id', actor.workspaceId)
      .eq('locked_by_user_id', actor.userId)
  }
}

export const syncService = new SyncService()
export { SyncError }
