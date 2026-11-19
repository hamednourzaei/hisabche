// ============================================
// packages/local-engine/src/export/exporter.ts
//
// Extracts the local SQLite database into a versioned, checksummed
// export package. Read-only on the device: nothing deleted, nothing locked.
//
// PART 5 / Phase C: the archive now covers every table in `localTableSchema`
// plus the device's own outbox and the newer feature tables. A table that
// cannot be read is REPORTED (coverage), never silently exported as an empty
// section that looks like «this business has no such data».
// ============================================

import { SCHEMA_VERSION, localTableSchema } from '@hisabche/app-bridge'
import type { LocalDb } from '../db'
import { sha256Hex } from './checksum'
import type { ExportCoverage, ExportMetadata, ExportPackage, ExportSection } from './types'

/** Tables whose absence means the archive is NOT a complete business archive. */
export const REQUIRED_EXPORT_TABLES: readonly string[] = [
  'local_workspace',
  'warehouse',
  'shelf',
  'product',
  'customer',
  'exchange_rate',
  'product_stock',
  'invoice',
  'invoice_item',
  'payment',
  'payment_allocation',
  'account',
  'journal_entry',
  'journal_line',
  'cost_layer',
  'cost_consumption',
  'inventory_movement',
]

/** Feature tables written only by devices that actually use that capability. */
export const OPTIONAL_EXPORT_TABLES: readonly string[] = [
  ...localTableSchema.options.filter((t) => !REQUIRED_EXPORT_TABLES.includes(t)),
  // Device-side tables added after the bridge schema was last regenerated.
  'fx_trade_drafts',
  'local_contracts',
  'local_contract_bills',
  'table_orders',
  'sync_queue',
]

export const EXPORT_TABLES: readonly string[] = [
  ...REQUIRED_EXPORT_TABLES,
  ...OPTIONAL_EXPORT_TABLES.filter((t) => !REQUIRED_EXPORT_TABLES.includes(t)),
]

export interface CreateExportOptions {
  deviceId: string
  licenceId: string
  workspaceId: string
}

function columnsOf(db: LocalDb, table: string): string[] {
  return db.all<{ name: string }>(`PRAGMA table_info("${table}")`).map((c) => c.name)
}

function readSection(
  db: LocalDb,
  tableName: string,
  workspaceId: string,
): { rows: Record<string, unknown>[] } | null {
  const tables = db
    .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'")
    .map((r) => r.name)
  if (!tables.includes(tableName)) return null

  const columns = columnsOf(db, tableName)
  const hasWorkspace = columns.includes('workspace_id')
  const order = columns.includes('created_at') ? ' ORDER BY created_at ASC' : ''
  const sql = hasWorkspace
    ? `SELECT * FROM "${tableName}" WHERE workspace_id = ?${order}`
    : `SELECT * FROM "${tableName}"${order}`
  const rows = db.all<Record<string, unknown>>(sql, hasWorkspace ? [workspaceId] : [])
  return { rows }
}

export function createExportPackage(db: LocalDb, options: CreateExportOptions): ExportPackage {
  const { deviceId, licenceId, workspaceId } = options
  const createdAt = new Date().toISOString()

  const metadata: ExportMetadata = {
    formatVersion: 1,
    schemaVersion: SCHEMA_VERSION,
    deviceId,
    licenceId,
    workspaceId,
    createdAt,
  }

  const sections: Record<string, ExportSection> = {}
  const missingRequired: string[] = []
  const missingOptional: string[] = []

  for (const tableName of EXPORT_TABLES) {
    const result = readSection(db, tableName, workspaceId)
    if (result === null) {
      if (REQUIRED_EXPORT_TABLES.includes(tableName)) missingRequired.push(tableName)
      else missingOptional.push(tableName)
      // Keep a section for schema compatibility, but make the gap VISIBLE.
      sections[tableName] = { name: tableName, rowCount: 0, rows: [], checksum: sha256Hex([]) }
      continue
    }
    const checksum = sha256Hex(result.rows)
    sections[tableName] = {
      name: tableName,
      rowCount: result.rows.length,
      rows: result.rows,
      checksum,
    }
  }

  const coverage: ExportCoverage = {
    expectedRequired: REQUIRED_EXPORT_TABLES.length,
    exportedRequired: REQUIRED_EXPORT_TABLES.length - missingRequired.length,
    missingRequired,
    missingOptional,
  }

  // Package checksum combines metadata and section hashes in deterministic order.
  const packageFingerprint = {
    metadata,
    sectionChecksums: Object.fromEntries(Object.entries(sections).map(([k, s]) => [k, s.checksum])),
  }
  const packageChecksum = sha256Hex(packageFingerprint)

  return { metadata, sections, packageChecksum, coverage }
}

export interface VerificationResult {
  valid: boolean
  reason?: string
}

export function verifyExportPackage(pkg: ExportPackage): VerificationResult {
  if (!pkg || pkg.metadata?.formatVersion !== 1) {
    return { valid: false, reason: 'INVALID_FORMAT_VERSION' }
  }

  // 0. A required table that could not be read is NOT a successful backup.
  if (pkg.coverage && pkg.coverage.missingRequired.length > 0) {
    return {
      valid: false,
      reason: `MISSING_REQUIRED_TABLES:${pkg.coverage.missingRequired.join(',')}`,
    }
  }

  // 1. Verify each section's checksum.
  for (const [name, section] of Object.entries(pkg.sections)) {
    if (section.rows.length !== section.rowCount) {
      return { valid: false, reason: `ROW_COUNT_MISMATCH:${name}` }
    }
    const computed = sha256Hex(section.rows)
    if (computed !== section.checksum) {
      return { valid: false, reason: `SECTION_CHECKSUM_MISMATCH:${name}` }
    }
  }

  // 2. Verify overall package checksum.
  const packageFingerprint = {
    metadata: pkg.metadata,
    sectionChecksums: Object.fromEntries(
      Object.entries(pkg.sections).map(([k, s]) => [k, s.checksum]),
    ),
  }
  const computedPackageChecksum = sha256Hex(packageFingerprint)
  if (computedPackageChecksum !== pkg.packageChecksum) {
    return { valid: false, reason: 'PACKAGE_CHECKSUM_MISMATCH' }
  }
  return { valid: true }
}
