// ============================================
// packages/local-engine/src/sync/sync-state-machine.ts
//
// Strict 6-State Mutation Lifecycle & Observability
// Enforces explicit valid transition edges, atomic state checks in SQLite,
// duplicate-commit idempotency without state reset, and retry backoff tracking.
// ============================================

import type { LocalDb } from '../db'

export type MutationSyncState =
  'local_pending' | 'syncing' | 'server_committed' | 'conflict' | 'rejected' | 'reconciled'

export class InvalidSyncTransitionError extends Error {
  public readonly code = 'ERR_INVALID_SYNC_TRANSITION'
  constructor(
    public readonly clientId: string,
    public readonly fromState: MutationSyncState | 'missing',
    public readonly toState: MutationSyncState,
    reason?: string,
  ) {
    super(
      reason ??
        `Invalid sync state transition for '${clientId}': '${fromState}' -> '${toState}' is forbidden.`,
    )
    this.name = 'InvalidSyncTransitionError'
  }
}

export const ALLOWED_SYNC_TRANSITIONS: Record<MutationSyncState, readonly MutationSyncState[]> = {
  local_pending: ['syncing', 'conflict', 'rejected'],
  syncing: ['server_committed', 'conflict', 'rejected', 'local_pending'],
  conflict: ['syncing', 'reconciled', 'rejected'],
  rejected: ['reconciled'],
  server_committed: ['reconciled'],
  reconciled: [],
}

export interface MutationLifecycleRecord {
  readonly clientId: string
  readonly entity: string
  readonly operation: string
  readonly userId: string
  readonly workspaceId: string
  readonly state: MutationSyncState
  readonly attempts: number
  readonly idempotencyKey: string
  readonly localCommittedAt: string
  readonly serverCommittedAt?: string | undefined
  readonly lastError?: string | undefined
  readonly conflictDetails?: string | undefined
  readonly nextRetryAt?: string | undefined
}

export interface SyncObservabilitySummary {
  readonly totalMutations: number
  readonly localPendingCount: number
  readonly syncingCount: number
  readonly serverCommittedCount: number
  readonly conflictCount: number
  readonly rejectedCount: number
  readonly reconciledCount: number
  readonly oldestPendingSeconds: number | null
}

interface RawLifecycleRow {
  client_id: string
  entity: string
  operation: string
  user_id: string
  workspace_id: string
  state: MutationSyncState
  attempts: number
  idempotency_key: string
  local_committed_at: string
  server_committed_at: string | null
  last_error: string | null
  conflict_details: string | null
  next_retry_at: string | null
}

function mapRow(row: RawLifecycleRow): MutationLifecycleRecord {
  return {
    clientId: row.client_id,
    entity: row.entity,
    operation: row.operation,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    state: row.state,
    attempts: row.attempts,
    idempotencyKey: row.idempotency_key,
    localCommittedAt: row.local_committed_at,
    serverCommittedAt: row.server_committed_at ?? undefined,
    lastError: row.last_error ?? undefined,
    conflictDetails: row.conflict_details ?? undefined,
    nextRetryAt: row.next_retry_at ?? undefined,
  }
}

