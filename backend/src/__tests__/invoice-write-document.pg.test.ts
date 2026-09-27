// ============================================
// docs/invoice-write-document-migration.sql, run unchanged (twice) in a real
// Postgres, with the REAL stock projection trigger (stock_movements_project,
// read from docs/phase-c-01-inventory-source-of-truth-migration.sql).
//
// What only a real database proves:
//   - the document and its stock are ONE transaction: any bad row, and
//     nothing at all is written;
//   - an edit gives back EXACTLY what the invoice moved (48 for «2 cartons»,
//     not 2) and the shelf ends where the new lines put it;
//   - a stale version and a finalized invoice are refused before any write;
//   - clients cannot call it.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 57000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-invoice-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/invoice`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const migration = readFileSync(join(DOCS, 'invoice-write-document-migration.sql'), 'utf8')
const poMigration = readFileSync(join(DOCS, 'purchase-order-write-migration.sql'), 'utf8')
const phaseC = readFileSync(
  join(DOCS, 'phase-c-01-inventory-source-of-truth-migration.sql'),
  'utf8',
)
const projection = phaseC.slice(
  phaseC.indexOf('CREATE OR REPLACE FUNCTION stock_movements_project()'),
  phaseC.indexOf(
    '$project$;',
    phaseC.indexOf('CREATE OR REPLACE FUNCTION stock_movements_project()'),
  ) + '$project$;'.length,
)

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_WS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER = '11111111-1111-4111-8111-111111111111'
const PRODUCT = '22222222-2222-4222-8222-222222222222'
const WAREHOUSE = '33333333-3333-4333-8333-333333333333'

let seq = 0
const uuid = () => {
  seq++
  return `44444444-4444-4444-8444-${String(seq).padStart(12, '0')}`
}

type Json = Record<string, unknown>

async function write(args: {
  invoiceId: string
  header?: Json | null
  items?: Json[]
  details?: Json[]
  movements?: Json[]
  replace?: boolean
  patch?: Json | null
  version?: number | null
  workspace?: string
}) {
  await sql`
    SELECT public.invoice_write_document(
      ${args.workspace ?? WS}::uuid, ${args.invoiceId}::uuid, ${USER}::uuid,
      ${args.header === undefined || args.header === null ? null : sql.json(args.header as never)}::jsonb,
      ${sql.json((args.items ?? []) as never)}::jsonb,
      ${sql.json((args.details ?? []) as never)}::jsonb,
      ${sql.json((args.movements ?? []) as never)}::jsonb,
      ${args.replace ?? false},
      ${args.patch ? sql.json(args.patch as never) : null}::jsonb,
      ${args.version ?? null}::bigint
    )`
}

const header = (id: string, extra: Json = {}): Json => ({
  id,
  workspace_id: WS,
  invoice_number: `INV-${id.slice(-4)}`,
  type: 'sale',
  total: 0,
  ...extra,
})
const item = (invoiceId: string, qty: number, unit = 'piece'): Json => ({
  id: uuid(),
  invoice_id: invoiceId,
  product_id: PRODUCT,
  quantity: qty,
  unit,
})
const sale = (invoiceId: string, baseQty: number): Json => ({
  product_id: PRODUCT,
  type: 'sale',
  quantity: -baseQty,
  reference_type: 'invoice',
  reference_id: invoiceId,
  from_warehouse_id: WAREHOUSE,
  workspace_id: WS,
  user_id: USER,
})

