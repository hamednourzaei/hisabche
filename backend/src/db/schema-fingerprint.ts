// ============================================
// backend/src/db/schema-fingerprint.ts
//
// Database Schema Fingerprinting & Promotion Gate
// Computes a deterministic SHA-256 checksum of database schema
// (tables, columns, constraints, functions, triggers).
// Blocks promotion if Standby schema diverges from Primary.
// ============================================

import { createHash } from 'node:crypto'

export interface SchemaMetadataSummary {
  readonly tableCount: number
  readonly functionCount: number
  readonly triggerCount: number
  readonly fingerprint: string
}

export interface SchemaComparisonResult {
  readonly matches: boolean
  readonly primaryFingerprint: string
  readonly standbyFingerprint: string
  readonly details?: string | undefined
}

export class SchemaFingerprintEngine {
  /**
   * Computes a deterministic SHA-256 fingerprint for a database instance.
   * Can query information_schema / pg_catalog or compare the declared migration manifest.
   */
  public static computeFromManifest(migrationFiles: readonly string[]): string {
    const hash = createHash('sha256')
    const sorted = [...migrationFiles].sort()
    for (const f of sorted) {
      hash.update(f)
    }
    return hash.digest('hex')
  }

  /**
   * Generates a deterministic schema fingerprint from runtime table / column schemas.
   */
  public static computeFromCatalog(catalog: {
    tables: Array<{
      name: string
      columns: Array<{ name: string; type: string; nullable: boolean }>
    }>
    functions: string[]
    triggers: string[]
  }): string {
    const hash = createHash('sha256')

    // Sort tables and columns deterministically
    const sortedTables = [...catalog.tables].sort((a, b) => a.name.localeCompare(b.name))
    for (const t of sortedTables) {
      hash.update(`table:${t.name};`)
      const sortedCols = [...t.columns].sort((a, b) => a.name.localeCompare(b.name))
      for (const c of sortedCols) {
        hash.update(`col:${c.name}:${c.type}:${c.nullable};`)
      }
    }

    const sortedFns = [...catalog.functions].sort()
    for (const fn of sortedFns) {
      hash.update(`fn:${fn};`)
    }

    const sortedTriggers = [...catalog.triggers].sort()
    for (const tr of sortedTriggers) {
      hash.update(`tr:${tr};`)
    }

    return hash.digest('hex')
  }

  /**
   * Promotion Gate: Asserts that the standby database has 100% schema parity with the primary.
   * Throws an error blocking promotion if a material discrepancy is found.
   */
  public static assertPromotionGate(
    primaryFingerprint: string,
    standbyFingerprint: string,
  ): SchemaComparisonResult {
    const matches = primaryFingerprint === standbyFingerprint
    if (!matches) {
      throw new Error(
        `[Promotion Gate BLOCKED] Material schema mismatch between Primary (${primaryFingerprint}) and Standby (${standbyFingerprint}). Standby promotion refused to prevent financial corruption.`,
      )
    }

    return {
      matches: true,
      primaryFingerprint,
      standbyFingerprint,
    }
  }
}
