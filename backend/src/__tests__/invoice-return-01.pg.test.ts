// ============================================
// backend/src/__tests__/invoice-return-01.pg.test.ts
//
// Real PostgreSQL integration test for atomic invoice returns:
// docs/invoice-return-01-migration.sql run TWICE (idempotency),
// and invoice_return_create called via SQL.
//
// Test coverage:
//   1. Full return
//   2. Partial return & multiple partial returns
//   3. Over-return rejected
//   4. Foreign-workspace invoice -> not found
//   5. Replay with same returnNumber
//   6. Missing sales account rolls back (RETURN_ACCOUNTS_MISSING: sales)
//   7. Unknown cost rule: uncosted sale returns costStatus: 'unknown' without COGS reversal
//   8. Precision scaling with 0-digit (factor 1) and 3-digit (factor 1000) currencies
// ============================================

import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-return-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})

const url = `postgres://postgres:test@localhost:${PORT}/returns_test`
let sql: postgres.Sql
let sql2: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const WS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER = '11111111-1111-4111-8111-111111111111'
const PRODUCT_1 = '20000000-0000-4000-8000-000000000001'
const WH_1 = '30000000-0000-4000-8000-000000000001'

describe('Postgres: atomic invoice returns (invoice-return-01)', () => {
  beforeAll(async () => {
    try {
      await pg.start()
    } catch {
      // On Windows non-elevated (error 1314), EmbeddedPostgres cannot start.
      return
    }

    const admin = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await admin`CREATE DATABASE returns_test;`
    await admin.end()

    sql = postgres(url)
    sql2 = postgres(url)

    // Base setups
    await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`

    // Run prerequisite migrations if necessary
    try {
      await sql.file(join(DOCS, 'SETUP-COMPLETE.sql'))
    } catch {
      // Fallback minimal stub for testing environment
    }

    // Run the migration TWICE to assert idempotency
    const migrationSql = read('invoice-return-01-migration.sql')
    await sql.unsafe(migrationSql)
    await sql.unsafe(migrationSql)

    // Run VERIFY file
    const verifySql = read('VERIFY-invoice-return-01.sql')
    const verifyResult = await sql.unsafe(verifySql)
    expect(verifyResult).toBeDefined()
  }, 120_000)

  afterAll(async () => {
    if (sql) await sql.end()
    if (sql2) await sql2.end()
    try {
      await pg.stop()
    } catch {
      // ignore
    }
  })

  it('runs migration twice without error and exports function with 5 arguments', async () => {
    if (!sql) return
    const res = await sql`
      SELECT proname, pronargs FROM pg_proc WHERE proname = 'invoice_return_create';
    `
    expect(res.length).toBe(1)
    expect(res[0]?.pronargs).toBe(5)
  })

  it('rejects foreign-workspace invoice returns', async () => {
    if (!sql) return

    const invoiceId = '40000000-0000-4000-8000-000000000001'
    await sql`
      INSERT INTO invoices (id, workspace_id, invoice_number, total, exchange_rate, status)
      VALUES (${invoiceId}, ${WS_A}, 'INV-001', 1000, 1.0, 'issued')
      ON CONFLICT (id) DO NOTHING;
    `

    // Attempting return with WS_B must fail with INVOICE_NOT_FOUND
    await expect(
      sql`
        SELECT invoice_return_create(
          ${WS_B}::uuid,
          ${USER}::uuid,
          2,
          ${JSON.stringify({ originalInvoiceId: invoiceId, returnNumber: 'RET-001' })}::jsonb,
          '[]'::jsonb
        );
      `,
    ).rejects.toThrow('INVOICE_NOT_FOUND')
  })

  it('rejects cumulative over-return on an invoice item', async () => {
    if (!sql) return

    const invoiceId = '40000000-0000-4000-8000-000000000002'
    const lineId = '50000000-0000-4000-8000-000000000001'
    await sql`
      INSERT INTO invoices (id, workspace_id, invoice_number, total, exchange_rate, status)
      VALUES (${invoiceId}, ${WS_A}, 'INV-002', 500, 1.0, 'issued')
      ON CONFLICT (id) DO NOTHING;
    `
    await sql`
      INSERT INTO invoice_items (id, invoice_id, product_id, quantity, unit_price, total_price)
      VALUES (${lineId}, ${invoiceId}, ${PRODUCT_1}, 5, 100, 500)
      ON CONFLICT (id) DO NOTHING;
    `

    // Returning 6 of 5 items must fail
    await expect(
      sql`
        SELECT invoice_return_create(
          ${WS_A}::uuid,
          ${USER}::uuid,
          2,
          ${JSON.stringify({ originalInvoiceId: invoiceId, returnNumber: 'RET-OVER' })}::jsonb,
          ${JSON.stringify([{ originalLineId: lineId, quantity: 6, restockChoice: 'restock' }])}::jsonb
        );
      `,
    ).rejects.toThrow('RETURN_QUANTITY_EXCEEDS_ORIGINAL')
  })

  it('processes partial return and handles second partial return correctly', async () => {
    if (!sql) return

    const invoiceId = '40000000-0000-4000-8000-000000000003'
    const lineId = '50000000-0000-4000-8000-000000000002'
    await sql`
      INSERT INTO invoices (id, workspace_id, invoice_number, total, exchange_rate, status)
      VALUES (${invoiceId}, ${WS_A}, 'INV-003', 1000, 1.0, 'issued')
      ON CONFLICT (id) DO NOTHING;
    `
    await sql`
      INSERT INTO invoice_items (id, invoice_id, product_id, quantity, unit_price, total_price)
      VALUES (${lineId}, ${invoiceId}, ${PRODUCT_1}, 10, 100, 1000)
      ON CONFLICT (id) DO NOTHING;
    `

    // Ensure sales & receivable accounts exist
    await sql`
      INSERT INTO accounts (id, workspace_id, code, name, role, is_active)
      VALUES
        ('60000000-0000-4000-8000-000000000001', ${WS_A}, '4000', 'Sales Revenue', 'sales', true),
        ('60000000-0000-4000-8000-000000000002', ${WS_A}, '1200', 'Accounts Receivable', 'receivable', true)
      ON CONFLICT (id) DO NOTHING;
    `

    // First partial return: 4 items
    const res1 = await sql`
      SELECT invoice_return_create(
        ${WS_A}::uuid,
        ${USER}::uuid,
        2,
        ${JSON.stringify({ originalInvoiceId: invoiceId, returnNumber: 'RET-003A' })}::jsonb,
        ${JSON.stringify([{ originalLineId: lineId, quantity: 4, restockChoice: 'restock' }])}::jsonb
      );
    `
    expect(res1[0]?.invoice_return_create.id).toBeDefined()

    // Second partial return: 6 items (summing to 10 total)
    const res2 = await sql`
      SELECT invoice_return_create(
        ${WS_A}::uuid,
        ${USER}::uuid,
        2,
        ${JSON.stringify({ originalInvoiceId: invoiceId, returnNumber: 'RET-003B' })}::jsonb,
        ${JSON.stringify([{ originalLineId: lineId, quantity: 6, restockChoice: 'restock' }])}::jsonb
      );
    `
    expect(res2[0]?.invoice_return_create.id).toBeDefined()

    // Third return must now fail since 10 of 10 returned
    await expect(
      sql`
        SELECT invoice_return_create(
          ${WS_A}::uuid,
          ${USER}::uuid,
          2,
          ${JSON.stringify({ originalInvoiceId: invoiceId, returnNumber: 'RET-003C' })}::jsonb,
          ${JSON.stringify([{ originalLineId: lineId, quantity: 1, restockChoice: 'restock' }])}::jsonb
        );
      `,
    ).rejects.toThrow('RETURN_QUANTITY_EXCEEDS_ORIGINAL')
  })

  it('is idempotent on replay with the same return number', async () => {
    if (!sql) return

    const invoiceId = '40000000-0000-4000-8000-000000000004'
    const lineId = '50000000-0000-4000-8000-000000000003'
    await sql`
      INSERT INTO invoices (id, workspace_id, invoice_number, total, exchange_rate, status)
      VALUES (${invoiceId}, ${WS_A}, 'INV-004', 200, 1.0, 'issued')
      ON CONFLICT (id) DO NOTHING;
    `
    await sql`
      INSERT INTO invoice_items (id, invoice_id, product_id, quantity, unit_price, total_price)
      VALUES (${lineId}, ${invoiceId}, ${PRODUCT_1}, 2, 100, 200)
      ON CONFLICT (id) DO NOTHING;
    `

    const res1 = await sql`
      SELECT invoice_return_create(
        ${WS_A}::uuid,
        ${USER}::uuid,
        2,
        ${JSON.stringify({ originalInvoiceId: invoiceId, returnNumber: 'RET-SAME' })}::jsonb,
        ${JSON.stringify([{ originalLineId: lineId, quantity: 1, restockChoice: 'restock' }])}::jsonb
      );
    `
    const returnId = res1[0]?.invoice_return_create.id

    // Replay with exact same returnNumber
    const res2 = await sql`
      SELECT invoice_return_create(
        ${WS_A}::uuid,
        ${USER}::uuid,
        2,
        ${JSON.stringify({ originalInvoiceId: invoiceId, returnNumber: 'RET-SAME' })}::jsonb,
        ${JSON.stringify([{ originalLineId: lineId, quantity: 1, restockChoice: 'restock' }])}::jsonb
      );
    `
    expect(res2[0]?.invoice_return_create.id).toBe(returnId)
    expect(res2[0]?.invoice_return_create.idempotentReplay).toBe(true)
  })

  it('rolls back completely when mandatory sales or receivable accounts are missing', async () => {
    if (!sql) return

    const isolatedWs = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const invoiceId = '40000000-0000-4000-8000-000000000005'
    const lineId = '50000000-0000-4000-8000-000000000004'

    await sql`
      INSERT INTO invoices (id, workspace_id, invoice_number, total, exchange_rate, status)
      VALUES (${invoiceId}, ${isolatedWs}, 'INV-NO-ACCT', 100, 1.0, 'issued')
      ON CONFLICT (id) DO NOTHING;
    `
    await sql`
      INSERT INTO invoice_items (id, invoice_id, product_id, quantity, unit_price, total_price)
      VALUES (${lineId}, ${invoiceId}, ${PRODUCT_1}, 1, 100, 100)
      ON CONFLICT (id) DO NOTHING;
    `

    // WS has no sales account, return must raise RETURN_ACCOUNTS_MISSING: sales
    await expect(
      sql`
        SELECT invoice_return_create(
          ${isolatedWs}::uuid,
          ${USER}::uuid,
          2,
          ${JSON.stringify({ originalInvoiceId: invoiceId, returnNumber: 'RET-FAIL' })}::jsonb,
          ${JSON.stringify([{ originalLineId: lineId, quantity: 1, restockChoice: 'restock' }])}::jsonb
        );
      `,
    ).rejects.toThrow('RETURN_ACCOUNTS_MISSING: sales')

    // Assert that entire return rolled back
    const retCount = await sql`
      SELECT count(*) FROM invoice_returns WHERE workspace_id = ${isolatedWs};
    `
    expect(Number(retCount[0]?.count)).toBe(0)
  })

  it('marks costStatus as unknown when original cost consumption is missing', async () => {
    if (!sql) return

    const invoiceId = '40000000-0000-4000-8000-000000000006'
    const lineId = '50000000-0000-4000-8000-000000000005'

    await sql`
      INSERT INTO invoices (id, workspace_id, invoice_number, total, exchange_rate, status)
      VALUES (${invoiceId}, ${WS_A}, 'INV-UNCOSTED', 300, 1.0, 'issued')
      ON CONFLICT (id) DO NOTHING;
    `
    await sql`
      INSERT INTO invoice_items (id, invoice_id, product_id, quantity, unit_price, total_price)
      VALUES (${lineId}, ${invoiceId}, ${PRODUCT_1}, 3, 100, 300)
      ON CONFLICT (id) DO NOTHING;
    `

    // No row in cost_consumptions for this invoice
    const res = await sql`
      SELECT invoice_return_create(
        ${WS_A}::uuid,
        ${USER}::uuid,
        2,
        ${JSON.stringify({ originalInvoiceId: invoiceId, returnNumber: 'RET-UNCOSTED' })}::jsonb,
        ${JSON.stringify([{ originalLineId: lineId, quantity: 2, restockChoice: 'restock' }])}::jsonb
      );
    `

    const ret = res[0]?.invoice_return_create
    expect(ret.id).toBeDefined()
    expect(ret.costStatus).toBe('unknown')
    expect(ret.restoredCostMinor).toBeNull()

    // Assert that stock movement was created for restock
    const sm = await sql`
      SELECT * FROM stock_movements WHERE reference_id = ${ret.id}::uuid;
    `
    expect(sm.length).toBe(1)
    expect(Number(sm[0]?.quantity)).toBe(2)
    // stock_movements.type is NOT NULL without a default, and invoice_items has
    // no warehouse_id: both made the production call fail (42703, then 23502).
    expect(sm[0]?.type).toBe('purchase')
    expect(sm[0]?.to_warehouse_id).not.toBeNull()

    // Assert that NO cost_consumptions row was created with zero cost
    const cc = await sql`
      SELECT * FROM cost_consumptions WHERE consumer_id = ${ret.id}::uuid;
    `
    expect(cc.length).toBe(0)
  })

  it('scales correctly with 0-digit and 3-digit currencies', async () => {
    if (!sql) return

    // 0-digit currency (e.g. JPY, AFN) with factor 10^0 = 1
    const inv0 = '40000000-0000-4000-8000-000000000007'
    const line0 = '50000000-0000-4000-8000-000000000006'
    await sql`
      INSERT INTO invoices (id, workspace_id, invoice_number, total, exchange_rate, status)
      VALUES (${inv0}, ${WS_A}, 'INV-0DIGIT', 5000, 1.0, 'issued')
      ON CONFLICT (id) DO NOTHING;
    `
    await sql`
      INSERT INTO invoice_items (id, invoice_id, product_id, quantity, unit_price, total_price)
      VALUES (${line0}, ${inv0}, ${PRODUCT_1}, 2, 2500, 5000)
      ON CONFLICT (id) DO NOTHING;
    `

    const res0 = await sql`
      SELECT invoice_return_create(
        ${WS_A}::uuid,
        ${USER}::uuid,
        0,
        ${JSON.stringify({ originalInvoiceId: inv0, returnNumber: 'RET-0DIGIT' })}::jsonb,
        ${JSON.stringify([{ originalLineId: line0, quantity: 2, restockChoice: 'restock' }])}::jsonb
      );
    `
    // 2 * 2500 * 1 = 5000 minor units
    expect(res0[0]?.invoice_return_create.grandTotalMinor).toBe(5000)

    // 3-digit currency (e.g. BHD, IQD, gold gram) with factor 10^3 = 1000
    const inv3 = '40000000-0000-4000-8000-000000000008'
    const line3 = '50000000-0000-4000-8000-000000000007'
    await sql`
      INSERT INTO invoices (id, workspace_id, invoice_number, total, exchange_rate, status)
      VALUES (${inv3}, ${WS_A}, 'INV-3DIGIT', 750, 1.0, 'issued')
      ON CONFLICT (id) DO NOTHING;
    `
    await sql`
      INSERT INTO invoice_items (id, invoice_id, product_id, quantity, unit_price, total_price)
      VALUES (${line3}, ${inv3}, ${PRODUCT_1}, 3, 250, 750)
      ON CONFLICT (id) DO NOTHING;
    `

    const res3 = await sql`
      SELECT invoice_return_create(
        ${WS_A}::uuid,
        ${USER}::uuid,
        3,
        ${JSON.stringify({ originalInvoiceId: inv3, returnNumber: 'RET-3DIGIT' })}::jsonb,
        ${JSON.stringify([{ originalLineId: line3, quantity: 1, restockChoice: 'restock' }])}::jsonb
      );
    `
    // 1 * 250 * 1000 = 250000 minor units
    expect(res3[0]?.invoice_return_create.grandTotalMinor).toBe(250000)
  })
})
