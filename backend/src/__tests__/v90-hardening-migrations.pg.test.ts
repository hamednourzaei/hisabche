// ============================================
// backend/src/__tests__/v90-hardening-migrations.pg.test.ts
//
// Real-Postgres verification for V90 P0/P1 additive migrations:
//   - docs/project-change-orders-02-rpc-migration.sql
//   - docs/payment-gateway-events-01-migration.sql
//   - docs/support-tickets-02-lifecycle-migration.sql
//
// Proves:
//   1. Idempotency (every migration executes cleanly TWICE on real Postgres).
//   2. Least-privilege REVOKE ALL / EXECUTE restrictions on anon/authenticated/PUBLIC.
//   3. Row-Level Security workspace isolation across two workspaces (A vs B).
//   4. Atomic transactional rollback & conflict detection in decide_project_change_order().
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-v90-hardening-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const DB_NAME = 'v90_hardening'
const url = `postgres://postgres:test@localhost:${PORT}/${DB_NAME}`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const readDoc = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const WS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'
const PROJ_A = '33333333-3333-4333-8333-333333333331'
const PAY_A = '44444444-4444-4444-8444-444444444441'
const TICKET_A = '55555555-5555-4555-8555-555555555551'

beforeAll(async () => {
  await pg.initialise()
  await pg.start()
  await pg.createDatabase(DB_NAME)

  const setup = postgres(url, { max: 1, onnotice: () => {} })
  await setup.unsafe(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
    END $$;

    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;

    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

    CREATE TABLE public.workspaces (
      id uuid PRIMARY KEY,
      name text NOT NULL
    );
    CREATE TABLE public.workspace_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
      user_id uuid NOT NULL,
      role text NOT NULL,
      has_access boolean NOT NULL DEFAULT true,
      suspended_at timestamptz
    );
    CREATE TABLE public.projects (
      id uuid PRIMARY KEY,
      workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
      budget numeric(18, 2) NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.payments (
      id uuid PRIMARY KEY,
      workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
      amount numeric(18, 2) NOT NULL DEFAULT 0
    );

    INSERT INTO public.workspaces (id, name) VALUES
      ('${WS_A}', 'Shop A'),
      ('${WS_B}', 'Shop B');
    INSERT INTO public.workspace_members (workspace_id, user_id, role, has_access) VALUES
      ('${WS_A}', '${USER_A}', 'owner', true),
      ('${WS_B}', '${USER_B}', 'owner', true);
    INSERT INTO public.projects (id, workspace_id, budget) VALUES
      ('${PROJ_A}', '${WS_A}', 1000.00);
    INSERT INTO public.payments (id, workspace_id, amount) VALUES
      ('${PAY_A}', '${WS_A}', 250.00);
  `)

  // Apply prerequisite base migrations + all three V90 hardening migrations TWICE for idempotency
  const migrations = [
    'project-change-orders-01-migration.sql',
    'project-change-orders-02-rpc-migration.sql',
    'payment-gateway-events-01-migration.sql',
    'support-tickets-01-migration.sql',
    'support-tickets-02-lifecycle-migration.sql',
  ]
  for (const file of migrations) {
    const content = readDoc(file)
    await setup.unsafe(content)
    await setup.unsafe(content)
  }

  await setup.unsafe(`
    INSERT INTO public.support_tickets (
      id, workspace_id, ticket_code, subject, priority, category, description,
      sla_hours, response_due_at, status, created_by
    ) VALUES (
      '${TICKET_A}', '${WS_A}', 'HSB-PG-1', 'Offline terminal mismatch', 'high', 'pos',
      'Terminal capture needs investigation', 4, now() + interval '4 hours', 'open', '${USER_A}'
    );
  `)

  await setup.end()
  sql = postgres(url, { max: 1, onnotice: () => {} })
}, 90_000)

afterAll(async () => {
  await sql?.end({ timeout: 2 })
  try {
    await pg.stop()
  } catch {
    // ignore
  }
})

describe('V90 hardening migrations — real Postgres guarantees', () => {
  it('revokes table and RPC function privileges from PUBLIC, anon, and authenticated', async () => {
    const tables = [
      'public.payment_gateway_events',
      'public.support_ticket_events',
      'public.support_ticket_comments',
    ]
    for (const tbl of tables) {
      const [priv] = await sql`
        SELECT
          has_table_privilege('anon', ${tbl}, 'SELECT') AS anon_sel,
          has_table_privilege('anon', ${tbl}, 'INSERT') AS anon_ins,
          has_table_privilege('authenticated', ${tbl}, 'SELECT') AS auth_sel,
          has_table_privilege('service_role', ${tbl}, 'SELECT') AS svc_sel,
          has_table_privilege('service_role', ${tbl}, 'INSERT') AS svc_ins
      `
      expect(priv?.anon_sel, tbl).toBe(false)
      expect(priv?.anon_ins, tbl).toBe(false)
      expect(priv?.auth_sel, tbl).toBe(false)
      expect(priv?.svc_sel, tbl).toBe(true)
      expect(priv?.svc_ins, tbl).toBe(true)
    }

    const sig = 'public.decide_project_change_order(uuid, uuid, uuid, text, uuid, numeric)'
    const [fnPriv] = await sql`
      SELECT
        has_function_privilege('anon', ${sig}, 'EXECUTE') AS anon_exec,
        has_function_privilege('authenticated', ${sig}, 'EXECUTE') AS auth_exec,
        has_function_privilege('service_role', ${sig}, 'EXECUTE') AS svc_exec
    `
    expect(fnPriv?.anon_exec).toBe(false)
    expect(fnPriv?.auth_exec).toBe(false)
    expect(fnPriv?.svc_exec).toBe(true)
  })

  it('enforces RLS workspace isolation on support_ticket_events, support_ticket_comments, and payment_gateway_events', async () => {
    await sql`
      INSERT INTO public.support_ticket_events (workspace_id, ticket_id, actor_id, action, from_status, to_status)
      VALUES (${WS_A}, ${TICKET_A}, ${USER_A}, 'created', NULL, 'open')
    `
    await sql`
      INSERT INTO public.support_ticket_comments (workspace_id, ticket_id, author_id, is_internal, body)
      VALUES (${WS_A}, ${TICKET_A}, ${USER_A}, true, 'Internal A note')
    `
    await sql`
      INSERT INTO public.payment_gateway_events (workspace_id, payment_id, to_state, gateway_name)
      VALUES (${WS_A}, ${PAY_A}, 'captured', 'hesabpay')
    `

    // Temporarily grant authenticated DML just to verify RLS row-level barriers under SET ROLE authenticated
    await sql.begin(async (tx) => {
      await tx.unsafe(`
        GRANT SELECT, INSERT ON public.support_ticket_events TO authenticated;
        GRANT SELECT, INSERT ON public.support_ticket_comments TO authenticated;
        GRANT SELECT, INSERT ON public.payment_gateway_events TO authenticated;
        SET LOCAL ROLE authenticated;
        SELECT set_config('request.jwt.claim.sub', '${USER_B}', true);
      `)
      const seenEvents = await tx`SELECT id FROM public.support_ticket_events`
      const seenComments = await tx`SELECT id FROM public.support_ticket_comments`
      const seenPayments = await tx`SELECT id FROM public.payment_gateway_events`
      expect(seenEvents).toHaveLength(0)
      expect(seenComments).toHaveLength(0)
      expect(seenPayments).toHaveLength(0)

      await expect(
        tx`
          INSERT INTO public.payment_gateway_events (workspace_id, payment_id, to_state)
          VALUES (${WS_A}, ${PAY_A}, 'declined')
        `,
      ).rejects.toThrow(/row-level security/i)
    })
  })

  it('decide_project_change_order updates change order and budget atomically and rejects invalid/stale transitions', async () => {
    const orderId = '66666666-6666-4666-8666-666666666661'
    await sql`
      INSERT INTO public.project_change_orders (
        id, workspace_id, project_id, title, original_budget_minor, delta_minor,
        revised_budget_minor, status, created_by
      ) VALUES (
        ${orderId}, ${WS_A}, ${PROJ_A}, 'Add cabling scope', 100000, 25000, 125000, 'pending_approval', ${USER_A}
      )
    `

    await expect(
      sql`SELECT * FROM public.decide_project_change_order(${WS_A}, ${PROJ_A}, ${orderId}, 'invalid_action', ${USER_A}, 100)`,
    ).rejects.toThrow(/INVALID_DECISION/)

    await expect(
      sql`SELECT * FROM public.decide_project_change_order(${WS_A}, ${PROJ_A}, ${orderId}, 'approved', ${USER_A}, 0)`,
    ).rejects.toThrow(/INVALID_CURRENCY_SCALE/)

    const [decided] = await sql`
      SELECT * FROM public.decide_project_change_order(${WS_A}, ${PROJ_A}, ${orderId}, 'approved', ${USER_A}, 100)
    `
    expect(decided?.status).toBe('approved')

    const [projAfter] = await sql`SELECT budget FROM public.projects WHERE id = ${PROJ_A}`
    expect(Number(projAfter?.budget)).toBe(1250)

    // Replay on an already-decided order fails deterministically
    await expect(
      sql`SELECT * FROM public.decide_project_change_order(${WS_A}, ${PROJ_A}, ${orderId}, 'rejected', ${USER_A}, 100)`,
    ).rejects.toThrow(/CHANGE_ORDER_NOT_PENDING/)
  })
})
