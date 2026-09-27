// ============================================
// Developer platform — docs/developer-platform-migration.sql run unchanged
// (twice) in a real Postgres, then docs/VERIFY-developer-platform.sql.
//
// What only a real database can prove: that one event reaches each subscribed
// endpoint exactly once however often it is emitted, that two workers never
// claim the same delivery, that only the holder may finish one, that an
// endpoint failing for good is switched off, and that RLS shows keys and
// deliveries to a workspace's managers only — and secrets to nobody.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 57000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-dev-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/dev`
let db: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const migration = readFileSync(join(DOCS, 'developer-platform-migration.sql'), 'utf8')
const verify = readFileSync(join(DOCS, 'VERIFY-developer-platform.sql'), 'utf8')

const WS = 'aaaaaaaa-0000-0000-0000-000000000001'
const OTHER_WS = 'aaaaaaaa-0000-0000-0000-000000000002'
const OWNER = '11111111-1111-1111-1111-111111111111'
const MANAGER = '22222222-2222-2222-2222-222222222222'
const SELLER = '33333333-3333-3333-3333-333333333333'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('dev')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  // The parts of Supabase and of the existing schema the migration touches.
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
    GRANT SELECT ON public.workspace_members TO authenticated;
  `)
  await setup.unsafe(migration)
  await setup.unsafe(migration)
  await setup`INSERT INTO workspaces VALUES (${WS}), (${OTHER_WS})`
  await setup`
    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
      (${WS}, ${OWNER}, 'owner'), (${WS}, ${MANAGER}, 'manager'), (${WS}, ${SELLER}, 'seller')`
  await setup.end()
  db = postgres(url, { max: 10, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await db?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
}, 60_000)

async function endpoint(workspaceId: string, events: string[], active = true): Promise<string> {
  const [row] = await db`
    INSERT INTO webhook_endpoints (workspace_id, created_by, url, events, is_active)
    VALUES (${workspaceId}, ${OWNER}, 'https://example.com/hook', ${events}, ${active})
    RETURNING id`
  const id = row!.id as string
  await db`INSERT INTO webhook_endpoint_secrets (endpoint_id, secret) VALUES (${id}, ${'s'.repeat(40)})`
  return id
}

async function enqueue(workspaceId: string, eventId: string, type: string): Promise<number> {
  const [row] = await db`
    SELECT enqueue_webhook_event(${workspaceId}, ${eventId}, ${type}, ${db.json({ type })}) AS n`
  return row!.n as number
}

beforeEach(async () => {
  await db`DELETE FROM webhook_deliveries`
  await db`DELETE FROM webhook_endpoints`
  await db`DELETE FROM api_keys`
})

describe('the migration', () => {
  it('ran twice, and every VERIFY row reads ok', async () => {
    const rows = await db.unsafe(verify)
    expect(rows.length).toBe(11)
    for (const row of rows)
      expect({ check: row.check, ok: row.ok }).toEqual({ check: row.check, ok: true })
  })
})

describe('fan-out', () => {
  it('writes one delivery per subscribed, active endpoint of THAT workspace', async () => {
    const subscribed = await endpoint(WS, ['invoice.created'])
    await endpoint(WS, ['customer.created'])
    await endpoint(WS, ['invoice.created'], false)
    await endpoint(OTHER_WS, ['invoice.created'])

    expect(await enqueue(WS, randomUUID(), 'invoice.created')).toBe(1)
    const rows = await db`SELECT endpoint_id FROM webhook_deliveries`
    expect(rows.map((r) => r.endpoint_id)).toEqual([subscribed])
  })

  it('an event emitted twice is delivered once', async () => {
    await endpoint(WS, ['invoice.created'])
    const eventId = randomUUID()
    expect(await enqueue(WS, eventId, 'invoice.created')).toBe(1)
    expect(await enqueue(WS, eventId, 'invoice.created')).toBe(0)
    const [{ n }] = (await db`SELECT count(*)::int AS n FROM webhook_deliveries`) as unknown as [
      { n: number },
    ]
    expect(n).toBe(1)
  })
})

describe('claims', () => {
  it('two workers claiming at once never take the same delivery', async () => {
    await endpoint(WS, ['invoice.created'])
    for (let i = 0; i < 10; i++) await enqueue(WS, randomUUID(), 'invoice.created')
    const [x, y] = await Promise.all([
      db`SELECT id FROM claim_webhook_deliveries('w1', 10, 60, NULL)`,
      db`SELECT id FROM claim_webhook_deliveries('w2', 10, 60, NULL)`,
    ])
    const ids = [...x, ...y].map((r) => r.id as string)
    expect(ids.length).toBe(10)
    expect(new Set(ids).size).toBe(10)
  })

  it('only the holder may complete or fail a delivery', async () => {
    await endpoint(WS, ['invoice.created'])
    await enqueue(WS, randomUUID(), 'invoice.created')
    const [claimed] = await db`SELECT id FROM claim_webhook_deliveries('holder', 1, 60, NULL)`
    const id = claimed!.id as string
    const [intruder] = await db`SELECT complete_webhook_delivery(${id}, 'intruder', 200) AS ok`
    expect(intruder!.ok).toBe(false)
    const [failIntruder] =
      await db`SELECT fail_webhook_delivery(${id}, 'intruder', 'x', 500, 60) AS s`
    expect(failIntruder!.s).toBeNull()
    const [holder] = await db`SELECT complete_webhook_delivery(${id}, 'holder', 204) AS ok`
    expect(holder!.ok).toBe(true)
    const [row] = await db`SELECT status, last_status_code FROM webhook_deliveries WHERE id = ${id}`
    expect(row).toMatchObject({ status: 'succeeded', last_status_code: 204 })
  })

  it('a failed attempt returns to pending after the delay, and ends failed at max_attempts', async () => {
    await endpoint(WS, ['invoice.created'])
    await enqueue(WS, randomUUID(), 'invoice.created')
    await db`UPDATE webhook_deliveries SET max_attempts = 2`
    const [first] = await db`SELECT id FROM claim_webhook_deliveries('w', 1, 60, NULL)`
    const id = first!.id as string
    const [again] = await db`SELECT fail_webhook_delivery(${id}, 'w', 'HTTP 500', 500, 3600) AS s`
    expect(again!.s).toBe('pending')
    // Not due for an hour: nothing to claim.
    expect((await db`SELECT id FROM claim_webhook_deliveries('w', 1, 60, NULL)`).length).toBe(0)
    await db`UPDATE webhook_deliveries SET next_attempt_at = now() WHERE id = ${id}`
    await db`SELECT id FROM claim_webhook_deliveries('w', 1, 60, NULL)`
    const [last] = await db`SELECT fail_webhook_delivery(${id}, 'w', 'HTTP 500', 500, 60) AS s`
    expect(last!.s).toBe('failed')
  })

  it('an endpoint whose deliveries fail for good 20 times in a row is switched off, with the reason', async () => {
    const id = await endpoint(WS, ['invoice.created'])
    await db`UPDATE webhook_endpoints SET consecutive_failures = 19 WHERE id = ${id}`
    await enqueue(WS, randomUUID(), 'invoice.created')
    await db`UPDATE webhook_deliveries SET max_attempts = 1`
    const [claimed] = await db`SELECT id FROM claim_webhook_deliveries('w', 1, 60, NULL)`
    await db`SELECT fail_webhook_delivery(${claimed!.id as string}, 'w', 'HTTP 410', 410, 60)`
    const [ep] =
      await db`SELECT is_active, disabled_reason, consecutive_failures FROM webhook_endpoints WHERE id = ${id}`
    expect(ep).toMatchObject({
      is_active: false,
      disabled_reason: 'TOO_MANY_FAILURES',
      consecutive_failures: 20,
    })
    // And nothing more is claimed for it.
    await enqueue(WS, randomUUID(), 'invoice.created')
    expect((await db`SELECT id FROM claim_webhook_deliveries('w', 5, 60, NULL)`).length).toBe(0)
  })
})

/** Run `fn` as a PostgREST request would: role + the caller's JWT subject. */
async function as<T>(
  role: 'anon' | 'authenticated',
  userId: string | null,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
) {
  return (await db.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL ROLE ${role}`)
    if (userId) await tx.unsafe(`SET LOCAL request.jwt.claim.sub = '${userId}'`)
    return fn(tx)
  })) as T
}

