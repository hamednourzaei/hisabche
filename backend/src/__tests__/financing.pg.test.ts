// ============================================
// docs/financing-01-migration.sql run unchanged (twice) in a real Postgres,
// then docs/VERIFY-financing-01.sql — plus the rules only the database holds.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 59000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-fin-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/fin`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER = '11111111-1111-4111-8111-111111111111'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('fin')
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
  await setup.unsafe(read('financing-01-migration.sql'))
  await setup.unsafe(read('financing-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 4, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
})

const loan = (fields: Record<string, unknown> = {}) =>
  sql`INSERT INTO loan_facilities ${sql({
    workspace_id: WS,
    created_by: USER,
    kind: 'loan',
    counterparty: 'بانک',
    principal_minor: 100_000_00,
    currency: 'AFN',
    annual_rate_percent: 12,
    start_date: '2026-01-01',
    charges_per_year: 12,
    ...fields,
  })}`
const holding = (fields: Record<string, unknown> = {}) =>
  sql`INSERT INTO investment_holdings ${sql({
    workspace_id: WS,
    created_by: USER,
    label: 'طلا',
    cost_minor: 50_000_00,
    market_value_minor: 60_000_00,
    currency: 'USD',
    valued_on: '2026-10-01',
    ...fields,
  })}`

describe('financing-01', () => {
  it('VERIFY: every check is ok', async () => {
    const rows = await sql.unsafe(read('VERIFY-financing-01.sql'))
    expect(rows.length).toBeGreaterThanOrEqual(7)
    expect(rows.filter((row) => row.ok !== true).map((row) => row.check)).toEqual([])
  })

  it('a loan and a holding are stored', async () => {
    await expect(loan()).resolves.toBeDefined()
    await expect(
      loan({ kind: 'receivable_facility', annual_rate_percent: 0, end_date: '2027-01-01' }),
    ).resolves.toBeDefined()
    await expect(holding()).resolves.toBeDefined()
  })

  it('a loan with no amount, a negative rate, no currency or an odd frequency is refused', async () => {
    await expect(loan({ principal_minor: 0 })).rejects.toThrow(/principal_minor/)
    await expect(loan({ annual_rate_percent: -1 })).rejects.toThrow(/annual_rate_percent/)
    await expect(loan({ currency: 'afn' })).rejects.toThrow(/currency/)
    await expect(loan({ charges_per_year: 7 })).rejects.toThrow(/charges_per_year/)
    await expect(loan({ kind: 'gift' })).rejects.toThrow(/kind/)
  })

  it('a loan that ends before or on the day it starts is refused', async () => {
    await expect(loan({ end_date: '2025-12-31' })).rejects.toThrow('loan_facilities_dates_in_order')
    await expect(loan({ end_date: '2026-01-01' })).rejects.toThrow('loan_facilities_dates_in_order')
  })

  it('a holding cannot have a negative cost or value', async () => {
    await expect(holding({ cost_minor: -1 })).rejects.toThrow(/cost_minor/)
    await expect(holding({ market_value_minor: -1 })).rejects.toThrow(/market_value_minor/)
  })

  it('a browser role can read neither register', async () => {
    for (const table of ['loan_facilities', 'investment_holdings']) {
      await expect(
        sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE authenticated`
          await tx.unsafe(`SELECT * FROM ${table}`)
        }),
      ).rejects.toThrow(/permission denied/)
    }
  })
})
