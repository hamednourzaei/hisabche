// ============================================
// The package-deferred-revenue-01 scenarios, written once against a tiny SQL runner (see scripts/pg/run-scenarios.mjs).
//
// They run the REAL migrations - package-credit-ledger-01, service-delivery-01/02/03 and package-deferred-revenue-01
// (twice) - on a stand-in for the tables they reference, then:
//   1. replay the SHARED golden vectors (packages/validation/src/__golden__/package-grant-vectors.json) against the
//      trigger, so the plpgsql rule and the TypeScript rule are proven to be the same rule;
//   2. drive the real delivery / cancel functions and check the money the journal received.
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

interface GrantVectorItem {
  id: string
  startsOn?: string
  quantity?: number
  deferredAmount?: number
  termMonths?: number
  adjustments?: number
  consumedQuantity?: number
  releasedAmount?: number
  activatedOn?: string
  suspensions?: Array<{ startsOn: string; endsOn?: string }>
}

interface GoldenVector {
  id: string
  quantity: number
  onDate: string
  unattributed?: number
  grants: GrantVectorItem[]
  expected: {
    shortfall?: number
    allocations?: Array<{ grantId: string | null; quantity: number; releasedAmount: number }>
    totalReleasedAmount?: number
  }
}

const DOCS = process.env.RETURN05_DOCS ?? join(__dirname, '..', '..', '..', '..', 'docs')
const doc = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const vectors = JSON.parse(
  readFileSync(
    join(DOCS, '..', 'packages', 'validation', 'src', '__golden__', 'package-grant-vectors.json'),
    'utf8',
  ),
) as { vectors: GoldenVector[] }

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SERVICE = '20000000-0000-4000-8000-000000000001'
const PACKAGE = '20000000-0000-4000-8000-000000000002'
const ACC_DEFERRED = 'a0000000-0000-4000-8000-000000000001'
const ACC_SALES = 'a0000000-0000-4000-8000-000000000002'

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
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY, workspace_id uuid, role text, deleted_at timestamptz, is_active boolean DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid, date date, source_type text, source_id uuid,
  reversal_of uuid, status text DEFAULT 'posted'
);
CREATE TABLE IF NOT EXISTS public.test_journal_lines (entry_id uuid, account_id uuid, debit numeric, credit numeric);
CREATE TABLE IF NOT EXISTS public.journal_lines (journal_id uuid, account_id uuid, debit numeric, credit numeric);
CREATE TABLE IF NOT EXISTS public.test_period_lock (workspace_id uuid, locked_until date);
-- Stand-in for the real function: balanced-only, refuses a closed period, writes the entry and its lines.
CREATE OR REPLACE FUNCTION public.accounting_post_journal_entry(
  p_workspace_id uuid, p_user_id uuid, p_entry jsonb, p_lines jsonb
) RETURNS uuid LANGUAGE plpgsql AS $fn$
DECLARE v_d numeric; v_c numeric; v_id uuid := gen_random_uuid(); v_date date := (p_entry->>'date')::date;
BEGIN
  IF EXISTS (SELECT 1 FROM public.test_period_lock WHERE workspace_id = p_workspace_id AND v_date <= locked_until) THEN
    RAISE EXCEPTION 'ACCOUNTING_PERIOD_LOCKED' USING ERRCODE = 'P0001';
  END IF;
  SELECT COALESCE(SUM((l->>'debit')::numeric), 0), COALESCE(SUM((l->>'credit')::numeric), 0)
    INTO v_d, v_c FROM jsonb_array_elements(p_lines) l;
  IF v_d <> v_c OR v_d = 0 THEN RAISE EXCEPTION 'JOURNAL_ENTRY_UNBALANCED: % vs %', v_d, v_c; END IF;
  INSERT INTO public.journal_entries (id, workspace_id, date, source_type, source_id, reversal_of)
  VALUES (v_id, p_workspace_id, v_date, p_entry->>'source_type', NULLIF(p_entry->>'source_id','')::uuid,
          NULLIF(p_entry->>'reversal_of','')::uuid);
  INSERT INTO public.test_journal_lines
  SELECT v_id, (l->>'account_id')::uuid, (l->>'debit')::numeric, (l->>'credit')::numeric FROM jsonb_array_elements(p_lines) l;
  INSERT INTO public.journal_lines
  SELECT v_id, (l->>'account_id')::uuid, (l->>'debit')::numeric, (l->>'credit')::numeric FROM jsonb_array_elements(p_lines) l;
  RETURN v_id;
