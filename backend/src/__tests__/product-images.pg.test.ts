// ============================================
// docs/product-images-migration.sql in a real Postgres (applied twice). What
// only a real database proves:
//   - never more than 8 images, even with uploads racing for the 8th slot;
//   - products.image_url always equals the image in position 0 — on add,
//     reorder and remove, and '' when the last image goes;
//   - positions stay 0..n-1 after a removal;
//   - a reorder must name exactly the product's images;
//   - another workspace can neither add to nor remove from this product;
//   - clients cannot call the functions; VERIFY is all true.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 58000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-images-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/images`
let db: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const migration = readFileSync(join(DOCS, 'product-images-migration.sql'), 'utf8')
const verify = readFileSync(join(DOCS, 'VERIFY-product-images.sql'), 'utf8')

const WS = 'aaaaaaaa-0000-4000-8000-000000000001'
const OTHER = 'bbbbbbbb-0000-4000-8000-000000000002'
const USER = '11111111-1111-4111-8111-111111111111'
const PRODUCT = 'cccccccc-0000-4000-8000-000000000003'

let n = 0
const add = (ws = WS, product = PRODUCT) => {
  n += 1
  return db<{ r: { id: string; position: number; url: string } }[]>`
    SELECT add_product_image(${ws}, ${product}, ${USER}, ${`p/${n}.webp`},
      ${`https://cdn.test/${n}.webp`}, 'alt') AS r`.then((rows) => rows[0]!.r)
}
const cover = async () =>
  (await db<{ u: string }[]>`SELECT image_url AS u FROM products WHERE id = ${PRODUCT}`)[0]!.u
const positions = async () =>
  (
    await db<{ id: string; position: number }[]>`
      SELECT id, position FROM product_images WHERE product_id = ${PRODUCT} ORDER BY position`
  ).map((r) => r.position)

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('images')
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
    CREATE TABLE public.products (id uuid PRIMARY KEY, workspace_id uuid NOT NULL, name text NOT NULL,
      image_url text DEFAULT '');
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false,
      file_size_limit bigint, allowed_mime_types text[]);
    CREATE SCHEMA IF NOT EXISTS private;
    CREATE OR REPLACE FUNCTION private.auth_workspace_ids() RETURNS SETOF uuid LANGUAGE sql STABLE AS
      $$ SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() $$;
  `)
  await setup.unsafe(migration)
  await setup.unsafe(migration)
  await setup.end()
  db = postgres(url, { max: 10, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await db?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  await db`DELETE FROM product_images`
  await db`DELETE FROM products`
  await db`INSERT INTO products (id, workspace_id, name, image_url) VALUES (${PRODUCT}, ${WS}, 'Tea', 'https://old/manual.png')`
})

describe('the cover follows position 0', () => {
  it('the first image becomes the cover', async () => {
    const first = await add()
    expect(first.position).toBe(0)
    expect(await cover()).toBe(first.url)
    await add()
    expect(await cover()).toBe(first.url)
  })

  it('a reorder moves the cover', async () => {
    const a = await add()
    const b = await add()
    const c = await add()
    await db`SELECT reorder_product_images(${WS}, ${PRODUCT}, ${[c.id, a.id, b.id]}::uuid[])`
    expect(await cover()).toBe(c.url)
    expect(await positions()).toEqual([0, 1, 2])
  })

  it('removing the cover promotes the next one and closes the gap', async () => {
    const a = await add()
    const b = await add()
    await add()
    const [removed] = await db<
      { path: string }[]
    >`SELECT remove_product_image(${WS}, ${a.id}) AS path`
    const path = removed!.path
    expect(path).toMatch(/^p\/\d+\.webp$/)
    expect(await cover()).toBe(b.url)
    expect(await positions()).toEqual([0, 1])
  })

  it('removing the last image clears the cover', async () => {
    const a = await add()
    await db`SELECT remove_product_image(${WS}, ${a.id})`
    expect(await cover()).toBe('')
  })
})

describe('never more than 8', () => {
  it('the 9th is refused', async () => {
    for (let i = 0; i < 8; i += 1) await add()
    await expect(add()).rejects.toThrow(/PRODUCT_IMAGE_LIMIT/)
    expect((await positions()).length).toBe(8)
  })

  it('five uploads racing for the last three slots: exactly three land', async () => {
    for (let i = 0; i < 5; i += 1) await add()
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => add()))
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3)
    // Without the lock on the product row the cap still held (the unique
    // position caught the collision) but a racer got a raw «duplicate key»
    // instead of the reason. Every refusal must be the limit, said as such.
    for (const r of results) {
      if (r.status === 'rejected') expect(String(r.reason)).toContain('PRODUCT_IMAGE_LIMIT')
    }
    expect(await positions()).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })
})

describe('refusals', () => {
  it('a reorder that does not name exactly the images is refused', async () => {
    const a = await add()
    await add()
    await expect(
      db`SELECT reorder_product_images(${WS}, ${PRODUCT}, ${[a.id]}::uuid[])`,
    ).rejects.toThrow(/PRODUCT_IMAGE_ORDER_INVALID/)
    await expect(
      db`SELECT reorder_product_images(${WS}, ${PRODUCT}, ${[a.id, a.id]}::uuid[])`,
    ).rejects.toThrow(/PRODUCT_IMAGE_ORDER_INVALID/)
  })

  it('another workspace cannot add, remove or reorder', async () => {
    const a = await add()
    await expect(add(OTHER)).rejects.toThrow(/PRODUCT_NOT_FOUND/)
    await expect(db`SELECT remove_product_image(${OTHER}, ${a.id})`).rejects.toThrow(
      /PRODUCT_IMAGE_NOT_FOUND/,
    )
    await expect(
      db`SELECT reorder_product_images(${OTHER}, ${PRODUCT}, ${[a.id]}::uuid[])`,
    ).rejects.toThrow(/PRODUCT_NOT_FOUND/)
    expect(await positions()).toEqual([0])
  })

  it('deleting the product removes its image rows', async () => {
    await add()
    await db`DELETE FROM products WHERE id = ${PRODUCT}`
    const [row] = await db<{ c: string }[]>`SELECT count(*) AS c FROM product_images`
    expect(Number(row!.c)).toBe(0)
  })
})

describe('access and verification', () => {
  it('clients cannot execute the functions', async () => {
    const rows = await db<{ ok: boolean }[]>`
      SELECT NOT has_function_privilege('authenticated', to_regprocedure(f), 'EXECUTE') AS ok
        FROM unnest(ARRAY['public.add_product_image(uuid, uuid, uuid, text, text, text)',
                          'public.remove_product_image(uuid, uuid)',
                          'public.reorder_product_images(uuid, uuid, uuid[])',
                          'public.sync_product_cover(uuid)']) AS f`
    expect(rows.every((r) => r.ok)).toBe(true)
  })

  it('VERIFY is all true', async () => {
    await add()
    const rows = await db.unsafe<{ check: string; ok: boolean }[]>(verify)
    expect(rows.filter((r) => !r.ok).map((r) => r.check)).toEqual([])
    expect(rows.length).toBeGreaterThan(15)
  })
})
