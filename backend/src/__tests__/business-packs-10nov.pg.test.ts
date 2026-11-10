// ============================================
// The four migrations of 10 Nov 2026 (QA document: clothing, mobile/repair,
// money changer, salon) on a real Postgres, TWICE, then VERIFY,
// then the rules each one exists for:
//
//   variant-stock-01   a variant's stock is the movements that name it
//   retail-ops-01      repair events append-only; a move happens once; a held unit names whom for
//   exchange-01        selling more than is held is refused, under a lock
//   salon-01           one chair, one session at a time; a recipe is well-formed
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-business-packs-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/packs`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const U = '11111111-1111-4111-8111-111111111111'
const W = '22222222-2222-4222-8222-222222222222'
const P = '33333333-3333-4333-8333-333333333333'
const V1 = '44444444-4444-4444-8444-444444444441'
const V2 = '44444444-4444-4444-8444-444444444442'
const WH = '55555555-5555-4555-8555-555555555555'
const C = '66666666-6666-4666-8666-666666666666'
const SVC = '77777777-7777-4777-8777-777777777777'
const DYE = '88888888-8888-4888-8888-888888888888'

// The tables these four files lean on, in the shape the files need.
const BASE = `
  CREATE TABLE public.workspaces (id uuid PRIMARY KEY);
  CREATE TABLE public.products (id uuid PRIMARY KEY, workspace_id uuid, quantity numeric DEFAULT 0);
  CREATE TABLE public.product_variants (id uuid PRIMARY KEY, workspace_id uuid, template_product_id uuid);
  CREATE TABLE public.warehouses (id uuid PRIMARY KEY, workspace_id uuid, deleted_at timestamptz);
  CREATE TABLE public.customers (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.employees (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.branches (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.departments (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.invoices (id uuid PRIMARY KEY, workspace_id uuid);
  CREATE TABLE public.stock_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL, type text NOT NULL,
    quantity numeric NOT NULL DEFAULT 0, reference_type text, reference_id uuid, notes text,
    created_at timestamptz DEFAULT now(), user_id uuid NOT NULL, from_warehouse_id uuid,
    to_warehouse_id uuid, workspace_id uuid
  );
  CREATE TABLE public.stock_serials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL, product_id uuid NOT NULL,
    serial_number text NOT NULL, status text NOT NULL DEFAULT 'in_stock',
    CONSTRAINT stock_serials_status_check CHECK (status IN ('in_stock', 'sold', 'returned', 'scrapped'))
  );
  CREATE TABLE public.service_delivery_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL, customer_id uuid NOT NULL,
    service_offering_id uuid NOT NULL, practitioner_id uuid, session_date date NOT NULL,
    start_time varchar(10) NOT NULL, end_time varchar(10) NOT NULL, status varchar(30) NOT NULL DEFAULT 'scheduled',
    deleted_at timestamptz
  );
`

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('packs')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  `)
  await setup.unsafe(BASE)
  for (const file of [
    'variant-stock-01-migration.sql',
    'retail-ops-01-migration.sql',
    'exchange-01-migration.sql',
    'salon-01-migration.sql',
  ]) {
    // ⚠️ Twice: re-runnable, or nobody dares run it on a half-migrated database.
    await setup.unsafe(read(file))
    await setup.unsafe(read(file))
  }
  await setup.unsafe(`
    INSERT INTO public.workspaces VALUES ('${W}');
    INSERT INTO public.products (id, workspace_id) VALUES ('${P}', '${W}'), ('${SVC}', '${W}'), ('${DYE}', '${W}');
    INSERT INTO public.product_variants VALUES ('${V1}', '${W}', '${P}'), ('${V2}', '${W}', '${P}');
    INSERT INTO public.warehouses (id, workspace_id) VALUES ('${WH}', '${W}');
    INSERT INTO public.customers VALUES ('${C}', '${W}');
  `)
  await setup.end()
  sql = postgres(url, { max: 4, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('VERIFY files', () => {
  it.each([
    ['VERIFY-variant-stock-01.sql', 5],
    ['VERIFY-retail-ops-01.sql', 8],
    ['VERIFY-exchange-01.sql', 10],
    ['VERIFY-salon-01.sql', 9],
  ])('%s is all true', async (file, count) => {
    const rows = await sql.unsafe(read(file))
    expect(rows.length).toBe(count)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check_name)).toEqual([])
  })
})

describe('variant-stock-01', () => {
  it('reads a variant’s stock from the movements that name it, per warehouse', async () => {
    await sql`
      INSERT INTO public.stock_movements (product_id, variant_id, type, quantity, to_warehouse_id, workspace_id, user_id)
      VALUES (${P}, ${V1}, 'adjustment', 5, ${WH}, ${W}, ${U}),
             (${P}, ${V1}, 'sale', -2, ${WH}, ${W}, ${U}),
             (${P}, ${V2}, 'adjustment', 3, ${WH}, ${W}, ${U}),
             (${P}, NULL, 'adjustment', 10, ${WH}, ${W}, ${U})`
    const rows =
      await sql`SELECT * FROM public.product_variant_stock(${W}, ${P}) ORDER BY variant_id`
    expect(rows.map((r) => [r.variant_id, Number(r.quantity)])).toEqual([
      [V1, 3],
      [V2, 3],
    ])
  })

  it('refuses a movement naming a variant that does not exist', async () => {
    await expect(
      sql`INSERT INTO public.stock_movements (product_id, variant_id, type, quantity, workspace_id, user_id)
          VALUES (${P}, ${'99999999-9999-4999-8999-999999999999'}, 'adjustment', 1, ${W}, ${U})`,
    ).rejects.toThrow(/stock_movements_variant_fk/)
  })
})

