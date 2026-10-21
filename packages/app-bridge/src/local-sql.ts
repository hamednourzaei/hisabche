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
  /**
   * The columns this search looks at, when the caller's rule is not the
   * table's default.
   *
   * The server searches a customer's NAME only and a product's name (plus its
   * barcode when the text is a barcode). A device that searched more would
   * answer a different question than the server does, and the two would
   * disagree about which rows exist.
   */
  searchColumns?: readonly string[] | undefined
}

export interface PreparedStatement {
  sql: string
  params: unknown[]
}

/**
 * The WHERE clause, built ONCE for the page and for the count.
 *
 * ⚠️ A null filter means "the column is empty". `column = NULL` matches
 * nothing in SQL, so the old builder turned "not deleted" into a filter that
 * excluded EVERY row — a list that came back empty because the filter was
 * wrong, which reads as "this business has no customers".
 */
export function buildWhere(input: LocalQueryInput): {
  clauses: string[]
  params: unknown[]
} {
  const columns = WRITABLE_COLUMNS[input.table] ?? []
  const clauses: string[] = []
  const params: unknown[] = []

  for (const [column, value] of Object.entries(input.where ?? {})) {
    // A column nobody declared is dropped, not refused: a filter the cache
    // cannot honour must not silently become a filter on everything.
    if (!columns.includes(column)) continue
    if (value === null) {
      clauses.push(`${ident(column)} IS NULL`)
      continue
    }
    clauses.push(`${ident(column)} = ?`)
    params.push(value)
  }

  // The caller's columns, or the table's own. A column nobody declared is
  // dropped, not honoured: a search over a column the cache does not have
  // must not become a search over everything.
  const searchable = (input.searchColumns ?? SEARCHABLE_COLUMNS[input.table] ?? []).filter(
    (column) => columns.includes(column),
  )
  if (input.search && searchable.length > 0) {
    clauses.push(`(${searchable.map((c) => `${ident(c)} LIKE ?`).join(' OR ')})`)
    searchable.forEach(() => params.push(`%${input.search}%`))
  }

  return { clauses, params }
}

export function buildSelect(input: LocalQueryInput): PreparedStatement {
  const columns = WRITABLE_COLUMNS[input.table] ?? []
  const { clauses, params } = buildWhere(input)

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
 * How many rows the same filter matches — not how many fit on one page.
 *
 * A page of twenty out of a thousand rows must say "a thousand", or the pager
 * tells the reader there is nothing beyond the page they can see.
 */
export function buildCount(input: LocalQueryInput): PreparedStatement {
  const { clauses, params } = buildWhere(input)
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''

  return {
    sql: `SELECT COUNT(*) AS total FROM ${ident(input.table)} ${where}`,
    params,
  }
}

/**
 * The outbox row, with its owner.
 *
 * ⚠️ THE SAME SQL ON BOTH HOSTS. A row queued on Windows and a row queued on
 * Android must be the same row, or one device's queue is a queue the other
 * device cannot read.
 *
 * The owner is KEPT when the new row has none: re-queuing a change that
 * already knows its owner must not turn it back into "owner unknown".
 */
export interface LocalEnqueueInput {
  entity: LocalTable
  operation: 'create' | 'update' | 'delete'
  clientId: string
  payload: Record<string, unknown>
  userId?: string | null | undefined
  workspaceId?: string | null | undefined
}

export function buildEnqueue(input: LocalEnqueueInput): PreparedStatement {
  return {
    sql:
      `INSERT INTO sync_queue (client_id, entity, operation, payload, attempts, status, last_error, created_at, user_id, workspace_id) ` +
      `VALUES (?, ?, ?, ?, 0, 'pending', NULL, ?, ?, ?) ` +
      `ON CONFLICT(client_id) DO UPDATE SET ` +
      `entity = excluded.entity, operation = excluded.operation, payload = excluded.payload, ` +
      `attempts = 0, status = 'pending', last_error = NULL, ` +
      `user_id = COALESCE(excluded.user_id, sync_queue.user_id), ` +
      `workspace_id = COALESCE(excluded.workspace_id, sync_queue.workspace_id)`,
    params: [
      input.clientId,
      input.entity,
      input.operation,
      JSON.stringify(input.payload),
      new Date().toISOString(),
      input.userId ?? null,
      input.workspaceId ?? null,
    ],
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
