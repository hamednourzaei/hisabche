// ============================================
// The local cache on Android and iOS.
//
// ⚠️ THE SAME CACHE WINDOWS HAS, NOT A MOBILE ONE.
//
// The tables, the columns, the SELECT and the upsert all come from
// `@hisabche/app-bridge`; only the driver differs — better-sqlite3 there,
// expo-sqlite here. A host that wrote its own SQL would answer the same
// `db.query` differently, and the same product would show a different
// quantity depending on which machine you opened.
//
// ⚠️ THERE IS ONE QUEUE, AND IT IS THIS ONE.
//
// The app used to keep offline writes in an AsyncStorage store while the
// shared UI queued through `db.enqueue`. Two queues means an invoice written
// on the old build is invisible to the new drain — or worse, sent twice.
// `migrateLegacyOutbox()` moves anything the old store still holds into this
// table, once, and then the old store is never written again.
// ============================================

import * as SQLite from 'expo-sqlite'
import {
  CREATE_STATEMENTS,
  SCHEMA_VERSION,
  buildSelect,
  buildUpserts,
  normalizeValue,
  type LocalQueryInput,
  type LocalTable,
  type QueueEntry,
} from '@hisabche/app-bridge'

let database: SQLite.SQLiteDatabase | null = null

/**
 * Open the cache, creating it on first run.
 *
 * ⚠️ NEVER THROWS OUT. A device whose SQLite will not open must still run
 * online-only rather than fail to start — the same choice the desktop makes.
 * `isReady()` is how callers tell the two apart, so that «no cache» can be
 * reported as itself instead of as «no data» (راهنمای سشن §۷٫۳).
 */
export async function initLocalDb(): Promise<boolean> {
  if (database) return true

  try {
    const db = await SQLite.openDatabaseAsync('hisabche.db')
    await db.execAsync('PRAGMA journal_mode = WAL')
    await db.execAsync('PRAGMA foreign_keys = ON')

    for (const statement of CREATE_STATEMENTS) {
      await db.execAsync(statement)
    }
    await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [
      'schema_version',
      String(SCHEMA_VERSION),
    ])

    database = db
    return true
  } catch (error) {
    console.error('[local-db] SQLite unavailable, running online-only:', error)
    database = null
    return false
  }
}

export function isReady(): boolean {
  return database !== null
}

/**
 * ⚠️ REFUSES WHEN THERE IS NO CACHE, rather than returning an empty list.
 *
 * An empty array here would render as «this workspace has no products», which
 * is a claim about the business rather than about this device.
 */
function require_(): SQLite.SQLiteDatabase {
  if (!database) throw new Error('LOCAL_CACHE_UNAVAILABLE')
  return database
}

export async function query<T>(input: LocalQueryInput): Promise<T[]> {
  const { sql, params } = buildSelect(input)
  return (await require_().getAllAsync(sql, params as SQLite.SQLiteBindValue[])) as T[]
}

export async function upsertMany(
  table: LocalTable,
  rows: Array<Record<string, unknown>>,
): Promise<number> {
  if (rows.length === 0) return 0
  const db = require_()
  const statements = buildUpserts(table, rows)

  // One transaction for the batch: a pull that fails halfway must not leave
  // half a page of products behind, which would read as a partial catalogue.
  await db.withTransactionAsync(async () => {
    for (const statement of statements) {
      await db.runAsync(statement.sql, statement.params as SQLite.SQLiteBindValue[])
    }
  })

  return statements.length
}

/** See the desktop implementation: server-deleted rows, never a dirty one. */
export async function removeMany(table: LocalTable, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const db = require_()
  let removed = 0
  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      const result = await db.runAsync(`DELETE FROM "${table}" WHERE id = ? AND dirty = 0`, [id])
      removed += result.changes
    }
  })
  return removed
}

// ============================================
// The write queue
// ============================================

export async function enqueue(input: {
  entity: LocalTable
  operation: 'create' | 'update' | 'delete'
  clientId: string
  payload: Record<string, unknown>
}): Promise<void> {
  // `INSERT OR IGNORE` on the clientId: the shared UI retries a failed call,
  // and a retry must not become a second invoice. The clientId is also the
  // Idempotency-Key the server deduplicates on.
  await require_().runAsync(
    `INSERT OR IGNORE INTO sync_queue (client_id, entity, operation, payload, status, attempts, created_at)
     VALUES (?, ?, ?, ?, 'pending', 0, ?)`,
    [
      input.clientId,
      input.entity,
      input.operation,
      JSON.stringify(input.payload),
      new Date().toISOString(),
    ],
  )
}

interface QueueRow {
  client_id: string
  entity: string
  operation: string
  payload: string
  status: string
  attempts: number
  last_error: string | null
  created_at: string
}

