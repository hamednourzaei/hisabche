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
  OPERATIONAL_WINDOW_DAYS,
  isRetryable,
  type SyncChange,
  type SyncEntity,
  type SyncErrorCode,
  type SyncMutation,
  type SyncMutationResult,
  type SyncPullResponse,
} from '@hisabche/validation'

import { supabase } from '../db'

/**
 * The server does not have this column.
 *
 * PostgREST says 42703 (a column that does not exist) or PGRST204 (a column
 * it could not resolve). Both mean the same thing here: the table is there,
 * the column is not.
 */
function isMissingColumn(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? ''
  if (code === '42703' || code === 'PGRST204') return true
  return /column .* does not exist|"column" .* not found/i.test(error.message ?? '')
}

/**
 * The server does not have this FUNCTION.
 *
 * PostgREST says PGRST202 (no function matching the signature) or 42883
 * (undefined_function). Both mean «the migration that creates it has not run».
 *
 * ⚠️ THE CALLER MUST NOT FALL BACK TO A DIRECT READ ON THIS. See `pull`.
 */
function isMissingFunction(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? ''
  if (code === 'PGRST202' || code === '42883') return true
  return /could not find the function|function .* does not exist/i.test(error.message ?? '')
}

/** Physical table behind each protocol entity. Nothing else is reachable. */
const ENTITY_TABLE: Record<SyncEntity, string> = {
  invoice: 'invoices',
  customer: 'customers',
  product: 'products',
  transaction: 'transactions',
  time_entry: 'time_entries',
  // The operational set (F2): what a device needs besides the three it had.
  warehouse: 'warehouses',
  branch: 'branches',
  exchange_rate: 'exchange_rates',
  product_stock: 'warehouse_stock',
}

/**
 * Entities backed by a physical table that has a `version` column maintained by `sync_bump_version()`.
 *
 * `transactions` (the cash/bank register) has no version column in the current schema
 * (docs/base-schema-migration.sql:171). The optimistic-lock guard and `.select('version')`
 * run only for entities backed by a versioned table; unversioned entities update without
 * the `.eq('version', ...)` predicate so PostgREST does not fail on 42703 (missing column).
 */
export const ENTITIES_WITH_VERSION: ReadonlySet<SyncEntity> = new Set([
  'invoice',
  'customer',
  'product',
  'time_entry',
  'warehouse',
  'branch',
  'exchange_rate',
  'product_stock',
])

/** Canonical SQL pattern for the version-guarded UPDATE issued on versioned entities. */
export const VERSION_GUARDED_UPDATE_SQL = (table: string, updateFields: string[]): string =>
  `UPDATE ${table} SET ${updateFields.map((f, i) => `${f} = $${i + 4}`).join(', ')} WHERE id = $1 AND workspace_id = $2 AND version = $3 RETURNING version`

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
  // ⚠️ NOTHING FINANCIAL. This road writes the row as given — no stock moves,
  // no ledger entry is booked, no total is re-derived from the lines. A
  // client that could send `total`, `paid_amount` or `status` here could
  // mark an invoice paid without a payment existing, or set a total the
  // ledger never saw. Those belong to `InvoiceService`, which is reached
  // through `/api/invoices` and nowhere else.
  //
  // What is left is the descriptive tail of an invoice: a note, a reference,
  // a due date. The client routing in `@hisabche/app-bridge` already refuses
  // to send an invoice down this road at all; this is the server refusing
  // too, because a server that trusts its clients has no rule.
  invoice: ['id', 'notes', 'reference', 'due_date'],
  // ⚠️ `credit_limit` is a CREDIT DECISION, not a detail. Raised through this
  // road it would let a device extend its own customer's borrowing with no
  // check that anybody is allowed to, and no record of who did.
  //
  // ⚠️ `full_name`, not `name` (27 Sep 2026). `customers` has no `name`
  // column; the list said `name`, so the `full_name` desktop sends was dropped
  // by the filter below and a customer renamed offline was renamed nowhere —
  // the push still answered «applied».
  customer: ['id', 'full_name', 'phone', 'email', 'address', 'type', 'notes'],
  product: [
    'id',
    'name',
    'barcode',
    'sku',
    'category',
    // ⚠️ `quantity` is STOCK and `buy_price` is cost — both move money.
    // Stock changes through an inventory movement, not a row update.
    'unit',
    'min_stock_level',
    'description',
  ],
  // ⚠️ A PAYMENT IS MONEY MOVING. `amount`, `type` and `invoice_id` decide
  // what a customer still owes; written straight to the table they change a
  // balance with no entry behind it. Only the note is descriptive.
  // The operational set is READ-ONLY for a device: a warehouse, a branch, an
  // exchange rate and a stock row are the server's to decide, and a client
  // that could write them would be inventing stock.
  warehouse: [],
  branch: [],
  exchange_rate: [],
  product_stock: [],
  transaction: ['id', 'notes'],
  // Note what is ABSENT: `invoice_id`. Its presence is the lock that says
  // these hours are already on a bill, and it is the SERVER's to set when the
  // invoice is raised. A device that could send it could un-bill hours that
  // have been paid for, or claim hours somebody else already invoiced.
  time_entry: [
    'id',
    'project_id',
    'task_id',
    'employee_id',
    'on_date',
    'minutes',
    'billable',
    // ⚠️ `rate_minor` is what the hours are BILLED at. A device that could
    // set it could re-price work that has already been quoted.
    'description',
  ],
}

