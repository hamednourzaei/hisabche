// ============================================
// SQLite access layer.
//
// better-sqlite3 is a native module: if the binding fails to load (version
// mismatch, missing toolchain) the app must still run online-only rather than
// crash on boot. `isReady()` reports which mode we are in.
// ============================================

import { app } from 'electron'
import { join } from 'node:path'

import { reportError } from '../services/monitoring'

import {
  CREATE_STATEMENTS,
  SCHEMA_VERSION,
  isAlreadyApplied,
  migrationsFrom,
  SEARCHABLE_COLUMNS,
  WRITABLE_COLUMNS,
  type LocalTable,
  type QueueEntry,
} from '@hisabche/app-bridge'

type SqliteDatabase = {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[]
    get(...params: unknown[]): unknown
    run(...params: unknown[]): unknown
  }
  exec(sql: string): void
  pragma(sql: string): unknown
  transaction<T extends (...args: never[]) => unknown>(fn: T): T
  close(): void
}

let db: SqliteDatabase | null = null

/**
 * Why the cache is unavailable, when it is.
 *
 * ⚠️ «No cache» and «no data» must never render the same (راهنمای سشن §۷٫۳),
 * and neither must «no cache» and «working offline fine». The renderer reads
 * this through .
 */
let lastFailure: string | null = null

/** Quote an identifier we have already validated against an allow-list. */
const ident = (name: string): string => `"${name.replace(/"/g, '')}"`

/**
 * Open a database with a caller-supplied driver.
 *
 * ⚠️ TEST SEAM — production always uses `initDatabase()`, which passes
 * better-sqlite3. This exists because better-sqlite3 is a NATIVE module built
 * against Electron's Node ABI (NODE_MODULE_VERSION 125), while jest runs on the
 * system Node (127), so requiring it under test throws. The alternative was a
 * suite whose every test silently early-returned and asserted nothing while
 * reporting green — a worse outcome than no test at all.
 *
 * The seam is a constructor, not a mock: tests pass Node's built-in
 * `node:sqlite`, so the SQL, the transaction and the DELETEs below are really
 * executed against a real SQLite. Only the binding differs.
 */

/**
 * Bring an existing cache up to the current schema.
 *
 * ⚠️ RUNS BEFORE THE VERSION IS STAMPED. The stamp is written after this
 * returns, so a migration that throws leaves the old number in place and is
 * retried on the next launch rather than being skipped forever.
 */
function runMigrations(database: SqliteDatabase): void {
  const row = database.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    { value?: string } | undefined
  // A cache with no stamp is either brand new (CREATE just ran, so it is
  // already current) or predates stamping. Treating it as v1 is safe: every
  // migration is written to be harmless when already applied.
  const from = Number(row?.value ?? 1) || 1

  for (const migration of migrationsFrom(from)) {
    for (const statement of migration.statements) {
      try {
        database.exec(statement)
      } catch (error) {
        if (isAlreadyApplied(error)) continue
        throw error
      }
    }
  }
}

export function initDatabaseWith(
  Driver: new (path: string) => SqliteDatabase,
  path: string,
): boolean {
  if (db) return true

  try {
    db = new Driver(path)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    CREATE_STATEMENTS.forEach((statement) => db?.exec(statement))
    runMigrations(db)
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
      'schema_version',
      String(SCHEMA_VERSION),
    )
    return true
  } catch (error) {
    // ⚠️ REPORTED, NOT SWALLOWED.
    //
    // Falling back to online-only is the right behaviour — the app must still
    // start. Doing it in silence is not: a machine whose cache never opens
    // looks identical to one that is simply online, so nobody finds out that
    // the offline product does not work on it. The reason is kept in
    // `lastFailure` so the renderer can say WHICH it is.
    lastFailure = error instanceof Error ? error.message : String(error)
    reportError(error, { scope: 'db.init' })
    db = null
    return false
  }
}

