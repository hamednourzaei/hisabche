// ============================================
// Subscription renewal fix — docs/subscription-renewal-fix-migration.sql run
// TWICE on a real Postgres.
//
// The two defects it closes (owner's report, 30 Aug 1405):
//   1. A legacy subscription with workspace_id IS NULL could not be renewed
//      because approve_subscription_upgrade() looked only by workspace_id —
//      while the write lock already resolved it through the workspace owner.
//   2. Every approval started the period at now(), throwing away the paid-for
//      remainder of an early renewal.
// ============================================

import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-renewal-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/renewal`
let sql: postgres.Sql

const migration = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'subscription-renewal-fix-migration.sql'),
  'utf8',
)
const baseMigration = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'subscription-upgrade-requests-migration.sql'),
  'utf8',
)

const WS_FUTURE = '11111111-1111-1111-1111-111111111111'
const WS_LEGACY = '22222222-2222-2222-2222-222222222222'
const WS_OTHER = '33333333-3333-3333-3333-333333333333'
const OWNER = '44444444-4444-4444-4444-444444444444'
const OTHER_OWNER = '55555555-5555-5555-5555-555555555555'
const ADMIN = '66666666-6666-6666-6666-666666666666'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('renewal')
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
  `)

  // The real subscriptions/workspaces shape the renewal touches. workspace_id
  // is NULLABLE on purpose: legacy rows really are still NULL there.
  await setup.unsafe(`
    CREATE TABLE workspaces (
      id uuid PRIMARY KEY,
      owner_id uuid,
      name text NOT NULL
    );
    CREATE TABLE subscriptions (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id uuid NOT NULL,
      workspace_id uuid,
      plan text NOT NULL,
      status text NOT NULL,
      is_trial boolean DEFAULT true,
      trial_used boolean DEFAULT true,
      period_start timestamptz NOT NULL DEFAULT now(),
      period_end timestamptz NOT NULL DEFAULT now(),
      cancel_at_period_end boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  `)

  // The tables the approval function writes. Run the base migration for them.
  await setup.unsafe(baseMigration)
  // …and the fix, twice: idempotent.
  await setup.unsafe(migration)
  await setup.unsafe(migration)
  await setup.end()
  sql = postgres(url, { max: 10, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
}, 60_000)

beforeEach(async () => {
  await sql`DELETE FROM subscription_events`
  await sql`DELETE FROM subscription_upgrade_requests`
  await sql`DELETE FROM subscriptions`
  await sql`DELETE FROM workspaces`
  await sql`INSERT INTO workspaces (id, owner_id, name) VALUES
    (${WS_FUTURE}, ${OWNER}, 'Future shop'),
    (${WS_LEGACY}, ${OWNER}, 'Legacy shop'),
    (${WS_OTHER}, ${OTHER_OWNER}, 'Other shop')`
})

async function requestAndApprove(workspaceId: string, plan: string) {
  const [req] = await sql`
    SELECT * FROM create_subscription_upgrade_request(
      ${workspaceId}::uuid, ${OWNER}::uuid, 'pro', ${plan}, 'month',
      null, null, 'card_to_card', null, null)`
  const [{ approve_subscription_upgrade: subId }] = (await sql`
    SELECT approve_subscription_upgrade(${req!.id}::uuid, ${ADMIN}::uuid, 1000, null)`) as unknown as [
    { approve_subscription_upgrade: string },
  ]
  return { req: req!, subId }
}

