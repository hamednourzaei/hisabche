// ============================================
// packages/local-engine/src/sync/sync-state-machine.ts
//
// Explicit 6-State Mutation Lifecycle & Observability
// Guarantees auditable, observable, and recoverable sync
// states for every local-first user action.
// ============================================

import type { LocalDb } from '../db'

export type MutationSyncState =
  'local_pending' | 'syncing' | 'server_committed' | 'conflict' | 'rejected' | 'reconciled'

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
        conflict_details TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_lifecycle_state ON sync_mutation_lifecycle(workspace_id, user_id, state);
    `)
  }

  /**
   * Records a local-first mutation commit.
   * Commits to SQLite locally before network transmission.
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

    this.db.run(
      `INSERT INTO sync_mutation_lifecycle (
        client_id, entity, operation, user_id, workspace_id, state, attempts, idempotency_key, local_committed_at
      ) VALUES (?, ?, ?, ?, ?, 'local_pending', 0, ?, ?)
      ON CONFLICT(client_id) DO UPDATE SET
        state = 'local_pending',
        attempts = 0,
        last_error = NULL`,
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
  }

  /**
   * Marks a mutation as actively syncing in-flight.
   */
  public markSyncing(clientId: string): void {
    this.db.run(
      `UPDATE sync_mutation_lifecycle
       SET state = 'syncing', attempts = attempts + 1
       WHERE client_id = ?`,
      [clientId],
    )
  }

  /**
   * Confirms that the server committed the mutation.
   * Records server timestamp and transitions state to server_committed.
   */
  public markServerCommitted(clientId: string, serverTimestamp?: string): void {
    const timestamp = serverTimestamp ?? new Date().toISOString()
    this.db.run(
      `UPDATE sync_mutation_lifecycle
       SET state = 'server_committed', server_committed_at = ?, last_error = NULL
       WHERE client_id = ?`,
      [timestamp, clientId],
    )
  }

  /**
   * Marks a conflict requiring inspection or domain reconciliation.
   */
  public markConflict(clientId: string, conflictDetails: string): void {
    this.db.run(
      `UPDATE sync_mutation_lifecycle
       SET state = 'conflict', conflict_details = ?
       WHERE client_id = ?`,
      [conflictDetails, clientId],
    )
  }

  /**
   * Marks a mutation as rejected by the server (e.g. permission revoked).
   */
  public markRejected(clientId: string, error: string): void {
    this.db.run(
      `UPDATE sync_mutation_lifecycle
       SET state = 'rejected', last_error = ?
       WHERE client_id = ?`,
      [error, clientId],
    )
  }

  /**
   * Resolves a conflicted or rejected mutation through explicit reconciliation.
   */
  public markReconciled(clientId: string): void {
    this.db.run(
      `UPDATE sync_mutation_lifecycle
       SET state = 'reconciled'
       WHERE client_id = ?`,
      [clientId],
    )
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
