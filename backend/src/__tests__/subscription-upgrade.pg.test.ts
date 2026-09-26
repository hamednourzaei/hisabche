// ============================================
// Upgrade requests — docs/subscription-upgrade-requests-migration.sql run
// unchanged (twice) in a real Postgres.
//
// The defect it closes: `POST /api/billing/upgrade` activated pro/enterprise
// with no payment, for EVERY workspace of the caller.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PORT = 56000 + Math.floor(Math.random() * 900)
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-up-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/up`
let a: postgres.Sql
let b: postgres.Sql

const migration = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'subscription-upgrade-requests-migration.sql'),
  'utf8',
)

const WS1 = '11111111-1111-1111-1111-111111111111'
const WS2 = '22222222-2222-2222-2222-222222222222'
const OWNER = '33333333-3333-3333-3333-333333333333'
const ADMIN = '44444444-4444-4444-4444-444444444444'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('up')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
    END $$;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
    CREATE TABLE workspace_members (workspace_id uuid, user_id uuid, role text);
    -- As in docs/SETUP-COMPLETE.sql (columns the approval touches).
    CREATE TABLE subscriptions (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id uuid NOT NULL, plan text NOT NULL, status text NOT NULL,
      period_start timestamptz NOT NULL DEFAULT now(), period_end timestamptz NOT NULL DEFAULT now(),
      cancel_at_period_end boolean DEFAULT true,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
      is_trial boolean DEFAULT true, trial_used boolean DEFAULT true,
      workspace_id uuid NOT NULL
    );
  `)
  await setup.unsafe(migration)
  await setup.unsafe(migration)
  await setup.end()
  a = postgres(url, { max: 10, onnotice: () => {} })
  b = postgres(url, { max: 10, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await a?.end()
  await b?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
}, 60_000)

beforeEach(async () => {
  await a`DELETE FROM subscription_events`
  await a`DELETE FROM subscription_upgrade_requests`
  await a`DELETE FROM subscriptions`
  // One owner, TWO businesses — both on the trial.
  await a`INSERT INTO subscriptions (user_id, plan, status, workspace_id) VALUES
          (${OWNER}, 'free', 'trialing', ${WS1}), (${OWNER}, 'free', 'trialing', ${WS2})`
})

const request = (sql: postgres.Sql, ws = WS1, plan = 'pro') =>
  sql`SELECT * FROM create_subscription_upgrade_request(${ws}::uuid, ${OWNER}::uuid, 'free', ${plan}, 'month', 1200, 'USD', 'card_to_card', 'TRK-123', null)`

