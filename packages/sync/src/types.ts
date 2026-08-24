// ============================================
// packages/sync/src/types.ts
//
// The storage contract the sync engine is written against.
//
// One engine, three platforms. Web has IndexedDB, desktop has SQLite behind
// IPC, mobile has SQLite directly — but none of that belongs in the protocol.
// Each platform implements this interface and gets the same outbox lifecycle,
// the same cursor safety and the same retry policy, which is the only way
// "the same logical sync protocol on mobile" can be true rather than aspired
// to.
//
// THE ONE HARD REQUIREMENT
//
// `applyPullAtomically` must commit the entity writes AND the cursor advance
// in a single durable transaction. If a platform cannot do that, it cannot
// implement this interface — a cursor that advances independently of the data
// it describes turns any crash into permanently missed changes.
// ============================================

import type {
  SyncChange,
  SyncEntity,
  SyncErrorCode,
  SyncMutation,
  SyncOperation,
} from '@hisabche/validation'

/* ═══════════════════════════════════════════════════════════════════════════
   Outbox
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Where a local mutation is in its life.
 *
 *   pending   → written locally, not yet sent
 *   in_flight → sent, no answer yet. NOT a terminal state: a crash here must
 *               return it to `pending`, because "we do not know" is different
 *               from "it failed".
 *   acked     → the server confirmed it. Safe to archive.
 *   retry     → failed in a way that may succeed later; `nextRetryAt` set.
 *   conflict  → the server has a newer version. Needs the user or a merge.
 *   failed    → will never succeed unchanged. Surfaced, never retried.
 */
export type OutboxStatus = 'pending' | 'in_flight' | 'acked' | 'retry' | 'conflict' | 'failed'

export interface OutboxRecord {
  /** Stable across every retry. Generated once, never regenerated. */
  mutationId: string
  workspaceId: string
  entityType: SyncEntity
  entityId: string
  operation: SyncOperation
  payload: Record<string, unknown>
  /** What the client believed the server version was. Absent for a create. */
  expectedVersion?: number
  status: OutboxStatus
  attemptCount: number
  createdAt: number
  /** Epoch ms; the scheduler will not touch the record before this. */
  nextRetryAt?: number
  lastError?: string
  lastErrorCode?: SyncErrorCode
  /** Which batch carried it last. Purely for tracing a mutation through logs. */
  batchId?: string
}

/* ═══════════════════════════════════════════════════════════════════════════
   Local entities
   ═══════════════════════════════════════════════════════════════════════════ */

export interface LocalEntity {
  id: string
  workspaceId: string
  entityType: SyncEntity
  /** The row as the server would return it. */
  data: Record<string, unknown>
  /** Server version, or 0 for a row that has never round-tripped. */
  version: number
  /**
   * True while a local mutation for this row is unacknowledged.
   *
   * The UI reads it to show "not yet saved", and the pull path reads it to
   * avoid overwriting a local edit with a server row that predates it.
   */
  pending: boolean
  updatedAt: number
}

/* ═══════════════════════════════════════════════════════════════════════════
   Storage adapter
   ═══════════════════════════════════════════════════════════════════════════ */

export interface StorageAdapter {
  // ── entities ────────────────────────────────────────────────────────────
  getEntity(workspaceId: string, type: SyncEntity, id: string): Promise<LocalEntity | null>
  listEntities(workspaceId: string, type: SyncEntity): Promise<LocalEntity[]>
  putEntity(entity: LocalEntity): Promise<void>
  deleteEntity(workspaceId: string, type: SyncEntity, id: string): Promise<void>

  // ── outbox ──────────────────────────────────────────────────────────────
  /**
   * Persist a local edit and its outbox record TOGETHER.
   *
   * Atomic on purpose: an entity written without its outbox record is a change
   * the server never hears about, and an outbox record without its entity is a
   * mutation describing a row the user cannot see.
   */
  enqueue(entity: LocalEntity, record: OutboxRecord): Promise<void>

  /** Records ready to send now: pending, or retry whose backoff has elapsed. */
  claimSendable(workspaceId: string, limit: number, now: number): Promise<OutboxRecord[]>

  updateOutbox(mutationId: string, patch: Partial<OutboxRecord>): Promise<void>
  removeOutbox(mutationId: string): Promise<void>
  listOutbox(workspaceId: string): Promise<OutboxRecord[]>

  /**
   * Return every `in_flight` record to `pending`.
   *
   * Called once at startup. A record left `in_flight` by a crash is a mutation
   * whose fate is unknown; the mutation_id makes resending it safe, and NOT
   * resending it would lose it silently. Recovering beats guessing.
   */
  recoverInFlight(workspaceId: string): Promise<number>

  // ── cursor ──────────────────────────────────────────────────────────────
  getCursor(workspaceId: string): Promise<number>

  /**
   * Apply a delta page and advance the cursor in ONE transaction.
   *
   * The single most important method here. See the file header.
   */
  applyPullAtomically(workspaceId: string, changes: SyncChange[], nextCursor: number): Promise<void>

  /** Wipe local state for a workspace — used when the server says re-hydrate. */
  clearWorkspace(workspaceId: string): Promise<void>
}

/* ═══════════════════════════════════════════════════════════════════════════
   Transport
   ═══════════════════════════════════════════════════════════════════════════ */

export interface PushOutcome {
  mutationId: string
  status: 'applied' | 'rejected'
  entityVersion?: number
  duplicate: boolean
  errorCode?: SyncErrorCode
  errorMessage?: string
  retryable: boolean
  serverState?: Record<string, unknown>
}

export interface Transport {
  push(
    batchId: string,
    deviceId: string,
    mutations: SyncMutation[],
  ): Promise<{ results: PushOutcome[]; currentCursor: number }>

  pull(
    cursor: number,
    limit: number,
    deviceId: string,
  ): Promise<{
    changes: SyncChange[]
    nextCursor: number
    hasMore: boolean
    mustRehydrate: boolean
  }>
}

/* ═══════════════════════════════════════════════════════════════════════════
   Engine surface
   ═══════════════════════════════════════════════════════════════════════════ */

export type SyncPhase = 'idle' | 'pushing' | 'pulling' | 'offline' | 'error'

export interface SyncState {
  phase: SyncPhase
  /** Unacknowledged local mutations. The number a user cares about. */
  pendingCount: number
  conflictCount: number
  failedCount: number
  cursor: number
  lastSyncedAt: number | null
  lastError: string | null
}

export type SyncListener = (state: SyncState) => void

export interface SyncEngineOptions {
  workspaceId: string
  deviceId: string
  storage: StorageAdapter
  transport: Transport
  /** Mutations per push. Bounded so a batch cannot time out halfway. */
  batchSize?: number
  /** Changes per pull page. */
  pullLimit?: number
  /** Quiet period after a mutation before pushing, so typing does not spam. */
  debounceMs?: number
  /** Sync at least this often even with no trigger. */
  maxIntervalMs?: number
  /** Give up retrying after this many attempts. */
  maxAttempts?: number
  /** Injectable for tests. */
  now?: () => number
  isOnline?: () => boolean
  log?: (event: string, data: Record<string, unknown>) => void
}
