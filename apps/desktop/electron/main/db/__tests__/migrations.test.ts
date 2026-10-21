// ============================================
// ⚠️ THIS RUNS AGAINST A REAL SQLITE, ON A REAL v1/v2 DATABASE.
//
// `CREATE TABLE IF NOT EXISTS` does nothing to a table that already exists, so
// a column added to the shared schema appears for new installs and is missing
// for everyone who has been using the app. Every read of that table then fails
// on exactly the machines that have run longest — and a unit test that only
// creates a fresh database would never see it.
//
// So these tests build v1 and v2 caches first, with the old columns and real
// rows in it, and then open it with the current code.
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

/** v2 tables as shipped before Offline Edition v3. */
const V2_TABLES = `
CREATE TABLE IF NOT EXISTS product (
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
  dirty INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS customer (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  opening_balance REAL NOT NULL DEFAULT 0,
  type TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS invoice (
  id TEXT PRIMARY KEY,
  invoice_number TEXT,
  type TEXT NOT NULL DEFAULT 'sale',
  customer_id TEXT,
  customer_name TEXT,
  date TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  discount_total REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  payment_method TEXT,
  currency TEXT NOT NULL DEFAULT 'AFN',
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  updated_at TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS invoice_item (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  unit_price REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  total_price REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS "transaction" (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  supplier_id TEXT,
  type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AFN',
  description TEXT,
  reference TEXT,
  date TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS employee (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  salary REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`

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

/** A cache as it exists on a machine that has been running the old v1 build. */
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

/**
 * A v3 device: the outbox exists, but nobody recorded who made the change.
 *
 * This is the shape a device that has been running the offline build has: the
 * queue table is there, with no owner columns, and rows already in it.
 */
function seedV3WithQueuedChange(): void {
  const db = new DatabaseSync(file)
  db.exec(`CREATE TABLE IF NOT EXISTS sync_queue (
    client_id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    last_error TEXT,
    created_at TEXT NOT NULL
  )`)
  db.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('schema_version', '3')
  db.prepare(
    `INSERT INTO sync_queue (client_id, entity, operation, payload, attempts, status, last_error, created_at)
     VALUES (?, ?, ?, ?, 0, 'pending', NULL, ?)`,
  ).run('c1', 'invoice', 'create', JSON.stringify({ id: 'inv-1' }), '2026-10-01T00:00:00.000Z')
  db.close()
}

