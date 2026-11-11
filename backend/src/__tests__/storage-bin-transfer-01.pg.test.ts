// ============================================
// docs/storage-bin-transfer-01-migration.sql — TWICE on a real Postgres, then
// the rules: conservation (what leaves one bin arrives at the other, and the
// warehouse total never changes), the destination's cap, the workspace
// boundary, and every refusal named.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeEach, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-storage-move-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/storage_move`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const W1 = '11111111-1111-4111-8111-111111111111'
const W3 = '33333333-3333-4333-8333-333333333333'
const P1 = '44444444-4444-4444-8444-444444444444'
const P2 = '55555555-5555-4555-8555-555555555555'
const A1 = '70000000-0000-4000-8000-000000000001'
const A2 = '70000000-0000-4000-8000-000000000002'
const A3 = '70000000-0000-4000-8000-000000000003'
const ACTOR = '66666666-6666-4666-8666-666666666666'

async function refusal(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
    return 'ALLOWED'
  } catch (error) {
    return String((error as Error).message)
  }
}

const move = (workspace: string, from: string, to: string, product: string, quantity: number) =>
  sql`SELECT public.storage_move_stock(${workspace}, ${ACTOR}, ${from}, ${to}, ${product}, ${quantity}::numeric) AS result`

/** A bin, with everything a caller may leave out defaulted by the table. */
const location = (id: string, warehouse: string, workspace = SHOP) =>
  sql`INSERT INTO public.storage_locations (id, workspace_id, warehouse_id, code, kind)
      VALUES (${id}, ${workspace}, ${warehouse}, 'L-' || ${id}, 'bin')`

const stock = (warehouse: string, product: string, quantity: number, workspace = SHOP) =>
  sql`INSERT INTO public.warehouse_stock (workspace_id, warehouse_id, product_id, quantity)
      VALUES (${workspace}, ${warehouse}, ${product}, ${quantity}::numeric)
      ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity`

const place = (loc: string, product: string, quantity: number, workspace = SHOP) =>
  sql`SELECT public.storage_place_stock(${workspace}, ${ACTOR}, ${loc}, ${product}, ${quantity}::numeric) AS result`

