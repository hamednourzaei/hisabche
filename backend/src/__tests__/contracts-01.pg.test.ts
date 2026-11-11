// ============================================
// backend/src/__tests__/contracts-01.pg.test.ts
//
// V60 Slice 9 — Proves docs/contracts-01-migration.sql against a real Postgres:
//   - runs twice idempotently with VERIFY checks
//   - UNIQUE (contract_id, kind, period_key) allows ONLY one bill obligation per period
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const pg = new EmbeddedPostgres({
  databaseDir: pgTempDir('hisabche-pg-contracts-'),
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/contractsdb`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = '22222222-2222-4222-8222-222222222222'
const CUST = '55555555-5555-4555-8555-555555555555'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('contractsdb')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
    END $$;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
    CREATE TABLE IF NOT EXISTS public.workspaces (id uuid PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS public.customers (id uuid PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS public.resource_bookings (id uuid PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS public.stock_serials (id uuid PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS public.workspace_members (
      workspace_id uuid, user_id uuid, has_access boolean, suspended_at timestamptz
    );
    INSERT INTO public.workspaces (id) VALUES ('${WS}') ON CONFLICT DO NOTHING;
    INSERT INTO public.customers (id) VALUES ('${CUST}') ON CONFLICT DO NOTHING;
  `)
  await setup.unsafe(read('contracts-01-migration.sql'))
  await setup.unsafe(read('contracts-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 2 })
}, 90_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('contracts-01', () => {
  it('enforces UNIQUE (contract_id, kind, period_key) so one period never produces two invoices', async () => {
    const [contract] = await sql<{ id: string }[]>`
      INSERT INTO public.contracts (workspace_id, customer_id, contract_type, title, currency, amount_minor, billing_cadence, start_date)
      VALUES (${WS}::uuid, ${CUST}::uuid, 'lease', 'Camera Kit Lease', 'USD', 25000, 'monthly', '2026-11-01')
      RETURNING id
    `
    await sql`
      INSERT INTO public.contract_obligations (workspace_id, contract_id, kind, period_key, due_date, idempotency_key)
      VALUES (${WS}::uuid, ${contract!.id}::uuid, 'bill', '2026-11', '2026-11-01', 'contract:1:bill:2026-11')
    `
    await expect(
      sql`
        INSERT INTO public.contract_obligations (workspace_id, contract_id, kind, period_key, due_date, idempotency_key)
        VALUES (${WS}::uuid, ${contract!.id}::uuid, 'bill', '2026-11', '2026-11-01', 'contract:1:bill:2026-11')
      `,
    ).rejects.toThrow(/contract_obligations_unique_period/)
  })

  it('passes every query in docs/VERIFY-contracts-01.sql', async () => {
    const blocks = read('VERIFY-contracts-01.sql')
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('--'))
    for (const stmt of blocks) {
      await sql.unsafe(stmt)
    }
  })
})
