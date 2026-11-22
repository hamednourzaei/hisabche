// ============================================
// backend/src/__tests__/helpers/service-delivery-05-scenarios.ts
//
// The service-delivery-05 scenarios:
//   • session subject distinction: customer vs employee
//   • multi-customer session participant relation
//   • free-text session_type
//   • participant integrity and promotion triggers
//   • deterministic backfill on historical rows
// ============================================

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type Run = (
  text: string,
  params?: readonly unknown[],
) => Promise<Array<Record<string, unknown>>>

export interface Scenario {
  name: string
  run: (run: Run) => Promise<void>
}

const DOCS = process.env.RETURN05_DOCS ?? join(__dirname, '..', '..', '..', '..', 'docs')
const doc = (name: string) => readFileSync(join(DOCS, name), 'utf8')

export const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const OTHER_WS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CUST = 'c0000000-0000-4000-8000-000000000001'
const CUST_2 = 'c0000000-0000-4000-8000-000000000002'
const OTHER_CUST = 'c0000000-0000-4000-8000-000000000003'
const EMP = 'e0000000-0000-4000-8000-000000000001'
const OTHER_EMP = 'e0000000-0000-4000-8000-000000000002'
const SERVICE = '20000000-0000-4000-8000-000000000001'

const STUB_SCHEMA = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.workspaces (id uuid PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.workspace_members (workspace_id uuid, user_id uuid);
CREATE TABLE IF NOT EXISTS public.customers (id uuid PRIMARY KEY, workspace_id uuid);
CREATE TABLE IF NOT EXISTS public.products (id uuid PRIMARY KEY, workspace_id uuid);
CREATE TABLE IF NOT EXISTS public.employees (id uuid PRIMARY KEY, workspace_id uuid);
CREATE TABLE IF NOT EXISTS public.branches (id uuid PRIMARY KEY, workspace_id uuid);
CREATE TABLE IF NOT EXISTS public.invoices (id uuid PRIMARY KEY, workspace_id uuid, customer_id uuid);
`

export async function setupServiceDelivery05(run: Run): Promise<void> {
  await run(STUB_SCHEMA)
  await run(
    `INSERT INTO public.workspaces VALUES ('${WS}'), ('${OTHER_WS}') ON CONFLICT DO NOTHING;
     INSERT INTO public.customers VALUES ('${CUST}', '${WS}'), ('${CUST_2}', '${WS}'), ('${OTHER_CUST}', '${OTHER_WS}') ON CONFLICT DO NOTHING;
     INSERT INTO public.employees VALUES ('${EMP}', '${WS}'), ('${OTHER_EMP}', '${OTHER_WS}') ON CONFLICT DO NOTHING;
     INSERT INTO public.products VALUES ('${SERVICE}', '${WS}') ON CONFLICT DO NOTHING;`,
  )
  await run(doc('package-credit-ledger-01-migration.sql'))
  await run(doc('service-delivery-01-migration.sql'))
  await run(doc('service-delivery-02-atomic-migration.sql'))
  await run(doc('service-delivery-03-cancellation-reason-migration.sql'))
  await run(doc('service-delivery-04-settlement-undecided-migration.sql'))

  // Historical session before 05 migration
  await run(
    `INSERT INTO public.service_delivery_sessions (id, workspace_id, customer_id, service_offering_id, session_date, start_time, end_time, duration_minutes)
     VALUES ('5e000000-0000-4000-8000-000000000001', '${WS}', '${CUST}', '${SERVICE}', '2026-11-01', '09:00', '10:00', 60)
     ON CONFLICT DO NOTHING;`,
  )

  // Migration 05 applied TWICE for idempotency check
  const m05 = doc('service-delivery-05-session-subject-participants-migration.sql')
  await run(m05)
  await run(m05)
}

let seq = 200
const sid = () => `5e000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`

export const scenarios05: Scenario[] = [
  {
    name: 'historical session has backfilled participant row',
    run: async (run) => {
      const rows = await run(
        `SELECT * FROM public.service_delivery_session_participants
          WHERE session_id = '5e000000-0000-4000-8000-000000000001' AND customer_id = $1`,
        [CUST],
      )
      assert.equal(rows.length, 1)
      assert.equal(rows[0]!.participant_type, 'customer')
      assert.equal(rows[0]!.workspace_id, WS)
    },
  },
  {
    name: 'creates customer session with automatic primary participant row',
    run: async (run) => {
      const id = sid()
      await run(
        `INSERT INTO public.service_delivery_sessions (id, workspace_id, subject_type, customer_id, service_offering_id, session_date, start_time, end_time, duration_minutes)
         VALUES ($1, $2, 'customer', $3, $4, '2026-11-20', '10:00', '11:00', 60)`,
        [id, WS, CUST, SERVICE],
      )
      const participants = await run(
        `SELECT * FROM public.service_delivery_session_participants WHERE session_id = $1`,
        [id],
      )
      assert.equal(participants.length, 1)
      assert.equal(participants[0]!.customer_id, CUST)
      assert.equal(participants[0]!.participant_type, 'customer')
    },
  },
  {
    name: 'creates employee session with automatic employee participant row',
    run: async (run) => {
      const id = sid()
      await run(
        `INSERT INTO public.service_delivery_sessions (id, workspace_id, subject_type, employee_id, service_offering_id, session_date, start_time, end_time, duration_minutes)
         VALUES ($1, $2, 'employee', $3, $4, '2026-11-20', '14:00', '15:00', 60)`,
        [id, WS, EMP, SERVICE],
      )
      const participants = await run(
        `SELECT * FROM public.service_delivery_session_participants WHERE session_id = $1`,
        [id],
      )
      assert.equal(participants.length, 1)
      assert.equal(participants[0]!.employee_id, EMP)
      assert.equal(participants[0]!.participant_type, 'employee')
    },
  },
  {
    name: 'refuses customer session carrying employee_id',
    run: async (run) => {
      const id = sid()
      let failed = false
      try {
        await run(
          `INSERT INTO public.service_delivery_sessions (id, workspace_id, subject_type, customer_id, employee_id, service_offering_id, session_date, start_time, end_time, duration_minutes)
           VALUES ($1, $2, 'customer', $3, $4, $5, '2026-11-20', '10:00', '11:00', 60)`,
          [id, WS, CUST, EMP, SERVICE],
        )
      } catch (err: unknown) {
        failed = true
        assert.match(String(err), /chk_service_delivery_subject/)
      }
      assert.ok(failed, 'expected chk_service_delivery_subject check refusal')
    },
  },
  {
    name: 'refuses employee session carrying customer_id',
    run: async (run) => {
      const id = sid()
      let failed = false
      try {
        await run(
          `INSERT INTO public.service_delivery_sessions (id, workspace_id, subject_type, employee_id, customer_id, service_offering_id, session_date, start_time, end_time, duration_minutes)
           VALUES ($1, $2, 'employee', $3, $4, $5, '2026-11-20', '10:00', '11:00', 60)`,
          [id, WS, EMP, CUST, SERVICE],
        )
      } catch (err: unknown) {
        failed = true
        assert.match(String(err), /chk_service_delivery_subject/)
      }
      assert.ok(failed, 'expected chk_service_delivery_subject check refusal')
    },
  },
  {
    name: 'supports multiple customer participants on one session',
    run: async (run) => {
      const id = sid()
      await run(
        `INSERT INTO public.service_delivery_sessions (id, workspace_id, subject_type, customer_id, service_offering_id, session_date, start_time, end_time, duration_minutes)
         VALUES ($1, $2, 'customer', $3, $4, '2026-11-20', '10:00', '11:00', 60)`,
        [id, WS, CUST, SERVICE],
      )
      await run(
        `INSERT INTO public.service_delivery_session_participants (workspace_id, session_id, participant_type, customer_id)
         VALUES ($1, $2, 'customer', $3)`,
        [WS, id, CUST_2],
      )
      const participants = await run(
        `SELECT customer_id FROM public.service_delivery_session_participants WHERE session_id = $1 ORDER BY created_at`,
        [id],
      )
      assert.equal(participants.length, 2)
      assert.deepEqual(participants.map((p) => p.customer_id).sort(), [CUST, CUST_2].sort())
    },
  },
  {
    name: 'refuses duplicate participant assignment on the same session',
    run: async (run) => {
      const id = sid()
      await run(
        `INSERT INTO public.service_delivery_sessions (id, workspace_id, subject_type, customer_id, service_offering_id, session_date, start_time, end_time, duration_minutes)
         VALUES ($1, $2, 'customer', $3, $4, '2026-11-20', '10:00', '11:00', 60)`,
        [id, WS, CUST, SERVICE],
      )
      let failed = false
      try {
        await run(
          `INSERT INTO public.service_delivery_session_participants (workspace_id, session_id, participant_type, customer_id)
           VALUES ($1, $2, 'customer', $3)`,
          [WS, id, CUST],
        )
      } catch (err: unknown) {
        failed = true
        assert.match(String(err), /uq_sd_participant_customer/)
      }
      assert.ok(failed, 'expected duplicate participant refusal')
    },
  },
  {
    name: 'refuses cross-workspace participant',
    run: async (run) => {
      const id = sid()
      await run(
        `INSERT INTO public.service_delivery_sessions (id, workspace_id, subject_type, customer_id, service_offering_id, session_date, start_time, end_time, duration_minutes)
         VALUES ($1, $2, 'customer', $3, $4, '2026-11-20', '10:00', '11:00', 60)`,
        [id, WS, CUST, SERVICE],
      )
      let failed = false
      try {
        await run(
          `INSERT INTO public.service_delivery_session_participants (workspace_id, session_id, participant_type, customer_id)
           VALUES ($1, $2, 'customer', $3)`,
          [WS, id, OTHER_CUST],
        )
      } catch (err: unknown) {
        failed = true
        assert.match(String(err), /PARTICIPANT_WORKSPACE_MISMATCH/)
      }
      assert.ok(failed, 'expected PARTICIPANT_WORKSPACE_MISMATCH trigger refusal')
    },
  },
  {
    name: 'promotes next participant when primary is removed',
    run: async (run) => {
      const id = sid()
      await run(
        `INSERT INTO public.service_delivery_sessions (id, workspace_id, subject_type, customer_id, service_offering_id, session_date, start_time, end_time, duration_minutes)
         VALUES ($1, $2, 'customer', $3, $4, '2026-11-20', '10:00', '11:00', 60)`,
        [id, WS, CUST, SERVICE],
      )
      await run(
        `INSERT INTO public.service_delivery_session_participants (workspace_id, session_id, participant_type, customer_id)
         VALUES ($1, $2, 'customer', $3)`,
        [WS, id, CUST_2],
      )

      // Delete the primary participant row
      await run(
        `DELETE FROM public.service_delivery_session_participants
          WHERE session_id = $1 AND customer_id = $2`,
        [id, CUST],
      )

      // The session should have promoted CUST_2 as primary customer_id
      const session = await run(
        `SELECT customer_id FROM public.service_delivery_sessions WHERE id = $1`,
        [id],
      )
      assert.equal(session[0]!.customer_id, CUST_2)
    },
  },
  {
    name: 'refuses removing the last participant',
    run: async (run) => {
      const id = sid()
      await run(
        `INSERT INTO public.service_delivery_sessions (id, workspace_id, subject_type, customer_id, service_offering_id, session_date, start_time, end_time, duration_minutes)
         VALUES ($1, $2, 'customer', $3, $4, '2026-11-20', '10:00', '11:00', 60)`,
        [id, WS, CUST, SERVICE],
      )
      let failed = false
      try {
        await run(
          `DELETE FROM public.service_delivery_session_participants WHERE session_id = $1`,
          [id],
        )
      } catch (err: unknown) {
        failed = true
        assert.match(String(err), /SESSION_PRIMARY_PARTICIPANT_REQUIRED/)
      }
      assert.ok(failed, 'expected SESSION_PRIMARY_PARTICIPANT_REQUIRED trigger refusal')
    },
  },
  {
    name: 'free-text session_type accepts Persian, Dari and English text',
    run: async (run) => {
      for (const text of ['مشاوره تخصصی', 'اصلاح و پیرایش', 'General Consultation']) {
        const id = sid()
        await run(
          `INSERT INTO public.service_delivery_sessions (id, workspace_id, subject_type, customer_id, session_type, service_offering_id, session_date, start_time, end_time, duration_minutes)
           VALUES ($1, $2, 'customer', $3, $4, $5, '2026-11-20', '10:00', '11:00', 60)`,
          [id, WS, CUST, text, SERVICE],
        )
        const row = await run(
          `SELECT session_type FROM public.service_delivery_sessions WHERE id = $1`,
          [id],
        )
        assert.equal(row[0]!.session_type, text)
      }
    },
  },
  {
    name: 'free-text session_type rejects empty or whitespace-only strings',
    run: async (run) => {
      const id = sid()
      let failed = false
      try {
        await run(
          `INSERT INTO public.service_delivery_sessions (id, workspace_id, subject_type, customer_id, session_type, service_offering_id, session_date, start_time, end_time, duration_minutes)
           VALUES ($1, $2, 'customer', $3, '   ', $4, '2026-11-20', '10:00', '11:00', 60)`,
          [id, WS, CUST, SERVICE],
        )
      } catch (err: unknown) {
        failed = true
        assert.match(String(err), /chk_service_delivery_session_type/)
      }
      assert.ok(failed, 'expected chk_service_delivery_session_type check refusal')
    },
  },
  {
    name: 'refuses delivering employee session as package_credit',
    run: async (run) => {
      const id = sid()
      let failed = false
      try {
        await run(
          `INSERT INTO public.service_delivery_sessions (id, workspace_id, subject_type, employee_id, service_offering_id, session_date, start_time, end_time, duration_minutes, status, settlement_method)
           VALUES ($1, $2, 'employee', $3, $4, '2026-11-20', '10:00', '11:00', 60, 'delivered', 'package_credit')`,
          [id, WS, EMP, SERVICE],
        )
      } catch (err: unknown) {
        failed = true
        assert.match(String(err), /chk_service_delivery_employee_settlement/)
      }
      assert.ok(failed, 'expected chk_service_delivery_employee_settlement check refusal')
    },
  },
]
