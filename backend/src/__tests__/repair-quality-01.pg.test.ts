// ============================================
// backend/src/__tests__/repair-quality-01.pg.test.ts
//
// V71 — proves docs/repair-quality-01-migration.sql on real Postgres:
//   · runs twice, VERIFY all true;
//   · a ready unit cannot be delivered with no check, or after a FAIL;
//   · a PASS lets it go; a FAIL after the PASS stops it again (latest decides);
//   · another workspace's PASS for the same id proves nothing;
//   · moves that are not a handover are untouched.
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
  databaseDir: pgTempDir('hisabche-pg-repair-quality-'),
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/repairqadb`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS = '22222222-2222-4222-8222-222222222222'
const OTHER_WS = '55555555-5555-4555-8555-555555555555'
const ACTOR = '33333333-3333-4333-8333-333333333333'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('repairqadb')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
    END $$;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
    CREATE TABLE IF NOT EXISTS public.workspaces (id uuid PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS public.products (id uuid PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS public.warehouses (id uuid PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS public.warranties (id uuid PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS public.workspace_members (
      workspace_id uuid, user_id uuid, has_access boolean, suspended_at timestamptz
    );
    -- The columns of retail-ops-01 this guard reads; the rest of that table is not its business.
    CREATE TABLE IF NOT EXISTS public.repair_tickets (
      id uuid PRIMARY KEY,
      workspace_id uuid NOT NULL,
      status text NOT NULL
    );
    INSERT INTO public.workspaces (id) VALUES ('${WS}'), ('${OTHER_WS}') ON CONFLICT DO NOTHING;
  `)
  await setup.unsafe(read('quality-events-01-migration.sql'))
  await setup.unsafe(read('repair-quality-01-migration.sql'))
  await setup.unsafe(read('repair-quality-01-migration.sql'))
  await setup.end()
  sql = postgres(url, { max: 2, onnotice: () => {} })
}, 90_000)

afterAll(async () => {
  await sql?.end({ timeout: 5 })
  await pg?.stop()
})

let n = 0
async function readyTicket(): Promise<string> {
  n += 1
  const id = `66666666-6666-4666-8666-${String(n).padStart(12, '0')}`
  await sql`INSERT INTO public.repair_tickets (id, workspace_id, status) VALUES (${id}, ${WS}, 'ready')`
  return id
}
const check = (id: string, kind: 'pass' | 'fail', ws = WS, at = 'now()') =>
  sql.unsafe(
    `INSERT INTO public.quality_events (workspace_id, source_type, source_id, event_kind, actor_id, occurred_at)
     VALUES ($1, 'repair', $2, $3, $4, ${at})`,
    [ws, id, kind, ACTOR],
  )
const deliver = (id: string) =>
  sql`UPDATE public.repair_tickets SET status = 'delivered' WHERE id = ${id}`

async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
    return ''
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

describe('repair-quality-01-migration.sql on Postgres', () => {
  it('VERIFY is all true after running twice', async () => {
    const rows = await sql.unsafe(read('VERIFY-repair-quality-01.sql'))
    expect(rows.map((r) => [r.check_name, r.ok])).toEqual(rows.map((r) => [r.check_name, true]))
    expect(rows).toHaveLength(4)
  })

  it('refuses a handover with no check, and after a fail', async () => {
    const id = await readyTicket()
    expect(await refusal(deliver(id))).toContain('REPAIR_QA_REQUIRED')
    await check(id, 'fail')
    expect(await refusal(deliver(id))).toContain('REPAIR_QA_REQUIRED')
    const [row] = await sql`SELECT status FROM public.repair_tickets WHERE id = ${id}`
    expect(row!.status).toBe('ready')
  })

  it('a pass lets it go', async () => {
    const id = await readyTicket()
    await check(id, 'pass')
    await deliver(id)
    const [row] = await sql`SELECT status FROM public.repair_tickets WHERE id = ${id}`
    expect(row!.status).toBe('delivered')
  })

  it('the latest verdict decides: a fail after a pass stops it again', async () => {
    const id = await readyTicket()
    await check(id, 'pass', WS, "now() - interval '1 hour'")
    await check(id, 'fail')
    expect(await refusal(deliver(id))).toContain('REPAIR_QA_REQUIRED')
  })

  it('a rework recorded by the old panel counts as a fail', async () => {
    const id = await readyTicket()
    await check(id, 'pass', WS, "now() - interval '1 hour'")
    await sql`INSERT INTO public.quality_events (workspace_id, source_type, source_id, event_kind, actor_id)
              VALUES (${WS}, 'repair', ${id}, 'rework', ${ACTOR})`
    expect(await refusal(deliver(id))).toContain('REPAIR_QA_REQUIRED')
  })

  it("another workspace's pass for the same id proves nothing", async () => {
    const id = await readyTicket()
    await check(id, 'pass', OTHER_WS)
    expect(await refusal(deliver(id))).toContain('REPAIR_QA_REQUIRED')
  })

  it('moves that are not a handover are untouched', async () => {
    const id = await readyTicket()
    await sql`UPDATE public.repair_tickets SET status = 'repairing' WHERE id = ${id}`
    const [row] = await sql`SELECT status FROM public.repair_tickets WHERE id = ${id}`
    expect(row!.status).toBe('repairing')
  })
})