async function onHand(): Promise<{ product: number; warehouse: number }> {
  const [p] = await sql<{ quantity: string }[]>`SELECT quantity FROM products WHERE id = ${PRODUCT}`
  const [w] = await sql<{ quantity: string }[]>`
    SELECT quantity FROM warehouse_stock WHERE warehouse_id = ${WAREHOUSE} AND product_id = ${PRODUCT}`
  return { product: Number(p?.quantity ?? 0), warehouse: Number(w?.quantity ?? 0) }
}
const count = async (table: string, invoiceId: string) => {
  const col =
    table === 'invoices' ? 'id' : table === 'stock_movements' ? 'reference_id' : 'invoice_id'
  const rows = await sql.unsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM ${table} WHERE ${col} = $1`,
    [invoiceId],
  )
  return rows[0]!.n
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('invoice')
  sql = postgres(url, { max: 2, onnotice: () => {} })
  await sql.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    CREATE TABLE products (id uuid PRIMARY KEY, workspace_id uuid, quantity numeric DEFAULT 0);
    CREATE TABLE warehouse_stock (
      warehouse_id uuid, product_id uuid, quantity numeric DEFAULT 0, workspace_id uuid, user_id uuid,
      updated_at timestamptz DEFAULT now(), PRIMARY KEY (warehouse_id, product_id));
    CREATE TABLE invoices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL,
      invoice_number text UNIQUE, type text, total numeric DEFAULT 0, subtotal numeric DEFAULT 0,
      discount_total numeric DEFAULT 0, tax_total numeric DEFAULT 0, status text DEFAULT 'pending',
      version bigint NOT NULL DEFAULT 1, finalized_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz DEFAULT now());
    CREATE OR REPLACE FUNCTION bump_version() RETURNS trigger AS $b$
      BEGIN NEW.version := COALESCE(OLD.version, 1) + 1; RETURN NEW; END $b$ LANGUAGE plpgsql;
    CREATE TRIGGER invoices_bump BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION bump_version();
    CREATE TABLE invoice_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid NOT NULL REFERENCES invoices(id),
      product_id uuid, quantity numeric DEFAULT 0, unit text NOT NULL, created_at timestamptz DEFAULT now());
    CREATE TABLE invoice_item_details (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_item_id uuid NOT NULL REFERENCES invoice_items(id) ON DELETE CASCADE,
      title text NOT NULL, amount numeric NOT NULL DEFAULT 0);
    CREATE TABLE stock_movements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL, type text NOT NULL,
      quantity numeric NOT NULL DEFAULT 0, reference_type text, reference_id uuid,
      created_at timestamptz DEFAULT now(), user_id uuid NOT NULL,
      from_warehouse_id uuid, to_warehouse_id uuid, workspace_id uuid);
    CREATE TABLE purchase_orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), supplier_id uuid, status text DEFAULT 'pending',
      notes text, workspace_id uuid NOT NULL, user_id uuid, created_at timestamptz DEFAULT now());
    CREATE TABLE purchase_order_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      purchase_order_id uuid REFERENCES purchase_orders(id),
      product_id uuid, quantity numeric NOT NULL DEFAULT 0, unit_price numeric NOT NULL DEFAULT 0,
      total_price numeric NOT NULL DEFAULT 0, workspace_id uuid, user_id uuid);
  `)
  await sql.unsafe(projection)
  await sql.unsafe(`
    CREATE TRIGGER stock_movements_project_trg AFTER INSERT OR DELETE ON stock_movements
      FOR EACH ROW EXECUTE FUNCTION stock_movements_project();`)
  // Twice: re-runnable.
  await sql.unsafe(migration)
  await sql.unsafe(migration)
  // After the invoice migration: it defines document_write_rows.
  await sql.unsafe(poMigration)
  await sql.unsafe(poMigration)
}, 180_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  await sql.unsafe(`
    TRUNCATE stock_movements, invoice_item_details, invoice_items, invoices, warehouse_stock, products CASCADE;
    INSERT INTO products VALUES ('${PRODUCT}', '${WS}', 0);
    INSERT INTO stock_movements (product_id, type, quantity, user_id, to_warehouse_id, workspace_id)
      VALUES ('${PRODUCT}', 'purchase', 100, '${USER}', '${WAREHOUSE}', '${WS}');`)
})