export function initDatabase(): boolean {
  if (db) return true

  try {
    // Required at runtime so a missing native binding degrades instead of
    // breaking the module graph at import time.

    const Database = require('better-sqlite3') as new (path: string) => SqliteDatabase

    db = new Database(join(app.getPath('userData'), 'hisabche.db'))
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    CREATE_STATEMENTS.forEach((statement) => db?.exec(statement))
    runMigrations(db)
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
      'schema_version',
      String(SCHEMA_VERSION),
    )
    return true
  } catch (error) {
    // ⚠️ REPORTED, NOT SWALLOWED.
    //
    // Falling back to online-only is the right behaviour — the app must still
    // start. Doing it in silence is not: a machine whose cache never opens
    // looks identical to one that is simply online, so nobody finds out that
    // the offline product does not work on it. The reason is kept in
    // `lastFailure` so the renderer can say WHICH it is.
    lastFailure = error instanceof Error ? error.message : String(error)
    reportError(error, { scope: 'db.init' })
    db = null
    return false
  }
}

export function isReady(): boolean {
  return db !== null
}

/** The reason the cache is unavailable, or null when it is working. */
export function cacheFailure(): string | null {
  return db === null ? (lastFailure ?? 'unknown') : null
}

export function closeDatabase(): void {
  db?.close()
  db = null
}

// ============================================
// Reads
// ============================================

export interface QueryInput {
  table: LocalTable
  search?: string | undefined
  where?: Record<string, string | number | boolean | null> | undefined
  orderBy?: string | undefined
  direction: 'asc' | 'desc'
  limit: number
  offset: number
}

export function query<T>(input: QueryInput): T[] {
  if (!db) return []

  const columns = WRITABLE_COLUMNS[input.table] ?? []
  const clauses: string[] = []
  const params: unknown[] = []

  for (const [column, value] of Object.entries(input.where ?? {})) {
    if (!columns.includes(column)) continue
    clauses.push(`${ident(column)} = ?`)
    params.push(value)
  }

  const searchable = SEARCHABLE_COLUMNS[input.table] ?? []
  if (input.search && searchable.length > 0) {
    clauses.push(`(${searchable.map((c) => `${ident(c)} LIKE ?`).join(' OR ')})`)
    searchable.forEach(() => params.push(`%${input.search}%`))
  }

  const order = input.orderBy && columns.includes(input.orderBy) ? input.orderBy : 'updated_at'
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
  const sql =
    `SELECT * FROM ${ident(input.table)} ${where} ` +
    `ORDER BY ${ident(order)} ${input.direction === 'asc' ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?`

  return db.prepare(sql).all(...params, input.limit, input.offset) as T[]
}

// ============================================
// Writes
// ============================================

export function upsertMany(table: LocalTable, rows: Array<Record<string, unknown>>): number {
  if (!db || rows.length === 0) return 0

  const allowed = WRITABLE_COLUMNS[table] ?? []
  const database = db

  const write = database.transaction((batch: Array<Record<string, unknown>>) => {
    for (const row of batch) {
      const columns = Object.keys(row).filter((key) => allowed.includes(key))
      if (columns.length === 0 || !columns.includes('id')) continue

      const assignments = columns
        .filter((c) => c !== 'id')
        .map((c) => `${ident(c)} = excluded.${ident(c)}`)
      const sql =
        `INSERT INTO ${ident(table)} (${columns.map(ident).join(', ')}) ` +
        `VALUES (${columns.map(() => '?').join(', ')}) ` +
        `ON CONFLICT(id) DO UPDATE SET ${assignments.join(', ')}`

      database.prepare(sql).run(...columns.map((c) => normalize(row[c])))
    }
  })

  write(rows)
  return rows.length
}

/** SQLite only binds primitives — booleans become 0/1, objects become JSON. */
function normalize(value: unknown): string | number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

// ============================================
// Sync queue
// ============================================

export function enqueue(input: {
  entity: LocalTable
  operation: 'create' | 'update' | 'delete'
  clientId: string
  payload: Record<string, unknown>
}): void {
  if (!db) return

  db.prepare(
    `INSERT OR REPLACE INTO sync_queue
      (client_id, entity, operation, payload, attempts, status, last_error, created_at)
     VALUES (?, ?, ?, ?, 0, 'pending', NULL, ?)`,
  ).run(
    input.clientId,
    input.entity,
    input.operation,
    JSON.stringify(input.payload),
    new Date().toISOString(),
  )
}

interface QueueRow {
  client_id: string
  entity: LocalTable
  operation: 'create' | 'update' | 'delete'
  payload: string
  attempts: number
  status: 'pending' | 'failed'
  last_error: string | null
  created_at: string
}

