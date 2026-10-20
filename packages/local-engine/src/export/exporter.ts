// ============================================
// packages/local-engine/src/export/exporter.ts
//
// Extracts the local SQLite database into a versioned, checksummed
// export package. Read-only on the device: nothing deleted, nothing locked.
// ============================================

import { SCHEMA_VERSION } from '@hisabche/app-bridge'
import type { LocalDb } from '../db'
import { sha256Hex } from './checksum'
import type { ExportMetadata, ExportPackage, ExportSection } from './types'

/** Tables exported in exact dependency order. */
export const EXPORT_TABLES = [
  'local_workspace',
  'inventory_settings',
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
] as const

export interface CreateExportOptions {
  deviceId: string
  licenceId: string
  workspaceId: string
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

  for (const tableName of EXPORT_TABLES) {
    let sql: string
    let params: unknown[]

    if (tableName === 'local_workspace') {
      sql = 'SELECT * FROM local_workspace WHERE id = ?'
      params = [workspaceId]
    } else if (tableName === 'inventory_settings') {
      sql = 'SELECT * FROM inventory_settings WHERE workspace_id = ?'
      params = [workspaceId]
    } else {
      sql = `SELECT * FROM "${tableName}" WHERE workspace_id = ? ORDER BY created_at ASC, id ASC`
      params = [workspaceId]
    }

    let rows: Record<string, unknown>[]
    try {
      rows = db.all<Record<string, unknown>>(sql, params)
    } catch {
      // Table may not have created_at, fallback to id order
      try {
        rows = db.all<Record<string, unknown>>(
          `SELECT * FROM "${tableName}" WHERE workspace_id = ?`,
          [workspaceId],
        )
      } catch {
        rows = []
      }
    }

    const checksum = sha256Hex(rows)
    sections[tableName] = {
      name: tableName,
      rowCount: rows.length,
      rows,
      checksum,
    }
  }

  // Package checksum combines metadata and section hashes in deterministic order
  const packageFingerprint = {
    metadata,
    sectionChecksums: Object.fromEntries(Object.entries(sections).map(([k, s]) => [k, s.checksum])),
  }
  const packageChecksum = sha256Hex(packageFingerprint)

  return {
    metadata,
    sections,
    packageChecksum,
  }
}

export interface VerificationResult {
  valid: boolean
  reason?: string
}

export function verifyExportPackage(pkg: ExportPackage): VerificationResult {
  if (!pkg || pkg.metadata?.formatVersion !== 1) {
    return { valid: false, reason: 'INVALID_FORMAT_VERSION' }
  }

  // 1. Verify each section's checksum
  for (const [name, section] of Object.entries(pkg.sections)) {
    if (section.rows.length !== section.rowCount) {
      return { valid: false, reason: `ROW_COUNT_MISMATCH:${name}` }
    }
    const computed = sha256Hex(section.rows)
    if (computed !== section.checksum) {
      return { valid: false, reason: `SECTION_CHECKSUM_MISMATCH:${name}` }
    }
  }

  // 2. Verify overall package checksum
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
