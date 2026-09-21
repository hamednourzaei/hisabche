// ============================================
// ⚠️ THIS RUNS AGAINST A REAL SQLITE, ON A REAL v1 DATABASE.
//
// `CREATE TABLE IF NOT EXISTS` does nothing to a table that already exists, so
// a column added to the shared schema appears for new installs and is missing
// for everyone who has been using the app. Every read of that table then fails
// on exactly the machines that have run longest — and a unit test that only
// creates a fresh database would never see it.
//
// So these tests build a v1 cache first, with the old columns and real rows in
// it, and then open it with the current code.
// ============================================

import { DatabaseSync } from 'node:sqlite'

import { TestDriver } from './test-driver'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { SCHEMA_VERSION } from '@hisabche/app-bridge'

import { closeDatabase, initDatabaseWith, query, upsertMany } from '../database'

/** The schema exactly as v1 shipped it: no `version` column anywhere. */
const V1_PRODUCT = `CREATE TABLE IF NOT EXISTS product (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  barcode TEXT,
  sku TEXT,
  category TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  unit TEXT,
  min_stock_level REAL NOT NULL DEFAULT 0,
  buy_price REAL NOT NULL DEFAULT 0,
  sell_price REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 0
)`

const V1_META = `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hisabche-db-'))
  file = join(dir, 'hisabche.db')
})

afterEach(() => {
  closeDatabase()
  rmSync(dir, { recursive: true, force: true })
})

/** A cache as it exists on a machine that has been running the old build. */
function seedV1(): void {
  const db = new DatabaseSync(file)
  db.exec(V1_PRODUCT)
  db.exec(V1_META)
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('schema_version', '1')
  db.prepare(`INSERT INTO product (id, name, quantity, updated_at) VALUES (?, ?, ?, ?)`).run(
    'p1',
    'گردنبند',
    3,
    '2026-09-01T00:00:00.000Z',
  )
  db.close()
}

describe('an existing cache survives a schema change', () => {
  it('⚠️ adds the new column to a v1 database instead of leaving it behind', () => {
    seedV1()

    expect(initDatabaseWith(TestDriver as never, file)).toBe(true)

    // The row that was already there must still be there, with the new column
    // defaulted — not dropped, and not re-fetched from a server we may have no
    // connection to.
    const rows = query<{ id: string; name: string; version: number }>({
      table: 'product',
      direction: 'desc',
      limit: 10,
      offset: 0,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('گردنبند')
    expect(rows[0]?.version).toBe(1)
  })

  it('⚠️ stamps the new version, so the migration is not run forever', () => {
    seedV1()
    initDatabaseWith(TestDriver as never, file)
    closeDatabase()

    const db = new DatabaseSync(file)
    const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as {
      value: string
    }
    db.close()

    expect(Number(row.value)).toBe(SCHEMA_VERSION)
  })

  it('⚠️ opening an already-migrated cache twice is harmless', () => {
    // The second launch re-runs `CREATE TABLE IF NOT EXISTS` and finds the
    // version already current. `duplicate column name` must not surface as a
    // failed start-up.
    seedV1()
    expect(initDatabaseWith(TestDriver as never, file)).toBe(true)
    closeDatabase()
    expect(initDatabaseWith(TestDriver as never, file)).toBe(true)

    expect(query({ table: 'product', direction: 'desc', limit: 10, offset: 0 })).toHaveLength(1)
  })

  it('⚠️ a fresh database is already current and needs no migration', () => {
    expect(initDatabaseWith(TestDriver as never, file)).toBe(true)

    const written = upsertMany('product', [
      { id: 'p2', name: 'زنجیر', quantity: 5, updated_at: '2026-09-21T00:00:00.000Z', version: 7 },
    ])
    expect(written).toBe(1)

    const rows = query<{ version: number }>({
      table: 'product',
      direction: 'desc',
      limit: 10,
      offset: 0,
    })
    // The server's number is kept, not overwritten by the local default.
    expect(rows[0]?.version).toBe(7)
  })
})
