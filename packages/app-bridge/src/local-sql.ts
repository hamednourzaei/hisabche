// ============================================
// The SQL both local caches run.
//
// ⚠️ THE RULES ARE THE CONTRACT, NOT JUST THE TABLES.
//
// Sharing `CREATE TABLE` but letting each host write its own SELECT is how two
// caches end up disagreeing: one searches three columns and the other four,
// one falls back to `updated_at` and the other to insertion order, one binds a
// boolean as `1` and the other as `"true"`. The answer to `db.query` has to be
// the same on Windows and Android, so the statement that produces it is built
// here and each host only runs it.
//
// Nothing in this file touches a driver. It takes an input and returns SQL
// plus parameters; better-sqlite3 and expo-sqlite both accept exactly that.
// ============================================

import { SEARCHABLE_COLUMNS, WRITABLE_COLUMNS } from './local-schema'
import type { LocalTable } from './contract'

/**
 * Quote an identifier that has ALREADY been checked against an allow-list.
 *
 * ⚠️ This is not what makes the query safe — the allow-list is. Every column
 * name reaching here has been matched against `WRITABLE_COLUMNS`, because a
 * table name or column name cannot be a bound parameter in SQL.
 */
const ident = (name: string): string => `"${name.replace(/"/g, '')}"`

export interface LocalQueryInput {
  table: LocalTable
  search?: string | undefined
  where?: Record<string, string | number | boolean | null> | undefined
  orderBy?: string | undefined
  direction: 'asc' | 'desc'
  limit: number
  offset: number
}

export interface PreparedStatement {
  sql: string
  params: unknown[]
}

export function buildSelect(input: LocalQueryInput): PreparedStatement {
  const columns = WRITABLE_COLUMNS[input.table] ?? []
  const clauses: string[] = []
  const params: unknown[] = []

  for (const [column, value] of Object.entries(input.where ?? {})) {
    // A column nobody declared is dropped, not refused: a filter the cache
    // cannot honour must not silently become a filter on everything.
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

  return {
    sql:
      `SELECT * FROM ${ident(input.table)} ${where} ` +
      `ORDER BY ${ident(order)} ${input.direction === 'asc' ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?`,
    params: [...params, input.limit, input.offset],
  }
}

/**
 * One upsert per row, in the order given.
 *
 * ⚠️ A ROW WITHOUT AN `id` IS SKIPPED, NOT INSERTED. The server's id is the
 * primary key, so a row without one would insert a duplicate on every pull
 * instead of overwriting its own previous copy.
 */
export function buildUpserts(
  table: LocalTable,
  rows: Array<Record<string, unknown>>,
): PreparedStatement[] {
  const allowed = WRITABLE_COLUMNS[table] ?? []
  const statements: PreparedStatement[] = []

  for (const row of rows) {
    const columns = Object.keys(row).filter((key) => allowed.includes(key))
    if (columns.length === 0 || !columns.includes('id')) continue

    const assignments = columns
      .filter((c) => c !== 'id')
      .map((c) => `${ident(c)} = excluded.${ident(c)}`)

    statements.push({
      sql:
        `INSERT INTO ${ident(table)} (${columns.map(ident).join(', ')}) ` +
        `VALUES (${columns.map(() => '?').join(', ')}) ` +
        `ON CONFLICT(id) DO UPDATE SET ${assignments.join(', ')}`,
      params: columns.map((c) => normalizeValue(row[c])),
    })
  }

  return statements
}

/**
 * SQLite binds primitives only.
 *
 * ⚠️ A boolean must become 0/1 and an object must become JSON — and it has to
 * happen the SAME way on both hosts, or `is_active` reads as `1` on Windows
 * and `"true"` on Android and every `WHERE is_active = ?` quietly stops
 * matching on one of them.
 */
export function normalizeValue(value: unknown): string | number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}
