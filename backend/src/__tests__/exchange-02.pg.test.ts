// ============================================
// exchange-02.pg.test.ts
//
// Runs docs/exchange-01-migration.sql + docs/exchange-02-migration.sql TWICE on
// a real Postgres instance, validates docs/VERIFY-exchange-02.sql, and verifies:
//   • matched / short / over per-currency cashbox reconciliation snapshots
//   • idempotency via client_request_id
//   • refusal of negative physical counts & malformed currency codes
//   • workspace isolation across two separate workspaces
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-exchange-02-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/exchange02`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const U = '11111111-1111-4111-8111-111111111111'
const W_A = '22222222-2222-4222-8222-222222222221'
const W_B = '22222222-2222-4222-8222-222222222222'

const BASE = `
  CREATE TABLE public.workspaces (id uuid PRIMARY KEY);
  CREATE TABLE public.customers (id uuid PRIMARY KEY, workspace_id uuid);
`

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('exchange02')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  `)
  await setup.unsafe(BASE)

  for (const file of ['exchange-01-migration.sql', 'exchange-02-migration.sql']) {
    await setup.unsafe(read(file))
    await setup.unsafe(read(file))
  }

  await setup.unsafe(`
    INSERT INTO public.workspaces VALUES ('${W_A}'), ('${W_B}');
  `)
  await setup.end()
  sql = postgres(url, { max: 4, onnotice: () => {} })
}, 240_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('VERIFY-exchange-02.sql', () => {
  it('passes all 7 structural and privilege checks', async () => {
    const rows = await sql.unsafe(read('VERIFY-exchange-02.sql'))
    expect(rows.length).toBe(7)
    expect(rows.filter((r) => r.ok !== true).map((r) => r.check_name)).toEqual([])
  })
})

describe('fx_reconcile_cashbox', () => {
  it('reconciles per currency (matched, short, over) against fx_held_minor', async () => {
    await sql`SELECT public.fx_trade_create(${W_A}, ${U}, ${sql.json({
      side: 'buy',
      currency: 'USD',
      amount_minor: 50_000,
      rate_micro: 70_000_000,
      book_currency: 'AFN',
      book_amount_minor: 35_000,
      client_request_id: 'ex02-buy-1',
    })})`

    const [matched] = await sql`
      SELECT public.fx_reconcile_cashbox(${W_A}, ${U}, 'usd', 50000, 'evening count', 'rec-1') AS res
    `
    expect(matched!.res).toMatchObject({
      currency: 'USD',
      expected_minor: 50_000,
      counted_minor: 50_000,
      variance_minor: 0,
      status: 'matched',
    })

    const [short] = await sql`
      SELECT public.fx_reconcile_cashbox(${W_A}, ${U}, 'USD', 48500, 'missing 15 USD', 'rec-2') AS res
    `
    expect(short!.res).toMatchObject({
      expected_minor: 50_000,
      counted_minor: 48_500,
      variance_minor: -1_500,
      status: 'short',
    })

    const [over] = await sql`
      SELECT public.fx_reconcile_cashbox(${W_A}, ${U}, 'USD', 51200, null, 'rec-3') AS res
    `
    expect(over!.res).toMatchObject({
      variance_minor: 1_200,
      status: 'over',
    })
  })

  it('is idempotent on client_request_id and refuses invalid inputs', async () => {
    const [first] = await sql`
      SELECT public.fx_reconcile_cashbox(${W_A}, ${U}, 'EUR', 0, 'zero box', 'rec-idem-1') AS res
    `
    const [second] = await sql`
      SELECT public.fx_reconcile_cashbox(${W_A}, ${U}, 'EUR', 9999, 'ignored retry', 'rec-idem-1') AS res
    `
    expect(first!.res.id).toBe(second!.res.id)
    expect(second!.res.counted_minor).toBe(0)

    await expect(
      sql`SELECT public.fx_reconcile_cashbox(${W_A}, ${U}, 'EUR', -1, null, null)`,
    ).rejects.toThrow(/FX_COUNT_INVALID/)
    await expect(
      sql`SELECT public.fx_reconcile_cashbox(${W_A}, ${U}, 'EURO', 100, null, null)`,
    ).rejects.toThrow(/FX_CURRENCY_INVALID/)
  })

  it('isolates cashbox expected holdings per workspace', async () => {
    const [resB] = await sql`
      SELECT public.fx_reconcile_cashbox(${W_B}, ${U}, 'USD', 0, null, 'rec-wb-1') AS res
    `
    expect(resB!.res).toMatchObject({
      expected_minor: 0,
      counted_minor: 0,
      variance_minor: 0,
      status: 'matched',
    })
  })
})