describe('a request changes nothing by itself', () => {
  it('the plan stays free until an admin approves; the log records the request', async () => {
    const [row] = await request(a)
    expect(row).toMatchObject({
      status: 'pending',
      requested_plan: 'pro',
      amount_minor: '1200',
      payment_reference: 'TRK-123',
    })
    const subs = await a`SELECT plan FROM subscriptions`
    expect(subs.every((s) => s.plan === 'free')).toBe(true)
    const [log] = await a`SELECT event FROM subscription_events`
    expect(log!.event).toBe('upgrade_requested')
  })

  it('⚠️ two simultaneous requests for one workspace: exactly one is created', async () => {
    const results = await Promise.allSettled([request(a), request(b), request(a), request(b)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    for (const r of rejected) expect(String(r.reason.message)).toContain('UPGRADE_REQUEST_PENDING')
  })
})

describe('approval — one transaction', () => {
  it('activates THIS workspace only, from now, cancel_at_period_end = false, logged with the period end', async () => {
    const [req] = await request(a)
    const [{ approve_subscription_upgrade: subId }] = (await a`
      SELECT approve_subscription_upgrade(${req!.id}::uuid, ${ADMIN}::uuid, null, 'paid by card')`) as unknown as [
      { approve_subscription_upgrade: string },
    ]
    const [ws1] =
      await a`SELECT id, plan, status, is_trial, cancel_at_period_end, period_end > now() + interval '27 days' AS month_ahead FROM subscriptions WHERE workspace_id = ${WS1}`
    const [ws2] = await a`SELECT plan FROM subscriptions WHERE workspace_id = ${WS2}`
    expect(ws1).toMatchObject({
      id: subId,
      plan: 'pro',
      status: 'active',
      is_trial: false,
      cancel_at_period_end: false,
      month_ahead: true,
    })
    expect(ws2!.plan).toBe('free')
    const events =
      await a`SELECT event, period_end IS NOT NULL AS has_end FROM subscription_events ORDER BY created_at`
    expect(events.map((e) => e.event)).toEqual(['upgrade_requested', 'upgrade_approved'])
    expect(events[1]!.has_end).toBe(true)
  })

  it('a request cannot be approved twice, even concurrently', async () => {
    const [req] = await request(a)
    const results = await Promise.allSettled([
      a`SELECT approve_subscription_upgrade(${req!.id}::uuid, ${ADMIN}::uuid, null, null)`,
      b`SELECT approve_subscription_upgrade(${req!.id}::uuid, ${ADMIN}::uuid, null, null)`,
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const [row] = await a<
      { n: number }[]
    >`SELECT count(*)::int AS n FROM subscription_events WHERE event = 'upgrade_approved'`
    expect(row!.n).toBe(1)
  })

  it('enterprise: the admin writes the agreed amount on approval', async () => {
    const [req] =
      await a`SELECT * FROM create_subscription_upgrade_request(${WS1}::uuid, ${OWNER}::uuid, 'pro', 'enterprise', 'year', null, 'USD', null, null, null)`
    await a`SELECT approve_subscription_upgrade(${req!.id}::uuid, ${ADMIN}::uuid, 150000, null)`
    const [row] =
      await a`SELECT amount_minor FROM subscription_upgrade_requests WHERE id = ${req!.id}`
    expect(row!.amount_minor).toBe('150000')
  })
})

describe('reject and withdraw', () => {
  it('rejected: no plan change, logged, and a new request is then possible', async () => {
    const [req] = await request(a)
    await a`SELECT reject_subscription_upgrade(${req!.id}::uuid, ${ADMIN}::uuid, 'no payment received')`
    const [ws1] = await a`SELECT plan FROM subscriptions WHERE workspace_id = ${WS1}`
    expect(ws1!.plan).toBe('free')
    await expect(request(a)).resolves.toHaveLength(1)
  })

  it("a member withdraws only their own workspace's pending request", async () => {
    const [req] = await request(a)
    await expect(
      a`SELECT cancel_subscription_upgrade_request(${req!.id}::uuid, ${WS2}::uuid, ${OWNER}::uuid)`,
    ).rejects.toThrow(/UPGRADE_REQUEST_NOT_FOUND/)
    await a`SELECT cancel_subscription_upgrade_request(${req!.id}::uuid, ${WS1}::uuid, ${OWNER}::uuid)`
    const [row] = await a`SELECT status FROM subscription_upgrade_requests WHERE id = ${req!.id}`
    expect(row!.status).toBe('cancelled')
  })
})

describe('members cannot approve or write', () => {
  it('no EXECUTE on the functions, no INSERT/UPDATE on the tables', async () => {
    const [p] = await a`
      SELECT has_function_privilege('authenticated', 'public.approve_subscription_upgrade(uuid, uuid, bigint, text)', 'EXECUTE') AS approve,
             has_function_privilege('authenticated', 'public.create_subscription_upgrade_request(uuid, uuid, text, text, text, bigint, text, text, text, text)', 'EXECUTE') AS create_req,
             has_table_privilege('authenticated', 'public.subscription_upgrade_requests', 'INSERT') AS ins,
             has_table_privilege('authenticated', 'public.subscription_upgrade_requests', 'UPDATE') AS upd,
             has_table_privilege('authenticated', 'public.subscription_events', 'INSERT') AS log_ins`
    expect(p).toEqual({ approve: false, create_req: false, ins: false, upd: false, log_ins: false })
  })
})
