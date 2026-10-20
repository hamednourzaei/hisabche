// ============================================
// Entitlement 01 migration pg test
// Runs docs/plan-limits-migration.sql first, then docs/entitlement-01-migration.sql TWICE.
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-ent-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/ent`
let sql: postgres.Sql

const planLimitsMigration = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'plan-limits-migration.sql'),
  'utf8',
)
const entitlementMigration = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'entitlement-01-migration.sql'),
  'utf8',
)

const WS1 = '11111111-1111-1111-1111-111111111111'
const WS2 = '22222222-2222-2222-2222-222222222222'
const USER1 = '33333333-3333-3333-3333-333333333333'
const USER2 = '44444444-4444-4444-4444-444444444444'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('ent')
  const setup = postgres(url, { max: 1, onnotice: () => {} })

  // Prerequisite setup: roles, schemas, base tables
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
    END $$;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

    CREATE TABLE IF NOT EXISTS public.workspaces (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      time_zone text,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.workspace_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
      user_id uuid NOT NULL,
      role text NOT NULL DEFAULT 'owner'
    );
    GRANT SELECT ON public.workspace_members TO authenticated;

    CREATE TABLE IF NOT EXISTS public.subscription_upgrade_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      requested_by uuid NOT NULL,
      current_plan text NOT NULL,
      requested_plan text NOT NULL CHECK (requested_plan IN ('pro', 'enterprise')),
      billing_interval text NOT NULL DEFAULT 'month',
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.subscription_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      event text NOT NULL CHECK (event IN ('upgrade_requested', 'upgrade_approved', 'cancelled')),
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `)

  // 1. Run plan-limits-migration.sql first
  await setup.unsafe(planLimitsMigration)

  // 2. Run entitlement-01-migration.sql TWICE (idempotency check)
  await setup.unsafe(entitlementMigration)
  await setup.unsafe(entitlementMigration)

  await setup.end()
  sql = postgres(url, { max: 10, onnotice: () => {} })
}, 180_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
  rmSync(dir, { recursive: true, force: true })
}, 60_000)

beforeEach(async () => {
  await sql`DELETE FROM public.offline_licenses`
  await sql`DELETE FROM public.devices`
  await sql`DELETE FROM public.workspace_members`
  await sql`DELETE FROM public.workspaces`

  // Insert two workspaces with two currencies
  await sql`INSERT INTO public.workspaces (id, name, time_zone) VALUES
    (${WS1}, 'Workspace Iran (IRR)', 'Asia/Tehran'),
    (${WS2}, 'Workspace Afghanistan (AFN)', 'Asia/Kabul')`

  await sql`INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES
    (${WS1}, ${USER1}, 'owner'),
    (${WS2}, ${USER2}, 'owner')`
})

describe('docs/entitlement-01-migration.sql', () => {
  it('widens plan_limit_settings check constraint to accept new plans', async () => {
    // Should accept new plans
    for (const plan of ['FREE', 'OFFLINE', 'ONLINE_500', 'ONLINE_1000', 'ONLINE_1500']) {
      await sql`INSERT INTO public.plan_limit_settings (plan, limits)
        VALUES (${plan}, '{}'::jsonb)
        ON CONFLICT (plan) DO UPDATE SET limits = EXCLUDED.limits`
    }

    const rows = await sql`SELECT plan FROM public.plan_limit_settings WHERE plan LIKE 'ONLINE_%'`
    expect(rows.map((r) => r.plan).sort()).toEqual(['ONLINE_1000', 'ONLINE_1500', 'ONLINE_500'])

    // Unknown plan should be rejected
    await expect(
      sql`INSERT INTO public.plan_limit_settings (plan, limits) VALUES ('SUPER_PLAN', '{}'::jsonb)`,
    ).rejects.toThrow()
  })

  it('widens subscription_upgrade_requests check constraint to accept new plans', async () => {
    await sql`INSERT INTO public.subscription_upgrade_requests
      (workspace_id, requested_by, current_plan, requested_plan)
      VALUES (${WS1}, ${USER1}, 'FREE', 'ONLINE_500')`

    const [row] =
      await sql`SELECT requested_plan FROM public.subscription_upgrade_requests WHERE workspace_id = ${WS1}`
    expect(row?.requested_plan).toBe('ONLINE_500')

    await expect(
      sql`INSERT INTO public.subscription_upgrade_requests
        (workspace_id, requested_by, current_plan, requested_plan)
        VALUES (${WS1}, ${USER1}, 'FREE', 'INVALID_PLAN')`,
    ).rejects.toThrow()
  })

  it('widens subscription_events check constraint to accept new event types', async () => {
    for (const event of [
      'refunded',
      'downgraded',
      'credit_issued',
      'licence_issued',
      'licence_revoked',
      'device_released',
    ]) {
      await sql`INSERT INTO public.subscription_events (workspace_id, event) VALUES (${WS1}, ${event})`
    }

    const rows = await sql`SELECT event FROM public.subscription_events WHERE workspace_id = ${WS1}`
    expect(rows).toHaveLength(6)

    await expect(
      sql`INSERT INTO public.subscription_events (workspace_id, event) VALUES (${WS1}, 'unsupported_event')`,
    ).rejects.toThrow()
  })

  it('enforces table privileges and RLS on offline_licenses and devices', async () => {
    const [p] = await sql`
      SELECT
        has_table_privilege('anon', 'public.offline_licenses', 'SELECT') AS anon_lic_sel,
        has_table_privilege('anon', 'public.devices', 'SELECT') AS anon_dev_sel,
        has_table_privilege('authenticated', 'public.offline_licenses', 'INSERT') AS auth_lic_ins,
        has_table_privilege('authenticated', 'public.devices', 'INSERT') AS auth_dev_ins,
        has_table_privilege('service_role', 'public.offline_licenses', 'INSERT') AS srv_lic_ins,
        has_table_privilege('service_role', 'public.devices', 'INSERT') AS srv_dev_ins
    `
    expect(p).toEqual({
      anon_lic_sel: false,
      anon_dev_sel: false,
      auth_lic_ins: false,
      auth_dev_ins: false,
      srv_lic_ins: true,
      srv_dev_ins: true,
    })
  })

  it('isolates offline_licenses and devices by workspace via RLS', async () => {
    // Insert for WS1 and WS2
    await sql`INSERT INTO public.offline_licenses (workspace_id, account_id, plan, expires_at)
      VALUES (${WS1}, ${USER1}, 'OFFLINE', now() + interval '1 year'),
             (${WS2}, ${USER2}, 'OFFLINE', now() + interval '1 year')`

    await sql`INSERT INTO public.devices (workspace_id, label)
      VALUES (${WS1}, 'POS Register 1 (IRR)'),
             (${WS2}, 'POS Register 2 (AFN)')`

    // As user 1
    const authedSql1 = postgres(url, {
      max: 1,
      onnotice: () => {},
      transform: {
        ...postgres.camel,
      },
    })
    await authedSql1.unsafe(`SET ROLE authenticated; SET request.jwt.claim.sub = '${USER1}';`)

    const user1Licenses = await authedSql1`SELECT workspace_id FROM public.offline_licenses`
    expect(user1Licenses).toHaveLength(1)
    expect(user1Licenses[0]?.workspaceId).toBe(WS1)

    const user1Devices = await authedSql1`SELECT workspace_id, label FROM public.devices`
    expect(user1Devices).toHaveLength(1)
    expect(user1Devices[0]?.workspaceId).toBe(WS1)
    expect(user1Devices[0]?.label).toContain('IRR')

    await authedSql1.end()
  })
})
