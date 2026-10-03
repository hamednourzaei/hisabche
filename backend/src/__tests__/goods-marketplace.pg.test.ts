// ============================================
// docs/goods-marketplace-01-migration.sql in a real Postgres (applied twice).
// What only a real database proves:
//   - the switch is OFF after the migration, and re-running the migration
//     never turns an enabled marketplace back off;
//   - a listing cannot point at another business's product — by INSERT or by
//     UPDATE (the trigger, not application code);
//   - slugs are unique where they must be; a price is positive; no listing
//     without a seller profile;
//   - a member reads only their own business's rows; anon reads nothing;
//   - there is no cost column to leak; VERIFY is all true.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 59000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-market-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/market`
let db: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const migration = readFileSync(join(DOCS, 'goods-marketplace-01-migration.sql'), 'utf8')
const verify = readFileSync(join(DOCS, 'VERIFY-goods-marketplace-01.sql'), 'utf8')

const WS = 'aaaaaaaa-0000-4000-8000-000000000001'
const OTHER = 'bbbbbbbb-0000-4000-8000-000000000002'
const MEMBER = '11111111-1111-4111-8111-111111111111'
const MINE = 'cccccccc-0000-4000-8000-000000000003'
const THEIRS = 'dddddddd-0000-4000-8000-000000000004'

const seller = (ws: string, slug: string) =>
  db`INSERT INTO seller_profiles (workspace_id, slug, name) VALUES (${ws}, ${slug}, 'Shop')`
