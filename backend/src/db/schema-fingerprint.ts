// ============================================
// backend/src/db/schema-fingerprint.ts
//
// Database Schema Fingerprinting & Promotion Gate
// Computes a deterministic SHA-256 checksum across ALL material Postgres
// schema objects (tables, columns, indexes, constraints, RLS policies, grants,
// extensions, sequences, functions, triggers) and migration file digests.
// Blocks standby promotion on ANY schema divergence.
// ============================================

import { createHash } from 'node:crypto'

export interface CatalogColumnSpec {
  readonly name: string
  readonly type: string
  readonly nullable: boolean
  readonly defaultValue?: string | null | undefined
}

export interface CatalogTableSpec {
  readonly name: string
  readonly columns: readonly CatalogColumnSpec[]
}

export interface CatalogIndexSpec {
  readonly name: string
  readonly table: string
  readonly unique: boolean
  readonly definition: string
}

export interface CatalogConstraintSpec {
  readonly name: string
  readonly table: string
  readonly type: string
  readonly definition: string
  readonly validated?: boolean | undefined
}

export interface CatalogRlsPolicySpec {
  readonly table: string
  readonly name: string
  readonly command: string
  readonly roles: readonly string[]
  readonly usingExpr?: string | null | undefined
  readonly checkExpr?: string | null | undefined
}

export interface CatalogGrantSpec {
  readonly grantee: string
  readonly objectType: 'table' | 'function' | 'sequence' | 'schema'
  readonly objectName: string
  readonly privilege: string
}

export interface CatalogSchemaSnapshot {
  readonly tables: readonly CatalogTableSpec[]
  readonly functions: readonly string[]
  readonly triggers: readonly string[]
  readonly indexes?: readonly CatalogIndexSpec[] | undefined
  readonly constraints?: readonly CatalogConstraintSpec[] | undefined
  readonly rlsPolicies?: readonly CatalogRlsPolicySpec[] | undefined
  readonly grants?: readonly CatalogGrantSpec[] | undefined
  readonly extensions?: readonly string[] | undefined
  readonly sequences?: readonly string[] | undefined
}

export interface SchemaMetadataSummary {
  readonly tableCount: number
  readonly indexCount: number
  readonly constraintCount: number
  readonly policyCount: number
  readonly grantCount: number
  readonly extensionCount: number
  readonly sequenceCount: number
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

export interface CatalogDiffResult {
  readonly matches: boolean
  readonly primaryFingerprint: string
  readonly standbyFingerprint: string
  readonly differences: readonly string[]
}

/** Canonical read-only PostgreSQL introspection SQL for live catalog parity audits. */
export const CATALOG_INTROSPECTION_SQL = `
SELECT
  (SELECT json_agg(row_to_json(t) ORDER BY t.table_name, t.column_name)
     FROM (
       SELECT table_name, column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public'
     ) t) AS columns,
  (SELECT json_agg(row_to_json(i) ORDER BY i.tablename, i.indexname)
     FROM (
       SELECT tablename, indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
     ) i) AS indexes,
  (SELECT json_agg(row_to_json(c) ORDER BY c.relname, c.conname)
     FROM (
       SELECT rel.relname, con.conname, con.contype, pg_get_constraintdef(con.oid) AS def, con.convalidated
       FROM pg_constraint con
       JOIN pg_class rel ON rel.oid = con.conrelid
       JOIN pg_namespace nsp ON nsp.oid = con.connamespace
       WHERE nsp.nspname = 'public'
     ) c) AS constraints,
  (SELECT json_agg(row_to_json(p) ORDER BY p.tablename, p.policyname)
     FROM (
       SELECT tablename, policyname, cmd, roles, qual, with_check
       FROM pg_policies
       WHERE schemaname = 'public'
     ) p) AS policies,
  (SELECT json_agg(row_to_json(g) ORDER BY g.table_name, g.grantee, g.privilege_type)
     FROM (
       SELECT table_name, grantee, privilege_type
       FROM information_schema.role_table_grants
       WHERE table_schema = 'public'
     ) g) AS grants,
  (SELECT array_agg(extname || '@' || extversion ORDER BY extname) FROM pg_extension) AS extensions,
  (SELECT array_agg(sequence_name ORDER BY sequence_name) FROM information_schema.sequences WHERE sequence_schema = 'public') AS sequences;
`.trim()

function canonicalTokens(catalog: CatalogSchemaSnapshot): string[] {
  const tokens: string[] = []

  const sortedTables = [...catalog.tables].sort((a, b) => a.name.localeCompare(b.name))
  for (const t of sortedTables) {
    tokens.push(`table:${t.name}`)
    const sortedCols = [...t.columns].sort((a, b) => a.name.localeCompare(b.name))
    for (const c of sortedCols) {
      tokens.push(`col:${t.name}.${c.name}:${c.type}:${c.nullable}:def=${c.defaultValue ?? 'null'}`)
    }
  }

  const sortedIndexes = [...(catalog.indexes ?? [])].sort((a, b) =>
    `${a.table}.${a.name}`.localeCompare(`${b.table}.${b.name}`),
  )
  for (const idx of sortedIndexes) {
    tokens.push(`idx:${idx.table}.${idx.name}:uniq=${idx.unique}:${idx.definition}`)
  }

  const sortedConstraints = [...(catalog.constraints ?? [])].sort((a, b) =>
    `${a.table}.${a.name}`.localeCompare(`${b.table}.${b.name}`),
  )
  for (const con of sortedConstraints) {
    tokens.push(
      `con:${con.table}.${con.name}:${con.type}:val=${con.validated ?? true}:${con.definition}`,
    )
  }

  const sortedPolicies = [...(catalog.rlsPolicies ?? [])].sort((a, b) =>
    `${a.table}.${a.name}`.localeCompare(`${b.table}.${b.name}`),
  )
  for (const pol of sortedPolicies) {
    const roles = [...pol.roles].sort().join(',')
    tokens.push(
      `pol:${pol.table}.${pol.name}:${pol.command}:roles=${roles}:using=${pol.usingExpr ?? ''}:check=${pol.checkExpr ?? ''}`,
    )
  }

  const sortedGrants = [...(catalog.grants ?? [])].sort((a, b) =>
    `${a.objectType}:${a.objectName}:${a.grantee}:${a.privilege}`.localeCompare(
      `${b.objectType}:${b.objectName}:${b.grantee}:${b.privilege}`,
    ),
  )
  for (const g of sortedGrants) {
    tokens.push(`grant:${g.objectType}:${g.objectName}:${g.grantee}:${g.privilege}`)
  }

  for (const ext of [...(catalog.extensions ?? [])].sort()) {
    tokens.push(`ext:${ext}`)
  }

  for (const seq of [...(catalog.sequences ?? [])].sort()) {
    tokens.push(`seq:${seq}`)
  }

  for (const fn of [...catalog.functions].sort()) {
    tokens.push(`fn:${fn}`)
  }

  for (const tr of [...catalog.triggers].sort()) {
    tokens.push(`tr:${tr}`)
  }

  return tokens
}

export class SchemaFingerprintEngine {
  /**
   * Computes a SHA-256 fingerprint from migration filenames (manifest order-independent).
   * Prefer `computeFromMigrationDigests` when file contents are available.
   */
  public static computeFromManifest(migrationFiles: readonly string[]): string {
    const hash = createHash('sha256')
    const sorted = [...migrationFiles].sort()
    for (const f of sorted) {
      hash.update(`file:${f};`)
    }
    return hash.digest('hex')
  }

