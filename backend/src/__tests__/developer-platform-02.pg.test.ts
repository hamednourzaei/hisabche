// ============================================
// Developer platform 02 — docs/developer-platform-02-migration.sql, run
// unchanged (twice) after 01 in a real Postgres, then its VERIFY query.
//
// What only a real database can prove: that a stock event fires on the
// CROSSING and not on every sale below the line, that a broken webhook path
// cannot stop the sale that moved the stock, that usage counts are exact, and
// that replay touches only the finished deliveries of the endpoint asked for.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 57000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-dev2-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/dev2`
let db: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const m01 = readFileSync(join(DOCS, 'developer-platform-migration.sql'), 'utf8')
const m02 = readFileSync(join(DOCS, 'developer-platform-02-migration.sql'), 'utf8')
const verify = readFileSync(join(DOCS, 'VERIFY-developer-platform-02.sql'), 'utf8')

const WS = 'aaaaaaaa-0000-0000-0000-000000000001'
const OWNER = '11111111-1111-1111-1111-111111111111'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('dev2')
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
    CREATE TABLE public.workspaces (id uuid PRIMARY KEY);
    CREATE TABLE public.workspace_members (
      workspace_id uuid NOT NULL, user_id uuid NOT NULL, role text,
      has_access boolean DEFAULT true, suspended_at timestamptz
    );
    CREATE TABLE public.products (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid, quantity numeric(18,4) DEFAULT 0,
      min_stock_level integer DEFAULT 0, is_active boolean DEFAULT true
    );
  `)
  // 02 refuses to run before 01.
  await expect(setup.unsafe(m02)).rejects.toThrow(/developer-platform-migration\.sql first/)
  await setup.unsafe('ROLLBACK')
  await setup.unsafe(m01)
  await setup.unsafe(m02)
  await setup.unsafe(m02)
  await setup`INSERT INTO workspaces VALUES (${WS})`
  await setup`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (${WS}, ${OWNER}, 'owner')`
  await setup.end()
  db = postgres(url, { max: 5, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await db?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
}, 60_000)

beforeEach(async () => {
  await db`DELETE FROM webhook_deliveries`
  await db`DELETE FROM webhook_endpoints`
  await db`DELETE FROM api_request_logs`
  await db`DELETE FROM api_keys`
  await db`DELETE FROM products`
})

async function endpoint(events: string[]): Promise<string> {
  const [row] = await db`
    INSERT INTO webhook_endpoints (workspace_id, created_by, url, events)
    VALUES (${WS}, ${OWNER}, 'https://example.com/hook', ${events}) RETURNING id`
  return row!.id as string
}

async function product(quantity: number, min: number): Promise<string> {
  const [row] = await db`
    INSERT INTO products (workspace_id, quantity, min_stock_level) VALUES (${WS}, ${quantity}, ${min}) RETURNING id`
  return row!.id as string
}

const events = async () =>
  (await db`SELECT event_type, payload FROM webhook_deliveries ORDER BY created_at`).map((r) => ({
    type: r.event_type as string,
    payload: r.payload as Record<string, unknown>,
  }))

describe('the migration', () => {
  it('ran twice after 01, and every VERIFY row reads ok', async () => {
    const rows = await db.unsafe(verify)
    expect(rows.length).toBe(8)
    for (const row of rows)
      expect({ check: row.check, ok: row.ok }).toEqual({ check: row.check, ok: true })
  })
})

describe('stock events', () => {
  it('fire on the crossing only — not on every sale below the line', async () => {
    await endpoint(['inventory.low_stock', 'inventory.restocked'])
    const id = await product(10, 3)
    await db`UPDATE products SET quantity = 5 WHERE id = ${id}` // still above
    await db`UPDATE products SET quantity = 3 WHERE id = ${id}` // crosses: low
    await db`UPDATE products SET quantity = 1 WHERE id = ${id}` // still low
    await db`UPDATE products SET quantity = 8 WHERE id = ${id}` // crosses: restocked
    expect((await events()).map((e) => e.type)).toEqual([
      'inventory.low_stock',
      'inventory.restocked',
    ])
  })

  it('the envelope is the one buildEnvelope writes', async () => {
    await endpoint(['inventory.low_stock'])
    const id = await product(5, 3)
    await db`UPDATE products SET quantity = 2 WHERE id = ${id}`
    const [event] = await events()
    expect(event!.payload).toMatchObject({
      type: 'inventory.low_stock',
      workspaceId: WS,
      data: { resource: 'product', id },
      apiVersion: 1,
    })
    expect(String(event!.payload.createdAt)).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    )
    expect(event!.payload.id).toBeTruthy()
  })

  it('raising the threshold above the stock is a crossing too', async () => {
    await endpoint(['inventory.low_stock'])
    const id = await product(5, 2)
    await db`UPDATE products SET min_stock_level = 6 WHERE id = ${id}`
    expect((await events()).map((e) => e.type)).toEqual(['inventory.low_stock'])
  })

  it('an inactive product emits nothing', async () => {
    await endpoint(['inventory.low_stock'])
    const [row] = await db`
      INSERT INTO products (workspace_id, quantity, min_stock_level, is_active)
      VALUES (${WS}, 5, 3, false) RETURNING id`
    await db`UPDATE products SET quantity = 0 WHERE id = ${row!.id as string}`
    expect(await events()).toEqual([])
  })

  it('a broken webhook path cannot stop the sale that moved the stock', async () => {
    await endpoint(['inventory.low_stock'])
    const id = await product(5, 3)
    await db`ALTER TABLE webhook_deliveries ADD CONSTRAINT refuse_all CHECK (false) NOT VALID`
    try {
      await db`UPDATE products SET quantity = 1 WHERE id = ${id}`
      const [row] = await db`SELECT quantity FROM products WHERE id = ${id}`
      expect(Number(row!.quantity)).toBe(1)
      expect(await events()).toEqual([])
    } finally {
      await db`ALTER TABLE webhook_deliveries DROP CONSTRAINT refuse_all`
    }
  })
})

async function key(): Promise<string> {
  const [row] = await db`
    INSERT INTO api_keys (workspace_id, created_by, name, prefix, key_hash, scopes)
    VALUES (${WS}, ${OWNER}, 'k', 'hk_live_x', ${randomUUID().replace(/-/g, '').padEnd(64, '0')}, ${['read:invoices']})
    RETURNING id`
  return row!.id as string
}

describe('usage', () => {
  it('counts are exact and split by outcome, per key', async () => {
    const k1 = await key()
    const k2 = await key()
    const rows: Array<[string, number, number]> = [
      [k1, 200, 10],
      [k1, 200, 30],
      [k1, 404, 5],
      [k1, 500, 55],
      [k2, 200, 1],
    ]
    for (const [k, status, ms] of rows) {
      await db`
        INSERT INTO api_request_logs (workspace_id, key_id, method, route, status, duration_ms)
        VALUES (${WS}, ${k}, 'GET', '/api/invoices', ${status}, ${ms})`
    }
    const usage = await db`SELECT * FROM api_key_usage(${WS}, ${k1}, 7)`
    expect(usage.length).toBe(1)
    expect(usage[0]).toMatchObject({
      requests: '4',
      client_errors: '1',
      server_errors: '1',
      avg_ms: 25,
    })
  })

  it('retention never keeps less than 7 days, whatever it is asked', async () => {
    const k = await key()
    await db`
      INSERT INTO api_request_logs (workspace_id, key_id, method, route, status, duration_ms, created_at)
      VALUES (${WS}, ${k}, 'GET', '/x', 200, 1, now() - interval '3 days'),
             (${WS}, ${k}, 'GET', '/x', 200, 1, now() - interval '40 days')`
    const [purged] = await db`SELECT purge_api_request_logs(1) AS n`
    expect(purged!.n).toBe(1)
    const [{ n }] = (await db`SELECT count(*)::int AS n FROM api_request_logs`) as unknown as [
      { n: number },
    ]
    expect(n).toBe(1)
  })
})

describe('replay', () => {
  async function delivery(endpointId: string, status: string, ageDays = 0) {
    await db`
      INSERT INTO webhook_deliveries (workspace_id, endpoint_id, event_id, event_type, payload, status, attempts, created_at)
      VALUES (${WS}, ${endpointId}, ${randomUUID()}, 'invoice.created', '{}'::jsonb, ${status}, 3,
              now() - make_interval(days => ${ageDays}))`
  }

  it('requeues the finished deliveries of that endpoint since the moment — nothing else', async () => {
    const a = await endpoint(['invoice.created'])
    const b = await endpoint(['invoice.created'])
    await delivery(a, 'succeeded')
    await delivery(a, 'failed')
    await delivery(a, 'pending')
    await delivery(a, 'succeeded', 10)
    await delivery(b, 'succeeded')
    const [out] =
      await db`SELECT replay_webhook_deliveries(${WS}, ${a}, now() - interval '1 day') AS n`
    expect(out!.n).toBe(2)
    const replayed = await db`
      SELECT endpoint_id, status, attempts FROM webhook_deliveries WHERE replayed_at IS NOT NULL`
    expect(replayed.length).toBe(2)
    for (const r of replayed)
      expect(r).toMatchObject({ endpoint_id: a, status: 'pending', attempts: 0 })
  })

  it('refuses a window longer than 30 days', async () => {
    const a = await endpoint(['invoice.created'])
    await expect(
      db`SELECT replay_webhook_deliveries(${WS}, ${a}, now() - interval '31 days')`,
    ).rejects.toThrow(/REPLAY_WINDOW_TOO_LONG/)
  })
})