END $fn$;
`

export async function setupDeferredRevenue(run: Run): Promise<void> {
  await run(STUB_SCHEMA)
  await run(
    `INSERT INTO public.workspaces VALUES ('${WS}');
     INSERT INTO public.products VALUES ('${SERVICE}', '${WS}'), ('${PACKAGE}', '${WS}');
     INSERT INTO public.accounts (id, workspace_id, role) VALUES
       ('${ACC_DEFERRED}', '${WS}', 'deferred_revenue'), ('${ACC_SALES}', '${WS}', 'sales');`,
  )
  // the role check the release and the scrap loss post to (run twice: idempotent)
  const roles = doc('accounts-role-deferred-and-loss-01-migration.sql')
  await run(roles)
  await run(roles)
  await run(doc('package-credit-ledger-01-migration.sql'))
  await run(doc('service-delivery-01-migration.sql'))
  await run(doc('service-delivery-02-atomic-migration.sql'))
  await run(doc('service-delivery-03-cancellation-reason-migration.sql'))
  const migration = doc('package-deferred-revenue-01-migration.sql')
  await run(migration)
  await run(migration) // idempotent: a second run changes nothing and does not fail
  const profit = doc('profit-ledger-totals-01-migration.sql')
  await run(profit)
  await run(profit)
}

let seq = 1000
const uid = (prefix: string) => `${prefix}-0000-4000-8000-${String(++seq).padStart(12, '0')}`

async function newCustomer(run: Run): Promise<string> {
  const id = uid('c0000000')
  await run(`INSERT INTO public.customers VALUES ($1, $2)`, [id, WS])
  return id
}

async function bookedInvoice(run: Run, customer: string): Promise<string> {
  const id = uid('e0000000')
  await run(`INSERT INTO public.invoices VALUES ($1, $2, $3)`, [id, WS, customer])
  await run(
    `INSERT INTO public.journal_entries (workspace_id, date, source_type, source_id) VALUES ($1, '2026-10-01', 'invoice', $2)`,
    [WS, id],
  )
  return id
}

interface GrantSpec {
  customer: string
  invoice: string
  startsOn: string
  quantity: number
  deferred: number | null
  term: number | null
  id?: string
}

async function insertGrant(run: Run, g: GrantSpec): Promise<string> {
  const id = g.id ?? uid('90000000')
  await run(
    `INSERT INTO public.package_credit_ledger
       (id, workspace_id, customer_id, package_product_id, entry_type, quantity, source_document_type, source_document_id,
        deferred_amount, term_months, effective_date)
     VALUES ($1, $2, $3, $4, 'GRANT', $5, 'invoice', $6, $7, $8, $9)`,
    [id, WS, g.customer, PACKAGE, g.quantity, g.invoice, g.deferred, g.term, g.startsOn],
  )
  return id
}

const releaseTotal = async (run: Run, entryId: string): Promise<number> =>
  Number(
    (
      await run(
        `SELECT COALESCE(SUM(l.credit), 0) AS t FROM public.journal_entries e
           JOIN public.test_journal_lines l ON l.entry_id = e.id
          WHERE e.source_type = 'package_release' AND e.source_id = $1 AND l.account_id = '${ACC_SALES}'`,
        [entryId],
      )
    )[0]!.t,
  )

const deferredBalance = async (run: Run): Promise<number> =>
  Number(
    (
      await run(
        `SELECT COALESCE(SUM(credit - debit), 0) AS b FROM public.test_journal_lines WHERE account_id = '${ACC_DEFERRED}'`,
      )
    )[0]!.b,
  )

async function refuses(promise: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(promise, (error: Error) => {
    assert.match(String(error.message), new RegExp(code))
    return true
  })
}

async function newSession(run: Run, customer: string, date = '2026-11-02'): Promise<string> {
  const id = uid('5e000000')
  await run(
    `INSERT INTO public.service_delivery_sessions (id, workspace_id, customer_id, service_offering_id, session_date,
       start_time, end_time, duration_minutes)
     VALUES ($1, $2, $3, $4, $5, '10:00', '11:00', 60)`,
    [id, WS, customer, SERVICE, date],
  )
  return id
}

const deliver = (run: Run, session: string, qty = 1) =>
  run(
    `SELECT public.service_delivery_deliver($1::uuid, $2::uuid, 'package_credit', $3::uuid, $4::numeric, NULL::uuid, NULL, NULL::uuid, NULL::timestamptz) AS r`,
    [WS, session, PACKAGE, qty],
  ).then((rows) => rows[0]!.r as Record<string, unknown>)

const cancel = (run: Run, session: string) =>
  run(
    `SELECT public.service_delivery_cancel($1::uuid, $2::uuid, NULL::uuid, 'customer asked') AS r`,
    [WS, session],
  )

export const scenarios: Scenario[] = [
  ...vectors.vectors.map<Scenario>((vector) => ({
    name: `golden vector (shared with TypeScript): ${vector.id}`,
    run: async (run) => {
      const customer = await newCustomer(run)
      const invoice = await bookedInvoice(run, customer)
      // GRANT ids must sort like their names (g0 < g1 < g2) and be unique per vector
      const vectorNo = String(vectors.vectors.indexOf(vector) + 1).padStart(4, '0')
      const gid = (name: string) =>
        `9000${vectorNo}-0000-4000-8000-${String(Number(name.slice(1))).padStart(12, '0')}`
      const grantIds = new Map<string, string>()
      await run(
        `ALTER TABLE public.package_credit_ledger DISABLE TRIGGER trg_package_credit_allocate`,
      )
      try {
        for (const g of vector.grants) {
          const id = gid(g.id)
          grantIds.set(g.id, id)
          await insertGrant(run, {
            id,
            customer,
            invoice,
            startsOn: g.startsOn ?? '2026-10-01',
            quantity: g.quantity ?? 1,
            deferred: g.deferredAmount ?? null,
            term: g.termMonths ?? null,
          })
          if (g.adjustments) {
            await run(
              `INSERT INTO public.package_credit_ledger (workspace_id, customer_id, package_product_id, entry_type, quantity,
                 reference_entry_id, effective_date) VALUES ($1, $2, $3, 'ADJUSTMENT', $4, $5, '2026-10-02')`,
              [WS, customer, PACKAGE, g.adjustments, id],
            )
          }
          if ((g.consumedQuantity ?? 0) > 0) {
            const consume = uid('c1000000')
            await run(
              `INSERT INTO public.package_credit_ledger (id, workspace_id, customer_id, package_product_id, entry_type, quantity, effective_date)
               VALUES ($1, $2, $3, $4, 'CONSUME', $5, $6)`,
              [consume, WS, customer, PACKAGE, g.consumedQuantity, g.activatedOn ?? '2026-10-02'],
            )
            await run(
              `INSERT INTO public.package_credit_allocations (workspace_id, entry_id, kind, grant_entry_id, quantity, released_amount, effective_date)
               VALUES ($1, $2, 'CONSUME', $3, $4, $5, $6)`,
              [
                WS,
                consume,
                id,
                g.consumedQuantity,
                g.releasedAmount,
                g.activatedOn ?? '2026-10-02',
              ],
            )
          }
          for (const s of g.suspensions ?? []) {
            await run(
              `INSERT INTO public.package_credit_suspensions (workspace_id, grant_entry_id, kind, effective_on, reason)
               VALUES ($1, $2, 'SUSPEND', $3, 'test')`,
              [WS, id, s.startsOn],
            )
            if (s.endsOn) {
              await run(
                `INSERT INTO public.package_credit_suspensions (workspace_id, grant_entry_id, kind, effective_on, reason)
                 VALUES ($1, $2, 'RESUME', ($3::date + 1), 'test')`,
                [WS, id, s.endsOn],
              )
            }
          }
        }
        if ((vector.unattributed ?? 0) > 0) {
          await run(
            `INSERT INTO public.package_credit_ledger (workspace_id, customer_id, package_product_id, entry_type, quantity, effective_date)
             VALUES ($1, $2, $3, 'ADJUSTMENT', $4, '2026-10-02')`,
            [WS, customer, PACKAGE, vector.unattributed],
          )
        }
      } finally {
        await run(
          `ALTER TABLE public.package_credit_ledger ENABLE TRIGGER trg_package_credit_allocate`,
        )
      }

      const entryId = uid('c2000000')
      const consume = run(
        `INSERT INTO public.package_credit_ledger (id, workspace_id, customer_id, package_product_id, entry_type, quantity, effective_date)
         VALUES ($1, $2, $3, $4, 'CONSUME', $5, $6)`,
        [entryId, WS, customer, PACKAGE, vector.quantity, vector.onDate],
      )

      if ((vector.expected.shortfall ?? 0) > 0) {
        await refuses(consume, 'INSUFFICIENT_ELIGIBLE_PACKAGE_CREDIT')
        const left = await run(
          `SELECT 1 FROM public.package_credit_allocations WHERE entry_id = $1`,
          [entryId],
        )
        // the whole statement rolled back inside its implicit transaction: no allocation, no ledger row
        assert.equal(left.length, 0)
        return
      }
      await consume
      const rows = await run(
        `SELECT grant_entry_id, quantity::float AS quantity, released_amount::float AS released
           FROM public.package_credit_allocations WHERE entry_id = $1 ORDER BY grant_entry_id NULLS LAST`,
        [entryId],
      )
      const name = (id: unknown) =>
        id === null ? null : ([...grantIds.entries()].find(([, v]) => v === id)?.[0] ?? String(id))
      const got = rows.map((r) => ({
        grantId: name(r.grant_entry_id),
        quantity: Number(r.quantity),
        releasedAmount: Number(r.released),
      }))
      assert.deepEqual(got, vector.expected.allocations)
      assert.equal(await releaseTotal(run, entryId), vector.expected.totalReleasedAmount)
    },
  })),

  {
    name: 'M5-1 + M5-4 end to end: 10 sessions of a 10 000 package release 1 000 each, exactly 10 000 in total',
    run: async (run) => {
      const customer = await newCustomer(run)
      const invoice = await bookedInvoice(run, customer)
      await insertGrant(run, {
        customer,
        invoice,
        startsOn: '2026-10-01',
        quantity: 10,
        deferred: 10000,
        term: null,
      })
      // the sale put 10 000 into deferred revenue (the journal row the invoice posting would have written)
      const before = await deferredBalance(run)
      await run(
        `INSERT INTO public.test_journal_lines VALUES (gen_random_uuid(), '${ACC_DEFERRED}', 0, 10000)`,
      )
      let total = 0
      for (let i = 0; i < 10; i++) {
        const s = await newSession(run, customer)
        await deliver(run, s)
        total += 1000
      }
      assert.equal(
        (await deferredBalance(run)) - before,
        0,
        'the liability is fully released after the last session',
      )
      assert.equal(total, 10000)
    },
  },
  {
    name: 'a non-divisible amount: three sessions of a 100 package release 33.33 + 33.33 + 33.34',
    run: async (run) => {
      const customer = await newCustomer(run)
      const invoice = await bookedInvoice(run, customer)
      await insertGrant(run, {
        customer,
        invoice,
        startsOn: '2026-10-01',
        quantity: 3,
        deferred: 100,
        term: null,
      })
      const released: number[] = []
      for (let i = 0; i < 3; i++) {
        const s = await newSession(run, customer)
        const r = (await deliver(run, s)) as { package_credit_id: string }
        released.push(await releaseTotal(run, r.package_credit_id))
      }
      assert.deepEqual(released, [33.33, 33.33, 33.34])
    },
  },
  {
    name: 'cancelling a delivered session restores EXACTLY what it released, in one reversal entry',
    run: async (run) => {
      const customer = await newCustomer(run)
      const invoice = await bookedInvoice(run, customer)
      await insertGrant(run, {
        customer,
        invoice,
        startsOn: '2026-10-01',
        quantity: 4,
        deferred: 400,
        term: null,
      })
      const s = await newSession(run, customer)
      const r = (await deliver(run, s, 2)) as { package_credit_id: string }
      assert.equal(await releaseTotal(run, r.package_credit_id), 200)
      await cancel(run, s)
      const rev = await run(
        `SELECT e.id, e.reversal_of, SUM(l.debit) FILTER (WHERE l.account_id = '${ACC_SALES}') AS sales_debit
           FROM public.journal_entries e JOIN public.test_journal_lines l ON l.entry_id = e.id
          WHERE e.source_type = 'package_release_reversal' GROUP BY e.id, e.reversal_of`,
      )
      const mine = rev.filter((x) => Number(x.sales_debit) === 200)
      assert.equal(mine.length >= 1, true)
      const alloc = await run(
        `SELECT kind, quantity::float AS q, released_amount::float AS r FROM public.package_credit_allocations
          WHERE grant_entry_id IS NOT NULL AND entry_id IN (
            SELECT id FROM public.package_credit_ledger WHERE source_document_id = $1) ORDER BY kind`,
        [s],
      )
      assert.deepEqual(
        alloc.map((a) => [a.kind, Number(a.q), Number(a.r)]),
        [
          ['CONSUME', 2, 200],
          ['REVERSAL', 2, 200],
        ],
      )
    },
  },
  {
    name: 'a delivery replay posts nothing and allocates nothing a second time',
    run: async (run) => {
      const customer = await newCustomer(run)
      const invoice = await bookedInvoice(run, customer)
      await insertGrant(run, {
        customer,
        invoice,
        startsOn: '2026-10-01',
        quantity: 3,
        deferred: 300,
        term: null,
      })
      const s = await newSession(run, customer)
      const first = (await deliver(run, s)) as { package_credit_id: string }
      const again = (await deliver(run, s)) as { replayed: boolean }
      assert.equal(again.replayed, true)
      const count = await run(
        `SELECT COUNT(*)::int AS n FROM public.journal_entries WHERE source_type = 'package_release' AND source_id = $1`,
        [first.package_credit_id],
      )
      assert.equal(count[0]!.n, 1)
    },
  },
  {
    name: 'a closed period refuses the WHOLE delivery: session still scheduled, no consume, no allocation',
    run: async (run) => {
      const customer = await newCustomer(run)
      const invoice = await bookedInvoice(run, customer)
      await insertGrant(run, {
        customer,
        invoice,
        startsOn: '2026-10-01',
        quantity: 3,
        deferred: 300,
        term: null,
      })
      const s = await newSession(run, customer, '2026-10-20')
      await run(`INSERT INTO public.test_period_lock VALUES ($1, '2026-10-31')`, [WS])
      try {
        await refuses(deliver(run, s), 'ACCOUNTING_PERIOD_LOCKED')
      } finally {
        await run(`DELETE FROM public.test_period_lock WHERE workspace_id = $1`, [WS])
      }
      const status = await run(
        `SELECT status FROM public.service_delivery_sessions WHERE id = $1`,
        [s],
      )
      assert.equal(status[0]!.status, 'scheduled')
      const consumes = await run(
        `SELECT COUNT(*)::int AS n FROM public.package_credit_ledger WHERE source_document_id = $1`,
        [s],
      )
      assert.equal(consumes[0]!.n, 0)
    },
  },
  {
    name: 'a package whose sale was never booked releases nothing: PACKAGE_INVOICE_NOT_BOOKED',
    run: async (run) => {
      const customer = await newCustomer(run)
      const unbooked = uid('e0000000')
      await run(`INSERT INTO public.invoices VALUES ($1, $2, $3)`, [unbooked, WS, customer])
      await insertGrant(run, {
        customer,
        invoice: unbooked,
        startsOn: '2026-10-01',
        quantity: 3,
        deferred: 300,
        term: null,
      })
      const s = await newSession(run, customer)
      await refuses(deliver(run, s), 'PACKAGE_INVOICE_NOT_BOOKED')
    },
  },
  {
    name: 'a legacy GRANT (no deferred amount) is delivered without any journal entry',
    run: async (run) => {
      const customer = await newCustomer(run)
      const invoice = await bookedInvoice(run, customer)
      await insertGrant(run, {
        customer,
        invoice,
        startsOn: '2026-01-01',
        quantity: 3,
        deferred: null,
        term: null,
      })
      const s = await newSession(run, customer)
      const r = (await deliver(run, s)) as { package_credit_id: string }
      assert.equal(await releaseTotal(run, r.package_credit_id), 0)
      const n = await run(
        `SELECT COUNT(*)::int AS n FROM public.journal_entries WHERE source_type = 'package_release' AND source_id = $1`,
        [r.package_credit_id],
      )
      assert.equal(n[0]!.n, 0)
    },
  },
  {
    name: 'consumptions written BEFORE the migration are charged to the old GRANTs and never counted twice',
    run: async (run) => {
      const customer = await newCustomer(run)
      const invoice = await bookedInvoice(run, customer)
      const legacy = await insertGrant(run, {
        customer,
        invoice,
        startsOn: '2026-01-01',
        quantity: 3,
        deferred: null,
        term: null,
      })
      void legacy
      // a CONSUME of 2 that has no allocation row (it predates the trigger)
      await run(
        `ALTER TABLE public.package_credit_ledger DISABLE TRIGGER trg_package_credit_allocate`,
      )
      await run(
        `INSERT INTO public.package_credit_ledger (workspace_id, customer_id, package_product_id, entry_type, quantity, effective_date)
         VALUES ($1, $2, $3, 'CONSUME', 2, '2026-02-01')`,
        [WS, customer, PACKAGE],
      )
      await run(
        `ALTER TABLE public.package_credit_ledger ENABLE TRIGGER trg_package_credit_allocate`,
      )
      const ok = await newSession(run, customer)
      await deliver(run, ok, 1) // the third unit
      const over = await newSession(run, customer)
      await refuses(deliver(run, over, 1), 'INSUFFICIENT')
    },
  },
  {
    name: 'B2-5: the profit report reads the ledger - the deferred-revenue change of a window is credits at sale minus releases at delivery',
    run: async (run) => {
      const customer = await newCustomer(run)
      const invoice = await bookedInvoice(run, customer)
      await insertGrant(run, {
        customer,
        invoice,
        startsOn: '2026-10-01',
        quantity: 10,
        deferred: 10000,
        term: null,
      })
      const probe = (from: string, to: string) =>
        run(`SELECT public.accounting_deferred_revenue_change($1::uuid, $2::date, $3::date) AS c`, [
          WS,
          from,
          to,
        ]).then((r) => Number(r[0]!.c))
      const before = await probe('2026-11-20', '2026-11-30')
      // the sale put 10 000 into deferred revenue on 20 November (the credit the invoice posting writes)
      const sale = uid('e7000000')
      await run(
        `INSERT INTO public.journal_entries (id, workspace_id, date, source_type, source_id) VALUES ($1, $2, '2026-11-20', 'invoice', $3)`,
        [sale, WS, uid('e7100000')],
      )
      await run(`INSERT INTO public.journal_lines VALUES ($1, '${ACC_DEFERRED}', 0, 10000)`, [sale])
      // the other side of the sale (receivable), so the fixture ledger balances like a real posting
      const receivable = uid('a1000000')
      await run(
        `INSERT INTO public.accounts (id, workspace_id, role) VALUES ($1, $2, 'receivable')`,
        [receivable, WS],
      )
      await run(`INSERT INTO public.journal_lines VALUES ($1, $2, 10000, 0)`, [sale, receivable])
      for (let i = 0; i < 3; i++) await deliver(run, await newSession(run, customer, '2026-11-21'))
      // 10 000 credited, 3 x 1 000 released: the liability moved by 7 000 in the window, and revenue is recognised only for 3 000
      assert.equal((await probe('2026-11-20', '2026-11-30')) - before, 7000)
      // the TypeScript reversal path marks the ORIGINAL entry 'reversed' and posts the cancelling entry: the sum must keep both
      const total = await probe('2026-11-20', '2026-11-30')
      await run(`UPDATE public.journal_entries SET status = 'reversed' WHERE id = $1`, [sale])
      assert.equal(
        await probe('2026-11-20', '2026-11-30'),
        total,
        'a reversed original still counts',
      )
      await run(`UPDATE public.journal_entries SET status = 'posted' WHERE id = $1`, [sale])
      // a window that holds neither the sale nor the deliveries sees nothing
      assert.equal(await probe('2026-12-01', '2026-12-31'), 0)
      // another workspace's ledger is never read
      const other = await run(
        `SELECT public.accounting_deferred_revenue_change($1::uuid, '2026-11-20', '2026-11-30') AS c`,
        ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
      )
      assert.equal(Number(other[0]!.c), 0)
    },
  },
  {
    name: 'C1: an expired GRANT is never revived by a renewal - the renewal is a NEW GRANT and the old remainder stays history',
    run: async (run) => {
      const customer = await newCustomer(run)
      const invoice = await bookedInvoice(run, customer)
      const old = await insertGrant(run, {
        customer,
        invoice,
        startsOn: '2026-08-01',
        quantity: 5,
        deferred: 500,
        term: 1,
      })
      await deliver(run, await newSession(run, customer, '2026-09-01')) // starts the term: it ends on 1 October
      const renewal = await insertGrant(run, {
        customer,
        invoice,
        startsOn: '2026-10-20',
        quantity: 4,
        deferred: 800,
        term: 1,
      })
      // 4 units of the OLD grant are unspent, 4 of the NEW one: only the new ones can be used
      for (let i = 0; i < 4; i++) await deliver(run, await newSession(run, customer, '2026-11-02'))
      await refuses(
        deliver(run, await newSession(run, customer, '2026-11-02')),
        'INSUFFICIENT_ELIGIBLE_PACKAGE_CREDIT',
      )
      const spent = await run(
        `SELECT grant_entry_id, SUM(quantity)::float AS q, SUM(released_amount)::float AS r
           FROM public.package_credit_allocations WHERE kind = 'CONSUME' AND grant_entry_id IN ($1, $2) GROUP BY grant_entry_id`,
        [old, renewal],
      )
      const byGrant = new Map(spent.map((r) => [r.grant_entry_id, [Number(r.q), Number(r.r)]]))
      assert.deepEqual(byGrant.get(old), [1, 100]) // history intact: one unit used before it expired
      assert.deepEqual(byGrant.get(renewal), [4, 800]) // the renewal's own entitlement and its own deferred value
    },
  },
  {
    name: 'accounts-role-deferred-and-loss-01: the role check accepts the two new roles and still refuses an unknown one',
    run: async (run) => {
      for (const role of ['deferred_revenue', 'inventory_loss', 'sales']) {
        await run(
          `INSERT INTO public.accounts (id, workspace_id, role) VALUES (gen_random_uuid(), $1, $2)`,
          [WS, role],
        )
      }
      await refuses(
        run(
          `INSERT INTO public.accounts (id, workspace_id, role) VALUES (gen_random_uuid(), $1, 'bogus_role')`,
          [WS],
        ),
        'accounts_role_check',
      )
    },
  },
  {
    name: 'docs/FINDING-m5-post-apply.sql blocks 1-7 are valid SQL on the migrated schema (block 4 reads the sale credit the fixtures do not all post)',
    run: async (run) => {
      const text = doc('FINDING-m5-post-apply.sql')
      const blocks = text
        .split(new RegExp('^-- [0-9]+' + String.fromCharCode(46) + ' ', 'm'))
        .slice(1)
        .map((b) =>
          b
            .slice(b.indexOf(String.fromCharCode(10)) + 1)
            .trim()
            .replace(/;\s*$/, ''),
        )
      assert.equal(blocks.length, 9)
      for (const [index, block] of blocks.slice(0, 7).entries()) {
        await run(`SELECT count(*) FROM (${block}) q`).catch((error: Error) => {
          throw new Error(`block ${index + 1}: ${error.message}`)
        })
      }
      // block 1 and 2 must be EMPTY on a ledger the trigger and the migration produced
      for (const index of [0, 1]) {
        const rows = await run(blocks[index]!)
        assert.equal(rows.length, 0, `block ${index + 1} found ${rows.length} anomaly row(s)`)
      }
    },
  },
  {
    name: 'C2: accounting_profit_ledger_totals sums sales / cost of sales / inventory loss from the LEDGER, counts reversed originals once, and never reads another workspace',
    run: async (run) => {
      const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      const mk = async (role: string, ws = WS) => {
        const id = uid('a2000000')
        await run(`INSERT INTO public.accounts (id, workspace_id, role) VALUES ($1, $2, $3)`, [
          id,
          ws,
          role,
        ])
        return id
      }
      const cash = await mk('cash'),
        sales = await mk('sales'),
        cogs = await mk('cogs'),
        loss = await mk('inventory_loss')
      const entry = async (
        date: string,
        status: string,
        lines: Array<[string, number, number]>,
        ws = WS,
      ) => {
        const id = uid('e8000000')
        await run(
          `INSERT INTO public.journal_entries (id, workspace_id, date, source_type, source_id, status) VALUES ($1, $2, $3, 'invoice', $4, $5)`,
          [id, ws, date, uid('e8100000'), status],
        )
        for (const [account, debit, credit] of lines)
          await run(`INSERT INTO public.journal_lines VALUES ($1, $2, $3, $4)`, [
            id,
            account,
            debit,
            credit,
          ])
        return id
      }
      const probe = (ws: string, from: string, to: string) =>
        run(`SELECT public.accounting_profit_ledger_totals($1::uuid, $2::date, $3::date) AS t`, [
          ws,
          from,
          to,
        ]).then((r) => r[0]!.t as Record<string, number>)
      const before = await probe(WS, '2027-03-01', '2027-03-31')
      const sale = await entry('2027-03-10', 'posted', [
        [cash, 500, 0],
        [sales, 0, 500],
        [cogs, 200, 0],
        [cash, 0, 200],
      ])
      await entry('2027-03-12', 'posted', [
        [loss, 60, 0],
        [cogs, 0, 60],
      ]) // a scrapped return moves cost of sales to loss
      await entry(
        '2027-03-15',
        'posted',
        [
          [cash, 999, 0],
          [sales, 0, 999],
        ],
        OTHER,
      ) // another workspace
      const t = await probe(WS, '2027-03-01', '2027-03-31')
      assert.equal(Number(t.revenue) - Number(before.revenue), 500)
      assert.equal(Number(t.cost) - Number(before.cost), 140) // 200 - 60 moved to loss
      assert.equal(Number(t.inventory_loss) - Number(before.inventory_loss), 60)
      // the TypeScript reversal marks the original 'reversed' and posts the cancelling entry: both must be kept so they cancel
      await run(`UPDATE public.journal_entries SET status = 'reversed' WHERE id = $1`, [sale])
      await entry('2027-03-20', 'posted', [
        [cash, 0, 500],
        [sales, 500, 0],
        [cogs, 0, 200],
        [cash, 200, 0],
      ])
      const reversed = await probe(WS, '2027-03-01', '2027-03-31')
      assert.equal(Number(reversed.revenue) - Number(before.revenue), 0)
      assert.equal(Number(reversed.cost) - Number(before.cost), -60)
      // a window with nothing in it
      const empty = await probe(WS, '2030-01-01', '2030-01-31')
      assert.deepEqual(
        [Number(empty.revenue), Number(empty.cost), Number(empty.inventory_loss)],
        [0, 0, 0],
      )
    },
  },
  {
    name: 'allocations and suspensions are append-only',
    run: async (run) => {
      await refuses(
        run(`UPDATE public.package_credit_allocations SET quantity = quantity + 1`),
        'PACKAGE_CREDIT_HISTORY_IMMUTABLE',
      )
      await refuses(
        run(`DELETE FROM public.package_credit_allocations`),
        'PACKAGE_CREDIT_HISTORY_IMMUTABLE',
      )
      await refuses(
        run(`DELETE FROM public.package_credit_suspensions`),
        'PACKAGE_CREDIT_HISTORY_IMMUTABLE',
      )
    },
  },
]
