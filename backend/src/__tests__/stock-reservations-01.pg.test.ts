// ============================================
// docs/stock-reservations-01-migration.sql — TWICE on a real Postgres, then
// the rules: a reservation that cannot oversell (the stock row is locked for
// the check), an idempotency key that returns the promise it already made,
// ATP that never counts a hold as free, expired holds that stop counting,
// release and settle that leave history behind and refuse to run twice, and
// a workspace boundary the other workspace cannot cross.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeEach, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-stock-reservations-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/stock_reservations`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const W1 = '11111111-1111-4111-8111-111111111111'
const W3 = '33333333-3333-4333-8333-333333333333'
const P1 = '44444444-4444-4444-8444-444444444444'
const P2 = '55555555-5555-4555-8555-555555555555'
/** A product of the shop that has NO stock row anywhere. */
const P3 = '88888888-8888-4888-8888-888888888888'
const ACTOR = '66666666-6666-4666-8666-666666666666'

async function refusal(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
    return 'ALLOWED'
  } catch (error) {
    return String((error as Error).message)
  }
}

const stock = (warehouse: string, product: string, quantity: number, workspace = SHOP) =>
  sql`
    INSERT INTO public.warehouse_stock (workspace_id, warehouse_id, product_id, quantity)
    VALUES (${workspace}, ${warehouse}, ${product}, ${quantity}::numeric)
    ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity
  `

const reserve = (
  workspace: string,
  warehouse: string,
  product: string,
  quantity: number,
  key: string | null = null,
  expires: string | null = null,
) =>
  sql`SELECT public.stock_reserve(${workspace}, ${ACTOR}, ${warehouse}, ${product}, ${quantity}::numeric, 'sale_order', null, ${key}, ${expires}::timestamptz) AS result`

const release = (workspace: string, reservation: string, quantity: number | null = null) =>
  sql`SELECT public.stock_release_reservation(${workspace}, ${ACTOR}, ${reservation}, ${quantity}::numeric) AS result`

const settle = (workspace: string, reservation: string, quantity: number | null = null) =>
  sql`SELECT public.stock_settle_reservation(${workspace}, ${ACTOR}, ${reservation}, ${quantity}::numeric) AS result`

const available = (warehouse: string, product: string, workspace = SHOP) =>
  sql`SELECT public.stock_available(${workspace}, ${warehouse}, ${product})::numeric AS atp`

