// ============================================
// docs/promotions-01-migration.sql run unchanged (twice) in a real Postgres,
// then docs/VERIFY-promotions-01.sql — plus the rules only the database holds.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 56000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-promo-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/promo`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER = '11111111-1111-4111-8111-111111111111'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('promo')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    -- As on Supabase: every new table and function in public arrives already
    -- granted to the three API roles. A migration that only GRANTs a narrower
    -- set, without revoking first, passes on a bare Postgres and fails there.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;`)
  await setup.unsafe(read('promotions-01-migration.sql'))
  await setup.unsafe(read('promotions-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 4, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  await sql`TRUNCATE promotions`
})

const insert = (fields: Record<string, unknown>) =>
  sql`INSERT INTO promotions ${sql({
    workspace_id: WS,
    created_by: USER,
    name: 'x',
    kind: 'percentage',
    value: 10,
    ...fields,
  })}`

describe('promotions-01', () => {
  it('VERIFY: every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-promotions-01.sql'))
    expect(rows.length).toBeGreaterThanOrEqual(9)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check)).toEqual([])
  })

  it('accepts a percentage and a fixed amount with its currency', async () => {
    await insert({})
    await insert({ kind: 'fixed_amount', value: 50, currency: 'AFN' })
    const [count] = await sql`SELECT COUNT(*)::int AS c FROM promotions WHERE is_active`
    expect(count!.c).toBe(2)
  })

  it('a fixed amount with NO currency is refused — NULL does not slip past the check', async () => {
    await expect(insert({ kind: 'fixed_amount', value: 50 })).rejects.toThrow(
      'promotions_fixed_has_currency',
    )
    await expect(insert({ kind: 'fixed_amount', value: 50, currency: 'afn' })).rejects.toThrow(
      'promotions_fixed_has_currency',
    )
  })

  it('more than 100 percent, a zero value and an unknown kind are refused', async () => {
    await expect(insert({ value: 101 })).rejects.toThrow('promotions_percent_in_range')
    await expect(insert({ value: 0 })).rejects.toThrow(/value/)
    await expect(insert({ kind: 'bundle' })).rejects.toThrow(/kind/)
  })

  it('an inverted window and an empty product or customer list are refused', async () => {
    await expect(insert({ valid_from: '2026-10-10', valid_to: '2026-10-01' })).rejects.toThrow(
      'promotions_window_in_order',
    )
    await expect(
      sql`INSERT INTO promotions (workspace_id, created_by, name, kind, value, product_ids)
          VALUES (${WS}, ${USER}, 'x', 'percentage', 10, '{}')`,
    ).rejects.toThrow('promotions_products_not_empty')
    await expect(
      sql`INSERT INTO promotions (workspace_id, created_by, name, kind, value, customer_ids)
          VALUES (${WS}, ${USER}, 'x', 'percentage', 10, '{}')`,
    ).rejects.toThrow('promotions_customers_not_empty')
  })

  it('a browser role cannot read promotions', async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE authenticated`
        await tx`SELECT * FROM promotions`
      }),
    ).rejects.toThrow(/permission denied/)
  })
})