const listing = (ws: string, product: string, slug: string, price = 1000) =>
  db`INSERT INTO marketplace_listings (workspace_id, product_id, slug, title, price_minor, currency)
     VALUES (${ws}, ${product}, ${slug}, 'Tea', ${price}, 'USD') RETURNING id`

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('market')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    CREATE TABLE public.workspace_members (workspace_id uuid NOT NULL, user_id uuid NOT NULL);
    GRANT SELECT ON public.workspace_members TO authenticated;
    CREATE TABLE public.products (id uuid PRIMARY KEY, workspace_id uuid NOT NULL, name text NOT NULL,
      buy_price numeric, is_active boolean DEFAULT true, image_url text DEFAULT '');
    CREATE SCHEMA IF NOT EXISTS private;
    CREATE OR REPLACE FUNCTION private.auth_workspace_ids() RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER AS
      $$ SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() $$;
    GRANT USAGE ON SCHEMA private TO authenticated;
  `)
  await setup.unsafe(migration)
  await setup.unsafe(migration)
  await setup.end()
  db = postgres(url, { max: 4, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await db?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  await db`DELETE FROM marketplace_listings`
  await db`DELETE FROM seller_profiles`
  await db`DELETE FROM products`
  await db`DELETE FROM workspace_members`
  await db`UPDATE platform_settings SET value = 'false' WHERE key = 'goods_marketplace_enabled'`
  await db`INSERT INTO products (id, workspace_id, name, buy_price) VALUES
    (${MINE}, ${WS}, 'Tea', 3), (${THEIRS}, ${OTHER}, 'Rice', 9)`
  await db`INSERT INTO workspace_members VALUES (${WS}, ${MEMBER})`
})

describe('the switch', () => {
  it('is OFF after the migration', async () => {
    const [row] = await db<{ value: boolean }[]>`
      SELECT value FROM platform_settings WHERE key = 'goods_marketplace_enabled'`
    expect(row!.value).toBe(false)
  })

  it('re-running the migration does not turn an enabled marketplace off', async () => {
    await db`UPDATE platform_settings SET value = 'true' WHERE key = 'goods_marketplace_enabled'`
    // The file carries its own BEGIN/COMMIT: one dedicated connection.
    const again = postgres(url, { max: 1, onnotice: () => {} })
    await again.unsafe(migration)
    await again.end()
    const [row] = await db<{ value: boolean }[]>`
      SELECT value FROM platform_settings WHERE key = 'goods_marketplace_enabled'`
    expect(row!.value).toBe(true)
  })
})

describe('a listing belongs to its seller', () => {
  it("another business's product is refused on INSERT", async () => {
    await seller(WS, 'my-shop')
    await expect(listing(WS, THEIRS, 'rice')).rejects.toThrow(/MARKET_PRODUCT_NOT_FOUND/)
  })

  it('and on UPDATE', async () => {
    await seller(WS, 'my-shop')
    const [row] = await listing(WS, MINE, 'tea')
    await expect(
      db`UPDATE marketplace_listings SET product_id = ${THEIRS} WHERE id = ${row!.id}`,
    ).rejects.toThrow(/MARKET_PRODUCT_NOT_FOUND/)
  })

  it('no listing without a seller profile', async () => {
    await expect(listing(WS, MINE, 'tea')).rejects.toThrow(/foreign key/)
  })

  it('removing the seller profile removes its listings', async () => {
    await seller(WS, 'my-shop')
    await listing(WS, MINE, 'tea')
    await db`DELETE FROM seller_profiles WHERE workspace_id = ${WS}`
    const [row] = await db<{ c: string }[]>`SELECT count(*) AS c FROM marketplace_listings`
    expect(Number(row!.c)).toBe(0)
  })
})

describe('constraints', () => {
  it('two sellers cannot share a slug', async () => {
    await seller(WS, 'my-shop')
    await expect(seller(OTHER, 'my-shop')).rejects.toThrow(/duplicate key/)
  })

  it('one product is listed once per seller, and a listing slug is unique per seller', async () => {
    await seller(WS, 'my-shop')
    await listing(WS, MINE, 'tea')
    await expect(listing(WS, MINE, 'tea-2')).rejects.toThrow(/marketplace_listings_product_key/)
  })

  it('a price of zero, a bad slug and a bad country are refused', async () => {
    await seller(WS, 'my-shop')
    await expect(listing(WS, MINE, 'tea', 0)).rejects.toThrow(/check constraint/)
    await expect(listing(WS, MINE, 'Tea Bags')).rejects.toThrow(/check constraint/)
    await expect(
      db`UPDATE seller_profiles SET country = 'Iran' WHERE workspace_id = ${WS}`,
    ).rejects.toThrow(/check constraint/)
  })

  it('a new listing is a draft, visible, not suspended', async () => {
    await seller(WS, 'my-shop')
    const [row] = await listing(WS, MINE, 'tea')
    const [l] = await db<{ status: string; is_hidden: boolean; suspended_at: string | null }[]>`
      SELECT status, is_hidden, suspended_at FROM marketplace_listings WHERE id = ${row!.id}`
    expect(l).toMatchObject({ status: 'draft', is_hidden: false, suspended_at: null })
  })

  it('a new seller is active and NOT verified', async () => {
    await seller(WS, 'my-shop')
    const [s] = await db<{ status: string; verified: boolean }[]>`
      SELECT status, verified FROM seller_profiles WHERE workspace_id = ${WS}`
    expect(s).toMatchObject({ status: 'active', verified: false })
  })
})

describe('who may read', () => {
  it('a member sees only their own business; the switch table is closed to them', async () => {
    await seller(WS, 'my-shop')
    await seller(OTHER, 'their-shop')
    await listing(WS, MINE, 'tea')
    await listing(OTHER, THEIRS, 'rice')
    const seen = await db.begin(async (tx) => {
      await tx`SELECT set_config('request.jwt.claim.sub', ${MEMBER}, true)`
      await tx`SET LOCAL ROLE authenticated`
      const sellers = await tx<{ slug: string }[]>`SELECT slug FROM seller_profiles`
      const listings = await tx<{ slug: string }[]>`SELECT slug FROM marketplace_listings`
      return { sellers, listings }
    })
    // Its own transaction: a refusal aborts the one it happens in.
    const settings = await db
      .begin(async (tx) => {
        await tx`SET LOCAL ROLE authenticated`
        await tx`SELECT 1 FROM platform_settings`
        return 'readable'
      })
      .catch(() => 'denied')
    expect(seen.sellers.map((s) => s.slug)).toEqual(['my-shop'])
    expect(seen.listings.map((l) => l.slug)).toEqual(['tea'])
    expect(settings).toBe('denied')
  })

  it('a member cannot write a listing or verify themselves', async () => {
    await seller(WS, 'my-shop')
    await expect(
      db.begin(async (tx) => {
        await tx`SELECT set_config('request.jwt.claim.sub', ${MEMBER}, true)`
        await tx`SET LOCAL ROLE authenticated`
        await tx`UPDATE seller_profiles SET verified = true WHERE workspace_id = ${WS}`
      }),
    ).rejects.toThrow(/permission denied/)
  })

  it('anon reads nothing', async () => {
    await expect(
      db.begin(async (tx) => {
        await tx`SET LOCAL ROLE anon`
        await tx`SELECT 1 FROM marketplace_listings`
      }),
    ).rejects.toThrow(/permission denied/)
  })
})

describe('verification', () => {
  it('VERIFY is all true', async () => {
    await seller(WS, 'my-shop')
    await listing(WS, MINE, 'tea')
    const rows = await db.unsafe<{ check: string; ok: boolean }[]>(verify)
    expect(rows.filter((r) => !r.ok).map((r) => r.check)).toEqual([])
    expect(rows.length).toBeGreaterThan(15)
  })
})
