// ============================================
// The service-delivery-02 scenarios, written once against a tiny SQL runner so the SAME assertions run on
// embedded-postgres (CI) and on any other real Postgres (PGlite where the embedded binary is quarantined).
//
// They run the REAL migrations - package-credit-ledger-01, service-delivery-01 and service-delivery-02 (twice) - on a
// stand-in for the tables they reference, then drive `service_delivery_deliver` / `service_delivery_cancel`.
// Nothing here imports a driver.
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
const OTHER_CUST = 'c0000000-0000-4000-8000-000000000002'
const SERVICE = '20000000-0000-4000-8000-000000000001'
const PACKAGE = '20000000-0000-4000-8000-000000000002'
const INVOICE = 'e0000000-0000-4000-8000-000000000001'
const OTHER_INVOICE = 'e0000000-0000-4000-8000-000000000002'

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

export async function setupServiceDelivery(run: Run): Promise<void> {
  await run(STUB_SCHEMA)
  await run(
    `INSERT INTO public.workspaces VALUES ('${WS}'), ('${OTHER_WS}');
     INSERT INTO public.customers VALUES ('${CUST}', '${WS}'), ('${OTHER_CUST}', '${WS}');
     INSERT INTO public.products VALUES ('${SERVICE}', '${WS}'), ('${PACKAGE}', '${WS}');
     INSERT INTO public.invoices VALUES ('${INVOICE}', '${WS}', '${CUST}'), ('${OTHER_INVOICE}', '${WS}', '${OTHER_CUST}');`,
  )
  await run(doc('package-credit-ledger-01-migration.sql'))
  await run(doc('service-delivery-01-migration.sql'))
  const migration = doc('service-delivery-02-atomic-migration.sql')
  await run(migration)
  await run(migration) // idempotent: a second run changes nothing and does not fail
  const cancellation = doc('service-delivery-03-cancellation-reason-migration.sql')
  await run(cancellation)
  await run(cancellation)
}

let seq = 100
const sid = () => `5e000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`

async function newSession(run: Run, customer = CUST): Promise<string> {
  const id = sid()
  await run(
    `INSERT INTO public.service_delivery_sessions (id, workspace_id, customer_id, service_offering_id, session_date,
       start_time, end_time, duration_minutes)
     VALUES ($1, $2, $3, $4, '2026-11-02', '10:00', '11:00', 60)`,
    [id, WS, customer, SERVICE],
  )
  return id
}

async function grant(run: Run, quantity: number, customer = CUST): Promise<void> {
  await run(
    `INSERT INTO public.package_credit_ledger (workspace_id, customer_id, package_product_id, entry_type, quantity)
     VALUES ($1, $2, $3, 'GRANT', $4)`,
    [WS, customer, PACKAGE, quantity],
  )
}

const balance = async (run: Run, customer = CUST) =>
  Number(
    (
      await run(
        `SELECT COALESCE(SUM(CASE WHEN entry_type IN ('GRANT','ADJUSTMENT','REVERSAL') THEN quantity
                                  WHEN entry_type IN ('CONSUME','EXPIRE') THEN -quantity ELSE 0 END), 0) AS b
           FROM public.package_credit_ledger WHERE workspace_id = $1 AND customer_id = $2 AND package_product_id = $3`,
        [WS, customer, PACKAGE],
      )
    )[0]!.b,
  )

const deliver = (
  run: Run,
  session: string,
  args: {
    settlement: string
    pkg?: string | null
    qty?: number
    invoice?: string | null
    reason?: string | null
    entry?: string | null
    expected?: string | null
    ws?: string
  },
) =>
  run(
    `SELECT public.service_delivery_deliver($1::uuid, $2::uuid, $3, $4::uuid, $5::numeric, $6::uuid, $7, $8::uuid, $9::timestamptz) AS r`,
    [
      args.ws ?? WS,
      session,
      args.settlement,
      args.pkg ?? null,
      args.qty ?? 1,
      args.invoice ?? null,
      args.reason ?? null,
      args.entry ?? null,
      args.expected ?? null,
    ],
  ).then((rows) => rows[0]!.r as Record<string, unknown>)

const cancel = (run: Run, session: string, ws = WS, reason: string | null = 'customer asked') =>
  run(`SELECT public.service_delivery_cancel($1::uuid, $2::uuid, NULL::uuid, $3) AS r`, [
    ws,
    session,
    reason,
  ]).then((rows) => rows[0]!.r as Record<string, unknown>)

async function refuses(promise: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(promise, (error: Error) => {
    assert.match(String(error.message), new RegExp(code))
    return true
  })
}

const session = async (run: Run, id: string) =>
  (await run(`SELECT * FROM public.service_delivery_sessions WHERE id = $1`, [id]))[0]!
const ledgerFor = (run: Run, id: string) =>
  run(
    `SELECT * FROM public.package_credit_ledger
      WHERE source_document_type = 'service_delivery' AND source_document_id = $1 ORDER BY entry_type`,
    [id],
  )