describe('invoice_write_document — create', () => {
  it('header, items, details and stock land together', async () => {
    const id = uuid()
    const it1 = item(id, 2, 'carton')
    await write({
      invoiceId: id,
      header: header(id),
      items: [it1],
      details: [{ invoice_item_id: it1.id, title: 'اجرت', amount: 5 }],
      // «2 cartons» → 48 pieces: the backend converts; the function writes.
      movements: [sale(id, 48)],
    })
    expect(await count('invoices', id)).toBe(1)
    expect(await count('invoice_items', id)).toBe(1)
    expect(await onHand()).toEqual({ product: 52, warehouse: 52 })
  })

  it('⚠️ a bad row anywhere → NOTHING is written (no header without items, no stock without a document)', async () => {
    const id = uuid()
    const it1 = item(id, 1)
    await expect(
      write({
        invoiceId: id,
        header: header(id),
        items: [it1],
        // A detail naming an item that is not in this write.
        details: [{ invoice_item_id: uuid(), title: 'x', amount: 1 }],
        movements: [sale(id, 1)],
      }),
    ).rejects.toThrow(/detail names an item outside/)
    expect(await count('invoices', id)).toBe(0)
    expect(await count('invoice_items', id)).toBe(0)
    expect(await onHand()).toEqual({ product: 100, warehouse: 100 })
  })

  it('⚠️ a failure in the LAST statement rolls back the first (details violate NOT NULL)', async () => {
    const id = uuid()
    const it1 = item(id, 1)
    await expect(
      write({
        invoiceId: id,
        header: header(id),
        items: [it1],
        details: [{ invoice_item_id: it1.id, title: null, amount: 1 }],
        movements: [sale(id, 1)],
      }),
    ).rejects.toThrow()
    expect(await count('invoices', id)).toBe(0)
    expect(await onHand()).toEqual({ product: 100, warehouse: 100 })
  })

  it('a movement for another workspace or another document is refused', async () => {
    const id = uuid()
    await expect(
      write({
        invoiceId: id,
        header: header(id),
        items: [],
        movements: [{ ...sale(id, 1), workspace_id: OTHER_WS }],
      }),
    ).rejects.toThrow(/another workspace or document/)
    await expect(
      write({ invoiceId: id, header: header(id), items: [], movements: [{ ...sale(uuid(), 1) }] }),
    ).rejects.toThrow(/another workspace or document/)
    expect(await count('invoices', id)).toBe(0)
  })

  it('a header for another workspace is refused', async () => {
    const id = uuid()
    await expect(
      write({ invoiceId: id, header: { ...header(id), workspace_id: OTHER_WS } }),
    ).rejects.toThrow(/header does not match/)
  })

  it('a duplicate invoice number (the replay shape) is 23505 and writes nothing', async () => {
    const a = uuid()
    const b = uuid()
    await write({
      invoiceId: a,
      header: header(a, { invoice_number: 'SAME' }),
      movements: [sale(a, 5)],
    })
    await expect(
      write({
        invoiceId: b,
        header: header(b, { invoice_number: 'SAME' }),
        movements: [sale(b, 5)],
      }),
    ).rejects.toMatchObject({ code: '23505' })
    expect(await onHand()).toEqual({ product: 95, warehouse: 95 })
  })
})

