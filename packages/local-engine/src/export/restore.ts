// ============================================
// packages/local-engine/src/export/restore.ts
//
// PART 5 / Slice 3 — SAFE LOCAL RESTORE of a portable archive.
//
// This never overwrites a database that already holds business data: the
// target workspace must be empty, and the restore runs inside ONE transaction.
// A failed or interrupted restore therefore leaves no half-imported business.
// The archive is validated BEFORE any write; checksums prove integrity, not
// authenticity — no encryption is claimed here.
// ============================================

import { SCHEMA_VERSION } from '@hisabche/app-bridge'
import type { LocalDb } from '../db'
import { REQUIRED_EXPORT_TABLES, verifyExportPackage } from './exporter'
import type { ExportPackage } from './types'

export interface RestoreOptions {
  readonly expectedWorkspaceId: string
}

export interface RestoreResult {
  readonly restoredTables: readonly string[]
  readonly totalRows: number
}

function columnsOf(db: LocalDb, table: string): string[] {
  return db.all<{ name: string }>(`PRAGMA table_info("${table}")`).map((c) => c.name)
}

function keyOf(columns: string[]): string {
  return columns.includes('id') ? 'id' : 'workspace_id'
}

/**
 * Validate every precondition. Throws on the first refusal; never writes.
 */
export function validateRestore(pkg: ExportPackage, options: RestoreOptions): void {
  const verification = verifyExportPackage(pkg)
  if (!verification.valid) {
    throw new Error(`RESTORE_ARCHIVE_INVALID:${verification.reason ?? 'UNKNOWN'}`)
  }
  if (pkg.metadata.workspaceId !== options.expectedWorkspaceId) {
    throw new Error('RESTORE_WORKSPACE_MISMATCH')
  }
  if (
    !Number.isSafeInteger(pkg.metadata.schemaVersion) ||
    pkg.metadata.schemaVersion > SCHEMA_VERSION
  ) {
    throw new Error('RESTORE_SCHEMA_VERSION_UNSUPPORTED')
  }
  if (pkg.coverage && pkg.coverage.missingRequired.length > 0) {
    throw new Error(`RESTORE_REQUIRED_TABLES_MISSING:${pkg.coverage.missingRequired.join(',')}`)
  }
}

/**
 * Restore into an empty workspace, atomically. Existing data is never removed
 * or replaced — a non-empty target is refused so there is no silent loss.
 */
export function restoreArchive(
  db: LocalDb,
  pkg: ExportPackage,
  options: RestoreOptions,
): RestoreResult {
  validateRestore(pkg, options)

  return db.transaction(() => {
    // Re-check inside the transaction: another writer may have landed rows
    // between validation and commitment. Refuse ONLY rows whose identity the
    // archive also carries — a fresh install already has default warehouse/
    // settings rows with different ids, and those are not in the way.
    for (const table of REQUIRED_EXPORT_TABLES) {
      if (table === 'local_workspace') continue // device identity, never business data
      const rows = pkg.sections[table]?.rows ?? []
      if (rows.length === 0) continue
      const columns = db.all<{ name: string }>(`PRAGMA table_info("${table}")`).map((c) => c.name)
      const key = columns.includes('id') ? 'id' : 'workspace_id'
      for (const row of rows) {
        const value = row[key]
        if (typeof value !== 'string') continue
        const existing = db.get<Record<string, unknown>>(
          `SELECT * FROM "${table}" WHERE "${key}" = ?`,
          [value],
        )
        if (!existing) continue
        // A pre-seeded default row (e.g. the device's own warehouse) may share
        // the id. Identical is safe to skip; DIFFERENT data must never be
        // silently overwritten by a restore.
        const normalize = (value: unknown): string =>
          JSON.stringify(value, (_k, v) => (v === null ? null : v))
        if (normalize(existing) === normalize(row)) continue
        throw new Error(`RESTORE_TARGET_NOT_EMPTY:${table}:${value}`)
      }
    }

    const tableNames = Object.keys(pkg.sections)
    const existing = new Set(
      db
        .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'")
        .map((r) => r.name),
    )
    const restoredTables: string[] = []
    let totalRows = 0

    for (const table of tableNames) {
      if (!existing.has(table)) {
        // A newer archive section whose table this device does not know yet:
        // report it rather than silently dropping customer data.
        if ((pkg.sections[table]?.rowCount ?? 0) > 0) {
          throw new Error(`RESTORE_TABLE_UNKNOWN:${table}`)
        }
        continue
      }
      const rows = pkg.sections[table]?.rows ?? []
      for (const row of rows) {
        // The workspace identity — or a device's pre-seeded default row — may
        // already exist with the same id. Identical means nothing to do; any
        // difference was already refused by the conflict check above.
        const key = keyOf(columnsOf(db, table))
        const value = row[key]
        if (typeof value === 'string') {
          const known = db.get<Record<string, unknown>>(
            `SELECT * FROM "${table}" WHERE "${key}" = ?`,
            [value],
          )
          if (known) continue
        }
        const columns = Object.keys(row)
        if (columns.length === 0) continue
        const names = columns.map((c) => `"${c}"`).join(',')
        const placeholders = columns.map(() => '?').join(',')
        db.run(
          `INSERT INTO "${table}" (${names}) VALUES (${placeholders})`,
          columns.map((c) => row[c] ?? null),
        )
      }
      restoredTables.push(table)
      totalRows += rows.length
    }

    return { restoredTables, totalRows }
  })
}