/**
 * Columns a PULL sends, per entity — what a client actually stores, nothing
 * more (request #153, «lean payload»). `select('*')` shipped search vectors,
 * sync bookkeeping and every column added since, on every change, to every
 * device. Each name here is checked against docs/*.sql by
 * `sync-pull-columns.test.ts`: a column that does not exist would turn every
 * pull into a 500 (loud, since P0 — but still broken).
 *
 * `version` and `workspace_id` travel for every entity: the first is the
 * optimistic-concurrency token a later edit must send back, the second lets a
 * client refuse a row that is not its workspace's.
 *
 * `null` = no client stores this entity yet; the whole row is sent until one
 * does and names what it needs.
 */
export const PULL_COLUMNS: Record<SyncEntity, readonly string[] | null> = {
  product: [
    'id',
    'workspace_id',
    'version',
    'name',
    'barcode',
    'sku',
    'category',
    'quantity',
    'unit',
    'min_stock_level',
    'buy_price',
    'sell_price',
    'is_active',
    'updated_at',
  ],
  customer: [
    'id',
    'workspace_id',
    'version',
    'full_name',
    'phone',
    'email',
    'address',
    'opening_balance',
    'type',
    'is_active',
    'updated_at',
  ],
  invoice: [
    'id',
    'workspace_id',
    'version',
    'invoice_number',
    'type',
    'customer_id',
    'date',
    'subtotal',
    'discount_total',
    'tax_total',
    'total',
    'paid_amount',
    'payment_method',
    'currency',
    'status',
    'notes',
    'updated_at',
  ],
  // The operational set. The lean pull columns: a device stores these and
  // nothing else, so a column added on the server later does not arrive as a
  // surprise.
  warehouse: [
    'id',
    'workspace_id',
    'version',
    'name',
    'location',
    'branch_id',
    'is_active',
    'updated_at',
  ],
  branch: [
    'id',
    'workspace_id',
    'version',
    'code',
    'name',
    'parent_branch_id',
    'is_active',
    'updated_at',
  ],
  exchange_rate: [
    'id',
    'workspace_id',
    'version',
    'currency_code',
    'rate',
    'rate_date',
    'updated_at',
  ],
  product_stock: [
    'id',
    'workspace_id',
    'version',
    'product_id',
    'warehouse_id',
    'quantity',
    'updated_at',
  ],
  transaction: null,
  time_entry: null,
}

/** What a device stores of each invoice line. */
export const INVOICE_ITEM_COLUMNS = [
  'id',
  'invoice_id',
  'product_id',
  'product_name',
  'quantity',
  'unit_price',
  'discount',
  'total_price',
  'unit',
  'unit_label',
] as const

