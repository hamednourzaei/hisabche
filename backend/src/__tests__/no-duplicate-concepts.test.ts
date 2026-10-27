// ============================================
// backend/src/__tests__/no-duplicate-concepts.test.ts
//
// Anti-duplicate concepts guard:
// Ensures that forbidden duplicate tables are NEVER created in docs/*.sql
// or local SQLite schema files.
//
// Forbidden duplicates & their existing canonical owners:
// - pack_barcodes  -> product_barcodes (has `unit` column)
// - product_serials -> stock_serials (in traceability)
// - vehicle_units  -> stock_serials + vehicle_attributes
// ============================================

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = join(__dirname, '..', '..', '..')

const FORBIDDEN_DUPLICATE_TABLES = ['pack_barcodes', 'product_serials', 'vehicle_units']

describe('Anti-duplicate Concepts Guard', () => {
  it('ensures no docs/*.sql migration creates forbidden duplicate tables', () => {
    const docsDir = join(REPO_ROOT, 'docs')
    const sqlFiles = readdirSync(docsDir).filter((f) => f.endsWith('.sql'))

    for (const sqlFile of sqlFiles) {
      const content = readFileSync(join(docsDir, sqlFile), 'utf8')
      for (const table of FORBIDDEN_DUPLICATE_TABLES) {
        const regex = new RegExp(
          `CREATE\\s+TABLE\\s+(IF\\s+NOT\\s+EXISTS\\s+)?(public\\.)?["']?${table}["']?\\b`,
          'i',
        )
        expect(
          regex.test(content),
          `Migration ${sqlFile} attempts to create duplicate table "${table}". Use canonical owner instead.`,
        ).toBe(false)
      }
    }
  })

  it('ensures local SQLite schemas do not declare forbidden duplicate tables', () => {
    const appBridgeSrc = join(REPO_ROOT, 'packages', 'app-bridge', 'src')
    const schemaFiles = readdirSync(appBridgeSrc).filter((f) => f.endsWith('.ts'))

    for (const file of schemaFiles) {
      const content = readFileSync(join(appBridgeSrc, file), 'utf8')
      for (const table of FORBIDDEN_DUPLICATE_TABLES) {
        const regex = new RegExp(
          `CREATE\\s+TABLE\\s+(IF\\s+NOT\\s+EXISTS\\s+)?["']?${table}["']?\\b`,
          'i',
        )
        expect(
          regex.test(content),
          `Local schema file ${file} attempts to create duplicate table "${table}". Use canonical owner instead.`,
        ).toBe(false)
      }
    }
  })
})