describe('invoice_write_document — edit', () => {
  async function created(baseQty: number) {
    const id = uuid()
    await write({
      invoiceId: id,
      header: header(id),
      items: [item(id, 2, 'carton')],
      movements: [sale(id, baseQty)],
    })
    return id
  }

  it('⚠️ gives back EXACTLY what was moved (48, not 2), then applies the new lines', async () => {
    const id = await created(48)
    expect((await onHand()).product).toBe(52)

    await write({
      invoiceId: id,
      items: [item(id, 1, 'carton')],
      movements: [sale(id, 24)],
      replace: true,
      patch: { total: 240, subtotal: 240 },
      version: 1,
    })
    expect(await onHand()).toEqual({ product: 76, warehouse: 76 })
    expect(await count('invoice_items', id)).toBe(1)
    const [row] = await sql<
      { total: string; version: string }[]
    >`SELECT total, version FROM invoices WHERE id = ${id}`
    expect(Number(row!.total)).toBe(240)
    expect(Number(row!.version)).toBe(2)
  })

  it('a second edit reverses the first edit too — never double', async () => {
    const id = await created(48)
    await write({
      invoiceId: id,
      items: [item(id, 1, 'carton')],
      movements: [sale(id, 24)],
      replace: true,
      version: 1,
    })
    await write({
      invoiceId: id,
      items: [item(id, 3, 'carton')],
      movements: [sale(id, 72)],
      replace: true,
      version: 1,
    })
    expect(await onHand()).toEqual({ product: 28, warehouse: 28 })
  })

  it('⚠️ a stale version is 40001 and changes nothing', async () => {
    const id = await created(48)
    await write({
      invoiceId: id,
      items: [],
      movements: [],
      replace: true,
      patch: { total: 1 },
      version: 1,
    })
    await expect(
      write({
        invoiceId: id,
        items: [item(id, 9)],
        movements: [sale(id, 9)],
        replace: true,
        patch: { total: 9 },
        version: 1,
      }),
    ).rejects.toMatchObject({ code: '40001' })
    const [row] = await sql<{ total: string }[]>`SELECT total FROM invoices WHERE id = ${id}`
    expect(Number(row!.total)).toBe(1)
    expect((await onHand()).product).toBe(100)
  })

  it('⚠️ a finalized invoice keeps its lines (55000)', async () => {
    const id = await created(48)
    await sql`UPDATE invoices SET finalized_at = now() WHERE id = ${id}`
    await expect(
      write({ invoiceId: id, items: [item(id, 1)], movements: [sale(id, 1)], replace: true }),
    ).rejects.toMatchObject({ code: '55000' })
    expect((await onHand()).product).toBe(52)
  })

  it('another workspace cannot edit it (P0002), and the patch may only set derived money', async () => {
    const id = await created(48)
    await expect(
      write({ invoiceId: id, replace: true, workspace: OTHER_WS }),
    ).rejects.toMatchObject({ code: 'P0002' })
    await expect(
      write({ invoiceId: id, replace: true, patch: { workspace_id: OTHER_WS } }),
    ).rejects.toThrow(/only set the derived money/)
  })
})

