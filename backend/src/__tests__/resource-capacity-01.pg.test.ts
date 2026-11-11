// ============================================
// backend/src/__tests__/resource-capacity-01.pg.test.ts
//
// V60 Slice 7 — Proves docs/resource-capacity-01-migration.sql against a real Postgres:
//   - runs twice idempotently with VERIFY checks
//   - two concurrent bookings of the same exclusive resource -> 1 succeeds, 1 fails with overlap
//   - maintenance holds block bookings
//   - releasing a booking frees the slot
//   - tenant isolation refuses cross-workspace resource booking
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
  databaseDir: pgTempDir('hisabche-pg-rescap-'),
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const url = `postgres://postgres:test@localhost:${PORT}/rescap`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const WS_A = '22222222-2222-4222-8222-222222222222'
const WS_B = '33333333-3333-4333-8333-333333333333'
const RES_A = '44444444-4444-4444-8444-444444444444'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('rescap')
  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
    END $$;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
    CREATE TABLE IF NOT EXISTS public.workspaces (id uuid PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS public.branches (id uuid PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS public.departments (id uuid PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS public.products (id uuid PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS public.warehouses (id uuid PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS public.workspace_members (
      workspace_id uuid, user_id uuid, has_access boolean, suspended_at timestamptz
    );
    CREATE TABLE IF NOT EXISTS public.service_delivery_sessions (
      id uuid PRIMARY KEY, workspace_id uuid, session_date date, start_time text, end_time text, status text, deleted_at timestamptz
    );
    INSERT INTO public.workspaces (id) VALUES ('${WS_A}'), ('${WS_B}') ON CONFLICT DO NOTHING;
  `)
  await setup.unsafe(read('salon-01-migration.sql'))
  // Run resource-capacity migration TWICE to verify idempotence.
  await setup.unsafe(read('resource-capacity-01-migration.sql'))
  await setup.unsafe(read('resource-capacity-01-migration.sql'))
  await setup.unsafe(`
    INSERT INTO public.service_resources (id, workspace_id, name, kind)
    VALUES ('${RES_A}', '${WS_A}', 'Camera Kit A', 'equipment')
    ON CONFLICT DO NOTHING;
  `)
  await setup.end()
  sql = postgres(url, { max: 4 })
}, 90_000)

afterAll(async () => {
  await sql?.end()
  await pg.stop()
})

describe('resource-capacity-01', () => {
  it('allows only one concurrent active booking per exclusive resource and names exclusion failure', async () => {
    const startAt = '2026-11-20T09:00:00Z'
    const endAt = '2026-11-20T11:00:00Z'

    const results = await Promise.allSettled([
      sql`
        INSERT INTO public.resource_bookings (workspace_id, resource_id, during, source_type)
        VALUES (${WS_A}::uuid, ${RES_A}::uuid, tstzrange(${startAt}::timestamptz, ${endAt}::timestamptz, '[)'), 'rental')
        RETURNING id
      `,
      sql`
        INSERT INTO public.resource_bookings (workspace_id, resource_id, during, source_type)
        VALUES (${WS_A}::uuid, ${RES_A}::uuid, tstzrange(${startAt}::timestamptz, ${endAt}::timestamptz, '[)'), 'rental')
        RETURNING id
      `,
    ])

    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(String(rejected[0]!.reason)).toMatch(
      /resource_bookings_no_overlap|conflicting key|excl/i,
    )
  })

  it('blocks booking during maintenance, frees slot on release, and enforces tenant isolation', async () => {
    const [maint] = await sql<{ id: string }[]>`
      INSERT INTO public.resource_bookings (workspace_id, resource_id, during, source_type, notes)
      VALUES (${WS_A}::uuid, ${RES_A}::uuid, tstzrange('2026-11-21T10:00:00Z', '2026-11-21T12:00:00Z', '[)'), 'maintenance', 'calibration')
      RETURNING id
    `
    await expect(
      sql`
        INSERT INTO public.resource_bookings (workspace_id, resource_id, during, source_type)
        VALUES (${WS_A}::uuid, ${RES_A}::uuid, tstzrange('2026-11-21T11:00:00Z', '2026-11-21T13:00:00Z', '[)'), 'session')
      `,
    ).rejects.toThrow(/resource_bookings_no_overlap/i)

    // Releasing maintenance frees the exact slot
    await sql`
      UPDATE public.resource_bookings
         SET status = 'released', released_at = now()
       WHERE id = ${maint!.id}::uuid AND workspace_id = ${WS_A}::uuid
    `
    const [afterRelease] = await sql<{ id: string }[]>`
      INSERT INTO public.resource_bookings (workspace_id, resource_id, during, source_type)
      VALUES (${WS_A}::uuid, ${RES_A}::uuid, tstzrange('2026-11-21T10:00:00Z', '2026-11-21T12:00:00Z', '[)'), 'session')
      RETURNING id
    `
    expect(afterRelease?.id).toBeTruthy()

    // Tenant isolation: WS_B cannot book WS_A's resource
    await expect(
      sql`
        INSERT INTO public.resource_bookings (workspace_id, resource_id, during, source_type)
        VALUES (${WS_B}::uuid, ${RES_A}::uuid, tstzrange('2026-11-22T10:00:00Z', '2026-11-22T11:00:00Z', '[)'), 'rental')
      `,
    ).rejects.toThrow(/TENANT_RESOURCE_MISMATCH/)
  })

  it('passes every query in docs/VERIFY-resource-capacity-01.sql', async () => {
    const blocks = read('VERIFY-resource-capacity-01.sql')
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('--'))
    for (const stmt of blocks) {
      await sql.unsafe(stmt)
    }
  })
})
