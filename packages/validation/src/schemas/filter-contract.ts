// ============================================
// packages/validation/src/schemas/filter-contract.ts
//
// What an UNSET list filter means — once, for every execution mode.
//
// ⚠️ THE BUG THIS EXISTS FOR (26 Oct 2026). The shared list hooks send every
// filter, set or not: `{ isActive: undefined, lowStock: undefined, … }`. One
// boundary turned `undefined` into `''`; every route asked «was it set?» with
// `x !== undefined`; `'' === 'true'` is false — so an UNSET `isActive` became
// «only INACTIVE products» and the invoice picker listed nothing with 10 grams
// of gold in stock. The same shape was one `=== 'true'` away on the server
// (`GET /suppliers?isActive=` read as «only inactive»).
//
// THE CONTRACT
//   unset            undefined · null · '' · the TEXT 'undefined' / 'null'
//                    (what `String(x)` makes of them on the way through a URL)
//                    ⇒ NO FILTER
//   explicit false   false · 'false' · '0'            ⇒ only the «false» rows
//   explicit true    true  · 'true'  · '1'            ⇒ only the «true» rows
//   anything else    not a flag ⇒ NO FILTER (never guessed into a condition)
//
// ⚠️ A SECURITY SCOPE IS NOT A FILTER. `workspaceId`, the member's branch and
// warehouse access, roles and soft-delete come from the authenticated context
// and are applied whether or not any business filter is set. Nothing here may
// ever be used to drop them.
// ============================================

const UNSET_TEXT = new Set(['', 'undefined', 'null'])

/** The value is a real «nobody set this»: `undefined`, `null` or `''`. */
export function isUnsetValue(raw: unknown): boolean {
  return raw === undefined || raw === null || raw === ''
}

/**
 * The value says «nobody set this», including the words a URL or a
 * `String(value)` leaves behind. For FLAGS and IDs only — a search box that
 * contains the word «null» is a search, so text filters use `isUnsetValue`.
 */
export function isUnsetFlag(raw: unknown): boolean {
  if (isUnsetValue(raw)) return true
  return typeof raw === 'string' && UNSET_TEXT.has(raw.trim().toLowerCase())
}

/**
 * A yes/no filter: `true`, `false`, or `undefined` for «no filter».
 *
 * `undefined` is NOT `false`: `false` means «only the rows where it is false».
 */
export function flagFilter(raw: unknown): boolean | undefined {
  if (raw === true || raw === false) return raw
  if (isUnsetFlag(raw)) return undefined
  if (typeof raw === 'string') {
    const value = raw.trim().toLowerCase()
    if (value === 'true' || value === '1') return true
    if (value === 'false' || value === '0') return false
  }
  return undefined
}

/** An id filter: the id, or `undefined`. `''` is not an id. */
export function idFilter(raw: unknown): string | undefined {
  if (isUnsetFlag(raw)) return undefined
  return typeof raw === 'string' ? raw.trim() || undefined : undefined
}

/** A free-text filter: the trimmed text, or `undefined` when it is blank. */
export function textFilter(raw: unknown): string | undefined {
  if (isUnsetValue(raw)) return undefined
  return typeof raw === 'string' ? raw.trim() || undefined : String(raw)
}

/** The filters that were actually set — an unset one is absent, not `''`. */
export function setFilters<T extends Record<string, unknown>>(filters: T): Partial<T> {
  const out: Partial<T> = {}
  for (const key of Object.keys(filters) as Array<keyof T>) {
    if (!isUnsetValue(filters[key])) out[key] = filters[key]
  }
  return out
}
