// ============================================
// packages/sync/src/engine.ts
//
// The client sync engine: push the outbox, pull the delta, survive crashes.
//
// It owns no storage and no HTTP. Both arrive as interfaces, which is what
// lets web, desktop and mobile run this exact file instead of three
// near-identical ones that drift.
//
// THREE RULES THIS FILE EXISTS TO ENFORCE
//
//   1. A mutation is never lost. It leaves the outbox only when the server
//      has acknowledged it, or when it has failed in a way retrying cannot
//      fix — and then it is kept and surfaced, not deleted.
//
//   2. A mutation is never applied twice. The mutation_id is generated once,
//      persisted, and reused on every retry. The server's idempotency ledger
//      does the rest.
//
//   3. The cursor never runs ahead of the data. Advancing it is the storage
//      adapter's job, in the same transaction as the changes it describes.
// ============================================

import type { SyncMutation } from '@hisabche/validation'

import type {
  OutboxRecord,
  PushOutcome,
  SyncEngineOptions,
  SyncListener,
  SyncState,
  StorageAdapter,
  Transport,
} from './types'

const DEFAULTS = {
  batchSize: 50,
  pullLimit: 200,
  debounceMs: 2000,
  maxIntervalMs: 60_000,
  maxAttempts: 8,
}

/**
 * Exponential backoff with jitter.
 *
 * The jitter matters more than the curve: without it, every client that lost
 * connectivity at the same moment retries at the same moment, and the server
 * gets a thundering herd exactly when it is least able to absorb one.
 */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(1000 * 2 ** Math.max(0, attempt - 1), 5 * 60_000)
  return Math.round(base * (0.5 + random() * 0.5))
}