describe('early renewal keeps the paid remainder', () => {
  it('monthly: the new period starts at the current period_end, not at now()', async () => {
    const oldEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
    await sql`
      INSERT INTO subscriptions (user_id, workspace_id, plan, status, period_start, period_end,
                                 cancel_at_period_end, is_trial)
      VALUES (${OWNER}, ${WS_FUTURE}, 'pro', 'active', now() - interval '20 days',
              ${oldEnd.toISOString()}, true, false)`

    await requestAndApprove(WS_FUTURE, 'pro')

    const [row] = await sql`
      SELECT plan, status, period_start, period_end, cancel_at_period_end
        FROM subscriptions WHERE workspace_id = ${WS_FUTURE}`
    expect(row!.plan).toBe('pro')
    expect(row!.status).toBe('active')
    expect(row!.cancel_at_period_end).toBe(false)
    // Starts where the old period ended (within a second of clock handling).
    expect(Math.abs(new Date(row!.period_start).getTime() - oldEnd.getTime())).toBeLessThan(2000)
    // …and that is NOT «now + a month»: a month on top of the old end is at
    // least 37 days away from today (10 remaining + 27 minimum month).
    const endMs = new Date(row!.period_end).getTime()
    expect(endMs).toBeGreaterThan(oldEnd.getTime() + 27 * 24 * 60 * 60 * 1000)
    expect(endMs).toBeLessThan(oldEnd.getTime() + 32 * 24 * 60 * 60 * 1000)
  })

  it('after expiry the new period starts at now()', async () => {
    await sql`
      INSERT INTO subscriptions (user_id, workspace_id, plan, status, period_start, period_end,
                                 is_trial)
      VALUES (${OWNER}, ${WS_FUTURE}, 'pro', 'active', now() - interval '40 days',
              now() - interval '10 days', false)`

    await requestAndApprove(WS_FUTURE, 'pro')

    const [row] = await sql`
      SELECT period_start, period_end FROM subscriptions WHERE workspace_id = ${WS_FUTURE}`
    expect(Math.abs(new Date(row!.period_start).getTime() - Date.now())).toBeLessThan(5000)
    const days = (new Date(row!.period_end).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    expect(days).toBeGreaterThan(27)
    expect(days).toBeLessThan(32)
  })
})

describe('legacy owner-only subscription', () => {
  it('is renewed through the workspace owner, and adopts the workspace in the same transaction', async () => {
    // The lolokhan shape: the subscription exists but never got workspace_id.
    await sql`
      INSERT INTO subscriptions (user_id, workspace_id, plan, status, period_start, period_end,
                                 is_trial)
      VALUES (${OWNER}, NULL, 'enterprise', 'active', now() - interval '40 days',
              now() - interval '5 days', false)`

    const { subId } = await requestAndApprove(WS_LEGACY, 'enterprise')

    const [row] = await sql`
      SELECT workspace_id, plan, status, period_end > now() + interval '27 days' AS month_ahead
        FROM subscriptions WHERE id = ${subId}`
    expect(row!.workspace_id).toBe(WS_LEGACY)
    expect(row!.plan).toBe('enterprise')
    expect(row!.status).toBe('active')
    expect(row!.month_ahead).toBe(true)
  })

  it('never adopts an owner row that already belongs to ANOTHER workspace', async () => {
    // Same owner, but their row belongs to WS_FUTURE. WS_LEGACY has no
    // subscription of its own — the approval must refuse instead of switching
    // the other business's plan.
    await sql`
      INSERT INTO subscriptions (user_id, workspace_id, plan, status, period_start, period_end)
      VALUES (${OWNER}, ${WS_FUTURE}, 'pro', 'active', now() - interval '10 days',
              now() + interval '20 days')`

    const [req] = await sql`
      SELECT * FROM create_subscription_upgrade_request(
        ${WS_LEGACY}::uuid, ${OWNER}::uuid, 'free', 'pro', 'month',
        null, null, null, null, null)`

    await expect(
      sql`SELECT approve_subscription_upgrade(${req!.id}::uuid, ${ADMIN}::uuid, null, null)`,
    ).rejects.toThrow(/SUBSCRIPTION_NOT_FOUND/)

    const [future] = await sql`
      SELECT workspace_id, plan FROM subscriptions WHERE user_id = ${OWNER}`
    expect(future!.workspace_id).toBe(WS_FUTURE)
    expect(future!.plan).toBe('pro')
  })
})

describe('one transaction, one decision', () => {
  it('a request cannot be approved twice', async () => {
    await sql`
      INSERT INTO subscriptions (user_id, workspace_id, plan, status, period_start, period_end)
      VALUES (${OWNER}, ${WS_FUTURE}, 'free', 'trialing', now(), now() + interval '7 days')`
    const [req] = await sql`
      SELECT * FROM create_subscription_upgrade_request(
        ${WS_FUTURE}::uuid, ${OWNER}::uuid, 'free', 'pro', 'month',
        null, null, null, null, null)`

    await sql`SELECT approve_subscription_upgrade(${req!.id}::uuid, ${ADMIN}::uuid, null, null)`
    await expect(
      sql`SELECT approve_subscription_upgrade(${req!.id}::uuid, ${ADMIN}::uuid, null, null)`,
    ).rejects.toThrow(/UPGRADE_REQUEST_NOT_PENDING/)

    const [events] = await sql<
      { n: number }[]
    >`SELECT count(*)::int AS n FROM subscription_events WHERE event = 'upgrade_approved'`
    expect(events!.n).toBe(1)
  })

  it('logs the period end that was actually applied', async () => {
    const oldEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    await sql`
      INSERT INTO subscriptions (user_id, workspace_id, plan, status, period_start, period_end)
      VALUES (${OWNER}, ${WS_FUTURE}, 'pro', 'active', now() - interval '27 days',
              ${oldEnd.toISOString()})`
    await requestAndApprove(WS_FUTURE, 'pro')

    const [log] = await sql`
      SELECT period_end FROM subscription_events WHERE event = 'upgrade_approved'`
    const [sub] = await sql`
      SELECT period_end FROM subscriptions WHERE workspace_id = ${WS_FUTURE}`
    expect(new Date(log!.period_end).getTime()).toBe(new Date(sub!.period_end).getTime())
  })
})

describe('clients cannot approve', () => {
  it('authenticated has no EXECUTE; service_role does', async () => {
    const [p] = await sql`
      SELECT has_function_privilege('authenticated',
               'public.approve_subscription_upgrade(uuid, uuid, bigint, text)', 'EXECUTE') AS member,
             has_function_privilege('service_role',
               'public.approve_subscription_upgrade(uuid, uuid, bigint, text)', 'EXECUTE') AS backend`
    expect(p).toEqual({ member: false, backend: true })
  })
})
