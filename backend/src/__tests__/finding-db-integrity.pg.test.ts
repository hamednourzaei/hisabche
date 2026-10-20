// ============================================
// docs/FINDING-db-integrity.sql, run for real.
//
// A diagnostic a person pastes into the live SQL editor must not fail there
// with a syntax error, must not write, and must find what it claims to find.
// Every block is run on a real Postgres against a small world in which each
// rule is broken exactly once, by hand.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-finddb-'))
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
  join(__dirname, '..', '..', '..', 'docs', 'FINDING-db-integrity.sql'),
  'utf8',
)

/** The blocks of the file by their label («A1», «B2», …), comments dropped. */
const blocks = new Map<string, string>()
{
  let label = ''
  for (const line of FILE.split('\n')) {
    const heading = /^-- ([A-F][0-9])\. /.exec(line)
    if (heading) label = heading[1]!
    if (line.trim().startsWith('--') || !label) continue
    blocks.set(label, `${blocks.get(label) ?? ''}${line}\n`)
  }
}

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

let sql: ReturnType<typeof postgres>

async function run(label: string): Promise<Array<Record<string, unknown>>> {
  const text = blocks.get(label)
  if (!text) throw new Error(`no block ${label}`)
  return (await sql.unsafe(text)) as unknown as Array<Record<string, unknown>>
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  sql = postgres({ host: 'localhost', port: PORT, user: 'postgres', password: 'test', max: 1 })
  await sql.unsafe(`
    CREATE TABLE workspaces (id uuid PRIMARY KEY, base_currency text NOT NULL DEFAULT 'AFN');
    CREATE TABLE accounts (id uuid PRIMARY KEY, workspace_id uuid, code text);
    CREATE TABLE journal_entries (id uuid PRIMARY KEY, workspace_id uuid, entry_number text,
      date date, status text, source_type text, source_id uuid, reversal_of uuid,
      deleted_at timestamp);
    CREATE TABLE journal_lines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid,
      journal_id uuid, account_id uuid, debit numeric NOT NULL DEFAULT 0,
      credit numeric NOT NULL DEFAULT 0);
    CREATE TABLE customers (id uuid PRIMARY KEY, workspace_id uuid
      REFERENCES workspaces(id), CONSTRAINT customers_workspace_fk FOREIGN KEY (workspace_id)
      REFERENCES workspaces(id));
    CREATE TABLE suppliers (id uuid PRIMARY KEY, workspace_id uuid);
    CREATE TABLE products (id uuid PRIMARY KEY, workspace_id uuid, quantity numeric,
      buy_price numeric, currency text NOT NULL DEFAULT 'AFN');
    CREATE TABLE invoices (id uuid PRIMARY KEY, workspace_id uuid, type text, status text,
      currency text, date timestamptz, customer_id uuid, supplier_id uuid);
    CREATE TABLE invoice_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid,
      invoice_id uuid, product_id uuid, quantity numeric, total_price numeric);
    CREATE TABLE payments (id uuid PRIMARY KEY, workspace_id uuid NOT NULL, currency text,
      status text, journal_entry_id uuid);
    CREATE TABLE payment_allocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid, payment_id uuid, invoice_id uuid, amount numeric);
    CREATE TABLE cost_layers (id uuid PRIMARY KEY, workspace_id uuid, product_id uuid,
      received_qty numeric, remaining_qty numeric, unit_cost numeric,
      currency text NOT NULL DEFAULT 'AFN');
    CREATE TABLE cost_consumptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid, layer_id uuid, product_id uuid, consumer_type text, consumer_id uuid,
      quantity numeric, unit_cost numeric, amount numeric, is_estimated boolean DEFAULT false);
    CREATE TABLE stock_movements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid, product_id uuid);
    CREATE TABLE warehouses (id uuid PRIMARY KEY, workspace_id uuid);
    CREATE TABLE warehouse_stock (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid);
    CREATE TABLE transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid,
      currency text, created_at timestamptz DEFAULT now());
    CREATE TABLE employees (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid);
    CREATE TABLE payrolls (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid);
    CREATE TABLE ledger_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz DEFAULT now());
    CREATE TABLE sync_queue (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamp);
    CREATE TABLE sync_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamp);
    CREATE TABLE journal_lines_archive (archive_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      archived_at timestamptz DEFAULT now());

    INSERT INTO workspaces VALUES ('${A}', 'AFN'), ('${B}', 'IRR');
    INSERT INTO accounts VALUES ('${id(1)}', '${A}', '1000'), ('${id(2)}', '${B}', '1000'),
      ('${id(3)}', NULL, '9999');
    INSERT INTO customers (id, workspace_id) VALUES ('${id(10)}', '${A}'), ('${id(11)}', '${B}');
    INSERT INTO suppliers VALUES ('${id(15)}', '${A}');
    INSERT INTO products (id, workspace_id, quantity, buy_price) VALUES
      ('${id(20)}', '${A}', 20, 100),
      ('${id(21)}', '${A}', 4, 0),
      ('${id(22)}', '${B}', 0, 5);

    -- Entry 30: balanced. Entry 31: posted and 50 out. Entry 32: posted, no lines.
    INSERT INTO journal_entries (id, workspace_id, entry_number, date, status, source_type, source_id, reversal_of) VALUES
      ('${id(30)}', '${A}', 'JV-1', '2026-10-01', 'posted', 'invoice', '${id(40)}', NULL),
      ('${id(31)}', '${A}', 'JV-2', '2026-10-02', 'posted', 'manual', NULL, NULL),
      ('${id(32)}', '${A}', 'JV-3', '2026-10-03', 'posted', 'manual', NULL, '${id(999)}'),
      ('${id(33)}', '${A}', 'JV-4', '2026-10-03', 'posted', 'invoice', '${id(40)}', NULL);
    INSERT INTO journal_lines (workspace_id, journal_id, account_id, debit, credit) VALUES
      ('${A}', '${id(30)}', '${id(1)}', 100, 0),
      ('${A}', '${id(30)}', '${id(1)}', 0, 100),
      ('${A}', '${id(31)}', '${id(1)}', 150, 0),
      ('${A}', '${id(31)}', '${id(1)}', 0, 100),
      -- A line of workspace A on an account of workspace B, and one on both sides.
      ('${A}', '${id(33)}', '${id(2)}', 10, 10);

    -- Sale 40: AFN, product 20, no cost drawn. Sale 41: USD. Sale 42: A's invoice, B's customer.
    INSERT INTO invoices (id, workspace_id, type, status, currency, date, customer_id) VALUES
      ('${id(40)}', '${A}', 'sale', 'completed', 'AFN', '2026-10-01', '${id(10)}'),
      ('${id(41)}', '${A}', 'sale', 'completed', 'USD', '2026-10-02', '${id(10)}'),
      ('${id(42)}', '${A}', 'sale', 'completed', NULL, '2026-10-03', '${id(11)}');
    INSERT INTO invoice_items (workspace_id, invoice_id, product_id, quantity, total_price) VALUES
      ('${A}', '${id(40)}', '${id(20)}', 15, 450),
      ('${A}', '${id(41)}', '${id(20)}', 1, 30);
    INSERT INTO cost_layers (id, workspace_id, product_id, received_qty, remaining_qty, unit_cost) VALUES
      ('${id(50)}', '${A}', '${id(20)}', 5, 5, 100);
    INSERT INTO cost_consumptions (workspace_id, layer_id, product_id, consumer_type, consumer_id, quantity, unit_cost, amount) VALUES
      ('${A}', '${id(50)}', '${id(20)}', 'invoice', '${id(41)}', 1, 100, 100);

    -- An AFN payment settling the USD sale, and an allocation to an invoice that is gone.
    INSERT INTO payments (id, workspace_id, currency, status) VALUES ('${id(60)}', '${A}', 'AFN', 'posted');
    INSERT INTO payment_allocations (workspace_id, payment_id, invoice_id, amount) VALUES
      ('${A}', '${id(60)}', '${id(41)}', 30),
      ('${A}', '${id(60)}', '${id(998)}', 5);
    INSERT INTO ledger_entries DEFAULT VALUES;
  `)
}, 120_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

