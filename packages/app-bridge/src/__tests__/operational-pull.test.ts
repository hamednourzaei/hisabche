// ============================================
// packages/app-bridge/src/__tests__/operational-pull.test.ts
//
// V70.2 — the device half of the four tables the pull did not carry.
//
// The server now sends product_variants, service_delivery_sessions,
// package_credit_ledger and repair_tickets. This guard proves the cache can
// receive them:
//
//   · each table exists in the schema a fresh install creates
//   · the contract names it (a table the IPC contract does not name cannot be
//     written by a pull at all)
//   · every column the cache will accept is a column the schema has — a name in
//     `WRITABLE_COLUMNS` that no CREATE or ALTER declares would turn the first
//     pulled row into a launch-time failure on the oldest caches
//   · v26 gives `product_variants` and `repair_tickets` the `version` the pull
//     sends, so the first offline edit is version-guarded instead of refused
// ============================================

import { describe, expect, it } from 'vitest'

import { localTableSchema } from '../contract'
import { LOCAL_MIGRATIONS, migrationsFrom } from '../local-migrations'
import { CREATE_STATEMENTS, SCHEMA_VERSION, WRITABLE_COLUMNS } from '../local-schema'

/** The four entities V70.2 added to the pull, and the local table each lands in. */
const ADDED = [
  'product_variants',
  'service_delivery_sessions',
  'package_credit_ledger',
  'repair_tickets',
] as const

/** Columns each table declares when the schema is created. */
function createdColumns(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const statement of CREATE_STATEMENTS) {
    const match = /CREATE TABLE IF NOT EXISTS "?(\w+)"?\s*\(([\s\S]*?)\n\s*\)/.exec(statement)
    if (!match) continue
    const columns = out.get(match[1]!) ?? new Set<string>()
    for (const line of match[2]!.split('\n')) {
      const column = /^\s*"?([a-z_][a-z0-9_]*)"?\s+[A-Za-z]/.exec(line)?.[1]
      if (column && !/^(constraint|primary|unique|foreign|check)$/i.test(column)) {
        columns.add(column.toLowerCase())
      }
    }
    out.set(match[1]!, columns)
  }
  return out
}

/** Columns added later, by every migration this build knows how to run. */
function alteredColumns(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const migration of LOCAL_MIGRATIONS) {
    for (const statement of migration.statements) {
      const match = /ALTER TABLE "?(\w+)"? ADD COLUMN "?(\w+)"?/i.exec(statement)
      if (!match) continue
      const columns = out.get(match[1]!) ?? new Set<string>()
      columns.add(match[2]!.toLowerCase())
      out.set(match[1]!, columns)
    }
  }
  return out
}

const created = createdColumns()
const altered = alteredColumns()

describe('the device has somewhere to put what the pull sends', () => {
  it.each(ADDED)('%s is a table the schema creates', (table) => {
    expect(created.has(table), `${table} is not in CREATE_STATEMENTS`).toBe(true)
    expect(created.get(table)!.has('id')).toBe(true)
    expect(created.get(table)!.has('workspace_id')).toBe(true)
  })

  it.each(ADDED)('%s is named by the IPC contract', (table) => {
    // `localTableSchema` is what `db.upsertMany` validates against: a table it
    // does not name is dropped, not stored.
    expect(localTableSchema.options).toContain(table)
  })

  it.each(ADDED)('%s accepts columns the schema actually has', (table) => {
    const writable = WRITABLE_COLUMNS[table]
    expect(writable, `${table} has no writable columns`).toBeDefined()
    expect(writable!.length).toBeGreaterThan(0)

    const declared = new Set([...(created.get(table) ?? []), ...(altered.get(table) ?? [])])
    expect(declared.size).toBeGreaterThan(0)
    expect(writable!.filter((column) => !declared.has(column))).toEqual([])
  })

  it.each(ADDED)('%s can be written at all — the pull has an id and a tenant', (table) => {
    const writable = WRITABLE_COLUMNS[table]!
    expect(writable).toEqual(expect.arrayContaining(['id', 'workspace_id']))
  })
})

describe('v26 gives the pulled rows their identity', () => {
  // ⚠️ PINNED BY VERSION, NOT «the latest». v27 and v28 landed later; a test
  // that read `SCHEMA_VERSION - 1` stopped describing v26 the day v27 shipped
  // and then failed for a reason that had nothing to do with its own columns.
  const v26 = LOCAL_MIGRATIONS.filter((migration) => migration.to === 26)[0]!

  it('is one step of the chain, and the chain ends at this build', () => {
    expect(v26, 'the v26 migration is missing').toBeDefined()
    const pending = migrationsFrom(SCHEMA_VERSION - 1)
    expect(pending.map((migration) => migration.to)).toEqual([SCHEMA_VERSION])
    expect(v26.to).toBeLessThanOrEqual(SCHEMA_VERSION)
  })

  it.each(['product_variants', 'repair_tickets'] as const)(
    'adds `version` to %s, the token the next offline edit sends back',
    (table) => {
      expect(v26.statements).toContain(
        `ALTER TABLE ${table} ADD COLUMN version INTEGER NOT NULL DEFAULT 1`,
      )
      expect(WRITABLE_COLUMNS[table]).toContain('version')
    },
  )

  it('gives repair_tickets the sync bookkeeping the other pulled tables have', () => {
    for (const column of ['origin', 'sync_state']) {
      expect(v26.statements).toContain(
        `ALTER TABLE repair_tickets ADD COLUMN ${column} TEXT NOT NULL DEFAULT '${
          column === 'origin' ? 'local' : 'local_only'
        }'`,
      )
      expect(WRITABLE_COLUMNS.repair_tickets).toContain(column)
    }
  })

  it('leaves the tables that already had a version alone', () => {
    for (const table of ['service_delivery_sessions', 'package_credit_ledger']) {
      expect(
        v26.statements.filter((statement) => statement.includes(table)),
        `${table} is not this migration's business`,
      ).toEqual([])
    }
  })
})