/**
 * Attach each invoice's lines as `items` (request: invoice lines in the
 * offline copy, 27 Sep 2026). A separate query rather than a PostgREST embed:
 * the invoice_items → invoices key was added NOT VALID, and an embed that does
 * not resolve fails the WHOLE pull (CLAUDE.md §8). `invoice_items` carries no
 * workspace column; it is scoped by invoice ids that were themselves read
 * under the workspace filter, so nothing outside the workspace is reachable.
 * A failed read throws (P0): never an invoice that looks like it has no lines.
 */
async function attachInvoiceItems(invoices: Record<string, unknown>[]): Promise<void> {
  const ids = invoices.map((row) => row.id).filter((id): id is string => typeof id === 'string')
  if (ids.length === 0) return
  const { data, error } = await supabase
    .from('invoice_items')
    .select(INVOICE_ITEM_COLUMNS.join(', '))
    .in('invoice_id', ids)
  if (error) throw new Error(`sync invoice items failed: ${error.message}`)
  const byInvoice = new Map<string, Record<string, unknown>[]>()
  for (const item of (data ?? []) as unknown as Record<string, unknown>[]) {
    const key = String(item.invoice_id)
    const list = byInvoice.get(key) ?? []
    list.push(item)
    byInvoice.set(key, list)
  }
  for (const row of invoices) row.items = byInvoice.get(String(row.id)) ?? []
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

/**
 * Fields this road must never write, and must never SILENTLY ignore either.
 *
 * ⚠️ DROPPING AND REFUSING ARE DIFFERENT ANSWERS.
 *
 * An unknown key is dropped on purpose: a newer client sending a field this
 * server has not learned about yet should still succeed on the fields it does
 * know. That is forward compatibility, and it is correct.
 *
 * A FINANCIAL key is not that. If a client sends `total` or `paid_amount`
 * here, silently ignoring it answers «saved» to somebody who just changed an
 * amount — and nothing changed. They close the screen believing the books say
 * one thing while the books say another. The request is refused instead, with
 * the field named, so the client can send it down the road that actually
 * recalculates (`/api/invoices`, `/api/transactions`).
 *
 * No client does this today — `routeFor` in `@hisabche/app-bridge` sends
 * anything financial to the domain — but a server that relies on its clients
 * behaving has no rule at all.
 */
const REFUSED_FIELDS: readonly string[] = [
  'total',
  'subtotal',
  'paid_amount',
  'discount_total',
  'tax_total',
  'amount',
  'status',
  'quantity',
  'buy_price',
  'sell_price',
  'credit_limit',
  'opening_balance',
  'salary',
  'rate_minor',
]

function pickWritable(entity: SyncEntity, payload: Record<string, unknown>) {
  const refused = REFUSED_FIELDS.filter((field) => field in payload)
  if (refused.length > 0) {
    throw new SyncError(
      'validation_failed',
      `FINANCIAL_FIELD_NOT_WRITABLE: ${refused.join(', ')} — send this through the ` +
        `domain route (/api/invoices, /api/transactions) so the figures are recalculated`,
    )
  }

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
      throw new SyncError(
        'forbidden',
        `Deletes are not accepted through /sync/push. Route deletes through the domain REST endpoint (/api/${mutation.entityType}s/:id).`,
      )
    }

    const values = pickWritable(mutation.entityType, mutation.payload)

    const hasVersion = ENTITIES_WITH_VERSION.has(mutation.entityType)

    if (mutation.operation === 'create') {
      const insertQuery = supabase.from(table).insert({
        ...values,
        id: mutation.entityId,
        // Derived from the verified token, never from the payload.
        workspace_id: actor.workspaceId,
        user_id: actor.userId,
      })

      const { data, error } = hasVersion
        ? await insertQuery.select('version').single()
        : await insertQuery.select('id').single()

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

      const rowWithVersion = data && 'version' in data ? (data as { version: unknown }) : null
      return { entityVersion: Number(rowWithVersion?.version ?? 1) }
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
      hasVersion &&
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

    let updateQuery = supabase
      .from(table)
      .update(values)
      .eq('id', mutation.entityId)
      .eq('workspace_id', actor.workspaceId)

    if (hasVersion && mutation.expectedVersion !== undefined) {
      updateQuery = updateQuery.eq('version', mutation.expectedVersion)
    }

    const { data, error } = hasVersion
      ? await updateQuery.select('version').maybeSingle()
      : await updateQuery.select('id').maybeSingle()

    if (error) {
      // The finalized-invoice guard trigger raises this.
      if (error.code === '23001' || /finalized/i.test(error.message)) {
        throw new SyncError('immutable', error.message)
      }
      throw new SyncError('validation_failed', error.message)
    }

    // If expectedVersion was passed but 0 rows matched (a concurrent write changed
    // the version between readRow and update), file the conflict and report it.
    if (hasVersion && mutation.expectedVersion !== undefined && !data) {
      const latest = await this.readRow(table, mutation.entityId, actor.workspaceId)
      await this.fileConflict(actor, mutation, latest ?? current)
      throw new SyncError(
        'version_conflict',
        `expected version ${mutation.expectedVersion}, server has ${latest?.version ?? 'concurrent update'}`,
        latest ?? current,
      )
    }

    const updatedWithVersion = data && 'version' in data ? (data as { version: unknown }) : null
    return { entityVersion: Number(updatedWithVersion?.version ?? 1) }
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
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    // A failed read is not «no such row»: answered as null it became
    // `not_found` or a version of null, and a retryable outage was reported to
    // the device as a permanent refusal.
    if (error) throw new SyncError('server_error', `read ${table} failed: ${error.message}`)
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
    const { data, error } = await supabase
      .from('sync_change_log')
      .select('sync_version')
      .eq('workspace_id', workspaceId)
      .order('sync_version', { ascending: false })
      .limit(1)
      .maybeSingle()

    // 0 means «nothing has ever changed here» — never «the query failed».
    if (error) throw new Error(`sync cursor read failed: ${error.message}`)
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
    //
    // ⚠️ N-36 — THE COMMIT HORIZON IS THE ONLY SOURCE (P1).
    //
    // `sync_pull_changes` returns only log rows whose writing transaction has
    // committed (`txid < pg_snapshot_xmin(pg_current_snapshot())`). A direct
    // read of `sync_change_log` returns everything visible, including ids whose
    // neighbours are still in flight — which is the exact hazard the horizon
    // exists to remove.
    //
    // So there is deliberately NO fallback here. The fallback used to run
    // precisely when the horizon answered «nothing yet», i.e. while a writer
    // was open, and handed back the rows the horizon had just hidden. And an
    // RPC error was swallowed, so a database without the migration silently
    // ran the unsafe path forever.
    //
    // A missing function is a DEPLOYMENT error, not a data condition: it says
    // the backend is ahead of the schema. It fails loudly and stays failed.
    const rpcRes = await supabase.rpc('sync_pull_changes', {
      p_workspace_id: workspaceId,
      p_cursor: cursor,
      p_limit: limit + 1,
    })

    if (rpcRes.error) {
      if (isMissingFunction(rpcRes.error)) {
        throw new SyncError(
          'server_error',
          'sync_pull_changes missing — apply docs/sync-commit-horizon-migration.sql',
        )
      }
      throw new SyncError('server_error', `sync pull failed: ${rpcRes.error.message}`)
    }

    const rows = (rpcRes.data ?? []) as Record<string, unknown>[]
    const hasMoreRows = rows.length > limit
    const page = hasMoreRows ? rows.slice(0, limit) : rows

    if (page.length === 0) {
      return { changes: [], nextCursor: cursor, hasMore: false, mustRehydrate: false }
    }

    const changes = await this.hydrate(workspaceId, page, excludeDevice)
    const nextCursor = Number(page[page.length - 1]?.sync_version ?? cursor)
    const hasMore = hasMoreRows && nextCursor > cursor

    return {
      changes,
      nextCursor,
      hasMore,
      mustRehydrate: false,
    }
  }

  /**
   * One page of a full rebuild, in id order (request #153: «gap too big →
   * snapshot → resume delta»).
   *
   * The same lean columns as a pull — including `version`, which the REST
   * list endpoints do not return. A device seeded from those stored every row
   * at the default version, and its first offline edit of anything the server
   * had changed before was refused as a version conflict.
   *
   * Keyset by id, not offset: rows written during the walk cannot shift a page
   * boundary and make a row be skipped. The caller reads the head BEFORE the
   * walk, so anything written meanwhile is pulled again as a delta.
   */
  async snapshot(
    workspaceId: string,
    entity: SyncEntity,
    after: string | null,
    limit: number,
  ): Promise<{ rows: Record<string, unknown>[]; nextAfter: string | null; hasMore: boolean }> {
    const columns = PULL_COLUMNS[entity]
    if (!columns) throw new SyncError('validation_failed', `no snapshot for ${entity}`)

    let query = supabase
      .from(ENTITY_TABLE[entity])
      .select(columns.join(', '))
      .eq('workspace_id', workspaceId)
      .order('id', { ascending: true })
      .limit(limit + 1)
    if (after) query = query.gt('id', after)

    // The operational window (F2): the last N days, plus every invoice that is
    // still open. The filter is deliberately OVER-INCLUSIVE: an invoice whose
    // status word this server does not know stays in the set rather than
    // disappearing from the device — and so does one whose date or status is
    // unreadable, because a sale dropped from the device is a sale the shop
    // cannot see.
    if (entity === 'invoice') {
      const cutoff = new Date(Date.now() - OPERATIONAL_WINDOW_DAYS * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
      query = query.or(
        `date.gte.${cutoff},date.is.null,and(status.neq.paid,status.neq.cancelled),status.is.null`,
      )
    }

    const { data, error } = await query
    // A COLUMN THIS SERVER DOES NOT HAVE IS "NOT CONFIGURED", NOT A 500. The
    // operational pull adds columns a server that has not run the migration
    // does not have; the device then reads nothing for that table instead of
    // every pull failing.
    if (error && isMissingColumn(error)) {
      return { rows: [], nextAfter: null, hasMore: false }
    }
    // A failed page is an error, never an empty table — an empty snapshot
    // would tell the device it has no customers (P0).
    if (error) throw new Error(`sync snapshot ${entity} failed: ${error.message}`)

    const rows = (data ?? []) as unknown as Record<string, unknown>[]
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    if (entity === 'invoice') await attachInvoiceItems(page)
    return {
      rows: page,
      nextAfter: hasMore ? String(page[page.length - 1]?.id ?? '') || null : null,
      hasMore,
    }
  }

  private async isBehindHorizon(workspaceId: string, cursor: number): Promise<boolean> {
    const { data, error } = await supabase
      .from('sync_change_log')
      .select('sync_version')
      .eq('workspace_id', workspaceId)
      .order('sync_version', { ascending: true })
      .limit(1)
      .maybeSingle()

    // Read as «not behind», a failure let a client whose cursor HAD fallen off
    // the log carry on pulling from a hole instead of rebuilding.
    if (error) throw new Error(`sync horizon read failed: ${error.message}`)
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
   *
   * ⚠️ A FAILED QUERY THROWS — IT IS NEVER `data: null` (P0, 27 Sep 2026).
   * The error used to be ignored, so every change in a failed type went out
   * with `data: null`. Clients read that as a delete (desktop:
   * `if (!change.data)`), removed the row from the offline copy and moved
   * their cursor past it — one transient database error emptied products or
   * customers until each row happened to change again. Throwing turns the
   * pull into a 500; the cursor stays where it was and the next pull retries.
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
      const columns = PULL_COLUMNS[type]
      const { data, error } = await supabase
        .from(ENTITY_TABLE[type])
        .select(columns ? columns.join(', ') : '*')
        .eq('workspace_id', workspaceId)
        .in('id', [...ids])

      if (error) throw new Error(`sync hydrate ${type} failed: ${error.message}`)

      // A column list built at runtime has no static row type; the rows are
      // plain records either way.
      const rows = (data ?? []) as unknown as Record<string, unknown>[]
      if (type === 'invoice') await attachInvoiceItems(rows)
      for (const row of rows) {
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