export async function queue(): Promise<QueueEntry[]> {
  const rows = await require_().getAllAsync<QueueRow>(
    `SELECT * FROM sync_queue ORDER BY created_at ASC`,
  )

  return rows.map((row) => ({
    clientId: row.client_id,
    entity: row.entity,
    operation: row.operation,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    // The contract's shape exactly: `status` is only ever pending or failed —
    // there is no «syncing», because a drain that dies mid-flight must leave
    // the entry retryable, not stuck in a state nobody clears.
    status: row.status === 'failed' ? 'failed' : 'pending',
    attempts: row.attempts,
    lastError: row.last_error,
    createdAt: row.created_at,
  })) as QueueEntry[]
}

export async function resolveQueue(
  clientId: string,
  status: 'done' | 'failed',
  error?: string,
): Promise<void> {
  const db = require_()

  // ⚠️ A DONE ENTRY IS DELETED, NOT MARKED. Keeping it would replay on the
  // next drain unless every reader remembered to filter — and one that forgot
  // would send the invoice again.
  if (status === 'done') {
    await db.runAsync('DELETE FROM sync_queue WHERE client_id = ?', [clientId])
    return
  }

  await db.runAsync(
    `UPDATE sync_queue SET status = 'failed', attempts = attempts + 1, last_error = ? WHERE client_id = ?`,
    [error ?? null, clientId],
  )
}

/**
 * Point the cache at a workspace.
 *
 * ⚠️ REFUSES WHILE WRITES ARE QUEUED. Those exist nowhere but this device;
 * purging the cache around them would leave an invoice queued against a
 * workspace it can no longer be sent to.
 */
export async function setWorkspace(
  workspaceId: string,
): Promise<{ purged: boolean; blockedByPendingMutations: number }> {
  const db = require_()

  const pending = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM sync_queue WHERE status != 'done'`,
  )
  const blocked = pending?.count ?? 0
  if (blocked > 0) return { purged: false, blockedByPendingMutations: blocked }

  const current = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM meta WHERE key = 'workspace_id'`,
  )
  if (current?.value === workspaceId) return { purged: false, blockedByPendingMutations: 0 }

  await db.withTransactionAsync(async () => {
    for (const table of CACHED_TABLES) {
      await db.runAsync(`DELETE FROM ${table}`)
    }
    await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [
      'workspace_id',
      normalizeValue(workspaceId) as string,
    ])
  })

  return { purged: true, blockedByPendingMutations: 0 }
}

/**
 * The tables a workspace switch clears.
 *
 * Derived from the shared CREATE statements so a table added to the schema is
 * purged too — a cached table nobody remembered to clear is one workspace's
 * data showing inside another's.
 */
const CACHED_TABLES: readonly string[] = CREATE_STATEMENTS.flatMap((statement) => {
  const match = /CREATE TABLE IF NOT EXISTS (\w+)/.exec(statement)
  const table = match?.[1]
  // `meta` holds which workspace this is; `sync_queue` is the queue itself.
  return table && table !== 'meta' && table !== 'sync_queue' ? [table] : []
})

/**
 * Spend an entry's remaining attempts.
 *
 * ⚠️ USED ONLY FOR A PERMANENT REJECTION. A 4xx means the server will refuse
 * this payload every time; retrying it on each reconnect is a request that
 * can never succeed and an entry that never stops looking like it might.
 */
export async function burnAttempts(clientId: string, maxAttempts: number): Promise<void> {
  await require_().runAsync('UPDATE sync_queue SET attempts = ? WHERE client_id = ?', [
    maxAttempts,
    clientId,
  ])
}

/** Revive a failed entry, from the sync screen. */
export async function resetAttempts(clientId: string): Promise<void> {
  await require_().runAsync(
    `UPDATE sync_queue SET status = 'pending', attempts = 0, last_error = NULL WHERE client_id = ?`,
    [clientId],
  )
}

/**
 * Wipe every cached row, keeping the queue.
 *
 * ⚠️ SIGNING OUT IS NOT SWITCHING WORKSPACES. `setWorkspace` refuses while
 * writes are queued, because those belong to the workspace they were made in
 * and can still be sent. Signing out cannot refuse — the next person on this
 * phone must not open the app to somebody else's customers — so the cached
 * READS go and the queue stays, to be drained when the original user signs
 * back in. Throwing away somebody's unsent invoices to tidy a cache would be
 * destroying the only copy (§12).
 */
export async function clearCachedReads(): Promise<void> {
  if (!database) return
  const db = database

  await db.withTransactionAsync(async () => {
    for (const table of CACHED_TABLES) {
      await db.runAsync(`DELETE FROM "${table}"`)
    }
    await db.runAsync(`DELETE FROM meta WHERE key = 'workspace_id'`)
  })
}
