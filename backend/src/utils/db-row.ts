// ============================================
// backend/src/utils/db-row.ts
//
// A row as PostgREST / the database returns it, read without `any` (13 Nov 2026). Every
// field is `unknown` until the code that uses it converts it — so a missing or renamed
// column shows up as a type to handle, not as a silent `undefined` flowing into money.
// ============================================

export type DbRow = Record<string, unknown>

export function isRow(value: unknown): value is DbRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The rows of a list result; anything that is not an object row is dropped. */
export function rowsOf(value: unknown): DbRow[] {
  return Array.isArray(value) ? value.filter(isRow) : []
}

/** A nested object (an embedded relation), or null. */
export function rowOf(value: unknown): DbRow | null {
  return isRow(value) ? value : null
}