export class SyncStateMachine {
  constructor(private db: LocalDb) {
    this.ensureSchema()
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_mutation_lifecycle (
        client_id TEXT PRIMARY KEY,
        entity TEXT NOT NULL,
        operation TEXT NOT NULL,
        user_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'local_pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        idempotency_key TEXT NOT NULL,
        local_committed_at TEXT NOT NULL,
        server_committed_at TEXT,
        last_error TEXT,
        conflict_details TEXT,
        next_retry_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_lifecycle_state ON sync_mutation_lifecycle(workspace_id, user_id, state);
    `)
    const cols = this.db.all<{ name: string }>(`PRAGMA table_info(sync_mutation_lifecycle)`)
    if (!cols.some((c) => c.name === 'next_retry_at')) {
      this.db.exec(`ALTER TABLE sync_mutation_lifecycle ADD COLUMN next_retry_at TEXT`)
    }
  }

  public getMutation(clientId: string): MutationLifecycleRecord | null {
    const row = this.db.get<RawLifecycleRow>(
      `SELECT * FROM sync_mutation_lifecycle WHERE client_id = ?`,
      [clientId],
    )
    return row ? mapRow(row) : null
  }

  /**
   * Records a local-first mutation commit safely.
   * Refuses resetting an already in-flight, committed, conflicted, or reconciled
   * `clientId`, preserving attempts and state on idempotent replays.
   */
  public recordLocalCommit(record: {
    clientId: string
    entity: string
    operation: string
    userId: string
    workspaceId: string
    idempotencyKey?: string | undefined
  }): MutationLifecycleRecord {
    const now = new Date().toISOString()
    const idempotencyKey = record.idempotencyKey ?? `${record.clientId}:${record.userId}`

    return this.db.transaction(() => {
      const existing = this.db.get<RawLifecycleRow>(
        `SELECT * FROM sync_mutation_lifecycle WHERE client_id = ?`,
        [record.clientId],
      )

      if (existing) {
        const sameIdentity =
          existing.idempotency_key === idempotencyKey &&
          existing.entity === record.entity &&
          existing.operation === record.operation &&
          existing.workspace_id === record.workspaceId &&
          existing.user_id === record.userId

        if (
          sameIdentity &&
          (existing.state === 'local_pending' ||
            existing.state === 'server_committed' ||
            existing.state === 'reconciled')
        ) {
          return mapRow(existing)
        }

        throw new InvalidSyncTransitionError(
          record.clientId,
          existing.state,
          'local_pending',
          `Cannot overwrite mutation '${record.clientId}' already in state '${existing.state}'.`,
        )
      }

      this.db.run(
        `INSERT INTO sync_mutation_lifecycle (
          client_id, entity, operation, user_id, workspace_id, state, attempts, idempotency_key, local_committed_at
        ) VALUES (?, ?, ?, ?, ?, 'local_pending', 0, ?, ?)`,
        [
          record.clientId,
          record.entity,
          record.operation,
          record.userId,
          record.workspaceId,
          idempotencyKey,
          now,
        ],
      )

      return {
        clientId: record.clientId,
        entity: record.entity,
        operation: record.operation,
        userId: record.userId,
        workspaceId: record.workspaceId,
        state: 'local_pending',
        attempts: 0,
        idempotencyKey,
        localCommittedAt: now,
      }
    })
  }

  private transitionStrict(
    clientId: string,
    toState: MutationSyncState,
    sqlUpdate: string,
    extraParams: unknown[],
  ): void {
    this.db.transaction(() => {
      const existing = this.db.get<{ state: MutationSyncState }>(
        `SELECT state FROM sync_mutation_lifecycle WHERE client_id = ?`,
        [clientId],
      )
      if (!existing) {
        throw new InvalidSyncTransitionError(clientId, 'missing', toState)
      }
      const allowedNext = ALLOWED_SYNC_TRANSITIONS[existing.state]
      if (!allowedNext.includes(toState)) {
        throw new InvalidSyncTransitionError(clientId, existing.state, toState)
      }

      const res = this.db.run(sqlUpdate, [...extraParams, clientId, existing.state])
      if (res.changes !== 1) {
        throw new InvalidSyncTransitionError(
          clientId,
          existing.state,
          toState,
          `Concurrent sync state modification detected for '${clientId}'.`,
        )
      }
    })
  }

  /**
   * Transitions a pending (or resolved-conflict) mutation to actively `syncing`
   * and increments `attempts`.
   */
  public markSyncing(clientId: string): void {
    this.transitionStrict(
      clientId,
      'syncing',
      `UPDATE sync_mutation_lifecycle
       SET state = 'syncing', attempts = attempts + 1, next_retry_at = NULL
       WHERE client_id = ? AND state = ?`,
      [],
    )
  }

  /**
   * Requeues an in-flight (`syncing`) mutation back to `local_pending` after a
   * transient transport failure, recording its next backoff eligibility timestamp.
   */
  public requeueForRetry(
    clientId: string,
    error: string,
    backoffMs: number,
    nowMs: number = Date.now(),
  ): void {
    const nextRetryAt = new Date(nowMs + Math.max(0, backoffMs)).toISOString()
    this.transitionStrict(
      clientId,
      'local_pending',
      `UPDATE sync_mutation_lifecycle
       SET state = 'local_pending', last_error = ?, next_retry_at = ?
       WHERE client_id = ? AND state = ?`,
      [error, nextRetryAt],
    )
  }

  /**
   * Confirms that the server committed the in-flight mutation.
   * Rejects transitions from terminal/non-syncing states.
   */
  public markServerCommitted(clientId: string, serverTimestamp?: string): void {
    const timestamp = serverTimestamp ?? new Date().toISOString()
    this.transitionStrict(
      clientId,
      'server_committed',
      `UPDATE sync_mutation_lifecycle
       SET state = 'server_committed', server_committed_at = ?, last_error = NULL, next_retry_at = NULL
       WHERE client_id = ? AND state = ?`,
      [timestamp],
    )
  }

  /**
   * Marks a conflict requiring inspection or domain reconciliation.
   */
  public markConflict(clientId: string, conflictDetails: string): void {
    this.transitionStrict(
      clientId,
      'conflict',
      `UPDATE sync_mutation_lifecycle
       SET state = 'conflict', conflict_details = ?, next_retry_at = NULL
       WHERE client_id = ? AND state = ?`,
      [conflictDetails],
    )
  }

  /**
   * Marks a mutation as rejected by the server (e.g. permission revoked).
   */
  public markRejected(clientId: string, error: string): void {
    this.transitionStrict(
      clientId,
      'rejected',
      `UPDATE sync_mutation_lifecycle
       SET state = 'rejected', last_error = ?, next_retry_at = NULL
       WHERE client_id = ? AND state = ?`,
      [error],
    )
  }

  /**
   * Resolves a conflicted, rejected, or server-committed mutation through explicit reconciliation.
   */
  public markReconciled(clientId: string): void {
    this.transitionStrict(
      clientId,
      'reconciled',
      `UPDATE sync_mutation_lifecycle
       SET state = 'reconciled', next_retry_at = NULL
       WHERE client_id = ? AND state = ?`,
      [],
    )
  }

  /**
   * Lists pending mutations whose retry backoff window has elapsed.
   */
  public getDispatchablePending(
    workspaceId: string,
    userId?: string,
    nowIso: string = new Date().toISOString(),
  ): MutationLifecycleRecord[] {
    let sql = `
      SELECT * FROM sync_mutation_lifecycle
      WHERE workspace_id = ?
        AND state = 'local_pending'
        AND (next_retry_at IS NULL OR next_retry_at <= ?)
    `
    const params: unknown[] = [workspaceId, nowIso]
    if (userId) {
      sql += ` AND user_id = ?`
      params.push(userId)
    }
    sql += ` ORDER BY local_committed_at ASC`
    return this.db.all<RawLifecycleRow>(sql, params).map(mapRow)
  }

  /**
   * Exposes observability metrics for UI dashboards and health reporting.
   */
  public getObservabilitySummary(workspaceId: string, userId?: string): SyncObservabilitySummary {
    let sql = `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN state = 'local_pending' THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN state = 'syncing' THEN 1 ELSE 0 END) AS syncing_count,
        SUM(CASE WHEN state = 'server_committed' THEN 1 ELSE 0 END) AS committed_count,
        SUM(CASE WHEN state = 'conflict' THEN 1 ELSE 0 END) AS conflict_count,
        SUM(CASE WHEN state = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
        SUM(CASE WHEN state = 'reconciled' THEN 1 ELSE 0 END) AS reconciled_count,
        MIN(CASE WHEN state = 'local_pending' THEN local_committed_at ELSE NULL END) AS oldest_pending
      FROM sync_mutation_lifecycle
      WHERE workspace_id = ?
    `
    const params: unknown[] = [workspaceId]
    if (userId) {
      sql += ` AND user_id = ?`
      params.push(userId)
    }

    const row = this.db.get<{
      total: number
      pending_count: number
      syncing_count: number
      committed_count: number
      conflict_count: number
      rejected_count: number
      reconciled_count: number
      oldest_pending: string | null
    }>(sql, params)

    const now = Date.now()
    const oldestPendingSeconds = row?.oldest_pending
      ? Math.max(0, Math.floor((now - new Date(row.oldest_pending).getTime()) / 1000))
      : null

    return {
      totalMutations: row?.total ?? 0,
      localPendingCount: row?.pending_count ?? 0,
      syncingCount: row?.syncing_count ?? 0,
      serverCommittedCount: row?.committed_count ?? 0,
      conflictCount: row?.conflict_count ?? 0,
      rejectedCount: row?.rejected_count ?? 0,
      reconciledCount: row?.reconciled_count ?? 0,
      oldestPendingSeconds,
    }
  }
}