/** A realistic device database as it exists on a v2 device with financial rows. */
function seedRealisticV2(): void {
  const db = new DatabaseSync(file)
  db.exec(V2_TABLES)
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('schema_version', '2')

  // Products with float prices
  db.prepare(
    `INSERT INTO product (id, name, buy_price, sell_price, quantity, updated_at, version)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run('p1', 'زعفران ممتاز', 15.5, 25.0, 10, '2026-09-01T00:00:00.000Z', 1)

  db.prepare(
    `INSERT INTO product (id, name, buy_price, sell_price, quantity, updated_at, version)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run('p2', 'پسته اکبری', 800.75, 1200.5, 5, '2026-09-01T00:00:00.000Z', 1)

  // Customer with float opening balance
  db.prepare(
    `INSERT INTO customer (id, full_name, opening_balance, updated_at, version)
     VALUES (?, ?, ?, ?, ?)`,
  ).run('c1', 'احمد صراف', 500.25, '2026-09-01T00:00:00.000Z', 1)

  // Invoice with float amounts
  db.prepare(
    `INSERT INTO invoice (id, invoice_number, subtotal, discount_total, tax_total, total, paid_amount, currency, date, updated_at, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    'inv1',
    'INV-001',
    250.0,
    10.0,
    5.0,
    245.0,
    100.0,
    'AFN',
    '2026-09-01',
    '2026-09-01T00:00:00.000Z',
    1,
  )

  // Invoice item with float amounts
  db.prepare(
    `INSERT INTO invoice_item (id, invoice_id, product_name, quantity, unit_price, discount, total_price, updated_at, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run('item1', 'inv1', 'زعفران ممتاز', 10, 25.0, 1.0, 240.0, '2026-09-01T00:00:00.000Z', 1)

  // Employee with float salary
  db.prepare(
    `INSERT INTO employee (id, full_name, salary, updated_at, version)
     VALUES (?, ?, ?, ?, ?)`,
  ).run('emp1', 'کریم نجفی', 15000.5, '2026-09-01T00:00:00.000Z', 1)

  // Transaction with float amount
  db.prepare(
    `INSERT INTO "transaction" (id, customer_id, type, amount, currency, date, updated_at, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run('tx1', 'c1', 'payment', 100.25, 'AFN', '2026-09-01', '2026-09-01T00:00:00.000Z', 1)

  db.close()
}

describe('an existing cache survives a schema change', () => {
  it('⚠️ adds the new column to a v1 database instead of leaving it behind', () => {
    seedV1()

    expect(initDatabaseWith(TestDriver as never, file)).toBe(true)

    const { rows: rows } = query<{ id: string; name: string; version: number }>({
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
    expect(SCHEMA_VERSION).toBe(4)
  })

  it('⚠️ the outbox gets its owner, and a change already queued keeps no owner', () => {
    seedV3WithQueuedChange()
    expect(initDatabaseWith(TestDriver as never, file)).toBe(true)
    closeDatabase()

    const db = new DatabaseSync(file)
    const columns = (
      db.prepare('PRAGMA table_info(sync_queue)').all() as Array<{ name: string }>
    ).map((column) => column.name)
    const row = db
      .prepare('SELECT user_id, workspace_id FROM sync_queue WHERE client_id = ?')
      .get('c1') as { user_id: string | null; workspace_id: string | null }
    db.close()

    expect(columns).toContain('user_id')
    expect(columns).toContain('workspace_id')
    // The change was queued before the device knew who made it. The owner is
    // NOT guessed: it stays unknown until a person says whose it is.
    expect(row.user_id).toBeNull()
    expect(row.workspace_id).toBeNull()
  })

  it('⚠️ opening an already-migrated cache twice is harmless', () => {
    seedV1()
    expect(initDatabaseWith(TestDriver as never, file)).toBe(true)
    closeDatabase()
    expect(initDatabaseWith(TestDriver as never, file)).toBe(true)

    expect(query({ table: 'product', direction: 'desc', limit: 10, offset: 0 }).rows).toHaveLength(
      1,
    )
  })

  it('⚠️ a fresh database is already current and needs no migration', () => {
    expect(initDatabaseWith(TestDriver as never, file)).toBe(true)

    const written = upsertMany('product', [
      {
        id: 'p2',
        name: 'زنجیر',
        quantity: '5',
        updated_at: '2026-09-21T00:00:00.000Z',
        version: 7,
      },
    ])
    expect(written).toBe(1)

    const { rows: rows } = query<{ version: number }>({
      table: 'product',
      direction: 'desc',
      limit: 10,
      offset: 0,
    })
    expect(rows[0]?.version).toBe(7)
  })
})

describe('Gate 3 — v2 to v3 offline schema migration', () => {
  it('⚠️ converts floating money to integer minor units and preserves every row', () => {
    seedRealisticV2()

    expect(initDatabaseWith(TestDriver as never, file)).toBe(true)

    // Check product rows: 15.5 -> 1550, 25.0 -> 2500, 800.75 -> 80075
    const { rows: products } = query<{
      id: string
      name: string
      buy_price: number
      sell_price: number
      workspace_id: string
      sync_state: string
    }>({
      table: 'product',
      direction: 'asc',
      limit: 10,
      offset: 0,
      orderBy: 'id',
    })

    expect(products).toHaveLength(2)
    expect(products[0]?.buy_price).toBe(1550)
    expect(products[0]?.sell_price).toBe(2500)
    expect(products[0]?.workspace_id).toBe('')
    expect(products[0]?.sync_state).toBe('local_only')

    expect(products[1]?.buy_price).toBe(80075)
    expect(products[1]?.sell_price).toBe(120050)

    // Check customer: 500.25 -> 50025
    const { rows: customers } = query<{ id: string; full_name: string; opening_balance: number }>({
      table: 'customer',
      direction: 'asc',
      limit: 10,
      offset: 0,
    })
    expect(customers).toHaveLength(1)
    expect(customers[0]?.opening_balance).toBe(50025)

    // Check invoice: subtotal 250.0 -> 25000, discount 10.0 -> 1000, tax 5.0 -> 500, total 245.0 -> 24500, paid 100.0 -> 10000
    const { rows: invoices } = query<{
      id: string
      subtotal: number
      discount_total: number
      tax_total: number
      total: number
      paid_amount: number
      exchange_rate: number | null
    }>({
      table: 'invoice',
      direction: 'asc',
      limit: 10,
      offset: 0,
    })
    expect(invoices).toHaveLength(1)
    expect(invoices[0]?.subtotal).toBe(25000)
    expect(invoices[0]?.discount_total).toBe(1000)
    expect(invoices[0]?.tax_total).toBe(500)
    expect(invoices[0]?.total).toBe(24500)
    expect(invoices[0]?.paid_amount).toBe(10000)
    expect(invoices[0]?.exchange_rate).toBeNull()

    // Check invoice_item: unit_price 25.0 -> 2500, discount 1.0 -> 100, total_price 240.0 -> 24000
    const { rows: items } = query<{
      id: string
      unit_price: number
      discount: number
      total_price: number
    }>({
      table: 'invoice_item',
      direction: 'asc',
      limit: 10,
      offset: 0,
    })
    expect(items).toHaveLength(1)
    expect(items[0]?.unit_price).toBe(2500)
    expect(items[0]?.discount).toBe(100)
    expect(items[0]?.total_price).toBe(24000)

    // Check employee: salary 15000.5 -> 1500050
    const { rows: employees } = query<{ id: string; salary: number }>({
      table: 'employee',
      direction: 'asc',
      limit: 10,
      offset: 0,
    })
    expect(employees).toHaveLength(1)
    expect(employees[0]?.salary).toBe(1500050)

    // Check transaction: 100.25 -> 10025
    const { rows: txs } = query<{ id: string; amount: number }>({
      table: 'transaction',
      direction: 'asc',
      limit: 10,
      offset: 0,
    })
    expect(txs).toHaveLength(1)
    expect(txs[0]?.amount).toBe(10025)
  })

  it('⚠️ running migration TWICE on real device DB copy has zero loss and does not double-convert money', () => {
    seedRealisticV2()

    // Run 1
    expect(initDatabaseWith(TestDriver as never, file)).toBe(true)
    closeDatabase()

    // Run 2 (second launch)
    expect(initDatabaseWith(TestDriver as never, file)).toBe(true)

    // Assert prices were NOT scaled a second time (e.g. 1550 must remain 1550, NOT 155000)
    const { rows: products } = query<{ id: string; buy_price: number; sell_price: number }>({
      table: 'product',
      direction: 'asc',
      limit: 10,
      offset: 0,
      orderBy: 'id',
    })
    expect(products[0]?.buy_price).toBe(1550)
    expect(products[0]?.sell_price).toBe(2500)

    const { rows: invoices } = query<{ id: string; total: number }>({
      table: 'invoice',
      direction: 'asc',
      limit: 10,
      offset: 0,
    })
    expect(invoices[0]?.total).toBe(24500)
  })

  it('⚠️ creates all 15 new offline tables and allows querying them', () => {
    seedRealisticV2()
    expect(initDatabaseWith(TestDriver as never, file)).toBe(true)

    // Verify warehouses table
    expect(query({ table: 'warehouse', direction: 'asc', limit: 10, offset: 0 }).rows).toEqual([])

    // Insert a warehouse
    upsertMany('warehouse', [
      {
        id: 'w1',
        workspace_id: 'ws-test',
        name: 'انبار مرکزی کابل',
        location: 'چهارراهی صدارت',
        created_at: '2026-10-19T00:00:00.000Z',
        updated_at: '2026-10-19T00:00:00.000Z',
      },
    ])
    const { rows: warehouses } = query<{ id: string; name: string }>({
      table: 'warehouse',
      direction: 'asc',
      limit: 10,
      offset: 0,
    })
    expect(warehouses).toHaveLength(1)
    expect(warehouses[0]?.name).toBe('انبار مرکزی کابل')

    // Verify account table
    upsertMany('account', [
      {
        id: 'acc1',
        workspace_id: 'ws-test',
        code: '1010',
        name: 'صندوق افغانی',
        type: 'asset',
        created_at: '2026-10-19T00:00:00.000Z',
        updated_at: '2026-10-19T00:00:00.000Z',
      },
    ])
    const { rows: accounts } = query<{ id: string; code: string; name: string }>({
      table: 'account',
      direction: 'asc',
      limit: 10,
      offset: 0,
    })
    expect(accounts).toHaveLength(1)
    expect(accounts[0]?.code).toBe('1010')

    // Verify cost_layer table
    expect(query({ table: 'cost_layer', direction: 'asc', limit: 10, offset: 0 }).rows).toEqual([])

    // Verify payment table
    expect(query({ table: 'payment', direction: 'asc', limit: 10, offset: 0 }).rows).toEqual([])

    // Verify journal_entry table
    expect(query({ table: 'journal_entry', direction: 'asc', limit: 10, offset: 0 }).rows).toEqual(
      [],
    )
  })

  it('⚠️ journal_line CHECK constraint enforces debit >= 0, credit >= 0, not both', () => {
    expect(initDatabaseWith(TestDriver as never, file)).toBe(true)
    closeDatabase()

    const db = new DatabaseSync(file)

    // Valid debit line (debit > 0, credit = 0)
    expect(() => {
      db.prepare(
        `INSERT INTO journal_line (id, workspace_id, journal_id, account_id, debit, credit, created_at, updated_at)
         VALUES ('jl1', 'ws1', 'j1', 'a1', 1000, 0, '2026-10-19T00:00:00Z', '2026-10-19T00:00:00Z')`,
      ).run()
    }).not.toThrow()

    // Valid credit line (debit = 0, credit > 0)
    expect(() => {
      db.prepare(
        `INSERT INTO journal_line (id, workspace_id, journal_id, account_id, debit, credit, created_at, updated_at)
         VALUES ('jl2', 'ws1', 'j1', 'a2', 0, 1000, '2026-10-19T00:00:00Z', '2026-10-19T00:00:00Z')`,
      ).run()
    }).not.toThrow()

    // Invalid line: BOTH debit > 0 AND credit > 0
    expect(() => {
      db.prepare(
        `INSERT INTO journal_line (id, workspace_id, journal_id, account_id, debit, credit, created_at, updated_at)
         VALUES ('jl3', 'ws1', 'j1', 'a3', 1000, 500, '2026-10-19T00:00:00Z', '2026-10-19T00:00:00Z')`,
      ).run()
    }).toThrow(/CHECK constraint failed/)

    // Invalid line: negative debit
    expect(() => {
      db.prepare(
        `INSERT INTO journal_line (id, workspace_id, journal_id, account_id, debit, credit, created_at, updated_at)
         VALUES ('jl4', 'ws1', 'j1', 'a4', -100, 0, '2026-10-19T00:00:00Z', '2026-10-19T00:00:00Z')`,
      ).run()
    }).toThrow(/CHECK constraint failed/)

    // Invalid line: negative credit
    expect(() => {
      db.prepare(
        `INSERT INTO journal_line (id, workspace_id, journal_id, account_id, debit, credit, created_at, updated_at)
         VALUES ('jl5', 'ws1', 'j1', 'a5', 0, -100, '2026-10-19T00:00:00Z', '2026-10-19T00:00:00Z')`,
      ).run()
    }).toThrow(/CHECK constraint failed/)

    db.close()
  })
})