let seq = 0
const nextKey = () => {
  seq += 1
  return `key-${seq}-${Date.now()}`
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('stock_reservations')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

    CREATE TABLE public.warehouses (
      id uuid PRIMARY KEY,
      workspace_id uuid NOT NULL,
      name text NOT NULL
    );
    CREATE TABLE public.products (
      id uuid PRIMARY KEY,
      workspace_id uuid NOT NULL,
      name text NOT NULL
    );
    CREATE TABLE public.warehouse_stock (
      warehouse_id uuid NOT NULL,
      product_id uuid NOT NULL,
      workspace_id uuid NOT NULL,
      quantity numeric NOT NULL DEFAULT 0,
      PRIMARY KEY (warehouse_id, product_id)
    );

    INSERT INTO public.warehouses (id, workspace_id, name) VALUES
      ('${W1}', '${SHOP}',  'گدام مرکزی'),
      ('${W3}', '${OTHER}', 'گدام دیگری');
    INSERT INTO public.products (id, workspace_id, name) VALUES
      ('${P1}', '${SHOP}',  'برنج'),
      ('${P2}', '${OTHER}', 'جنس دیگری'),
      ('${P3}', '${SHOP}',  'بدون موجودی');
  `)
  // ⚠️ Twice. A migration that is not re-runnable is a migration nobody dares
  // run against a database that already has half of it.
  await setup.unsafe(read('stock-reservations-01-migration.sql'))
  await setup.unsafe(read('stock-reservations-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 1, onnotice: () => {} })
})

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

// Tests share one database on purpose (booting Postgres is expensive); every
// test starts from a clean reservation ledger so no hold leaks into the next.
beforeEach(async () => {
  await sql`DELETE FROM public.stock_reservations`
})

describe('stock-reservations-01 — schema', () => {
  it('created the table, the terminal-state rule and the four functions', async () => {
    const fns = await sql`
      SELECT proname FROM pg_proc
       WHERE pronamespace = 'public'::regnamespace
         AND proname IN ('stock_available','stock_reserve','stock_release_reservation','stock_settle_reservation')`
    expect(fns.length).toBe(4)
    const constraints = await sql`
      SELECT conname FROM pg_constraint
       WHERE conrelid = 'public.stock_reservations'::regclass
         AND conname IN ('stock_reservations_quantity_positive','stock_reservations_status','stock_reservations_state_terminal')`
    expect(constraints.length).toBe(3)
  })
})

describe('stock-reservations-01 — reserve', () => {
  it('reserves against real stock and ATP shows the hold', async () => {
    await stock(W1, P1, 10)
    const result = (await reserve(SHOP, W1, P1, 4, nextKey()))[0]?.result as Record<string, unknown>
    expect(result.status).toBe('reserved')
    const atp = (await available(W1, P1))[0]?.atp as string
    expect(Number(atp)).toBe(6)
  })

  it('is idempotent on the idempotency key', async () => {
    await stock(W1, P1, 10)
    const key = nextKey()
    const first = (await reserve(SHOP, W1, P1, 2, key))[0]?.result as Record<string, unknown>
    const second = (await reserve(SHOP, W1, P1, 2, key))[0]?.result as Record<string, unknown>
    expect(first.status).toBe('reserved')
    expect(second.status).toBe('already_reserved')
    expect(String(second.reservation_id)).toBe(String(first.reservation_id))
    const rows = await sql`SELECT id FROM public.stock_reservations WHERE idempotency_key = ${key}`
    expect(rows.length).toBe(1)
    // And ATP counts the hold once, not twice.
    const atp = (await available(W1, P1))[0]?.atp as string
    expect(Number(atp)).toBe(8)
  })

  it('refuses to promise more than is available', async () => {
    await stock(W1, P1, 3)
    const message = await refusal(() => reserve(SHOP, W1, P1, 5, nextKey()))
    expect(message).toContain('STOCK_RESERVATION_INSUFFICIENT')
  })

  it('counts another active hold against the second caller — the oversell race', async () => {
    await stock(W1, P1, 5)
    await reserve(SHOP, W1, P1, 4, nextKey())
    const message = await refusal(() => reserve(SHOP, W1, P1, 2, nextKey()))
    expect(message).toContain('STOCK_RESERVATION_INSUFFICIENT')
  })

  it('refuses a product with no stock row at all', async () => {
    const message = await refusal(() => reserve(SHOP, W1, P3, 1, nextKey()))
    expect(message).toContain('STOCK_RESERVATION_NO_STOCK')
  })

  it('refuses a zero or negative quantity', async () => {
    await stock(W1, P1, 5)
    expect(await refusal(() => reserve(SHOP, W1, P1, 0, nextKey()))).toContain(
      'STOCK_RESERVATION_INVALID_QUANTITY',
    )
    expect(await refusal(() => reserve(SHOP, W1, P1, -2, nextKey()))).toContain(
      'STOCK_RESERVATION_INVALID_QUANTITY',
    )
  })

  it('ignores an expired hold when deciding what is available', async () => {
    await stock(W1, P1, 5)
    const past = new Date(Date.now() - 60_000).toISOString()
    await reserve(SHOP, W1, P1, 4, nextKey(), past)
    const atp = (await available(W1, P1))[0]?.atp as string
    expect(Number(atp)).toBe(5)
  })

  it('cannot cross the workspace boundary — another shop cannot hold this stock', async () => {
    await stock(W1, P1, 5)
    const message = await refusal(() => reserve(OTHER, W1, P1, 1, nextKey()))
    expect(message).toContain('STOCK_RESERVATION_NO_STOCK')
  })
})

describe('stock-reservations-01 — release', () => {
  it('releases the whole hold and keeps the row as history', async () => {
    await stock(W1, P1, 5)
    const made = (await reserve(SHOP, W1, P1, 3, nextKey()))[0]?.result as Record<string, unknown>
    const id = String(made?.reservation_id)
    const result = (await release(SHOP, id))[0]?.result as Record<string, unknown>
    expect(result.status).toBe('released')
    const atp = (await available(W1, P1))[0]?.atp as string
    expect(Number(atp)).toBe(5)
    const row = (
      await sql`SELECT status, released_quantity FROM public.stock_reservations WHERE id = ${id}`
    )[0]
    expect(row?.status).toBe('released')
    expect(Number(row?.released_quantity)).toBe(3)
  })

  it('releases part of a hold and keeps the rest active', async () => {
    await stock(W1, P1, 10)
    const made = (await reserve(SHOP, W1, P1, 6, nextKey()))[0]?.result as Record<string, unknown>
    const id = String(made?.reservation_id)
    const result = (await release(SHOP, id, 2))[0]?.result as Record<string, unknown>
    expect(result.status).toBe('partially_released')
    const atp = (await available(W1, P1))[0]?.atp as string
    expect(Number(atp)).toBe(6)
    const row = (
      await sql`SELECT status, quantity FROM public.stock_reservations WHERE id = ${id}`
    )[0]
    expect(row?.status).toBe('active')
    expect(Number(row?.quantity)).toBe(4)
  })

  it('refuses to release twice and refuses an unknown reservation', async () => {
    await stock(W1, P1, 5)
    const made = (await reserve(SHOP, W1, P1, 1, nextKey()))[0]?.result as Record<string, unknown>
    const id = String(made?.reservation_id)
    await release(SHOP, id)
    expect(await refusal(() => release(SHOP, id))).toContain('STOCK_RESERVATION_NOT_ACTIVE')
    const missing = '0a000000-0000-4000-8000-000000000000'
    expect(await refusal(() => release(SHOP, missing))).toContain('STOCK_RESERVATION_NOT_FOUND')
  })
})

describe('stock-reservations-01 — settle', () => {
  it('settles the hold WITHOUT moving stock — the sale decrements its own way', async () => {
    await stock(W1, P1, 10)
    const made = (await reserve(SHOP, W1, P1, 4, nextKey()))[0]?.result as Record<string, unknown>
    const id = String(made?.reservation_id)
    const result = (await settle(SHOP, id))[0]?.result as Record<string, unknown>
    expect(result.status).toBe('settled')
    // The hold no longer binds…
    const atp = (await available(W1, P1))[0]?.atp as string
    expect(Number(atp)).toBe(10)
    // …and the stock was NOT decremented a second time.
    const onHand = (
      await sql`SELECT quantity FROM public.warehouse_stock WHERE warehouse_id = ${W1} AND product_id = ${P1}`
    )[0]
    expect(Number(onHand?.quantity)).toBe(10)
  })

  it('settles part of a hold and keeps the rest active', async () => {
    await stock(W1, P1, 10)
    const made = (await reserve(SHOP, W1, P1, 5, nextKey()))[0]?.result as Record<string, unknown>
    const id = String(made?.reservation_id)
    const result = (await settle(SHOP, id, 2))[0]?.result as Record<string, unknown>
    expect(result.status).toBe('partially_settled')
    const atp = (await available(W1, P1))[0]?.atp as string
    expect(Number(atp)).toBe(7)
  })

  it('refuses to settle twice', async () => {
    await stock(W1, P1, 5)
    const made = (await reserve(SHOP, W1, P1, 1, nextKey()))[0]?.result as Record<string, unknown>
    const id = String(made?.reservation_id)
    await settle(SHOP, id)
    expect(await refusal(() => settle(SHOP, id))).toContain('STOCK_RESERVATION_NOT_ACTIVE')
  })
})

describe('stock-reservations-01 — VERIFY invariants', () => {
  it('holds never exceed on-hand and never cross warehouses', async () => {
    const breaches = await sql`
      WITH per_cell AS (
        SELECT workspace_id, warehouse_id, product_id, SUM(quantity) AS held
          FROM public.stock_reservations WHERE status = 'active'
         GROUP BY 1,2,3
      )
      SELECT c.* FROM per_cell c
      JOIN public.warehouse_stock w
        ON w.workspace_id = c.workspace_id AND w.warehouse_id = c.warehouse_id AND w.product_id = c.product_id
       WHERE c.held > w.quantity`
    expect(breaches.length).toBe(0)
    const cross = await sql`
      SELECT r.id FROM public.stock_reservations r
      LEFT JOIN public.warehouses w ON w.id = r.warehouse_id
       WHERE w.id IS NULL OR w.workspace_id IS DISTINCT FROM r.workspace_id`
    expect(cross.length).toBe(0)
  })
})
