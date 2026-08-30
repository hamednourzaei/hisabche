// ============================================
// packages/sync/src/gc.ts
//
// Local storage lifecycle. Evicts local REPLICAS. Never touches the server.
//
// ─────────────────────────────────────────────────────────────────────────
// THE ONE RULE
//
//   LOCAL DELETE  ≠  SERVER DELETE
//
// This module calls `storage.deleteEntity()`, which removes a row from the
// device. It NEVER calls `mutateLocal({ operation: 'delete' })`, which would
// enqueue an instruction telling the server to destroy accounting history.
//
// Those two are one keystroke apart and worlds apart in consequence. A bug
// that confused them would delete a shopkeeper's books because their laptop
// was running low on disk. So the boundary is enforced structurally: this file
// does not import `mutateLocal`, and a test asserts the outbox stays empty
// across every eviction path.
// ─────────────────────────────────────────────────────────────────────────
//
// WHAT MAY BE EVICTED
//
// Only rows that are safe replicas of server state:
//
//   * not referenced by any queued mutation;
//   * not locally modified and unacknowledged (`pending`);
//   * older than the retention window;
//   * outside the "recent" working set the UI needs offline.
//
// A local miss after eviction is not data loss — it is a cache miss, and
// `hydrateEntity` fetches that row back on demand.
// ============================================

import type { SyncEntity } from '@hisabche/validation'

import type { LocalEntity, OutboxRecord, StorageAdapter } from './types'

export interface RetentionPolicy {
  /**
   * Rows newer than this are never evicted, so the offline working set stays
   * intact. A shopkeeper opening the app on a dead connection must still see
   * this month's invoices.
   */
  keepDays: number
  /**
   * Hard ceiling per entity type. Even inside the window, the newest N are
   * kept and the rest become eligible — a device with 50,000 invoices should
   * not hold all of them.
   */
  maxRows: number
}

/**
 * Defaults chosen around how the product is actually used.
 *
 * 90 days covers a quarter, which is the longest period a shopkeeper routinely
 * scrolls back through without deliberately going looking for history.
 * Anything older is reachable, just not resident.
 */
export const DEFAULT_RETENTION: Record<SyncEntity, RetentionPolicy> = {
  // Financial documents: the most likely to be revisited, so kept longest.
  invoice: { keepDays: 90, maxRows: 2000 },
  // Parties are small, referenced constantly, and awkward to miss. Effectively
  // never evicted by age.
  customer: { keepDays: 3650, maxRows: 5000 },
  product: { keepDays: 3650, maxRows: 5000 },
  transaction: { keepDays: 90, maxRows: 5000 },
  // Kept as long as invoices: unbilled hours from three months ago are still
  // owed, and a timesheet evicted before it is billed is money written off by
  // a cache policy.
  time_entry: { keepDays: 90, maxRows: 5000 },
}

export interface GcOptions {
  storage: StorageAdapter
  workspaceId: string
  retention?: Partial<Record<SyncEntity, RetentionPolicy>>
  now?: () => number
  log?: (event: string, data: Record<string, unknown>) => void
}

export interface GcReport {
  scanned: number
  evicted: number
  /** Kept because a queued mutation still refers to them. */
  protectedByOutbox: number
  /** Kept because they carry unacknowledged local edits. */
  protectedByPending: number
  perType: Partial<Record<SyncEntity, number>>
  durationMs: number
}

/** Every row id any queued mutation touches, whatever its status. */
function protectedIds(outbox: OutboxRecord[]): Set<string> {
  const ids = new Set<string>()

  for (const record of outbox) {
    // Deliberately not filtered by status. A `failed` or `conflict` record is
    // still a decision the user has not made yet, and evicting the row it
    // refers to would leave them resolving a conflict against nothing.
    ids.add(`${record.entityType}:${record.entityId}`)
  }

  return ids
}

function rowTimestamp(entity: LocalEntity): number {
  // Prefer the business date the server set; fall back to when we stored it.
  const candidates = [entity.data.updated_at, entity.data.created_at, entity.data.date]

  for (const value of candidates) {
    if (typeof value === 'string') {
      const parsed = Date.parse(value)
      if (!Number.isNaN(parsed)) return parsed
    }
  }

  return entity.updatedAt
}

/**
 * Evict what is safe to evict.
 *
 * Returns a report rather than logging and forgetting, so a caller can surface
 * "freed 1,240 rows" and a test can assert exactly what happened.
 */