describe('access', () => {
  it('clients cannot call either function; the backend can', async () => {
    const [r] = await sql<{ anon: boolean; auth: boolean; svc: boolean; rows: boolean }[]>`
      SELECT has_function_privilege('anon', 'public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint)', 'EXECUTE') AS anon,
             has_function_privilege('authenticated', 'public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint)', 'EXECUTE') AS auth,
             has_function_privilege('service_role', 'public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint)', 'EXECUTE') AS svc,
             has_function_privilege('authenticated', 'public.document_write_rows(text, jsonb)', 'EXECUTE') AS rows`
    expect(r).toEqual({ anon: false, auth: false, svc: true, rows: false })
  })

  it('docs/rpc-client-revoke-migration.sql takes EXECUTE away from clients (every overload)', async () => {
    // Supabase's default: public functions are executable by anon and
    // authenticated. Two overloads, as a real schema may have after a
    // signature change.
    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION public.warehouse_transfer_stock(p_workspace_id uuid, p_user_id uuid, p_payload jsonb)
        RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $f$ SELECT '{}'::jsonb $f$;
      CREATE OR REPLACE FUNCTION public.warehouse_transfer_stock(p_workspace_id uuid)
        RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $f$ SELECT '{}'::jsonb $f$;
      GRANT EXECUTE ON FUNCTION public.warehouse_transfer_stock(uuid, uuid, jsonb) TO anon, authenticated;
      GRANT EXECUTE ON FUNCTION public.warehouse_transfer_stock(uuid) TO anon, authenticated;`)
    const revoke = readFileSync(join(DOCS, 'rpc-client-revoke-migration.sql'), 'utf8')
    await sql.unsafe(revoke)
    await sql.unsafe(revoke) // re-runnable
    const rows = await sql<{ anon: boolean; auth: boolean; svc: boolean }[]>`
      SELECT has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
             has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc
        FROM pg_proc p WHERE p.proname = 'warehouse_transfer_stock'`
    expect(rows).toHaveLength(2)
    for (const r of rows) expect(r).toEqual({ anon: false, auth: false, svc: true })
  })

  it('VERIFY-write-functions.sql runs, and the rows for THESE functions are ok', async () => {
    const verify = readFileSync(join(DOCS, 'VERIFY-write-functions.sql'), 'utf8')
    const rows = (await sql.unsafe(verify)) as unknown as Array<{ check: string; ok: boolean }>
    const mine = rows.filter((r) =>
      /^(invoice_write_document|document_write_rows|purchase_order_write):/.test(r.check),
    )
    expect(mine.length).toBe(12)
    expect(mine.filter((r) => r.ok !== true)).toEqual([])
  })

  it('document_write_rows refuses any table but the document tables', async () => {
    await expect(
      sql`SELECT public.document_write_rows('products', '[{"id":"x"}]'::jsonb)`,
    ).rejects.toThrow(/not a document table/)
  })
})

describe('purchase_order_write', () => {
  const po = (id: string, extra: Json = {}) => ({
    id,
    workspace_id: WS,
    status: 'pending',
    ...extra,
  })
  const line = (orderId: string, extra: Json = {}) => ({
    purchase_order_id: orderId,
    product_id: PRODUCT,
    quantity: 2,
    unit_price: 10,
    total_price: 20,
    workspace_id: WS,
    ...extra,
  })
  const call = (id: string, order: Json, items: Json[]) =>
    sql`SELECT public.purchase_order_write(${WS}::uuid, ${id}::uuid, ${sql.json(order as never)}::jsonb, ${sql.json(items as never)}::jsonb)`
  const orders = async (id: string) =>
    (
      await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM purchase_orders WHERE id = ${id}`
    )[0]!.n
  const lines = async (id: string) =>
    (
      await sql<
        { n: number }[]
      >`SELECT count(*)::int AS n FROM purchase_order_items WHERE purchase_order_id = ${id}`
    )[0]!.n

  it('header and lines land together', async () => {
    const id = uuid()
    await call(id, po(id), [line(id), line(id)])
    expect([await orders(id), await lines(id)]).toEqual([1, 2])
  })

  it('⚠️ a bad line → no header either (the compensating DELETE is gone because nothing half-lands)', async () => {
    const id = uuid()
    await expect(call(id, po(id), [line(id), line(id, { quantity: null })])).rejects.toThrow()
    expect([await orders(id), await lines(id)]).toEqual([0, 0])
  })

  it('⚠️ the same id twice (a retried keyed submit) → 23505, one order', async () => {
    const id = uuid()
    await call(id, po(id), [line(id)])
    await expect(call(id, po(id), [line(id)])).rejects.toMatchObject({ code: '23505' })
    expect([await orders(id), await lines(id)]).toEqual([1, 1])
  })

  it('a line for another order or workspace is refused', async () => {
    const id = uuid()
    await expect(call(id, po(id), [line(uuid())])).rejects.toThrow(/another order or workspace/)
    await expect(call(id, po(id), [line(id, { workspace_id: OTHER_WS })])).rejects.toThrow(
      /another order or workspace/,
    )
    expect(await orders(id)).toBe(0)
  })

  it('clients cannot call it', async () => {
    const [r] = await sql<{ a: boolean }[]>`
      SELECT has_function_privilege('authenticated', 'public.purchase_order_write(uuid, uuid, jsonb, jsonb)', 'EXECUTE') AS a`
    expect(r!.a).toBe(false)
  })
})
