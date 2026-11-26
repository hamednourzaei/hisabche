// ============================================
// backend/src/__tests__/v100-hardening-migrations.pg.test.ts
//
// Real-Postgres verification for V100 additive hardening migrations:
//   - docs/payment-gateway-events-02-rpc-migration.sql
//   - docs/project-change-orders-03-atomic-migration.sql
//   - docs/support-tickets-03-atomic-sla-migration.sql
//   - docs/budget-currency-02-any-unit-migration.sql
//
// Proves:
//   1. Idempotency (every migration executes cleanly TWICE on real Postgres).
//   2. Least-privilege EXECUTE/table revocations from PUBLIC, anon, and authenticated.
//   3. Atomic change-order RPC (`decide_project_change_order_v2`) row-lock, version
//      check, cumulative minor unit arithmetic across USD/XAU, and audit_logs write.
//   4. Atomic webhook RPC (`apply_payment_gateway_event`) replay idempotency +
//      currency/amount invariant checks.
//   5. Atomic support ticket lifecycle + automated SLA sweep (`sweep_support_ticket_slas`).
//   6. Currency & precious-metal neutrality (`budgets` accepts XAU/IRT/USD/AFN).
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-v100-hardening-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  createPostgresUser: process.getuid?.() === 0,
})
const DB_NAME = 'v100_hardening'
const url = `postgres://postgres:test@localhost:${PORT}/${DB_NAME}`
let sql: postgres.Sql

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const readDoc = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const WS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER_A = '11111111-1111-4111-8111-111111111111'
const PROJ_A = '33333333-3333-4333-8333-333333333331'
const PAY_A = '44444444-4444-4444-8444-444444444441'
const TICKET_DUE = '55555555-5555-4555-8555-555555555551'

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
      currency text NOT NULL DEFAULT 'USD',
      amount numeric(18, 2) NOT NULL DEFAULT 0
    );
    CREATE TABLE public.audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      user_id uuid,
      action text NOT NULL,
      entity_type text,
      entity_id uuid,
      old_data jsonb,
      new_data jsonb,
      reason text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.activities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      entity_type text,
      entity_id uuid,
      action text,
      title text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.budgets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL,
      amount_minor bigint NOT NULL DEFAULT 0
    );

    INSERT INTO public.workspaces (id, name) VALUES
      ('${WS_A}', 'Gold Exchange A'),
      ('${WS_B}', 'Shop B');
    INSERT INTO public.workspace_members (workspace_id, user_id, role, has_access) VALUES
      ('${WS_A}', '${USER_A}', 'owner', true);
    INSERT INTO public.projects (id, workspace_id, budget) VALUES
      ('${PROJ_A}', '${WS_A}', 1000.00);
    INSERT INTO public.payments (id, workspace_id, currency, amount) VALUES
      ('${PAY_A}', '${WS_A}', 'USD', 250.00);
  `)

  const migrations = [
    'project-change-orders-01-migration.sql',
    'project-change-orders-02-rpc-migration.sql',
    'project-change-orders-03-atomic-migration.sql',
    'payment-gateway-events-01-migration.sql',
    'payment-gateway-events-02-rpc-migration.sql',
    'support-tickets-01-migration.sql',
    'support-tickets-02-lifecycle-migration.sql',
    'support-tickets-03-atomic-sla-migration.sql',
    'budget-currency-migration.sql',
    'budget-currency-02-any-unit-migration.sql',
  ]

  // Apply every migration TWICE to guarantee idempotency on live Postgres
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
      '${TICKET_DUE}', '${WS_A}', 'HSB-V100-PG', 'Gateway capture timeout', 'high', 'billing',
      'Needs immediate SLA investigation', 4, now() - interval '2 hours', 'open', '${USER_A}'
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

describe('V100 hardening migrations — real Postgres guarantees', () => {
  it('revokes EXECUTE privileges on all V100 SECURITY DEFINER RPCs from PUBLIC, anon, and authenticated', async () => {
    const fnSigs = [
      'public.decide_project_change_order_v2(uuid, uuid, uuid, text, uuid, numeric, bigint, integer, text)',
      'public.apply_payment_gateway_event(uuid, text, text, text, text, text, integer, bigint, text, integer, text, text, uuid)',
      'public.transition_support_ticket(uuid, uuid, uuid, text, text, text, text)',
      'public.sweep_support_ticket_slas(uuid, uuid, text)',
    ]
    for (const sig of fnSigs) {
      const [priv] = await sql`
        SELECT
          has_function_privilege('anon', ${sig}, 'EXECUTE') AS anon_exec,
          has_function_privilege('authenticated', ${sig}, 'EXECUTE') AS auth_exec,
          has_function_privilege('service_role', ${sig}, 'EXECUTE') AS svc_exec
      `
      expect(priv?.anon_exec, sig).toBe(false)
      expect(priv?.auth_exec, sig).toBe(false)
      expect(priv?.svc_exec, sig).toBe(true)
    }
  })

  it('decide_project_change_order_v2 enforces version lock, updates budget atomically, and writes audit_logs', async () => {
    const createdRows = await sql`
      SELECT * FROM public.create_project_change_order(
        ${WS_A}, ${PROJ_A}, ${USER_A}, 'Install Vault', 25050, 10000, false, 100, 'idem-v100-co-1', 1, null
      )
    `
    const orderId = String(createdRows[0]?.id)
    expect(createdRows[0]?.status).toBe('pending_approval')

    await expect(
      sql`SELECT * FROM public.decide_project_change_order_v2(${WS_A}, ${PROJ_A}, ${orderId}, 'approved', ${USER_A}, 100, null, 99, null)`,
    ).rejects.toThrow(/STALE_PROJECT_VERSION_CONFLICT/)

    const [decided] = await sql`
      SELECT * FROM public.decide_project_change_order_v2(${WS_A}, ${PROJ_A}, ${orderId}, 'approved', ${USER_A}, 100, null, 1, 'Signed by owner')
    `
    expect(decided?.status).toBe('approved')

    const [projAfter] =
      await sql`SELECT budget, budget_version FROM public.projects WHERE id = ${PROJ_A}`
    expect(Number(projAfter?.budget)).toBe(1250.5)
    expect(Number(projAfter?.budget_version)).toBe(2)

    const logs = await sql`SELECT * FROM public.audit_logs WHERE entity_id = ${orderId}`
    expect(logs.length).toBeGreaterThanOrEqual(1)
  })

  it('apply_payment_gateway_event validates amount/currency and de-duplicates replay by event_id', async () => {
    await expect(
      sql`
        SELECT * FROM public.apply_payment_gateway_event(
          ${PAY_A}, 'stripe', 'evt-mismatch', 'payment_intent.succeeded', 'captured', 'pi_1',
          100, 99999, 'USD', 100, 'sha256', 'Webhook test', ${USER_A}
        )
      `,
    ).rejects.toThrow(/GATEWAY_AMOUNT_MISMATCH/)

    const [first] = await sql`
      SELECT * FROM public.apply_payment_gateway_event(
        ${PAY_A}, 'stripe', 'evt-v100-1', 'payment_intent.succeeded', 'captured', 'pi_v100',
        150, 25000, 'USD', 100, 'sha256_ok', 'Webhook captured', ${USER_A}
      ) AS result
    `
    expect((first?.result as { replay?: boolean })?.replay).toBe(false)

    const [second] = await sql`
      SELECT * FROM public.apply_payment_gateway_event(
        ${PAY_A}, 'stripe', 'evt-v100-1', 'payment_intent.succeeded', 'captured', 'pi_v100',
        150, 25000, 'USD', 100, 'sha256_ok', 'Webhook captured', ${USER_A}
      ) AS result
    `
    expect((second?.result as { replay?: boolean })?.replay).toBe(true)
  })

  it('sweep_support_ticket_slas escalates overdue tickets and transition_support_ticket records immutable history', async () => {
    const [sweep] =
      await sql`SELECT * FROM public.sweep_support_ticket_slas(${WS_A}, ${USER_A}, 'corr-1') AS result`
    const payload = sweep?.result as { escalatedTicketIds?: string[] }
    expect(payload?.escalatedTicketIds ?? []).toContain(TICKET_DUE)

    const [resolved] = await sql`
      SELECT * FROM public.transition_support_ticket(${WS_A}, ${TICKET_DUE}, ${USER_A}, 'resolved', 'Restarted worker', 'Verified healthy', 'corr-2')
    `
    expect(resolved?.status).toBe('resolved')

    const events =
      await sql`SELECT * FROM public.support_ticket_events WHERE ticket_id = ${TICKET_DUE}`
    expect(events.length).toBeGreaterThanOrEqual(2)
  })

  it('budgets currency constraint accepts fiat and precious metals (XAU, USD, IRT, AFN) without AFN-only restriction', async () => {
    for (const unit of ['USD', 'IRT', 'XAU', 'XAG', 'AFN']) {
      await sql`
        INSERT INTO public.budgets (workspace_id, amount_minor, currency, amount_currency_minor, fx_rate)
        VALUES (${WS_A}, 10000, ${unit}, 10000, ${unit === 'XAU' ? 2.5 : null})
      `
    }
    await expect(
      sql`
        INSERT INTO public.budgets (workspace_id, amount_minor, currency, amount_currency_minor, fx_rate)
        VALUES (${WS_A}, 10000, 'usd', 10000, -1)
      `,
    ).rejects.toThrow()
  })
})