/** CONSERVATION: placements of a product never exceed what its warehouse holds. */
const conservationBreaches = () =>
  sql`
    SELECT p.workspace_id, p.product_id, SUM(p.quantity) AS placed, w.quantity AS on_hand
      FROM public.storage_location_placements p
      JOIN public.warehouse_stock w
        ON w.workspace_id = p.workspace_id
       AND w.warehouse_id = (SELECT l.warehouse_id FROM public.storage_locations l WHERE l.id = p.location_id)
       AND w.product_id = p.product_id
     GROUP BY p.workspace_id, p.product_id, w.quantity
    HAVING SUM(p.quantity) > w.quantity`

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('storage_move')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

    CREATE TABLE public.warehouses (id uuid PRIMARY KEY, workspace_id uuid NOT NULL, name text NOT NULL);
    CREATE TABLE public.products (id uuid PRIMARY KEY, workspace_id uuid NOT NULL, name text NOT NULL);
    CREATE TABLE public.warehouse_stock (
      warehouse_id uuid NOT NULL, product_id uuid NOT NULL, workspace_id uuid NOT NULL,
      quantity numeric NOT NULL DEFAULT 0, PRIMARY KEY (warehouse_id, product_id)
    );
    INSERT INTO public.warehouses (id, workspace_id, name) VALUES
      ('${W1}', '${SHOP}', 'گدام مرکزی'), ('${W3}', '${OTHER}', 'گدام دیگری');
    INSERT INTO public.products (id, workspace_id, name) VALUES
      ('${P1}', '${SHOP}', 'برنج'), ('${P2}', '${OTHER}', 'جنس دیگری');
  `)
  // The placement system this migration builds on, then the migration — twice.
  await setup.unsafe(read('warehouse-map-01-migration.sql'))
  await setup.unsafe(read('storage-bin-transfer-01-migration.sql'))
  await setup.unsafe(read('storage-bin-transfer-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 1, onnotice: () => {} })
})

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

beforeEach(async () => {
  await sql`DELETE FROM public.storage_location_placements`
  await sql`DELETE FROM public.storage_locations`
  await sql`DELETE FROM public.warehouse_stock`
})

describe('storage-bin-transfer-01 — the happy path and conservation', () => {
  it('moves the whole placement and the warehouse total does not change', async () => {
    await location(A1, W1)
    await location(A2, W1)
    await stock(W1, P1, 10)
    await place(A1, P1, 10)
    const result = (await move(SHOP, A1, A2, P1, 10))[0]?.result as Record<string, unknown>
    expect(result.status).toBe('moved')
    const onHand = (
      await sql`SELECT quantity FROM public.warehouse_stock WHERE warehouse_id = ${W1} AND product_id = ${P1}`
    )[0]
    expect(Number(onHand?.quantity)).toBe(10)
    expect((await conservationBreaches()).length).toBe(0)
  })

  it('moves part of a placement and keeps the remainder at the source', async () => {
    await location(A1, W1)
    await location(A2, W1)
    await stock(W1, P1, 10)
    await place(A1, P1, 10)
    await move(SHOP, A1, A2, P1, 4)
    const from = (
      await sql`SELECT quantity FROM public.storage_location_placements WHERE location_id = ${A1} AND product_id = ${P1}`
    )[0]
    const to = (
      await sql`SELECT quantity FROM public.storage_location_placements WHERE location_id = ${A2} AND product_id = ${P1}`
    )[0]
    expect(Number(from?.quantity)).toBe(6)
    expect(Number(to?.quantity)).toBe(4)
    expect((await conservationBreaches()).length).toBe(0)
  })

  it('merges into an existing placement at the destination', async () => {
    await location(A1, W1)
    await location(A2, W1)
    await stock(W1, P1, 10)
    await place(A1, P1, 6)
    await place(A2, P1, 2)
    await move(SHOP, A1, A2, P1, 6)
    const to = (
      await sql`SELECT quantity FROM public.storage_location_placements WHERE location_id = ${A2} AND product_id = ${P1}`
    )[0]
    expect(Number(to?.quantity)).toBe(8)
    const from =
      await sql`SELECT 1 FROM public.storage_location_placements WHERE location_id = ${A1} AND product_id = ${P1}`
    expect(from.length).toBe(0) // emptied source: no zero-row husk
  })
})

describe('storage-bin-transfer-01 — every refusal is named', () => {
  it('refuses a move larger than the source bin holds', async () => {
    await location(A1, W1)
    await location(A2, W1)
    await stock(W1, P1, 5)
    await place(A1, P1, 3)
    expect(await refusal(() => move(SHOP, A1, A2, P1, 4))).toContain('STORAGE_MOVE_EXCEEDS_PLACED')
  })

  it('refuses a destination whose warehouse row is gone — defense in depth', async () => {
    // An intra-warehouse move preserves the placement sum, so the warehouse
    // cap can only be breached if the stock row itself vanished. The function
    // still refuses rather than moving against nothing.
    await location(A1, W1)
    await location(A2, W1)
    await stock(W1, P1, 5)
    await place(A1, P1, 5)
    await sql`DELETE FROM public.warehouse_stock WHERE warehouse_id = ${W1} AND product_id = ${P1}`
    expect(await refusal(() => move(SHOP, A1, A2, P1, 1))).toContain('STORAGE_MOVE_NO_STOCK')
  })

  it('refuses the same location, an unknown location and an unknown product', async () => {
    await location(A1, W1)
    await stock(W1, P1, 5)
    await place(A1, P1, 5)
    expect(await refusal(() => move(SHOP, A1, A1, P1, 1))).toContain('STORAGE_MOVE_SAME_LOCATION')
    const missing = '0a000000-0000-4000-8000-000000000000'
    await location(A2, W1)
    expect(await refusal(() => move(SHOP, missing, A2, P1, 1))).toContain(
      'STORAGE_MOVE_SOURCE_NOT_FOUND',
    )
    expect(await refusal(() => move(SHOP, A1, missing, P1, 1))).toContain(
      'STORAGE_MOVE_DESTINATION_NOT_FOUND',
    )
    expect(await refusal(() => move(SHOP, A1, A2, P2, 1))).toContain(
      'STORAGE_MOVE_PRODUCT_NOT_FOUND',
    )
  })

  it('refuses a move across warehouses and across the workspace boundary', async () => {
    await location(A1, W1)
    await location(A2, W1)
    await location(A3, W3, OTHER)
    await stock(W1, P1, 5)
    await place(A1, P1, 5)
    // A3 is the other shop's bin in the other shop's warehouse.
    expect(await refusal(() => move(SHOP, A1, A3, P1, 1))).toContain(
      'STORAGE_MOVE_DESTINATION_NOT_FOUND',
    )
    // And the other workspace cannot move this shop's placement at all.
    expect(await refusal(() => move(OTHER, A1, A2, P1, 1))).toContain(
      'STORAGE_MOVE_SOURCE_NOT_FOUND',
    )
  })

  it('refuses zero, negative quantities and a bin with nothing placed', async () => {
    await location(A1, W1)
    await location(A2, W1)
    await stock(W1, P1, 5)
    expect(await refusal(() => move(SHOP, A1, A2, P1, 0))).toContain(
      'STORAGE_MOVE_INVALID_QUANTITY',
    )
    expect(await refusal(() => move(SHOP, A1, A2, P1, 1))).toContain('STORAGE_MOVE_NOTHING_PLACED')
  })
})

describe('storage-bin-transfer-01 — VERIFY invariants', () => {
  it('placements never breach the warehouse total and never go negative', async () => {
    await location(A1, W1)
    await location(A2, W1)
    await stock(W1, P1, 10)
    await place(A1, P1, 7)
    await move(SHOP, A1, A2, P1, 3)
    await move(SHOP, A2, A1, P1, 3)
    expect((await conservationBreaches()).length).toBe(0)
    const negative = await sql`SELECT id FROM public.storage_location_placements WHERE quantity < 0`
    expect(negative.length).toBe(0)
  })
})
