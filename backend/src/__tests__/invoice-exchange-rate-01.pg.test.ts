// ============================================
// docs/invoice-exchange-rate-01-migration.sql — TWICE on a real Postgres, then
// its VERIFY, then the one rule it adds (a rate is positive) and the one thing
// it must not do (give an old invoice a rate).
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 57400 + Math.floor(Math.random() * 500)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-invoice-rate-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/inv_rate`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const AFN_SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USD_SHOP = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

async function refusal(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
    return 'ALLOWED'
  } catch (error) {
    return (error as Error).message
  }
}

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('inv_rate')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    CREATE TABLE workspaces (
      id uuid PRIMARY KEY, name text NOT NULL, base_currency text
    );
    CREATE TABLE invoices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      currency text,
      total numeric,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO workspaces VALUES ('${AFN_SHOP}', 'طلافروشی', 'AFN'), ('${USD_SHOP}', 'صرافی', 'USD');
    -- Before the migration: one ordinary invoice, and two that were booked
    -- figure for figure in a currency that is not their business's.
    INSERT INTO invoices (workspace_id, currency, total) VALUES
      ('${AFN_SHOP}', 'AFN', 100),
      ('${AFN_SHOP}', 'IRR', 6500000000),
      ('${USD_SHOP}', 'AFN', 70000);
  `)
  await setup.unsafe(read('invoice-exchange-rate-01-migration.sql'))
  await setup.unsafe(read('invoice-exchange-rate-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 2, onnotice: () => {} })
}, 120_000)

afterAll(async () => {
  if (sql) await sql.end()
  try {
    await pg.stop()
  } catch {
    // teardown only
  }
  rmSync(dir, { recursive: true, force: true })
})

describe('docs/invoice-exchange-rate-01-migration.sql', () => {
  it('ran twice; the checks of its VERIFY say ok, and its findings count the old foreign invoices', async () => {
    const rows = await sql.unsafe(read('VERIFY-invoice-exchange-rate-01.sql'))
    expect(rows).toHaveLength(4)
    expect(rows.filter((row) => row.ok === false).map((row) => row.name)).toEqual([])
    expect(rows.filter((row) => row.ok === true)).toHaveLength(2)
    // Two invoices were in a currency other than their business's books — one
    // in each direction. They are COUNTED, by business; nothing is done to them.
    expect(String(rows[2]!.detail)).toMatch(/^2 /)
    expect(String(rows[3]!.detail)).toContain('IRR in AFN books: 1')
    expect(String(rows[3]!.detail)).toContain('AFN in USD books: 1')
  })

  it('⚠️ no invoice that already existed was given a rate', async () => {
    const [row] = await sql`SELECT COUNT(*)::int AS n FROM invoices WHERE exchange_rate IS NOT NULL`
    expect(row!.n).toBe(0)
  })

  it('a rate is positive, keeps its decimals, and may be absent', async () => {
    const add = (rate: number | null) => sql`
      INSERT INTO invoices (workspace_id, currency, total, exchange_rate)
      VALUES (${AFN_SHOP}, 'IRR', 1, ${rate})
    `
    expect(await refusal(() => add(0))).toContain('invoices_exchange_rate_positive')
    expect(await refusal(() => add(-1))).toContain('invoices_exchange_rate_positive')
    expect(await refusal(() => add(null))).toBe('ALLOWED')
    // One toman in afghani is a small number; it must not be rounded to zero.
    expect(await refusal(() => add(0.00157))).toBe('ALLOWED')
    const [row] = await sql`
      SELECT exchange_rate::text AS rate FROM invoices WHERE exchange_rate IS NOT NULL
    `
    expect(Number(row!.rate)).toBe(0.00157)
  })
})
