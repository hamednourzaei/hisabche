// ============================================
// docs/price-lists-01-migration.sql run unchanged (twice) in a real Postgres,
// with Supabase's default privileges, then its VERIFY — plus the rules only
// the database holds.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 51100 + Math.floor(Math.random() * 800)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-pl-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/pl`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER = '11111111-1111-4111-8111-111111111111'
const PRODUCT = '22222222-2222-4222-8222-222222222222'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('pl')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    -- As on Supabase: every new table and function in public arrives already
    -- granted to the three API roles.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
    -- The table the migration adds a column to.
    CREATE TABLE customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid, full_name text NOT NULL);`)
  await setup.unsafe(read('price-lists-01-migration.sql'))
  await setup.unsafe(read('price-lists-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 4, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  await sql`TRUNCATE price_list_items, price_lists CASCADE`
})

const list = (fields: Record<string, unknown> = {}) =>
  sql`INSERT INTO price_lists ${sql({ workspace_id: WS, created_by: USER, name: 'عمده', currency: 'AFN', ...fields })} RETURNING id`

describe('price-lists-01', () => {
  it('VERIFY: every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-price-lists-01.sql'))
    expect(rows.length).toBeGreaterThanOrEqual(11)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check)).toEqual([])
  })

  it('one ACTIVE list per name per workspace; a retired one frees the name', async () => {
    await list()
    await expect(list({ name: ' عمده ' })).rejects.toThrow('price_lists_active_name')
    await expect(list({ workspace_id: OTHER })).resolves.toBeDefined()
    await sql`UPDATE price_lists SET is_active = false WHERE workspace_id = ${WS}`
    await expect(list()).resolves.toBeDefined()
  })

  it('a list needs a currency, and its window cannot be inverted', async () => {
    await expect(list({ currency: 'afn' })).rejects.toThrow(/currency/)
    await expect(list({ valid_from: '2026-10-10', valid_to: '2026-10-01' })).rejects.toThrow(
      'price_lists_window_in_order',
    )
  })

  it('one price per product per list, and never zero — a free product is not a price', async () => {
    const [row] = await list()
    const item = (price: number) => sql`
      INSERT INTO price_list_items (price_list_id, workspace_id, product_id, unit_price_minor, updated_by)
      VALUES (${row!.id}, ${WS}, ${PRODUCT}, ${price}, ${USER})`
    await expect(item(0)).rejects.toThrow(/unit_price_minor/)
    await item(15_000)
    await expect(item(16_000)).rejects.toThrow(/price_list_items_pkey/)
  })

  it('the backend role cannot delete a list or an item; a browser role sees nothing', async () => {
    for (const table of ['price_lists', 'price_list_items']) {
      await expect(
        sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE service_role`
          await tx.unsafe(`DELETE FROM ${table}`)
        }),
      ).rejects.toThrow(/permission denied/)
      await expect(
        sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE authenticated`
          await tx.unsafe(`SELECT * FROM ${table}`)
        }),
      ).rejects.toThrow(/permission denied/)
    }
  })

  it('existing customers are left on no list', async () => {
    await sql`INSERT INTO customers (workspace_id, full_name) VALUES (${WS}, 'احمد')`
    const [row] = await sql`SELECT price_list_id FROM customers LIMIT 1`
    expect(row!.price_list_id).toBeNull()
  })
})