/** A v4 UUID from whatever the platform offers. */
export function newId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c?.randomUUID) return c.randomUUID()

  // Deterministic fallback for environments without WebCrypto.
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export class SyncEngine {
  private readonly storage: StorageAdapter
  private readonly transport: Transport
  private readonly workspaceId: string
  private readonly deviceId: string
  private readonly opts: Required<Omit<SyncEngineOptions, 'storage' | 'transport' | 'log'>> & {
    log: (event: string, data: Record<string, unknown>) => void
  }

  private listeners = new Set<SyncListener>()
  private state: SyncState
  private running = false
  /** Set while a cycle is in flight so a trigger schedules instead of racing. */
  private queuedRun = false
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private intervalTimer: ReturnType<typeof setInterval> | null = null

  constructor(options: SyncEngineOptions) {
    this.storage = options.storage
    this.transport = options.transport
    this.workspaceId = options.workspaceId
    this.deviceId = options.deviceId

    this.opts = {
      workspaceId: options.workspaceId,
      deviceId: options.deviceId,
      batchSize: options.batchSize ?? DEFAULTS.batchSize,
      pullLimit: options.pullLimit ?? DEFAULTS.pullLimit,
      debounceMs: options.debounceMs ?? DEFAULTS.debounceMs,
      maxIntervalMs: options.maxIntervalMs ?? DEFAULTS.maxIntervalMs,
      maxAttempts: options.maxAttempts ?? DEFAULTS.maxAttempts,
      now: options.now ?? (() => Date.now()),
      isOnline: options.isOnline ?? (() => true),
      log: options.log ?? (() => {}),
    }

    this.state = {
      phase: 'idle',
      pendingCount: 0,
      conflictCount: 0,
      failedCount: 0,
      cursor: 0,
      lastSyncedAt: null,
      lastError: null,
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     Lifecycle
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Recover anything the last run left behind, then sync.
   *
   * Recovery comes FIRST and unconditionally. A record stuck `in_flight` from
   * a killed process is the single most dangerous state in the system: leave
   * it and the mutation is lost forever, resend it and — because the
   * mutation_id is stable — nothing bad happens.
   */
  async start(): Promise<void> {
    const recovered = await this.storage.recoverInFlight(this.workspaceId)
    if (recovered > 0) {
      this.opts.log('sync.recovered', { count: recovered, workspaceId: this.workspaceId })
    }

    this.state.cursor = await this.storage.getCursor(this.workspaceId)
    await this.refreshCounts()

    this.intervalTimer = setInterval(() => void this.run('interval'), this.opts.maxIntervalMs)
    await this.run('startup')
  }

  stop(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    if (this.intervalTimer) clearInterval(this.intervalTimer)
    this.debounceTimer = null
    this.intervalTimer = null
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener)

    // Guarded exactly like the broadcast path. A subscriber that throws on its
    // first call must not take down whatever was mounting it — the engine is
    // infrastructure, and a bad consumer is a consumer problem.
    try {
      listener(this.state)
    } catch {
      /* ignored — see above */
    }

    return () => this.listeners.delete(listener)
  }

  getState(): SyncState {
    return { ...this.state }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     Triggers
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * A local mutation happened.
   *
   * Debounced, so a burst of edits becomes one batch. Correctness never
   * depends on the timer: the interval, the reconnect and the next startup all
   * pick up anything the debounce missed.
   */
  schedule(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => void this.run('debounce'), this.opts.debounceMs)
  }

  /** Network came back, tab regained focus, or realtime signalled. */
  wake(reason: string): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    void this.run(reason)
  }

  /** Push and pull once. Safe to call concurrently — extra calls coalesce. */
  async run(reason: string): Promise<void> {
    if (this.running) {
      // Do not drop it: whatever prompted this may not be covered by the cycle
      // already in flight.
      this.queuedRun = true
      return
    }

    if (!this.opts.isOnline()) {
      this.setState({ phase: 'offline' })
      return
    }

    this.running = true
    const started = this.opts.now()

    try {
      await this.pushAll()
      await this.pullAll()

      this.setState({
        phase: 'idle',
        lastSyncedAt: this.opts.now(),
        lastError: null,
      })

      this.opts.log('sync.cycle', {
        reason,
        durationMs: this.opts.now() - started,
        cursor: this.state.cursor,
        pending: this.state.pendingCount,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'sync failed'
      // A failed cycle is not a failed mutation. Everything stays in the
      // outbox and the next trigger tries again.
      this.setState({ phase: 'error', lastError: message })
      this.opts.log('sync.error', { reason, error: message })
    } finally {
      this.running = false
      await this.refreshCounts()

      if (this.queuedRun) {
        this.queuedRun = false
        void this.run('coalesced')
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PUSH
     ═══════════════════════════════════════════════════════════════════════ */

  private async pushAll(): Promise<void> {
    for (;;) {
      const batch = await this.storage.claimSendable(
        this.workspaceId,
        this.opts.batchSize,
        this.opts.now(),
      )
      if (batch.length === 0) return

      this.setState({ phase: 'pushing' })
      await this.pushBatch(batch)

      // A short batch means the queue is drained.
      if (batch.length < this.opts.batchSize) return
    }
  }

  private async pushBatch(batch: OutboxRecord[]): Promise<void> {
    const batchId = newId()

    // Marked before the request, so a crash mid-flight is distinguishable from
    // a mutation that was never sent — `recoverInFlight` turns it back to
    // pending on the next start.
    for (const record of batch) {
      await this.storage.updateOutbox(record.mutationId, {
        status: 'in_flight',
        attemptCount: record.attemptCount + 1,
        batchId,
      })
    }

    const mutations: SyncMutation[] = batch.map((record) => ({
      mutationId: record.mutationId,
      entityType: record.entityType,
      entityId: record.entityId,
      operation: record.operation,
      ...(record.expectedVersion !== undefined ? { expectedVersion: record.expectedVersion } : {}),
      payload: record.payload,
    }))

    let results: PushOutcome[]

    try {
      const response = await this.transport.push(batchId, this.deviceId, mutations)
      results = response.results
    } catch (err) {
      // The transport failed as a whole — timeout, DNS, 5xx. Every mutation in
      // the batch returns to the queue with backoff. None is discarded, because
      // "we did not hear back" never means "it did not happen".
      const message = err instanceof Error ? err.message : 'push failed'
      for (const record of batch) {
        await this.scheduleRetry(record, message)
      }
      throw err
    }

    const byId = new Map(results.map((r) => [r.mutationId, r]))

    for (const record of batch) {
      const outcome = byId.get(record.mutationId)

      if (!outcome) {
        // The server answered without mentioning this mutation. Treat it as
        // unknown, not as success.
        await this.scheduleRetry(record, 'no result returned for mutation')
        continue
      }

      await this.settle(record, outcome)
    }
  }

  private async settle(record: OutboxRecord, outcome: PushOutcome): Promise<void> {
    if (outcome.status === 'applied') {
      // `duplicate` means the server replayed a stored result. From the
      // client's side that is a success — which is the entire point of the
      // idempotency ledger.
      await this.acknowledge(record, outcome.entityVersion)
      return
    }

    if (outcome.errorCode === 'version_conflict') {
      // Never auto-resolved here. A financial value cannot be merged by a
      // rule; it needs the server's row in front of a person.
      if (outcome.serverState) {
        await this.storage.putEntity({
          id: record.entityId,
          workspaceId: record.workspaceId,
          entityType: record.entityType,
          data: outcome.serverState,
          version: Number(outcome.serverState.version ?? 0),
          pending: true,
          updatedAt: this.opts.now(),
        })
      }

      await this.storage.updateOutbox(record.mutationId, {
        status: 'conflict',
        lastErrorCode: 'version_conflict',
        lastError: outcome.errorMessage ?? 'version conflict',
      })
      return
    }

    if (outcome.retryable && record.attemptCount < this.opts.maxAttempts) {
      await this.scheduleRetry(record, outcome.errorMessage ?? 'retryable failure')
      return
    }

    // Terminal. Kept in the outbox rather than deleted: a mutation the user
    // made and the server refused is something they need to be told about.
    await this.storage.updateOutbox(record.mutationId, {
      status: 'failed',
      ...(outcome.errorCode ? { lastErrorCode: outcome.errorCode } : {}),
      lastError: outcome.errorMessage ?? 'mutation rejected',
    })
  }

  private async acknowledge(record: OutboxRecord, version?: number): Promise<void> {
    const local = await this.storage.getEntity(
      record.workspaceId,
      record.entityType,
      record.entityId,
    )

    if (local) {
      await this.storage.putEntity({
        ...local,
        version: version ?? local.version,
        // Clears the "not yet saved" marker in the UI.
        pending: false,
        updatedAt: this.opts.now(),
      })
    }

    await this.storage.removeOutbox(record.mutationId)
  }

  private async scheduleRetry(record: OutboxRecord, error: string): Promise<void> {
    const attempt = record.attemptCount + 1

    if (attempt >= this.opts.maxAttempts) {
      await this.storage.updateOutbox(record.mutationId, {
        status: 'failed',
        lastError: `giving up after ${attempt} attempts: ${error}`,
      })
      return
    }

    await this.storage.updateOutbox(record.mutationId, {
      status: 'retry',
      nextRetryAt: this.opts.now() + backoffMs(attempt),
      lastError: error,
    })
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PULL
     ═══════════════════════════════════════════════════════════════════════ */

  private async pullAll(): Promise<void> {
    for (;;) {
      const cursor = await this.storage.getCursor(this.workspaceId)
      this.setState({ phase: 'pulling', cursor })

      const page = await this.transport.pull(cursor, this.opts.pullLimit, this.deviceId)

      if (page.mustRehydrate) {
        // Our cursor is older than the server's retained history, so the
        // changes we missed no longer exist to replay. Continuing would skip
        // them silently; starting over is the only correct answer.
        this.opts.log('sync.rehydrate', { workspaceId: this.workspaceId, cursor })
        await this.storage.clearWorkspace(this.workspaceId)
        continue
      }

      if (page.changes.length === 0) {
        this.setState({ cursor: page.nextCursor })
        return
      }

      // The atomicity that makes a crash here survivable: entities and cursor
      // land together or not at all.
      await this.storage.applyPullAtomically(this.workspaceId, page.changes, page.nextCursor)

      this.setState({ cursor: page.nextCursor })

      if (!page.hasMore) return
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     State
     ═══════════════════════════════════════════════════════════════════════ */

  private async refreshCounts(): Promise<void> {
    const outbox = await this.storage.listOutbox(this.workspaceId)

    this.setState({
      pendingCount: outbox.filter(
        (r) => r.status === 'pending' || r.status === 'retry' || r.status === 'in_flight',
      ).length,
      conflictCount: outbox.filter((r) => r.status === 'conflict').length,
      failedCount: outbox.filter((r) => r.status === 'failed').length,
    })
  }

  private setState(patch: Partial<SyncState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of [...this.listeners]) {
      try {
        listener(this.state)
      } catch {
        // A subscriber that throws must not stop the engine.
      }
    }
  }
}
