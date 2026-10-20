// ============================================
// docs/FINDING-multi-currency.sql, run for real.
//
// A diagnostic a person pastes into the live SQL editor must not fail there
// with a syntax error, and must not write. Each block is run on a real
// Postgres against a small world whose right answers are known by hand.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-findcur-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})

const FILE = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'FINDING-multi-currency.sql'),
  'utf8',
)

/** The statements of the file: comment lines dropped, split on the terminator. */
const statements = FILE.split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean)

const AFN_SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const IRT_SHOP = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

let sql: ReturnType<typeof postgres>

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  sql = postgres({ host: 'localhost', port: PORT, user: 'postgres', password: 'test', max: 1 })
  await sql.unsafe(`
    CREATE TABLE workspaces (id uuid PRIMARY KEY, base_currency text NOT NULL DEFAULT 'AFN');
    CREATE TABLE invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid,
      type text, currency text, total numeric(12,2), paid_amount numeric(12,2));
    CREATE TABLE payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid,
      direction text, currency text, amount numeric(18,2), status text);
    CREATE TABLE transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid,
      type text, currency text, amount numeric);
    CREATE TABLE payment_allocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid, payment_id uuid, invoice_id uuid, amount numeric(18,2));
    CREATE TABLE journal_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid,
      source_type text, source_id uuid, reversal_of uuid);
    CREATE TABLE exchange_rates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid);

    INSERT INTO workspaces VALUES ('${AFN_SHOP}', 'AFN'), ('${IRT_SHOP}', 'IRT');

    -- The AFN shop: two AFN sales, one USD sale (booked), one USD sale (not booked).
    INSERT INTO invoices (id, workspace_id, type, currency, total, paid_amount) VALUES
      ('11111111-1111-4111-8111-111111111111', '${AFN_SHOP}', 'sale', 'AFN', 1000, 0),
      ('22222222-2222-4222-8222-222222222222', '${AFN_SHOP}', 'sale', NULL, 500, 0),
      ('33333333-3333-4333-8333-333333333333', '${AFN_SHOP}', 'sale', 'USD', 100, 40),
      ('44444444-4444-4444-8444-444444444444', '${AFN_SHOP}', 'sale', 'USD', 50, 0),
    -- The toman shop: a toman sale is NOT foreign there; an AFN one is.
      ('55555555-5555-4555-8555-555555555555', '${IRT_SHOP}', 'sale', 'IRT', 900000, 0),
      ('66666666-6666-4666-8666-666666666666', '${IRT_SHOP}', 'sale', 'AFN', 700, 0);

    INSERT INTO journal_entries (workspace_id, source_type, source_id) VALUES
      ('${AFN_SHOP}', 'invoice', '33333333-3333-4333-8333-333333333333');

    -- An AFN payment of 40 allocated to the USD invoice: the unchecked case.
    INSERT INTO payments (id, workspace_id, direction, currency, amount, status) VALUES
      ('77777777-7777-4777-8777-777777777777', '${AFN_SHOP}', 'in', 'AFN', 40, 'posted'),
      ('88888888-8888-4888-8888-888888888888', '${AFN_SHOP}', 'in', 'USD', 10, 'cancelled');
    INSERT INTO payment_allocations (workspace_id, payment_id, invoice_id, amount) VALUES
      ('${AFN_SHOP}', '77777777-7777-4777-8777-777777777777',
       '33333333-3333-4333-8333-333333333333', 40);
  `)
}, 120_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

describe('FINDING-multi-currency', () => {
  it('⚠️ is five statements and every one is a read', () => {
    expect(statements).toHaveLength(5)
    for (const statement of statements) {
      expect(statement).toMatch(/^(WITH|SELECT)\b/)
      expect(statement).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT)\b/i)
    }
  })

  it('selects no name, phone or document number', () => {
    for (const statement of statements) {
      expect(statement).not.toMatch(/full_name|phone|email|invoice_number|payment_number|\bname\b/i)
    }
  })

  it('Q1 — «foreign» is measured against each business’s own books currency', async () => {
    const rows = await sql.unsafe(statements[0] as string)
    const of = (kind: string, currency: string) =>
      rows.filter((row) => row.kind === kind && row.currency === currency)

    // USD in the AFN shop: two invoices, foreign.
    expect(of('invoice_sale', 'USD')).toEqual([
      expect.objectContaining({
        foreign_to_books: true,
        documents: '2',
        sum_in_that_currency: '150.00',
      }),
    ])
    // AFN appears twice: at home in one shop, foreign in the toman shop.
    expect(of('invoice_sale', 'AFN').map((row) => [row.foreign_to_books, row.documents])).toEqual(
      expect.arrayContaining([
        [false, '1'],
        [true, '1'],
      ]),
    )
    // Toman in the toman shop is not foreign; a currency-less invoice is «(none)».
    expect(of('invoice_sale', 'IRT')[0]).toMatchObject({ foreign_to_books: false })
    expect(of('invoice_sale', '(none)')[0]).toMatchObject({
      foreign_to_books: false,
      documents: '1',
    })
    // The cancelled payment is not counted.
    expect(rows.filter((row) => row.kind === 'payment_in')).toHaveLength(1)
  })

  it('Q2 — names the two businesses, by eight characters of their id', async () => {
    const rows = await sql.unsafe(statements[1] as string)
    expect(rows.map((row) => [row.business, row.books_currency, row.foreign_invoices])).toEqual([
      ['aaaaaaaa', 'AFN', '2'],
      ['bbbbbbbb', 'IRT', '1'],
    ])
  })

  it('Q3 — finds the payment allocated to an invoice of another currency', async () => {
    const rows = await sql.unsafe(statements[2] as string)
    expect(rows).toEqual([
      expect.objectContaining({
        payment_currency: 'AFN',
        invoice_currency: 'USD',
        allocations: '1',
        allocated_amount: '40.00',
      }),
    ])
  })

  it('Q4 — foreign invoices, split by whether the ledger booked them', async () => {
    const rows = await sql.unsafe(statements[3] as string)
    expect(rows.find((row) => row.currency === 'USD')).toMatchObject({
      invoices: '2',
      booked_in_ledger: '1',
      not_booked: '1',
      total_in_that_currency: '150.00',
      unpaid_in_that_currency: '110.00',
    })
  })

  it('Q5 runs', async () => {
    const [row] = await sql.unsafe(statements[4] as string)
    expect(row).toMatchObject({ rates_on_file: '0', revaluation_entries: '0' })
  })
})