describe('retail-ops-01', () => {
  it('moves a repair slip once, records the event, and never rewrites it', async () => {
    const [ticket] = await sql`
      INSERT INTO public.repair_tickets (workspace_id, customer_id, device_label, problem, created_by)
      VALUES (${W}, ${C}, 'Samsung A54', 'screen', ${U}) RETURNING id`
    const move = () =>
      sql`SELECT public.repair_ticket_move(${W}, ${ticket!.id}, 'received', 'diagnosing', null, null, ${U}) AS ok`
    const [a, b] = await Promise.all([move(), move()])
    expect([a![0]!.ok, b![0]!.ok].sort()).toEqual([false, true])
    const events =
      await sql`SELECT * FROM public.repair_ticket_events WHERE ticket_id = ${ticket!.id}`
    expect(events.length).toBe(1)
    await expect(sql`UPDATE public.repair_ticket_events SET note = 'x'`).rejects.toThrow(
      /append-only/,
    )
  })

  it('refuses an invoice on a slip that is not delivered', async () => {
    await expect(
      sql`INSERT INTO public.repair_tickets (workspace_id, customer_id, device_label, problem, created_by, invoice_id)
          VALUES (${W}, ${C}, 'x', 'y', ${U}, gen_random_uuid())`,
    ).rejects.toThrow()
  })

  it('a held unit names who it is held for', async () => {
    await expect(
      sql`INSERT INTO public.stock_serials (workspace_id, product_id, serial_number, status)
          VALUES (${W}, ${P}, 'IMEI-1', 'reserved')`,
    ).rejects.toThrow(/stock_serials_reserved_for/)
    await sql`INSERT INTO public.stock_serials (workspace_id, product_id, serial_number, status, reserved_for_customer_id)
              VALUES (${W}, ${P}, 'IMEI-2', 'reserved', ${C})`
  })
})

describe('exchange-01', () => {
  const trade = (side: string, amount: number, key: string | null = null) =>
    sql`SELECT public.fx_trade_create(${W}, ${U}, ${sql.json({
      side,
      currency: 'USD',
      amount_minor: amount,
      rate_micro: 70_250_000,
      book_currency: 'AFN',
      book_amount_minor: Math.round((amount / 100) * 70.25),
      client_request_id: key,
    })}) AS id`

  it('refuses to sell more than is held; two sales of the last dollars cannot both pass', async () => {
    await trade('buy', 10_000)
    await expect(trade('sell', 10_001)).rejects.toThrow(/FX_POSITION_SHORT/)
    const results = await Promise.allSettled([trade('sell', 6_000), trade('sell', 6_000)])
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1)
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(String(rejected.reason)).toMatch(/FX_POSITION_SHORT/)
    const [held] = await sql`SELECT public.fx_held_minor(${W}, 'USD') AS held`
    expect(Number(held!.held)).toBe(4_000)
  })

  it('the same request twice is one trade', async () => {
    const [a] = await trade('buy', 500, 'k-1')
    const [b] = await trade('buy', 500, 'k-1')
    expect(a!.id).toBe(b!.id)
  })

  it('a bought amount already sold cannot be voided', async () => {
    const [bought] = await trade('buy', 20_000)
    await trade('sell', 24_000)
    const [res] = await sql`SELECT public.fx_trade_void(${W}, ${bought!.id}, 'typo', ${U}) AS r`
    expect(res!.r).toBe('would_go_short')
  })

  it('pays an incoming remittance only against its code, once', async () => {
    const [row] = await sql`
      INSERT INTO public.remittances (workspace_id, direction, counterparty, sender_name, receiver_name,
        currency, amount_minor, payout_code_hash, created_by)
      VALUES (${W}, 'incoming', 'Herat office', 'Ali', 'Reza', 'USD', 5000, 'hash-ok', ${U}) RETURNING id`
    const pay = (hash: string) =>
      sql`SELECT public.remittance_move(${W}, ${row!.id}, 'created', 'paid', null, ${hash}, ${U}) AS r`
    expect((await pay('wrong'))[0]!.r).toBe('wrong_code')
    expect((await pay('hash-ok'))[0]!.r).toBe('moved_ok')
    expect((await pay('hash-ok'))[0]!.r).toBe('moved')
  })
})

describe('salon-01', () => {
  it('one chair, one session at a time; a cancelled one frees it', async () => {
    const [chair] = await sql`
      INSERT INTO public.service_resources (workspace_id, name, kind) VALUES (${W}, 'Chair 1', 'chair') RETURNING id`
    const book = (start: string, end: string) =>
      sql`INSERT INTO public.service_delivery_sessions
            (workspace_id, customer_id, service_offering_id, session_date, start_time, end_time, resource_id)
          VALUES (${W}, ${C}, ${SVC}, '2026-11-12', ${start}, ${end}, ${chair!.id}) RETURNING id`
    const [first] = await book('10:00', '11:00')
    await expect(book('10:30', '11:30')).rejects.toThrow(/SERVICE_RESOURCE_BUSY/)
    await book('11:00', '12:00') // touching, not overlapping
    await sql`UPDATE public.service_delivery_sessions SET status = 'cancelled' WHERE id = ${first!.id}`
    await book('10:15', '10:45')
  })

  it('a recipe is a list on the catalog row', async () => {
    await sql`INSERT INTO public.service_catalog (workspace_id, product_id, duration_minutes, warehouse_id, consumables)
              VALUES (${W}, ${SVC}, 45, ${WH}, ${sql.json([{ productId: DYE, quantity: 0.25 }])})`
    await expect(
      sql`INSERT INTO public.service_catalog (workspace_id, product_id, duration_minutes, consumables)
          VALUES (${W}, ${DYE}, 30, '{"not":"a list"}'::jsonb)`,
    ).rejects.toThrow(/service_catalog_consumables_list/)
  })
})
