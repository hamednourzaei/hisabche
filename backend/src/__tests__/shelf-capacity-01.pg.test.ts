// ============================================
// docs/shelf-capacity-01-migration.sql — on a real Postgres, after
// warehouse-map-01, TWICE; then its VERIFY and the owner's own numbers
// (18 Oct 2026): 8 gearboxes in the warehouse, 2 on shelf A-3.
//
//   · a shelf cannot be RAISED past its capacity (all products, in units);
//   · a committed purchase fills the product's auto shelf up to the room left,
//     never more than the warehouse holds unshelved; the rest stays unshelved;
//   · once per (invoice, product): a retry allocates nothing twice;
//   · two purchases at once cannot overfill the shelf;
//   · nothing here touches warehouse_stock or stock_movements.
// ============================================

import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-shelf-capacity-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/shelf_capacity`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const W1 = '11111111-1111-4111-8111-111111111111'
const W2 = '22222222-2222-4222-8222-222222222222'
const GEARBOX = '44444444-4444-4444-8444-444444444444'
const HOSE = '55555555-5555-4555-8555-555555555555'
const A3 = '90000000-0000-4000-8000-0000000000a3'
const B1 = '90000000-0000-4000-8000-0000000000b1'
const OTHER_WH_SHELF = '90000000-0000-4000-8000-0000000000c1'
const ACTOR = '66666666-6666-4666-8666-666666666666'
const INV1 = 'f0000000-0000-4000-8000-000000000001'
const INV2 = 'f0000000-0000-4000-8000-000000000002'
const INV3 = 'f0000000-0000-4000-8000-000000000003'

async function refusal(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
    return 'ALLOWED'
  } catch (error) {
    return (error as Error).message
  }
}

const place = (loc: string, product: string, quantity: number) =>
  sql`SELECT public.storage_place_stock(${SHOP}, ${ACTOR}, ${loc}, ${product}, ${quantity}::numeric)`
const onShelf = async (loc: string, product: string) =>
  Number(
    (
      await sql`SELECT quantity FROM storage_location_placements WHERE location_id = ${loc} AND product_id = ${product}`
    )[0]?.quantity ?? 0,
  )
/** A committed purchase: the movement AND the projection the trigger would write. */
async function purchase(invoice: string, warehouse: string, product: string, qty: number) {
  await sql`INSERT INTO stock_movements (product_id, type, quantity, reference_type, reference_id, user_id, to_warehouse_id)
            VALUES (${product}, 'purchase', ${qty}::numeric, 'invoice', ${invoice}, ${ACTOR}, ${warehouse})`
  await sql`INSERT INTO warehouse_stock (workspace_id, warehouse_id, product_id, quantity)
            VALUES (${SHOP}, ${warehouse}, ${product}, ${qty}::numeric)
            ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = warehouse_stock.quantity + EXCLUDED.quantity`
}
const autoFill = (invoice: string) =>
  sql`SELECT public.storage_auto_shelve_invoice(${SHOP}, ${invoice}) AS result`

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('shelf_capacity')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    CREATE TABLE public.warehouses (id uuid PRIMARY KEY, workspace_id uuid NOT NULL, name text NOT NULL);
    CREATE TABLE public.products (id uuid PRIMARY KEY, workspace_id uuid NOT NULL, name text NOT NULL);
    CREATE TABLE public.warehouse_stock (
      warehouse_id uuid NOT NULL, product_id uuid NOT NULL, workspace_id uuid NOT NULL,
      quantity numeric NOT NULL DEFAULT 0, PRIMARY KEY (warehouse_id, product_id));
    CREATE TABLE public.stock_movements (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY, product_id uuid NOT NULL, type text NOT NULL,
      quantity numeric DEFAULT 0 NOT NULL, reference_type text, reference_id uuid, notes text,
      created_at timestamptz DEFAULT now(), user_id uuid NOT NULL,
      from_warehouse_id uuid, to_warehouse_id uuid);
    INSERT INTO public.warehouses VALUES ('${W1}', '${SHOP}', 'halakoi'), ('${W2}', '${SHOP}', 'حاجی');
    INSERT INTO public.products VALUES ('${GEARBOX}', '${SHOP}', 'گیربوکس اتوماتیک'), ('${HOSE}', '${SHOP}', 'شلنگ رادیات');
  `)
  await setup.unsafe(read('warehouse-map-01-migration.sql'))
  // ⚠️ Twice: re-runnable, or nobody dares run it on a half-migrated database.
  await setup.unsafe(read('shelf-capacity-01-migration.sql'))
  await setup.unsafe(read('shelf-capacity-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 4, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

beforeEach(async () => {
  await sql.unsafe(`
    DELETE FROM storage_auto_receipts; DELETE FROM storage_auto_shelves;
    DELETE FROM storage_location_placements; DELETE FROM storage_locations;
    DELETE FROM stock_movements; DELETE FROM warehouse_stock;
    INSERT INTO storage_locations (id, workspace_id, warehouse_id, code, kind, position_x, position_y, width, height, capacity, is_active) VALUES
      ('${A3}', '${SHOP}', '${W1}', 'A-3', 'shelf', 0, 0, 1, 1, 10, true),
      ('${B1}', '${SHOP}', '${W1}', 'B-1', 'shelf', 0, 0, 1, 1, NULL, true),
      ('${OTHER_WH_SHELF}', '${SHOP}', '${W2}', 'C-1', 'shelf', 0, 0, 1, 1, 10, true);
    INSERT INTO warehouse_stock (workspace_id, warehouse_id, product_id, quantity) VALUES
      ('${SHOP}', '${W1}', '${GEARBOX}', 8), ('${SHOP}', '${W1}', '${HOSE}', 10);
    INSERT INTO storage_location_placements (workspace_id, location_id, product_id, quantity) VALUES
      ('${SHOP}', '${A3}', '${GEARBOX}', 2);
  `)
})

describe('shelf-capacity-01', () => {
  it('VERIFY says ok on every row', async () => {
    const rows = await sql.unsafe(read('VERIFY-shelf-capacity-01.sql'))
    expect(rows.length).toBe(10)
    expect(rows.filter((row) => row.ok !== true)).toEqual([])
  })
})

describe('capacity is enforced on the shelf', () => {
  it('8 in the warehouse, 2 on A-3 (capacity 10): adding 4 → 6 on the shelf, 2 unshelved', async () => {
    await place(A3, GEARBOX, 2 + 4)
    expect(await onShelf(A3, GEARBOX)).toBe(6)
  })

  it('the shelf counts EVERY product on it: 6 gearboxes + 5 hoses would be 11 of 10', async () => {
    await place(A3, GEARBOX, 6)
    expect(await refusal(() => place(A3, HOSE, 5))).toContain('STORAGE_PLACEMENT_EXCEEDS_CAPACITY')
    await place(A3, HOSE, 4)
    expect(await onShelf(A3, HOSE)).toBe(4)
  })

  it('never more than the warehouse holds unshelved, whichever shelf it is on', async () => {
    await place(B1, GEARBOX, 5) // B-1 has no capacity: only the stock limits it
    // 8 held: 2 on A-3 + 5 on B-1 → 1 left for A-3.
    expect(await refusal(() => place(A3, GEARBOX, 4))).toContain('STORAGE_PLACEMENT_EXCEEDS_STOCK')
    await place(A3, GEARBOX, 3)
  })

  it('an over-full shelf can still be LOWERED — that is how it gets fixed', async () => {
    await sql`UPDATE storage_locations SET capacity = 1 WHERE id = ${A3}`
    expect(await refusal(() => place(A3, GEARBOX, 3))).toContain(
      'STORAGE_PLACEMENT_EXCEEDS_CAPACITY',
    )
    await place(A3, GEARBOX, 1)
    expect(await onShelf(A3, GEARBOX)).toBe(1)
  })

  it('negative is refused; a placement writes no stock and no movement', async () => {
    expect(await refusal(() => place(A3, GEARBOX, -1))).toContain('STORAGE_PLACEMENT_NEGATIVE')
    await place(A3, GEARBOX, 5)
    const held = await sql`SELECT quantity FROM warehouse_stock WHERE product_id = ${GEARBOX}`
    expect(Number(held[0]!.quantity)).toBe(8)
    expect((await sql`SELECT count(*)::int AS n FROM stock_movements`)[0]!.n).toBe(0)
  })
})

describe('a purchase fills its auto shelf, up to the room left', () => {
  beforeEach(async () => {
    await sql`INSERT INTO storage_auto_shelves (workspace_id, warehouse_id, product_id, location_id)
              VALUES (${SHOP}, ${W1}, ${GEARBOX}, ${A3})`
  })

  it('room 8, bought 5 → all 5 on A-3', async () => {
    await purchase(INV1, W1, GEARBOX, 5)
    const [row] = await autoFill(INV1)
    expect(row!.result).toEqual([
      expect.objectContaining({ productId: GEARBOX, received: 5, allocated: 5, overflow: 0 }),
    ])
    expect(await onShelf(A3, GEARBOX)).toBe(7)
  })

  it('the owner’s case: 6 on A-3 (room 4), bought 5 → 4 placed, 1 stays unshelved', async () => {
    await place(A3, GEARBOX, 6)
    await purchase(INV1, W1, GEARBOX, 5)
    const [row] = await autoFill(INV1)
    expect(row!.result).toEqual([expect.objectContaining({ allocated: 4, overflow: 1 })])
    expect(await onShelf(A3, GEARBOX)).toBe(10)
    const held = Number(
      (
        await sql`SELECT quantity FROM warehouse_stock WHERE product_id = ${GEARBOX} AND warehouse_id = ${W1}`
      )[0]!.quantity,
    )
    expect(held).toBe(13) // 13 held: 10 on A-3, 3 unshelved (2 old + 1 that did not fit)
  })

  it('a full shelf receives nothing', async () => {
    await sql`UPDATE storage_locations SET capacity = 2 WHERE id = ${A3}`
    await purchase(INV1, W1, GEARBOX, 3)
    const [row] = await autoFill(INV1)
    expect(row!.result).toEqual([expect.objectContaining({ allocated: 0, overflow: 3 })])
    expect(await onShelf(A3, GEARBOX)).toBe(2)
  })

  it('a retry, a replay, a second call: allocated ONCE', async () => {
    await purchase(INV1, W1, GEARBOX, 3)
    await autoFill(INV1)
    await autoFill(INV1)
    await autoFill(INV1)
    expect(await onShelf(A3, GEARBOX)).toBe(5)
    expect((await sql`SELECT count(*)::int AS n FROM storage_auto_receipts`)[0]!.n).toBe(1)
  })

  it('another warehouse, another product, a sale: nothing goes on A-3', async () => {
    await purchase(INV1, W2, GEARBOX, 3)
    await purchase(INV2, W1, HOSE, 3)
    await sql`INSERT INTO stock_movements (product_id, type, quantity, reference_type, reference_id, user_id, from_warehouse_id)
              VALUES (${GEARBOX}, 'sale', -1, 'invoice', ${INV3}, ${ACTOR}, ${W1})`
    await autoFill(INV1)
    await autoFill(INV2)
    await autoFill(INV3)
    expect(await onShelf(A3, GEARBOX)).toBe(2)
    expect(await onShelf(A3, HOSE)).toBe(0)
  })

  it('a purchase that never committed has no movements — and so no placement', async () => {
    const [row] = await autoFill(INV3)
    expect(row!.result).toEqual([])
    expect(await onShelf(A3, GEARBOX)).toBe(2)
  })

  it('two purchases at once cannot overfill the shelf (room 8, two × 6)', async () => {
    await purchase(INV1, W1, GEARBOX, 6)
    await purchase(INV2, W1, GEARBOX, 6)
    const results = await Promise.all([autoFill(INV1), autoFill(INV2)])
    const allocated = results
      .flatMap(([row]) => row!.result as Array<{ allocated: number }>)
      .reduce((sum, item) => sum + Number(item.allocated), 0)
    expect(allocated).toBe(8)
    expect(await onShelf(A3, GEARBOX)).toBe(10)
  })

  it('auto-fill writes no stock and no movement', async () => {
    await purchase(INV1, W1, GEARBOX, 3)
    const movements = (await sql`SELECT count(*)::int AS n FROM stock_movements`)[0]!.n
    await autoFill(INV1)
    expect((await sql`SELECT count(*)::int AS n FROM stock_movements`)[0]!.n).toBe(movements)
    const held = Number(
      (
        await sql`SELECT quantity FROM warehouse_stock WHERE product_id = ${GEARBOX} AND warehouse_id = ${W1}`
      )[0]!.quantity,
    )
    expect(held).toBe(11)
  })
})
