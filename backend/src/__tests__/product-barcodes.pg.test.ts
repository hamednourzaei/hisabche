// ============================================
// docs/product-barcodes-migration.sql in a real Postgres (twice), after the
// main-barcode uniqueness it builds on. What only a real database proves:
// ONE CODE, ONE PRODUCT across both places — a code cannot be one product's
// main barcode and another's extra, in either order, and the refusal is the
// 23505 the backend already answers as BARCODE_TAKEN.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 57000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-barcodes-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/barcodes`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const unique = readFileSync(join(DOCS, 'product-barcode-unique-migration.sql'), 'utf8')
const migration = readFileSync(join(DOCS, 'product-barcodes-migration.sql'), 'utf8')

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_WS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const P1 = '11111111-1111-4111-8111-111111111111'
const P2 = '22222222-2222-4222-8222-222222222222'
const P3 = '33333333-3333-4333-8333-333333333333'

const extra = (product: string, barcode: string, ws = WS) =>
  sql`INSERT INTO product_barcodes (workspace_id, product_id, barcode) VALUES (${ws}, ${product}, ${barcode})`

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('barcodes')
  sql = postgres(url, { max: 2, onnotice: () => {} })
  await sql.unsafe(`
    CREATE TABLE public.products (
      id uuid PRIMARY KEY, workspace_id uuid NOT NULL, name text, barcode text, is_active boolean DEFAULT true);
    -- The helper the workspace policies call (defined by the tenancy migration).
    CREATE OR REPLACE FUNCTION public.auth_workspace_ids() RETURNS SETOF uuid
      LANGUAGE sql STABLE AS $$ SELECT NULL::uuid WHERE false $$;
  `)
  // The file's own section 1 creates the unique index; its later sections are
  // read-only checks, which are harmless here.
  await sql.unsafe(unique)
  await sql.unsafe(migration)
  await sql.unsafe(migration)
}, 180_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  await sql.unsafe(`
    DELETE FROM product_barcodes; DELETE FROM products;
    INSERT INTO products (id, workspace_id, name, barcode) VALUES
      ('${P1}', '${WS}', 'شیر', '6260000000011'),
      ('${P2}', '${WS}', 'ماست', '6260000000028'),
      ('${P3}', '${OTHER_WS}', 'شیر (فروشگاه دیگر)', '6260000000011');`)
})

describe('product_barcodes — one code, one product', () => {
  it('a product can carry extra codes, with a unit', async () => {
    await sql`INSERT INTO product_barcodes (workspace_id, product_id, barcode, unit) VALUES (${WS}, ${P1}, '6260000000999', 'carton')`
    await extra(P1, '8000000000017')
    const [r] = await sql<
      { n: number }[]
    >`SELECT count(*)::int AS n FROM product_barcodes WHERE product_id = ${P1}`
    expect(r!.n).toBe(2)
  })

  it("⚠️ an extra code that is another product's MAIN barcode → 23505", async () => {
    await expect(extra(P2, '6260000000011')).rejects.toMatchObject({ code: '23505' })
  })

  it("⚠️ a MAIN barcode that is another product's extra code → 23505", async () => {
    await extra(P1, '8000000000017')
    await expect(
      sql`UPDATE products SET barcode = '8000000000017' WHERE id = ${P2}`,
    ).rejects.toMatchObject({
      code: '23505',
    })
  })

  it('the same extra code twice in a workspace → 23505 (the unique index)', async () => {
    await extra(P1, '8000000000017')
    await expect(extra(P2, '8000000000017')).rejects.toMatchObject({ code: '23505' })
  })

  it('another workspace may use the same code — the boundary is the workspace', async () => {
    await extra(P1, '8000000000017')
    await expect(extra(P3, '8000000000017', OTHER_WS)).resolves.toBeDefined()
  })

  it('deleting the product removes its extra codes (no orphan code scanning to nothing)', async () => {
    await extra(P1, '8000000000017')
    await sql`DELETE FROM products WHERE id = ${P1}`
    const [r] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM product_barcodes`
    expect(r!.n).toBe(0)
  })

  it('row security is on, with the workspace policy', async () => {
    const [r] = await sql<{ on: boolean }[]>`
      SELECT relrowsecurity AS on FROM pg_class WHERE relname = 'product_barcodes'`
    expect(r!.on).toBe(true)
    const policies = await sql`SELECT 1 FROM pg_policies WHERE tablename = 'product_barcodes'`
    expect(policies).toHaveLength(1)
  })

  it('⚠️ production shape: the helper in `private` (linter-2026-09-14) — the file still applies', async () => {
    // A bare auth_workspace_ids() failed here with 42883 on the live database.
    await sql.unsafe(`
      CREATE SCHEMA IF NOT EXISTS private;
      ALTER FUNCTION public.auth_workspace_ids() SET SCHEMA private;`)
    await sql.unsafe(migration)
    const [p] = await sql<{ qual: string }[]>`
      SELECT qual FROM pg_policies WHERE tablename = 'product_barcodes'`
    expect(p!.qual).toContain('private.auth_workspace_ids')
    // Put it back for any later test.
    await sql.unsafe(`ALTER FUNCTION private.auth_workspace_ids() SET SCHEMA public;`)
    await sql.unsafe(migration)
  })
})
