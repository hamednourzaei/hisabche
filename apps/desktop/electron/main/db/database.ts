// ============================================
// SQLite access layer.
//
// better-sqlite3 is a native module: if the binding fails to load (version
// mismatch, missing toolchain) the app must still run online-only rather than
// crash on boot. `isReady()` reports which mode we are in.
// ============================================

import { app } from 'electron'
import { join } from 'node:path'

import {
  CREATE_STATEMENTS,
  SCHEMA_VERSION,
  SEARCHABLE_COLUMNS,
  WRITABLE_COLUMNS,
} from './schema'
import type { LocalTable, QueueEntry } from '../../shared/ipc-contract'

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

/** Quote an identifier we have already validated against an allow-list. */
const ident = (name: string): string => `"${name.replace(/"/g, '')}"`

export function initDatabase(): boolean {
  if (db) return true

  try {
    // Required at runtime so a missing native binding degrades instead of
    // breaking the module graph at import time.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Database = require('better-sqlite3') as new (path: string) => SqliteDatabase

    db = new Database(join(app.getPath('userData'), 'hisabche.db'))
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    CREATE_STATEMENTS.forEach((statement) => db?.exec(statement))
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
      'schema_version',
      String(SCHEMA_VERSION)
    )
    return true
  } catch (error) {
    console.error('[db] SQLite unavailable, running online-only:', error)
    db = null
    return false
  }
}

export function isReady(): boolean {
  return db !== null
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

      const assignments = columns.filter((c) => c !== 'id').map((c) => `${ident(c)} = excluded.${ident(c)}`)
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
     VALUES (?, ?, ?, ?, 0, 'pending', NULL, ?)`
  ).run(
    input.clientId,
    input.entity,
    input.operation,
    JSON.stringify(input.payload),
    new Date().toISOString()
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

  const rows = db
    .prepare(`SELECT * FROM sync_queue ORDER BY created_at ASC`)
    .all() as QueueRow[]

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
     WHERE client_id = ?`
  ).run(error ?? null, clientId)
}

// ============================================
// Pull cursors
// ============================================

export function getCursor(entity: LocalTable): string | null {
  if (!db) return null
  const row = db
    .prepare(`SELECT last_pulled_at FROM sync_cursor WHERE entity = ?`)
    .get(entity) as { last_pulled_at: string } | undefined
  return row?.last_pulled_at ?? null
}

export function setCursor(entity: LocalTable, value: string): void {
  if (!db) return
  db.prepare(
    `INSERT OR REPLACE INTO sync_cursor (entity, last_pulled_at) VALUES (?, ?)`
  ).run(entity, value)
}