  /**
   * Computes a content-verified SHA-256 fingerprint over migration names AND
   * each SQL file's content digest, detecting in-place migration edits.
   */
  public static computeFromMigrationDigests(
    entries: readonly { filename: string; contentSha256: string }[],
  ): string {
    const hash = createHash('sha256')
    const sorted = [...entries].sort((a, b) => a.filename.localeCompare(b.filename))
    for (const entry of sorted) {
      hash.update(`migration:${entry.filename}=${entry.contentSha256};`)
    }
    return hash.digest('hex')
  }

  /**
   * Generates a deterministic schema fingerprint from full runtime catalog objects:
   * tables, columns, indexes, constraints, RLS policies, grants, extensions,
   * sequences, functions, and triggers.
   */
  public static computeFromCatalog(catalog: CatalogSchemaSnapshot): string {
    const hash = createHash('sha256')
    for (const token of canonicalTokens(catalog)) {
      hash.update(`${token};`)
    }
    return hash.digest('hex')
  }

  public static summarizeCatalog(catalog: CatalogSchemaSnapshot): SchemaMetadataSummary {
    return {
      tableCount: catalog.tables.length,
      indexCount: catalog.indexes?.length ?? 0,
      constraintCount: catalog.constraints?.length ?? 0,
      policyCount: catalog.rlsPolicies?.length ?? 0,
      grantCount: catalog.grants?.length ?? 0,
      extensionCount: catalog.extensions?.length ?? 0,
      sequenceCount: catalog.sequences?.length ?? 0,
      functionCount: catalog.functions.length,
      triggerCount: catalog.triggers.length,
      fingerprint: this.computeFromCatalog(catalog),
    }
  }

  /**
   * Returns exact schema token discrepancies between Primary and Standby catalogs.
   */
  public static diffCatalogs(
    primary: CatalogSchemaSnapshot,
    standby: CatalogSchemaSnapshot,
  ): CatalogDiffResult {
    const primaryFp = this.computeFromCatalog(primary)
    const standbyFp = this.computeFromCatalog(standby)
    const primarySet = new Set(canonicalTokens(primary))
    const standbySet = new Set(canonicalTokens(standby))

    const differences: string[] = []
    for (const token of primarySet) {
      if (!standbySet.has(token)) {
        differences.push(`missing_on_standby:${token}`)
      }
    }
    for (const token of standbySet) {
      if (!primarySet.has(token)) {
        differences.push(`extra_on_standby:${token}`)
      }
    }

    return {
      matches: primaryFp === standbyFp && differences.length === 0,
      primaryFingerprint: primaryFp,
      standbyFingerprint: standbyFp,
      differences,
    }
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