export async function collectGarbage(options: GcOptions): Promise<GcReport> {
  const { storage, workspaceId, now = () => Date.now(), log } = options
  const started = now()

  const retention: Record<SyncEntity, RetentionPolicy> = {
    ...DEFAULT_RETENTION,
    ...(options.retention ?? {}),
  } as Record<SyncEntity, RetentionPolicy>

  const outbox = await storage.listOutbox(workspaceId)
  const shielded = protectedIds(outbox)

  const report: GcReport = {
    scanned: 0,
    evicted: 0,
    protectedByOutbox: 0,
    protectedByPending: 0,
    perType: {},
    durationMs: 0,
  }

  const types = Object.keys(retention) as SyncEntity[]

  for (const type of types) {
    const policy = retention[type]
    const rows = await storage.listEntities(workspaceId, type)
    report.scanned += rows.length

    const cutoff = now() - policy.keepDays * 24 * 60 * 60 * 1000

    // Newest first, so "keep the newest N" is a slice.
    const ordered = [...rows].sort((a, b) => rowTimestamp(b) - rowTimestamp(a))

    for (const [index, entity] of ordered.entries()) {
      // ── Guard 1: a queued mutation refers to this row. ─────────────────
      if (shielded.has(`${type}:${entity.id}`)) {
        report.protectedByOutbox += 1
        continue
      }

      // ── Guard 2: unacknowledged local edit. Evicting this would discard
      //    the user's own unsent work, which is data loss, not caching. ───
      if (entity.pending) {
        report.protectedByPending += 1
        continue
      }

      // ── Guard 3: a row that has never synced has no server copy to
      //    re-fetch. It exists only here, so it is not a replica. ─────────
      if (entity.version <= 0) {
        report.protectedByPending += 1
        continue
      }

      const tooOld = rowTimestamp(entity) < cutoff
      const beyondCap = index >= policy.maxRows

      if (!tooOld && !beyondCap) continue

      // Local eviction. NOT a mutation — nothing is enqueued, the server is
      // never told, and the row remains fully intact in PostgreSQL.
      await storage.deleteEntity(workspaceId, type, entity.id)

      report.evicted += 1
      report.perType[type] = (report.perType[type] ?? 0) + 1
    }
  }

  report.durationMs = now() - started

  log?.('sync.gc', {
    workspaceId,
    scanned: report.scanned,
    evicted: report.evicted,
    protectedByOutbox: report.protectedByOutbox,
    protectedByPending: report.protectedByPending,
    durationMs: report.durationMs,
  })

  return report
}

/* ═══════════════════════════════════════════════════════════════════════════
   Targeted hydration — the other half of eviction
   ═══════════════════════════════════════════════════════════════════════════ */

export interface HydrationSource {
  /**
   * Fetch specific rows the local database does not have.
   *
   * A read-only server call. It exists so that eviction is invisible to the
   * user: a local miss becomes a fetch, not an empty screen.
   */
  fetchEntities(
    entityType: SyncEntity,
    ids: string[],
  ): Promise<Array<{ id: string; data: Record<string, unknown>; version: number }>>
}

/**
 * Fetch rows that are not resident, store them, and return everything asked
 * for.
 *
 * Hydrated rows land with `pending: false` and their server version, so they
 * are indistinguishable from rows that arrived by delta — including being
 * eligible for eviction again later.
 */
export async function hydrateEntities(
  storage: StorageAdapter,
  source: HydrationSource,
  workspaceId: string,
  entityType: SyncEntity,
  ids: string[],
): Promise<LocalEntity[]> {
  const resident: LocalEntity[] = []
  const missing: string[] = []

  for (const id of ids) {
    const local = await storage.getEntity(workspaceId, entityType, id)
    if (local) resident.push(local)
    else missing.push(id)
  }

  if (missing.length === 0) return resident

  const fetched = await source.fetchEntities(entityType, missing)

  for (const row of fetched) {
    const entity: LocalEntity = {
      id: row.id,
      workspaceId,
      entityType,
      data: row.data,
      version: row.version,
      // Server-sourced and unmodified: a replica, not a local edit.
      pending: false,
      updatedAt: Date.now(),
    }

    await storage.putEntity(entity)
    resident.push(entity)
  }

  return resident
}

/* ═══════════════════════════════════════════════════════════════════════════
   Scheduling
   ═══════════════════════════════════════════════════════════════════════════ */

export interface GcSchedulerOptions extends GcOptions {
  /** How often to consider running. Default: every 6 hours. */
  intervalMs?: number
}

/**
 * Run the collector periodically, and once shortly after startup.
 *
 * Deliberately unhurried. Eviction is never urgent — a device that is a little
 * fuller than ideal costs nothing, whereas GC competing with a user's first
 * interaction costs them a slow app.
 */
export function startGcScheduler(options: GcSchedulerOptions): () => void {
  const interval = options.intervalMs ?? 6 * 60 * 60 * 1000

  // Long enough after boot to be well clear of the first sync and first paint.
  const initial = setTimeout(() => void collectGarbage(options), 60_000)
  const repeating = setInterval(() => void collectGarbage(options), interval)

  return () => {
    clearTimeout(initial)
    clearInterval(repeating)
  }
}