describe('RLS', () => {
  beforeEach(async () => {
    await db`
      INSERT INTO api_keys (workspace_id, created_by, name, prefix, key_hash, scopes)
      VALUES (${WS}, ${OWNER}, 'shop', 'hk_live_abcdefgh', ${'a'.repeat(64)}, ${['read:invoices']}),
             (${OTHER_WS}, ${OWNER}, 'other', 'hk_live_zzzzzzzz', ${'b'.repeat(64)}, ${['read:invoices']})`
    await endpoint(WS, ['invoice.created'])
  })

  it('owners and managers read their own workspace keys only', async () => {
    for (const user of [OWNER, MANAGER]) {
      const rows = await as('authenticated', user, (tx) => tx`SELECT name FROM api_keys`)
      expect(rows.map((r) => r.name)).toEqual(['shop'])
    }
  })

  it('a seller reads no keys and no endpoints', async () => {
    expect((await as('authenticated', SELLER, (tx) => tx`SELECT id FROM api_keys`)).length).toBe(0)
    expect(
      (await as('authenticated', SELLER, (tx) => tx`SELECT id FROM webhook_endpoints`)).length,
    ).toBe(0)
  })

  it('nobody but the service role reads a secret', async () => {
    await expect(
      as('authenticated', OWNER, (tx) => tx`SELECT secret FROM webhook_endpoint_secrets`),
    ).rejects.toThrow(/permission denied/)
    await expect(
      as('anon', null, (tx) => tx`SELECT secret FROM webhook_endpoint_secrets`),
    ).rejects.toThrow(/permission denied/)
  })

  it('an owner cannot write a key directly — writes are the backend’s', async () => {
    await expect(
      as('authenticated', OWNER, (tx) => tx`UPDATE api_keys SET revoked_at = NULL`),
    ).rejects.toThrow(/permission denied/)
  })

  it('anon reads nothing', async () => {
    await expect(as('anon', null, (tx) => tx`SELECT id FROM api_keys`)).rejects.toThrow(
      /permission denied/,
    )
  })

  it('a client cannot call the delivery functions', async () => {
    await expect(
      as('authenticated', OWNER, (tx) => tx`SELECT claim_webhook_deliveries('x', 1, 60, NULL)`),
    ).rejects.toThrow(/permission denied/)
  })
})
