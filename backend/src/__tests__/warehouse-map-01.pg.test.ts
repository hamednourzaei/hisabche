// ============================================
// docs/warehouse-map-01-migration.sql — TWICE on a real Postgres, then its
// VERIFY, then the rules: a code unique inside its warehouse, a parent that is
// in the same warehouse and cannot make a cycle, a rectangle and a capacity
// that are positive, and a placement that can never exceed what the warehouse
// actually holds.
//
// ⚠️ The last one is the whole point of this table. A shelf label that says 9
// while the warehouse holds 3 is how a map stops being trustworthy, so the
// write is refused rather than stored and shown.
// ============================================

import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-warehouse-map-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/warehouse_map`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

// Two businesses. Every tenancy rule is tested with a second one: a rule that
// is only tried against a single workspace never proves isolation.
const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const W1 = '11111111-1111-4111-8111-111111111111'
const W2 = '22222222-2222-4222-8222-222222222222'
const W3 = '33333333-3333-4333-8333-333333333333'
const W4 = '77777777-7777-4777-8777-777777777777'
const P1 = '44444444-4444-4444-8444-444444444444'
const P2 = '55555555-5555-4555-8555-555555555555'
const P3 = '88888888-8888-4888-8888-888888888888'
const ACTOR = '66666666-6666-4666-8666-666666666666'
/** A well-formed warehouse id that no row carries. */
const MISSING = '0a000000-0000-4000-8000-000000000000'

async function refusal(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
    return 'ALLOWED'
  } catch (error) {
    return (error as Error).message
  }
}

/** A location, with everything a caller may leave out defaulted by the table. */
const location = (
  id: string,
  warehouse: string,
  code: string,
  extra: Record<string, unknown> = {},
  workspace = SHOP,
) =>
  sql`
    INSERT INTO public.storage_locations
      (id, workspace_id, warehouse_id, code, kind, position_x, position_y, width, height,
       parent_id, capacity, is_active)
    VALUES (
      ${id}, ${workspace}, ${warehouse}, ${code},
      ${(extra.kind as string) ?? 'bin'},
      ${(extra.x as number) ?? 0}, ${(extra.y as number) ?? 0},
      ${(extra.w as number) ?? 1}, ${(extra.h as number) ?? 1},
      ${(extra.parent as string) ?? null},
      ${(extra.capacity as number) ?? null}::numeric,
      ${(extra.active as boolean) ?? true}
    )
  `

const place = (loc: string, product: string, quantity: number, workspace = SHOP) =>
  sql`SELECT public.storage_place_stock(${workspace}, ${ACTOR}, ${loc}, ${product}, ${quantity}::numeric) AS result`

/** The warehouse's real stock, as the projection would hold it. */
const stock = (warehouse: string, product: string, quantity: number, workspace = SHOP) =>
  sql`
    INSERT INTO public.warehouse_stock (workspace_id, warehouse_id, product_id, quantity)
    VALUES (${workspace}, ${warehouse}, ${product}, ${quantity}::numeric)
    ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity
  `

let seq = 0
const nextLocation = () => {
  seq += 1
  return `90000000-0000-4000-8000-${String(seq).padStart(12, '0')}`
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('warehouse_map')
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
      ('${W2}', '${SHOP}',  'گدام دوم'),
      ('${W4}', '${SHOP}',  'گدام چهارم'),
      ('${W3}', '${OTHER}', 'گدام دیگری');
    INSERT INTO public.products (id, workspace_id, name) VALUES
      ('${P1}', '${SHOP}',  'برنج'),
      ('${P3}', '${SHOP}',  'چای'),
      ('${P2}', '${OTHER}', 'جنس دیگری');
  `)
  // ⚠️ Twice. A migration that is not re-runnable is a migration nobody dares
  // run against a database that already has half of it.
  await setup.unsafe(read('warehouse-map-01-migration.sql'))
  await setup.unsafe(read('warehouse-map-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 2, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('warehouse-map-01', () => {
  it('VERIFY says ok on every row', async () => {
    const rows = await sql.unsafe(read('VERIFY-warehouse-map-01.sql'))
    expect(rows.length).toBe(17)
    expect(rows.filter((row) => row.ok !== true)).toEqual([])
  })

  it('a zone, a rack inside it and a bin inside that are stored with their rectangles', async () => {
    const zone = nextLocation()
    const rack = nextLocation()
    const bin = nextLocation()
    await location(zone, W1, 'Z01', { kind: 'zone', x: 0, y: 0, w: 12, h: 8 })
    await location(rack, W1, 'R01', { kind: 'rack', x: 1, y: 1, w: 4, h: 2, parent: zone })
    await location(bin, W1, 'S01', {
      kind: 'bin',
      x: 1,
      y: 1,
      w: 1,
      h: 1,
      parent: rack,
      capacity: 40,
    })

    const rows = await sql`
      SELECT code, kind, position_x::float AS x, capacity::float AS capacity
        FROM public.storage_locations
       WHERE id IN (${zone}, ${rack}, ${bin})
       ORDER BY code
    `
    expect(rows).toEqual([
      { code: 'R01', kind: 'rack', x: 1, capacity: null },
      { code: 'S01', kind: 'bin', x: 1, capacity: 40 },
      { code: 'Z01', kind: 'zone', x: 0, capacity: null },
    ])
  })

  it('⚠️ the same code twice in one warehouse is refused — and allowed in another', async () => {
    await location(nextLocation(), W1, 'A-01')
    expect(await refusal(() => location(nextLocation(), W1, 'A-01'))).toContain(
      'storage_locations_code_per_warehouse',
    )
    expect(await refusal(() => location(nextLocation(), W2, 'A-01'))).toBe('ALLOWED')
  })

  it('a blank code, an unknown kind, a flat rectangle and a zero capacity are refused', async () => {
    expect(await refusal(() => location(nextLocation(), W1, '   '))).toContain(
      'storage_locations_code_length',
    )
    expect(await refusal(() => location(nextLocation(), W1, 'x'.repeat(41)))).toContain(
      'storage_locations_code_length',
    )
    expect(await refusal(() => location(nextLocation(), W1, ' OK ', {}))).toContain(
      'storage_locations_code_trimmed',
    )
    expect(await refusal(() => location(nextLocation(), W1, 'A-02', { kind: 'pallet' }))).toContain(
      'storage_locations_kind',
    )
    expect(await refusal(() => location(nextLocation(), W1, 'A-03', { w: 0 }))).toContain(
      'storage_locations_size_positive',
    )
    expect(await refusal(() => location(nextLocation(), W1, 'A-04', { capacity: 0 }))).toContain(
      'storage_locations_capacity_positive',
    )
    // Allowed: a location with no capacity recorded says «unknown», not zero.
    expect(await refusal(() => location(nextLocation(), W1, 'A-05'))).toBe('ALLOWED')
  })

  it('⚠️ a location cannot be its own parent, and the chain cannot cycle', async () => {
    const first = nextLocation()
    const second = nextLocation()
    await location(first, W1, 'C-01')
    await location(second, W1, 'C-02', { parent: first })

    // The parent of a row is set to the row itself. ⚠️ The BEFORE trigger
    // answers first; the CHECK constraint
    // (`storage_locations_not_own_parent`) stays as the second line of defence
    // if the trigger is ever dropped.
    expect(
      await refusal(
        () => sql`UPDATE public.storage_locations SET parent_id = id WHERE id = ${first}`,
      ),
    ).toContain('STORAGE_LOCATION_CYCLE')

    // first → second would close the loop first → second → first.
    expect(
      await refusal(
        () => sql`UPDATE public.storage_locations SET parent_id = ${second} WHERE id = ${first}`,
      ),
    ).toContain('STORAGE_LOCATION_CYCLE')

    // A parent in another warehouse of the same business is refused too.
    expect(await refusal(() => location(nextLocation(), W2, 'C-03', { parent: first }))).toContain(
      'STORAGE_LOCATION_PARENT_OTHER_WAREHOUSE',
    )
  })

  it('⚠️ a location cannot be attached to another business’s warehouse', async () => {
    expect(await refusal(() => location(nextLocation(), W3, 'X-01', {}, SHOP))).toContain(
      'STORAGE_LOCATION_WAREHOUSE_MISMATCH',
    )
    expect(await refusal(() => location(nextLocation(), W1, 'X-02', {}, OTHER))).toContain(
      'STORAGE_LOCATION_WAREHOUSE_MISMATCH',
    )
    expect(await refusal(() => location(nextLocation(), MISSING, 'X-03'))).toContain(
      'STORAGE_LOCATION_WAREHOUSE_NOT_FOUND',
    )
  })

  it('⚠️ a placement above what the warehouse holds is refused; up to it is allowed', async () => {
    const loc = nextLocation()
    await location(loc, W1, 'P-01', { capacity: 100 })
    await stock(W1, P1, 12)

    expect(await refusal(() => place(loc, P1, 13))).toContain('STORAGE_PLACEMENT_EXCEEDS_STOCK')
    expect(await refusal(() => place(loc, P1, 12))).toBe('ALLOWED')

    // ⚠️ A second location of the SAME warehouse cannot claim the same 12: the
    // cap is over the warehouse, not over the shelf.
    const second = nextLocation()
    await location(second, W1, 'P-02')
    expect(await refusal(() => place(second, P1, 1))).toContain('STORAGE_PLACEMENT_EXCEEDS_STOCK')

    // Setting the first location lower frees the units for the second.
    expect(await refusal(() => place(loc, P1, 5))).toBe('ALLOWED')
    expect(await refusal(() => place(second, P1, 7))).toBe('ALLOWED')
    expect(await refusal(() => place(second, P1, 8))).toContain('STORAGE_PLACEMENT_EXCEEDS_STOCK')
  })

  it('a placement is replaced, never added to — a repeat does not inflate the shelf', async () => {
    const loc = nextLocation()
    await location(loc, W4, 'Q-01')
    await stock(W4, P3, 10)

    await place(loc, P3, 4)
    await place(loc, P3, 4)
    const rows = await sql`
      SELECT quantity::float AS quantity FROM public.storage_location_placements
       WHERE location_id = ${loc} AND product_id = ${P3}
    `
    expect(rows).toEqual([{ quantity: 4 }])

    // Zero means «no longer recorded here». The row stays: retirement, not
    // deletion, and the table grants the server no DELETE.
    await place(loc, P3, 0)
    const cleared = await sql`
      SELECT count(*)::int AS rows, COALESCE(SUM(quantity), 0)::float AS quantity
        FROM public.storage_location_placements
       WHERE location_id = ${loc} AND product_id = ${P3}
    `
    expect(cleared).toEqual([{ quantity: 0, rows: 1 }])
  })

  it('a negative placement, a retired location and a foreign location are refused', async () => {
    const retired = nextLocation()
    await location(retired, W1, 'R-09', { active: false })
    expect(await refusal(() => place(retired, P1, 1))).toContain('STORAGE_LOCATION_INACTIVE')
    expect(await refusal(() => place(retired, P1, -1))).toContain('STORAGE_PLACEMENT_NEGATIVE')
    expect(await refusal(() => place(nextLocation(), P1, 1))).toContain(
      'STORAGE_LOCATION_NOT_FOUND',
    )

    // Another business's location, named by workspace, is not found either.
    const mine = nextLocation()
    await location(mine, W1, 'R-10')
    expect(await refusal(() => place(mine, P1, 1, OTHER))).toContain('STORAGE_LOCATION_NOT_FOUND')
    // A product that is not this business's cannot be placed.
    expect(await refusal(() => place(mine, P2, 1))).toContain('STORAGE_PLACEMENT_PRODUCT_NOT_FOUND')
  })

  it('scale: 30 shelves each holding one unit, the 31st refused', async () => {
    const ids: string[] = []
    for (let i = 0; i < 30; i += 1) {
      const id = nextLocation()
      ids.push(id)
      await location(id, W2, `S-${String(i).padStart(2, '0')}`)
    }
    // W2 holds nothing: every one of the 30 is refused until it does.
    expect(await refusal(() => place(ids[0]!, P1, 1))).toContain('STORAGE_PLACEMENT_EXCEEDS_STOCK')
    await stock(W2, P1, 30)
    for (const id of ids) expect(await refusal(() => place(id, P1, 1))).toBe('ALLOWED')

    const extra = nextLocation()
    await location(extra, W2, 'S-99')
    expect(await refusal(() => place(extra, P1, 1))).toContain('STORAGE_PLACEMENT_EXCEEDS_STOCK')

    const total = await sql`
      SELECT COALESCE(SUM(quantity), 0)::float AS placed
        FROM public.storage_location_placements p
        JOIN public.storage_locations l ON l.id = p.location_id
       WHERE l.warehouse_id = ${W2}
    `
    expect(total).toEqual([{ placed: 30 }])
  })
})
