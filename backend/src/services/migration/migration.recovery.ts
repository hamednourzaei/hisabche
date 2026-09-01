// ============================================
// backend/src/services/migration/migration.recovery.ts
//
// §39 rollback · §40 import profiles · §41 export symmetry — the pure rules.
//
// ---------------------------------------------------------------------------
// ROLLBACK IS NOT "DELETE WHAT THE IMPORT MADE"
//
// §39 is explicit: never a blanket delete. The identity ledger knows exactly
// which rows a migration created, which is necessary but nowhere near
// sufficient, because between the import and the rollback a real business
// happened. A customer the import created may now be on three invoices. A
// product may have stock movements against it.
//
// So a row is only reversible while nothing depends on it, and the answer for
// everything else is "kept, and here is why" — stated plainly rather than
// forced. An importer that can undo half a migration and calls it done leaves
// books that balance to nothing.
//
// ⚠️ Rows the import UPDATED are never reverted. The pre-import values were
// not recorded (deliberately — see the migration SQL on why the source file is
// not retained), so "undo" would mean writing a guess over something a person
// may have since corrected by hand.
// ============================================

import type { MigrationEntity } from './migration.domain'

/* ─── Rollback ────────────────────────────────────────────────────────────── */

export type RowDisposition = 'deletable' | 'kept_has_dependents' | 'kept_was_update'

export interface RollbackCandidate {
  targetId: string
  outcome: 'created' | 'updated' | 'skipped'
  /** How many live rows reference this one. Counted by the caller, from the DB. */
  dependentCount: number
}

export interface RollbackPlan {
  entity: MigrationEntity
  deletable: string[]
  keptHasDependents: string[]
  keptWasUpdate: string[]
  /** True only when every created row can go. Anything else is partial. */
  complete: boolean
}

export function dispositionOf(candidate: RollbackCandidate): RowDisposition {
  // An updated row's previous values are not recoverable, so it stays. This is
  // the honest answer, not a limitation to work around.
  if (candidate.outcome !== 'created') return 'kept_was_update'
  if (candidate.dependentCount > 0) return 'kept_has_dependents'
  return 'deletable'
}

/**
 * What a rollback would actually do.
 *
 * Pure, so the plan can be shown to the user and approved BEFORE anything is
 * deleted — the same preview-then-commit shape the import itself uses. §39
 * requires rollback be authorization-protected and tested; this is the part
 * that can be tested.
 */
export function planRollback(
  entity: MigrationEntity,
  candidates: readonly RollbackCandidate[],
): RollbackPlan {
  const deletable: string[] = []
  const keptHasDependents: string[] = []
  const keptWasUpdate: string[] = []

  for (const candidate of candidates) {
    const disposition = dispositionOf(candidate)
    if (disposition === 'deletable') deletable.push(candidate.targetId)
    else if (disposition === 'kept_has_dependents') keptHasDependents.push(candidate.targetId)
    else keptWasUpdate.push(candidate.targetId)
  }

  const created = candidates.filter((candidate) => candidate.outcome === 'created')

  return {
    entity,
    deletable,
    keptHasDependents,
    keptWasUpdate,
    // "Complete" means every row this migration CREATED can be removed. Rows
    // it updated are outside the question — counting them would make a
    // complete rollback impossible by definition and the flag meaningless.
    complete: created.length > 0 && deletable.length === created.length,
  }
}

/* ─── Import profiles ─────────────────────────────────────────────────────── */

export interface ImportProfile {
  id: string
  name: string
  entity: MigrationEntity
  /** Target field → source COLUMN NAME. Deliberately not a column index. */
  columnsByName: Record<string, string>
  /** The headers the profile was built against, in order. */
  signature: readonly string[]
}

/**
 * A profile stores column NAMES, never indexes.
 *
 * An index is a fact about one file. The next export from the same system has
 * the same columns in a different order as soon as somebody adds one, and a
 * saved index would then map `phone` onto `openingBalance` — silently, into a
 * financial field.
 */
export function toProfile(
  id: string,
  name: string,
  entity: MigrationEntity,
  headers: readonly string[],
  mapping: Record<string, number>,
): ImportProfile {
  const columnsByName: Record<string, string> = {}
  for (const [field, index] of Object.entries(mapping)) {
    const header = headers[index]
    if (header !== undefined) columnsByName[field] = header
  }
  return { id, name, entity, columnsByName, signature: [...headers] }
}

export type ProfileFit =
  | { fits: true; mapping: Record<string, number>; drifted: false }
  | { fits: true; mapping: Record<string, number>; drifted: true; missing: string[] }
  | { fits: false; reason: 'WRONG_ENTITY' | 'NO_COLUMNS_MATCH' }

/**
 * Apply a saved profile to a new file.
 *
 * §40: "Never apply a stale mapping silently when schema or field semantics
 * have changed." So the result distinguishes three cases, and only the first
 * may be applied without saying anything:
 *
 *   fits, not drifted   every saved column is present
 *   fits, drifted       some are missing — applied, and the user is TOLD which
 *   does not fit        nothing in common; the profile is for another export
 */
export function applyProfile(
  profile: ImportProfile,
  entity: MigrationEntity,
  headers: readonly string[],
): ProfileFit {
  if (profile.entity !== entity) return { fits: false, reason: 'WRONG_ENTITY' }

  const index = new Map(headers.map((header, position) => [header.trim(), position]))

  const mapping: Record<string, number> = {}
  const missing: string[] = []

  for (const [field, column] of Object.entries(profile.columnsByName)) {
    const position = index.get(column.trim())
    if (position === undefined) missing.push(column)
    else mapping[field] = position
  }

  if (Object.keys(mapping).length === 0) return { fits: false, reason: 'NO_COLUMNS_MATCH' }
  if (missing.length > 0) return { fits: true, mapping, drifted: true, missing }
  return { fits: true, mapping, drifted: false }
}

/* ─── Export symmetry ─────────────────────────────────────────────────────── */

/**
 * The columns an export writes so that re-importing it is predictable.
 *
 * §41 asks export and import to be complementary. The requirement that makes
 * it real is the FIRST column: Hisabche's own id, exported as `externalId`, so
 * a re-import matches the same rows instead of creating twins. Without it,
 * export-then-import is a duplication machine.
 *
 * Order matters: it is the order `suggestMapping` scores best against, so a
 * round trip needs no manual mapping at all.
 */
export const EXPORT_COLUMNS: Record<MigrationEntity, readonly string[]> = {
  customer: ['externalId', 'fullName', 'phone', 'email', 'address', 'notes', 'type'],
  product: [
    'externalId',
    'name',
    'sku',
    'barcode',
    'category',
    'unit',
    'quantity',
    'buyPrice',
    'sellPrice',
  ],
}

/**
 * ⚠️ `openingBalance` is absent from the customer export ON PURPOSE.
 *
 * Re-importing it would restate a balance that transactions have since moved —
 * and `updateEntity` refuses to write it for the same reason. Exporting a
 * field the importer will not accept is a promise of a round trip that does
 * not happen.
 */
export function isRoundTrippable(entity: MigrationEntity, field: string): boolean {
  return EXPORT_COLUMNS[entity].includes(field)
}

/** A CSV line, quoted the way the parser expects to read it back. */
export function toCsvRow(values: readonly string[]): string {
  return values
    .map((value) => {
      const text = value ?? ''
      // Quote when the value could otherwise change the shape of the row.
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    })
    .join(',')
}