export function readQueue(): QueueEntry[] {
  if (!db) return []

  const rows = db.prepare(`SELECT * FROM sync_queue ORDER BY created_at ASC`).all() as QueueRow[]

  return rows.map((row) => ({
    clientId: row.client_id,
    entity: row.entity,
    operation: row.operation,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    attempts: row.attempts,
    status: row.status,
    lastError: row.last_error,
    createdAt: row.created_at,
  }))
}

export function resolveQueue(clientId: string, status: 'done' | 'failed', error?: string): void {
  if (!db) return

  if (status === 'done') {
    db.prepare(`DELETE FROM sync_queue WHERE client_id = ?`).run(clientId)
    return
  }

  db.prepare(
    `UPDATE sync_queue SET status = 'failed', attempts = attempts + 1, last_error = ?
     WHERE client_id = ?`,
  ).run(error ?? null, clientId)
}

// ============================================
// Pull cursors
// ============================================

export function getCursor(entity: LocalTable): string | null {
  if (!db) return null
  const row = db.prepare(`SELECT last_pulled_at FROM sync_cursor WHERE entity = ?`).get(entity) as
    { last_pulled_at: string } | undefined
  return row?.last_pulled_at ?? null
}

export function setCursor(entity: LocalTable, value: string): void {
  if (!db) return
  db.prepare(`INSERT OR REPLACE INTO sync_cursor (entity, last_pulled_at) VALUES (?, ?)`).run(
    entity,
    value,
  )
}

// ============================================
// Workspace switching
// ============================================

/**
 * The workspace this local cache currently holds, or null on a fresh install.
 *
 * The cached tables carry no `workspace_id` of their own: they are filled from
 * REST endpoints that are already scoped to the caller's authorized workspace,
 * so every row in them belongs to whichever workspace was active at pull time.
 * That is sound right up until the active workspace CHANGES — at which point
 * the cache holds one business's books while the app believes it is showing
 * another's. Recording which one it is makes that detectable.
 */
export function getCachedWorkspace(): string | null {
  if (!db) return null
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'workspace_id'`).get() as
    { value: string } | undefined
  return row?.value ?? null
}

/**
 * Point the cache at a workspace, clearing it first if it held another one.
 *
 * Returns true when a purge happened.
 *
 * ⚠️ WHAT IS AND IS NOT DELETED
 *
 * The cached entity tables are discarded: they are a copy of server state and
 * are refetched on the next pull, so losing them costs a round-trip and
 * nothing else.
 *
 * `sync_queue` is NOT discarded. It holds mutations the user made offline that
 * the server has never seen — deleting them destroys work that exists nowhere
 * else. If any are pending, this refuses to switch and reports the count so
 * the caller can flush them first. A shopkeeper who wrote three invoices on a
 * plane must not lose them by tapping a workspace switcher on landing.
 */
export function setCachedWorkspace(workspaceId: string): {
  purged: boolean
  blockedByPendingMutations: number
} {
  if (!db) return { purged: false, blockedByPendingMutations: 0 }

  const current = getCachedWorkspace()
  if (current === workspaceId) return { purged: false, blockedByPendingMutations: 0 }

  if (current !== null) {
    const pending = db
      .prepare(`SELECT count(*) AS n FROM sync_queue WHERE status <> 'failed'`)
      .get() as { n: number }

    if (pending.n > 0) {
      return { purged: false, blockedByPendingMutations: pending.n }
    }
  }

  // One transaction: a half-cleared cache mixing two businesses' rows is worse
  // than either a full one or an empty one.
  const purge = db.transaction(() => {
    for (const table of CACHED_TABLES) {
      db!.prepare(`DELETE FROM ${table === 'transaction' ? '"transaction"' : table}`).run()
    }
    db!.prepare(`DELETE FROM sync_cursor`).run()
    db!
      .prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('workspace_id', ?)`)
      .run(workspaceId)
  })

  purge()

  return { purged: current !== null, blockedByPendingMutations: 0 }
}

/** Server-derived tables only. `sync_queue` is deliberately absent. */
const CACHED_TABLES: readonly LocalTable[] = [
  'product',
  'customer',
  'invoice',
  'invoice_item',
  'transaction',
  'inventory_movement',
  'employee',
]
