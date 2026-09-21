// ============================================
// ⚠️ A MIGRATION RUNS ON A MACHINE NOBODY CAN REACH.
//
// If it throws, the app falls back to online-only and the person is simply
// working without a cache — on every launch, forever. There is no second
// chance and no way to patch that device's database by hand, so the SQL has
// to be right before it ships.
//
// The one that nearly shipped: one of the cached tables is called
// `transaction`, which is a reserved word. `ALTER TABLE transaction ADD
// COLUMN …` reads as the start of a transaction statement and fails with
// `near "transaction": syntax error`.
// ============================================

import { describe, expect, it } from 'vitest'

import { LOCAL_MIGRATIONS, migrationsFrom, isAlreadyApplied } from '../local-migrations'
import { CREATE_STATEMENTS, SCHEMA_VERSION, WRITABLE_COLUMNS } from '../local-schema'

/**
 * SQLite's keyword list, trimmed to words a table in this product could
 * plausibly be named. A name here must be quoted wherever it appears.
 */
const RESERVED = [
  'transaction',
  'order',
  'group',
  'index',
  'key',
  'table',
  'values',
  'check',
  'default',
  'references',
  'select',
  'from',
  'where',
  'limit',
  'offset',
  'having',
  'union',
  'primary',
  'unique',
  'add',
  'column',
  'view',
  'when',
  'then',
  'between',
  'like',
  'and',
  'or',
  'not',
  'null',
  'is',
  'in',
  'as',
  'by',
  'on',
  'set',
  'to',
  'end',
  'release',
  'action',
]

const tableNames = Object.keys(WRITABLE_COLUMNS)

describe('the local migrations are safe to run on a real device', () => {
  it('⚠️ quotes every table name that is a reserved SQL word', () => {
    const reservedTables = tableNames.filter((name) => RESERVED.includes(name.toLowerCase()))

    // Guards the guard: if this list ever becomes empty because a table was
    // renamed, the assertions below would pass while checking nothing.
    expect(reservedTables).toContain('transaction')

    for (const migration of LOCAL_MIGRATIONS) {
      for (const statement of migration.statements) {
        for (const table of reservedTables) {
          if (!statement.includes(table)) continue
          // `ALTER TABLE "transaction"`, never `ALTER TABLE transaction`.
          expect(statement).toContain(`"${table}"`)
          expect(statement).not.toMatch(new RegExp(`TABLE\\s+${table}\\b`))
        }
      }
    }
  })

  it('⚠️ every table in the schema is quoted in its CREATE too', () => {
    // The CREATE statements have always quoted `transaction`; this keeps the
    // next table added from being the one that is not.
    const reservedTables = tableNames.filter((name) => RESERVED.includes(name.toLowerCase()))

    for (const table of reservedTables) {
      const create = CREATE_STATEMENTS.find((s) => s.includes(table))
      expect(create).toBeDefined()
      expect(create).toContain(`"${table}"`)
    }
  })

  it('⚠️ names no table the schema does not have', () => {
    // A migration against a table that does not exist throws on every launch
    // and never gets past it.
    const known = new Set(tableNames)
    for (const migration of LOCAL_MIGRATIONS) {
      for (const statement of migration.statements) {
        const named = /ALTER TABLE "?(\w+)"?/.exec(statement)?.[1]
        if (named) expect(known.has(named)).toBe(true)
      }
    }
  })

  it('⚠️ covers every version between an old cache and this build', () => {
    // A gap means a device two versions behind skips one and keeps a column
    // the newer SQL expects to exist.
    const targets = LOCAL_MIGRATIONS.map((m) => m.to).sort((a, b) => a - b)
    expect(targets[targets.length - 1]).toBe(SCHEMA_VERSION)

    for (let version = 1; version < SCHEMA_VERSION; version += 1) {
      expect(migrationsFrom(version).length).toBeGreaterThan(0)
    }
  })

  it('⚠️ a cache newer than this build is left alone, not downgraded', () => {
    // The user may launch the newer app again tomorrow; dropping a column it
    // writes to would lose whatever it had stored there.
    expect(migrationsFrom(SCHEMA_VERSION)).toEqual([])
    expect(migrationsFrom(SCHEMA_VERSION + 5)).toEqual([])
  })

  it('⚠️ recognises an already-applied column without swallowing real errors', () => {
    expect(isAlreadyApplied(new Error('duplicate column name: version'))).toBe(true)
    // A locked database or a missing table must still surface — otherwise the
    // cache silently stays a version behind and every later migration is
    // skipped too.
    expect(isAlreadyApplied(new Error('database is locked'))).toBe(false)
    expect(isAlreadyApplied(new Error('no such table: product'))).toBe(false)
  })
})
