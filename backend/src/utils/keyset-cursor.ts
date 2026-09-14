// ============================================
// backend/src/utils/keyset-cursor.ts
//
// Cursor pagination that actually continues where the last page ended.
//
// ⚠️ WHAT THIS REPLACED. The invoice, product and customer lists each returned
// `nextCursor = <last row's id>` and then filtered the next page with
// `.lt(sortBy, cursor)` — comparing a uuid against `created_at`. The "next page"
// was whatever that nonsense comparison returned, so infinite scroll stalled or
// skipped. Offset paging (`page`) also shifts rows when a new invoice lands
// between two page reads.
//
// A cursor is now (sort value, id), opaque to the client. The next page is
// every row strictly after that pair in the list's own order — `id` breaks
// ties, so two rows with the same `created_at` are neither skipped nor repeated.
//
// Sorting by `id` itself keeps the plain id cursor (the desktop snapshot uses it).
// ============================================

export interface KeysetCursor {
  value: string | number
  id: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function encodeCursor(row: Record<string, unknown>, sortColumn: string): string | null {
  const id = row.id
  if (typeof id !== 'string') return null
  if (sortColumn === 'id') return id
  const value = row[sortColumn]
  if (typeof value !== 'string' && typeof value !== 'number') return null
  return Buffer.from(JSON.stringify([value, id]), 'utf8').toString('base64url')
}

export function decodeCursor(cursor: string, sortColumn: string): KeysetCursor | null {
  if (sortColumn === 'id') return UUID.test(cursor) ? { value: cursor, id: cursor } : null
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown
    if (!Array.isArray(parsed) || parsed.length !== 2) return null
    const [value, id] = parsed
    if ((typeof value !== 'string' && typeof value !== 'number') || typeof id !== 'string')
      return null
    if (!UUID.test(id)) return null
    return { value, id }
  } catch {
    return null
  }
}

/** PostgREST filter value, quoted so ':' ',' '(' in timestamps survive. */
function literal(value: string | number): string {
  if (typeof value === 'number') return String(value)
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/** Column names come from an allow-list upstream; this refuses anything else. */
const SAFE_COLUMN = /^[a-z_][a-z0-9_]*$/

interface KeysetQuery<Q> {
  gt(column: string, value: unknown): Q
  lt(column: string, value: unknown): Q
  or(filters: string): Q
}

/**
 * Rows strictly after the cursor in (sortColumn, id) order. The caller must
 * also order by `id` in the same direction as its secondary key.
 */
export function applyKeyset<Q extends KeysetQuery<Q>>(
  query: Q,
  sortColumn: string,
  direction: 'asc' | 'desc',
  cursor: KeysetCursor,
): Q {
  const op = direction === 'desc' ? 'lt' : 'gt'
  if (sortColumn === 'id') return query[op]('id', cursor.id)
  if (!SAFE_COLUMN.test(sortColumn)) return query
  const v = literal(cursor.value)
  return query.or(`${sortColumn}.${op}.${v},and(${sortColumn}.eq.${v},id.${op}.${cursor.id})`)
}