const count = (rows: Array<Record<string, unknown>>, key: string, value: string, field: string) =>
  Number(rows.find((row) => row[key] === value)?.[field] ?? -1)

describe('docs/FINDING-db-integrity.sql', () => {
  it('has every block, and none of them writes', () => {
    expect([...blocks.keys()]).toEqual([
      'A1',
      'A2',
      'B1',
      'B2',
      'C1',
      'C2',
      'D1',
      'D2',
      'D3',
      'E1',
      'E2',
      'E3',
      'F1',
      'F2',
      'F3',
    ])
    for (const text of blocks.values()) {
      expect(text.trim().toUpperCase().startsWith('SELECT')).toBe(true)
      expect(text).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT)\b/i)
    }
  })

  it('A1 — counts the rows with no workspace', async () => {
    const rows = await run('A1')
    expect(count(rows, 'table_name', 'accounts', 'rows_without_workspace')).toBe(1)
    expect(count(rows, 'table_name', 'invoices', 'rows_without_workspace')).toBe(0)
  })

  it('A2 — says which tenant columns the database does not check', async () => {
    const rows = await run('A2')
    const of = (name: string) => rows.find((row) => row.table_name === name)!
    expect(of('customers')).toMatchObject({ has_workspace_id: true, has_fk: true })
    expect(of('accounts')).toMatchObject({
      has_workspace_id: true,
      workspace_id_nullable: true,
      has_fk: false,
    })
    expect(of('payments')).toMatchObject({ workspace_id_nullable: false, has_fk: false })
    expect(of('ledger_entries')).toMatchObject({ has_workspace_id: false })
  })

  it('B1 — finds the line of one workspace on the account of another', async () => {
    const rows = await run('B1')
    expect(count(rows, 'reference', 'journal_lines → accounts', 'crossing_rows')).toBe(1)
    expect(count(rows, 'reference', 'invoices → customers', 'crossing_rows')).toBe(1)
    expect(count(rows, 'reference', 'cost_layers → products', 'crossing_rows')).toBe(0)
  })

  it('B2 — finds references to rows that are gone', async () => {
    const rows = await run('B2')
    expect(count(rows, 'reference', 'payment_allocations.invoice_id', 'orphan_rows')).toBe(1)
    expect(count(rows, 'reference', 'journal_entries.reversal_of', 'orphan_rows')).toBe(1)
    expect(count(rows, 'reference', 'cost_layers.product_id', 'orphan_rows')).toBe(0)
  })

  it('C1 — lists the posted entry that does not balance, and only that one', async () => {
    const rows = await run('C1')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ entry_number: 'JV-2' })
    expect(Number(rows[0]!.difference)).toBe(50)
  })

  it('C2 — finds bad line shapes, empty entries and a doubled source', async () => {
    const rows = await run('C2')
    expect(count(rows, 'problem', 'line on both sides at once', 'line_count')).toBe(1)
    expect(count(rows, 'problem', 'posted entry with no lines', 'line_count')).toBe(1)
    expect(count(rows, 'problem', 'two live entries for one source document', 'line_count')).toBe(1)
    expect(count(rows, 'problem', 'line with a negative amount', 'line_count')).toBe(0)
  })

  it('D1 — finds the afghani payment settling a dollar invoice', async () => {
    const rows = await run('D1')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ payment_currency: 'AFN', invoice_currency: 'USD' })
    expect(Number(rows[0]!.allocations)).toBe(1)
  })

  it('D2 — lists the currency columns and the default nobody chose', async () => {
    const rows = await run('D2')
    const products = rows.find(
      (row) => row.table_name === 'products' && row.column_name === 'currency',
    )
    expect(String(products?.column_default)).toContain('AFN')
    expect(
      rows.some((row) => row.table_name === 'workspaces' && row.column_name === 'base_currency'),
    ).toBe(true)
    expect(rows.some((row) => row.table_name === 'invoices' && row.is_nullable === 'YES')).toBe(
      true,
    )
  })

  it('D3 — counts missing and foreign currencies per table', async () => {
    const rows = await run('D3')
    const invoices = rows.find((row) => row.table_name === 'invoices')!
    expect(Number(invoices.no_currency)).toBe(1)
    expect(Number(invoices.not_books_currency)).toBe(1)
    expect(Number(invoices.all_rows)).toBe(3)
  })

  it('E1 — finds the sale that drew no cost (INV-000077), not the one that did', async () => {
    const rows = await run('E1')
    expect(rows).toHaveLength(1)
    expect(Number(rows[0]!.invoices_without_cost)).toBe(1)
    expect(Number(rows[0]!.revenue_without_cost)).toBe(450)
  })

  it('E2 — finds stock with no layer, split by whether it can be valued', async () => {
    const rows = await run('E2')
    const shop = rows.find((row) => row.workspace_id === A)!
    // Product 20: 20 on the shelf, 5 in layers → 15. Product 21: 4, no price.
    expect(Number(shop.products_with_unvalued_stock)).toBe(2)
    expect(Number(shop.unvalued_units)).toBe(19)
    expect(Number(shop.can_be_valued)).toBe(1)
    expect(Number(shop.no_purchase_price)).toBe(1)
    expect(Number(shop.value_at_purchase_price)).toBe(1500)
    expect(rows.some((row) => row.workspace_id === B)).toBe(false)
  })

  it('E3, F1, F2, F3 — run, and report what the world holds', async () => {
    const e3 = await run('E3')
    expect(count(e3, 'problem', 'layer with more remaining than received', 'row_count')).toBe(0)

    const f1 = await run('F1')
    expect(f1).toHaveLength(1)
    expect(String(f1[0]!.table_name)).toBe('customers')
    expect(Number(f1[0]!.constraints)).toBe(2)

    const f2 = await run('F2')
    expect(count(f2, 'table_name', 'ledger_entries', 'row_count')).toBe(1)
    expect(count(f2, 'table_name', 'sync_queue', 'row_count')).toBe(0)

    const f3 = await run('F3')
    expect(f3.some((row) => row.table_name === 'sync_queue')).toBe(true)
    expect(f3.some((row) => row.table_name === 'transactions')).toBe(false)
  })
})
