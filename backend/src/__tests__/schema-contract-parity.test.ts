// ============================================
// backend/src/__tests__/schema-contract-parity.test.ts
//
// Automated contract checks for shared entities across:
// - packages/db-schema/src/drizzle.schema.ts
// - packages/db-schema/src/watermelon.schema.ts
// - packages/app-bridge/src/local-schema.ts
// - docs/base-schema-migration.sql
// ============================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')

describe('Shared Schema Contract Parity', () => {
  const drizzle = read('packages/db-schema/src/drizzle.schema.ts')
  const watermelon = read('packages/db-schema/src/watermelon.schema.ts')
  const localSchema =
    read('packages/app-bridge/src/local-schema.ts') +
    '\n' +
    read('packages/app-bridge/src/local-books-schema.ts')
  const baseSql = read('docs/base-schema-migration.sql')

  const SHARED_ENTITIES = [
    { server: 'products', local: 'product', inWatermelon: true },
    { server: 'customers', local: 'customer', inWatermelon: true },
    { server: 'invoices', local: 'invoice', inWatermelon: true },
    { server: 'transactions', local: 'transaction', inWatermelon: false },
  ] as const

  it('every core shared entity is declared across Drizzle, WatermelonDB (where applicable), Local SQLite, and Base SQL', () => {
    for (const { server, local, inWatermelon } of SHARED_ENTITIES) {
      expect(drizzle, `drizzle missing ${server}`).toContain(`"${server}"`)
      if (inWatermelon) {
        expect(watermelon, `watermelon missing ${server}`).toContain(`name: '${server}'`)
      }
      expect(localSchema, `local-schema missing ${local}`).toMatch(
        new RegExp(`CREATE TABLE IF NOT EXISTS "?${local}"?\\s*\\(`),
      )
      expect(baseSql, `base-schema-migration.sql missing ${server}`).toContain(
        `CREATE TABLE IF NOT EXISTS ${server}`,
      )
    }
  })

  it('customers uses full_name (never legacy name) across Drizzle, WatermelonDB, and Base SQL', () => {
    expect(drizzle).toContain('fullName: text("full_name")')
    expect(watermelon).toContain("{ name: 'full_name', type: 'string' }")
    expect(baseSql).toContain('full_name')
  })

  it('all tenant-owned shared tables carry workspace_id in Base SQL and Local Schema', () => {
    for (const { server } of SHARED_ENTITIES) {
      expect(localSchema).toContain('workspace_id')
      expect(baseSql).toContain(`CREATE TABLE IF NOT EXISTS ${server}`)
    }
  })
})