export const scenarios: Scenario[] = [
  {
    name: 'package delivery: one transaction - session delivered, ONE consume linked to it, balance down by one',
    run: async (run) => {
      await grant(run, 3)
      const id = await newSession(run)
      const entryId = 'd0000000-0000-4000-8000-0000000000a1'
      const res = await deliver(run, id, {
        settlement: 'package_credit',
        pkg: PACKAGE,
        entry: entryId,
      })
      assert.equal(res.replayed, false)
      const s = await session(run, id)
      assert.equal(s.status, 'delivered')
      assert.equal(s.settlement_method, 'package_credit')
      assert.equal(s.package_credit_id, entryId)
      const rows = await ledgerFor(run, id)
      assert.equal(rows.length, 1)
      assert.equal(rows[0]!.entry_type, 'CONSUME')
      assert.equal(rows[0]!.id, entryId, 'the ledger fact carries the id the device chose')
      assert.equal(rows[0]!.idempotency_key, `delivery_${id}`)
      assert.equal(await balance(run), 2)
    },
  },
  {
    name: 'delivering the same session again is a replay: no second consume',
    run: async (run) => {
      await grant(run, 3)
      const id = await newSession(run)
      await deliver(run, id, { settlement: 'package_credit', pkg: PACKAGE })
      const before = await balance(run)
      const again = await deliver(run, id, { settlement: 'package_credit', pkg: PACKAGE })
      assert.equal(again.replayed, true)
      assert.equal((await ledgerFor(run, id)).length, 1)
      assert.equal(await balance(run), before)
      await refuses(
        deliver(run, id, { settlement: 'complementary', reason: 'x' }),
        'SESSION_ALREADY_DELIVERED_DIFFERENTLY',
      )
    },
  },
  {
    name: 'a refused delivery leaves NOTHING: no package, not enough credit',
    run: async (run) => {
      const id = await newSession(run)
      const before = await balance(run)
      await refuses(
        deliver(run, id, { settlement: 'package_credit' }),
        'SETTLEMENT_PACKAGE_REQUIRED',
      )
      await refuses(
        deliver(run, id, { settlement: 'package_credit', pkg: PACKAGE, qty: 9999 }),
        'INSUFFICIENT_PACKAGE_CREDIT',
      )
      assert.equal((await session(run, id)).status, 'scheduled')
      assert.equal((await ledgerFor(run, id)).length, 0)
      assert.equal(await balance(run), before)
    },
  },
  {
    name: 'two sessions, one credit, delivered together: exactly one wins and the balance never goes below zero',
    run: async (run) => {
      await run(
        `DELETE FROM public.package_credit_ledger WHERE workspace_id = $1 AND customer_id = $2`,
        [WS, OTHER_CUST],
      ).catch(() => undefined)
      await grant(run, 1, OTHER_CUST)
      const a = await newSession(run, OTHER_CUST)
      const b = await newSession(run, OTHER_CUST)
      const results = await Promise.allSettled([
        deliver(run, a, { settlement: 'package_credit', pkg: PACKAGE }),
        deliver(run, b, { settlement: 'package_credit', pkg: PACKAGE }),
      ])
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
      assert.equal(results.filter((r) => r.status === 'rejected').length, 1)
      assert.equal(await balance(run, OTHER_CUST), 0)
      const delivered = [await session(run, a), await session(run, b)].filter(
        (s) => s.status === 'delivered',
      )
      assert.equal(delivered.length, 1)
    },
  },
  {
    name: "invoice settlement links an existing invoice of the SAME customer - another customer's is refused",
    run: async (run) => {
      const id = await newSession(run)
      await refuses(deliver(run, id, { settlement: 'invoice' }), 'SETTLEMENT_INVOICE_REQUIRED')
      await refuses(
        deliver(run, id, { settlement: 'invoice', invoice: OTHER_INVOICE }),
        'SETTLEMENT_INVOICE_INVALID',
      )
      assert.equal((await session(run, id)).status, 'scheduled')
      await deliver(run, id, { settlement: 'invoice', invoice: INVOICE })
      const s = await session(run, id)
      assert.equal(s.status, 'delivered')
      assert.equal(s.invoice_id, INVOICE)
      assert.equal((await ledgerFor(run, id)).length, 0)
    },
  },
  {
    name: 'complementary settlement needs a reason and keeps it',
    run: async (run) => {
      const id = await newSession(run)
      await refuses(deliver(run, id, { settlement: 'complementary' }), 'SETTLEMENT_REASON_REQUIRED')
      await refuses(
        deliver(run, id, { settlement: 'complementary', reason: '   ' }),
        'SETTLEMENT_REASON_REQUIRED',
      )
      await deliver(run, id, { settlement: 'complementary', reason: ' goodwill ' })
      assert.equal((await session(run, id)).settlement_reason, 'goodwill')
    },
  },
  {
    name: 'a stale view cannot deliver (expected updated_at)',
    run: async (run) => {
      const id = await newSession(run)
      await refuses(
        deliver(run, id, {
          settlement: 'complementary',
          reason: 'x',
          expected: '2000-01-01T00:00:00Z',
        }),
        'SESSION_CHANGED',
      )
      assert.equal((await session(run, id)).status, 'scheduled')
    },
  },
  {
    name: 'cancelling a delivered package session gives the credit back ONCE, with a reversal that references the consume',
    run: async (run) => {
      await grant(run, 2)
      const id = await newSession(run)
      await deliver(run, id, { settlement: 'package_credit', pkg: PACKAGE })
      const consume = (await ledgerFor(run, id))[0]!
      const before = await balance(run)
      const res = await cancel(run, id)
      assert.equal(res.replayed, false)
      assert.equal((await session(run, id)).status, 'cancelled')
      const rows = await ledgerFor(run, id)
      const reversal = rows.find((row) => row.entry_type === 'REVERSAL')!
      assert.equal(reversal.reference_entry_id, consume.id)
      assert.equal(Number(reversal.quantity), Number(consume.quantity))
      assert.equal(await balance(run), before + Number(consume.quantity))
      // twice = once
      const again = await cancel(run, id)
      assert.equal(again.replayed, true)
      assert.equal(
        (await ledgerFor(run, id)).filter((row) => row.entry_type === 'REVERSAL').length,
        1,
      )
    },
  },
  {
    name: 'a delivered INVOICED session is not cancelled by a status flip',
    run: async (run) => {
      const id = await newSession(run)
      await deliver(run, id, { settlement: 'invoice', invoice: INVOICE })
      await refuses(cancel(run, id), 'DELIVERED_INVOICE_CORRECTION_REQUIRED')
      assert.equal((await session(run, id)).status, 'delivered')
    },
  },
  {
    name: 'a cancelled session cannot be delivered; a scheduled one cancels with nothing to reverse',
    run: async (run) => {
      const id = await newSession(run)
      const res = await cancel(run, id)
      assert.equal(res.reversal_entry_id, null)
      await refuses(
        deliver(run, id, { settlement: 'complementary', reason: 'x' }),
        'INVALID_STATUS_TRANSITION',
      )
    },
  },
  {
    name: 'a cancellation says why: no reason is refused whole, the reason is kept, a replay needs none',
    run: async (run) => {
      await grant(run, 2)
      const id = await newSession(run)
      await deliver(run, id, { settlement: 'package_credit', pkg: PACKAGE })
      const before = await balance(run)
      await refuses(cancel(run, id, WS, null), 'CANCELLATION_REASON_REQUIRED')
      await refuses(cancel(run, id, WS, '   '), 'CANCELLATION_REASON_REQUIRED')
      assert.equal((await session(run, id)).status, 'delivered')
      assert.equal(await balance(run), before, 'a refused cancel gives no credit back')
      await cancel(run, id, WS, '  wrong customer  ')
      const s = await session(run, id)
      assert.equal(s.status, 'cancelled')
      assert.equal(s.cancellation_reason, 'wrong customer')
      const again = await cancel(run, id, WS, null)
      assert.equal(again.replayed, true)
      assert.equal((await session(run, id)).cancellation_reason, 'wrong customer')
    },
  },
  {
    name: 're-running migration 02 AFTER 03 does not bring the reason-less cancel function back',
    run: async (run) => {
      await run(doc('service-delivery-02-atomic-migration.sql'))
      const rows = await run(
        `SELECT COUNT(*) AS n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
          WHERE ns.nspname = 'public' AND p.proname = 'service_delivery_cancel'`,
      )
      assert.equal(Number(rows[0]!.n), 1)
      const id = await newSession(run)
      await refuses(cancel(run, id, WS, null), 'CANCELLATION_REASON_REQUIRED')
    },
  },
  {
    name: 'the ledger itself refuses a second consume for one session, and refuses edits and deletes',
    run: async (run) => {
      await grant(run, 3)
      const id = await newSession(run)
      await deliver(run, id, { settlement: 'package_credit', pkg: PACKAGE })
      await refuses(
        run(
          `INSERT INTO public.package_credit_ledger (workspace_id, customer_id, package_product_id, entry_type, quantity,
             source_document_type, source_document_id, idempotency_key)
           VALUES ($1, $2, $3, 'CONSUME', 1, 'service_delivery', $4, 'another-key')`,
          [WS, CUST, PACKAGE, id],
        ),
        'uq_pkg_credit_service_consume|duplicate key',
      )
      await refuses(
        run(`UPDATE public.package_credit_ledger SET quantity = 99 WHERE source_document_id = $1`, [
          id,
        ]),
        'IMMUTABLE',
      )
      await refuses(
        run(`DELETE FROM public.package_credit_ledger WHERE source_document_id = $1`, [id]),
        'IMMUTABLE',
      )
    },
  },
  {
    name: 'a session of another workspace is not found - and nothing of it is touched',
    run: async (run) => {
      const id = await newSession(run)
      await refuses(
        deliver(run, id, { settlement: 'complementary', reason: 'x', ws: OTHER_WS }),
        'SERVICE_DELIVERY_SESSION_NOT_FOUND',
      )
      await refuses(cancel(run, id, OTHER_WS), 'SERVICE_DELIVERY_SESSION_NOT_FOUND')
      assert.equal((await session(run, id)).status, 'scheduled')
    },
  },
]
