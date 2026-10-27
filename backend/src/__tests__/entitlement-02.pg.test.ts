// ============================================
// backend/src/__tests__/entitlement-02.pg.test.ts
// Entitlement 02 migration pg test
// Runs docs/plan-limits-migration.sql, docs/entitlement-01-migration.sql,
// then docs/entitlement-02-migration.sql TWICE (testing idempotency).
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'

const PORT = freePortSync()
const dir = mkdtempSync(join(tmpdir(), 'hisabche-pg-ent2-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/ent2`
let sql: postgres.Sql

const planLimitsMigration = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'plan-limits-migration.sql'),
  'utf8',
)
const entitlement01Migration = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'entitlement-01-migration.sql'),
  'utf8',
)
const entitlement02Migration = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'entitlement-02-migration.sql'),
  'utf8',
)

const WS1 = '11111111-1111-1111-1111-111111111111'
const WS2 = '22222222-2222-2222-2222-222222222222'
const USER1 = '33333333-3333-3333-3333-333333333333'
const USER2 = '44444444-4444-4444-4444-444444444444'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('ent2')
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

    CREATE TABLE IF NOT EXISTS public.subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
      plan text NOT NULL,
      status text NOT NULL DEFAULT 'active',
      period_start timestamptz,
      period_end timestamptz,
      is_trial boolean DEFAULT false,
      trial_used boolean DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS public.subscription_upgrade_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
      requested_by uuid NOT NULL,
      current_plan text NOT NULL,
      requested_plan text NOT NULL,
      billing_interval text NOT NULL DEFAULT 'month',
      amount_minor bigint,
      currency text,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.subscription_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
      event text NOT NULL,
      metadata jsonb,
      created_at timestamptz DEFAULT now()
    );
  `)

  // Run prerequisites
  await setup.unsafe(planLimitsMigration)
  await setup.unsafe(entitlement01Migration)

  // Run entitlement-02 migration TWICE (proving idempotency)
  await setup.unsafe(entitlement02Migration)
  await setup.unsafe(entitlement02Migration)

  await setup.end()
  sql = postgres(url, { max: 5, onnotice: () => {} })
})

afterAll(async () => {
  if (sql) await sql.end()
  await pg.stop()
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    // the temp directory may still be locked on Windows; it is not test state
  }
})

beforeEach(async () => {
  await sql`TRUNCATE TABLE public.license_logs, public.license_review_queue, public.devices, public.offline_licenses, public.workspace_members, public.workspaces CASCADE`
  await sql`INSERT INTO public.workspaces (id, name, time_zone) VALUES (${WS1}, 'Tehran Shop (IRR)', 'Asia/Tehran'), (${WS2}, 'Kabul Branch (AFN)', 'Asia/Kabul')`
  await sql`INSERT INTO public.workspace_members (workspace_id, user_id) VALUES (${WS1}, ${USER1}), (${WS2}, ${USER2})`
})

describe('docs/entitlement-02-migration.sql', () => {
  it('applies idempotent columns to offline_licenses and devices', async () => {
    const licCols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'offline_licenses' AND column_name IN ('status', 'banned_at', 'ban_reason', 'transfer_count', 'transfer_year')
    `
    expect(licCols.map((c) => c.column_name).sort()).toEqual([
      'ban_reason',
      'banned_at',
      'status',
      'transfer_count',
      'transfer_year',
    ])

    const devCols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'devices' AND column_name IN ('seat', 'stable_id', 'public_key', 'is_active', 'license_id')
    `
    expect(devCols.map((c) => c.column_name).sort()).toEqual([
      'is_active',
      'license_id',
      'public_key',
      'seat',
      'stable_id',
    ])
  })

  it('enforces check constraints on seat and status', async () => {
    const licId = '33333333-3333-3333-3333-333333333333'
    // Invalid status should be refused
    await expect(
      sql`INSERT INTO public.offline_licenses (license_id, workspace_id, account_id, plan, expires_at, status)
          VALUES (${licId}, ${WS1}, ${USER1}, 'OFFLINE', now() + interval '1 year', 'invalid_status')`,
    ).rejects.toThrow()

    // Valid status allowed
    await sql`INSERT INTO public.offline_licenses (license_id, workspace_id, account_id, plan, expires_at, status)
              VALUES (${licId}, ${WS1}, ${USER1}, 'OFFLINE', now() + interval '1 year', 'banned')`

    // Invalid seat should be refused
    await expect(
      sql`INSERT INTO public.devices (workspace_id, license_id, seat, stable_id)
          VALUES (${WS1}, ${licId}, 'smartwatch', 'stable-123')`,
    ).rejects.toThrow()

    // Valid seats ('computer' and 'mobile') allowed
    await sql`INSERT INTO public.devices (workspace_id, license_id, seat, stable_id)
              VALUES (${WS1}, ${licId}, 'computer', 'stable-pc')`
    await sql`INSERT INTO public.devices (workspace_id, license_id, seat, stable_id)
              VALUES (${WS1}, ${licId}, 'mobile', 'stable-phone')`
  })

  it('license_logs is strictly append-only (refuses UPDATE and DELETE)', async () => {
    const licId = '44444444-4444-4444-4444-444444444444'
    const logId = '55555555-5555-5555-5555-555555555555'

    await sql`
      INSERT INTO public.license_logs (log_id, license_id, workspace_id, event, device_seat, reason)
      VALUES (${logId}, ${licId}, ${WS1}, 'activation', 'computer', 'initial activation')
    `

    // UPDATE must fail due to trigger
    await expect(
      sql`UPDATE public.license_logs SET reason = 'modified' WHERE log_id = ${logId}`,
    ).rejects.toThrow(/append-only/i)

    // DELETE must fail due to trigger
    await expect(sql`DELETE FROM public.license_logs WHERE log_id = ${logId}`).rejects.toThrow(
      /append-only/i,
    )

    // Log remains intact
    const [row] = await sql`SELECT reason FROM public.license_logs WHERE log_id = ${logId}`
    expect(row?.reason).toBe('initial activation')
  })

  it('license_review_queue records heuristic tier-2 flags', async () => {
    const licId = '66666666-6666-6666-6666-666666666666'
    await sql`
      INSERT INTO public.license_review_queue (license_id, workspace_id, signal_type, details)
      VALUES (${licId}, ${WS1}, 'parallel_invoice_sequences', '{"cities": ["Tehran", "Isfahan"]}'::jsonb)
    `

    const [queueItem] =
      await sql`SELECT status, signal_type FROM public.license_review_queue WHERE license_id = ${licId}`
    expect(queueItem?.status).toBe('pending')
    expect(queueItem?.signal_type).toBe('parallel_invoice_sequences')
  })

  it('subscription_events allows licence_banned and licence_unbanned events', async () => {
    await sql`INSERT INTO public.subscription_events (workspace_id, event) VALUES (${WS1}, 'licence_banned')`
    await sql`INSERT INTO public.subscription_events (workspace_id, event) VALUES (${WS1}, 'licence_unbanned')`
    const rows =
      await sql`SELECT count(*)::int as count FROM public.subscription_events WHERE workspace_id = ${WS1}`
    expect(rows[0]?.count).toBe(2)
  })
})
