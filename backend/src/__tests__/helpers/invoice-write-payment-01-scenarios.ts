// ============================================
// The invoice-write-payment-01 scenarios, written once against the tiny SQL runner
// (scripts/pg/run-scenarios.mjs).
//
// They run the REAL migrations in the order a person runs them -
// payments-ar-ap, package-credit-ledger-01, invoice-write-document,
// invoice-write-grant-01, offline-idempotency, invoice-write-payment-01 (twice) -
// and drive the 12-argument `invoice_write_document` with payment rows:
//   · invoice + items + stock + payments commit together;
//   · a payment the payments core refuses rolls back the WHOLE invoice;
//   · a payment naming another invoice, another party, or the wrong direction is
//     refused before anything is written;
//   · a retry of the same request records the money once;
//   · without payments_record_keyed the request is refused and NOTHING is written;
//   · a sale with no money still uses the 10-argument function.
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

const DOCS = process.env.INVOICE_PAYMENT_DOCS ?? join(__dirname, '..', '..', '..', '..', 'docs')
const doc = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER = '11111111-1111-4111-8111-111111111111'
const CUST = 'c0000000-0000-4000-8000-000000000001'
const OTHER_CUST = 'c0000000-0000-4000-8000-000000000002'
const SUP = '50000000-0000-4000-8000-000000000001'
const PRODUCT = '20000000-0000-4000-8000-000000000002'
const TILL = '70000000-0000-4000-8000-000000000001'

const STUB_SCHEMA = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.workspaces (id uuid PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id uuid, user_id uuid, has_access boolean, suspended_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.customers (id uuid PRIMARY KEY, workspace_id uuid);
CREATE TABLE IF NOT EXISTS public.suppliers (id uuid PRIMARY KEY, workspace_id uuid);
CREATE TABLE IF NOT EXISTS public.products (id uuid PRIMARY KEY, workspace_id uuid);
CREATE TABLE IF NOT EXISTS public.transactions (id uuid PRIMARY KEY, workspace_id uuid);
CREATE TABLE IF NOT EXISTS public.pos_sessions (
  id uuid PRIMARY KEY, workspace_id uuid, status text, currency text, branch_id uuid
);
CREATE TABLE IF NOT EXISTS public.accounts (id uuid PRIMARY KEY, role text);
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY, workspace_id uuid, customer_id uuid, supplier_id uuid,
  invoice_number text, type text, status text, total numeric, paid_amount numeric,
  currency text, date date, due_date date, version bigint DEFAULT 1,
  finalized_at timestamptz, updated_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY, invoice_id uuid, workspace_id uuid, product_id uuid,
  quantity numeric, unit_price numeric, total_price numeric
);
CREATE TABLE IF NOT EXISTS public.invoice_item_details (invoice_item_id uuid, title text);
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid, user_id uuid,
  product_id uuid, type text, quantity numeric, from_warehouse_id uuid,
  to_warehouse_id uuid, reference_type text, reference_id uuid
);
`

export async function setupInvoiceWritePayment(run: Run): Promise<void> {
  await run(STUB_SCHEMA)
  await run(
    `INSERT INTO public.workspaces VALUES ('${WS}');
     INSERT INTO public.customers VALUES ('${CUST}', '${WS}'), ('${OTHER_CUST}', '${WS}');
     INSERT INTO public.suppliers VALUES ('${SUP}', '${WS}');
     INSERT INTO public.products VALUES ('${PRODUCT}', '${WS}');
     INSERT INTO public.pos_sessions VALUES ('${TILL}', '${WS}', 'open', 'AFN', NULL);`,
  )
  await run(doc('payments-ar-ap-migration.sql'))
  await run(doc('package-credit-ledger-01-migration.sql'))
  await run(doc('invoice-write-document-migration.sql'))
  await run(doc('invoice-write-grant-01-migration.sql'))
  await run(doc('offline-idempotency-migration.sql'))
  await run(doc('till-payments-01-migration.sql'))
  const migration = doc('invoice-write-payment-01-migration.sql')
  await run(migration)
  await run(migration) // idempotent
}

let seq = 100
const uid = (p: string) => `${p}-0000-4000-8000-${String(++seq).padStart(12, '0')}`

interface PaymentOverrides {
  partyType?: 'customer' | 'supplier'
  partyId?: string | null
  direction?: 'in' | 'out'
  amount?: number
  allocationInvoiceId?: string
  /** Money into the open drawer: the RPC must use payments_record_at_till. */
  atTill?: boolean
}

let paySeq = 900

function paymentElement(invoiceId: string, index: number, over: PaymentOverrides = {}) {
  const amount = over.amount ?? 400
  return {
    payment: {
      payment_number: `PMT-2026-${String(++paySeq).padStart(6, '0')}`,
      direction: over.direction ?? 'in',
      party_type: over.partyType ?? 'customer',
      party_id: over.partyId === undefined ? CUST : over.partyId,
      amount,
      currency: 'AFN',
      method: 'cash',
      entry_date: '2026-11-02',
      reference: '',
      notes: '',
      status: 'posted',
    },
    allocations: [{ invoice_id: over.allocationInvoiceId ?? invoiceId, amount }],
    client_request_id: `create-${invoiceId}:payment:${index}`,
    ...(over.atTill ? { till_session_id: TILL, till_amount_minor: amount * 100 } : {}),
  }
}

function call(
  run: Run,
  invoiceId: string,
  opts: {
    type?: 'sale' | 'purchase'
    partyId?: string
    payments: unknown[] | null
    lineId?: string
  },
) {
  const lineId = opts.lineId ?? uid('e1000000')
  const type = opts.type ?? 'sale'
  const header = {
    id: invoiceId,
    workspace_id: WS,
    ...(type === 'purchase' ? { supplier_id: SUP } : { customer_id: opts.partyId ?? CUST }),
    invoice_number: `INV-${seq}`,
    type,
    total: 1000,
    paid_amount: 0,
    currency: 'AFN',
    date: '2026-11-02',
    due_date: '2026-11-02',
    status: 'pending',
  }
  const items = [
    {
      id: lineId,
      invoice_id: invoiceId,
      workspace_id: WS,
      product_id: PRODUCT,
      quantity: 10,
      unit_price: 100,
      total_price: 1000,
    },
  ]
  const movements = [
    {
      id: uid('f0000000'),
      workspace_id: WS,
      user_id: USER,
      product_id: PRODUCT,
      type,
      quantity: 10,
      reference_type: 'invoice',
      reference_id: invoiceId,
    },
  ]
  if (opts.payments === null) {
    return run(
      `SELECT public.invoice_write_document($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5::jsonb, '[]'::jsonb, $6::jsonb, false, NULL::jsonb, NULL::bigint) AS r`,
      [WS, invoiceId, USER, header, items, movements],
    )
  }
  return run(
    `SELECT public.invoice_write_document($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5::jsonb, '[]'::jsonb, $6::jsonb, false, NULL::jsonb, NULL::bigint, $7::jsonb, $8::jsonb) AS r`,
    [WS, invoiceId, USER, header, items, movements, [], opts.payments],
  )
}

const count = async (run: Run, sql: string, params: unknown[] = []) =>
  Number((await run(`SELECT COUNT(*)::int AS n ${sql}`, params))[0]!.n)

const scalar = async (run: Run, sql: string, params: unknown[] = []) =>
  String((await run(`SELECT ${sql}`, params))[0]!.v)

export const scenarios: Scenario[] = [
  {
    name: 'a sale commits invoice + items + stock + TWO tranches together',
    run: async (run) => {
      const inv = uid('e0000000')
      await call(run, inv, {
        payments: [paymentElement(inv, 0), paymentElement(inv, 1, { amount: 600 })],
      })
      assert.equal(await count(run, 'FROM public.invoices WHERE id = $1', [inv]), 1)
      assert.equal(await count(run, 'FROM public.invoice_items WHERE invoice_id = $1', [inv]), 1)
      assert.equal(
        await count(run, 'FROM public.stock_movements WHERE reference_id = $1', [inv]),
        1,
      )
      assert.equal(await count(run, 'FROM public.payments WHERE workspace_id = $1', [WS]), 2)
      assert.equal(
        await count(run, 'FROM public.payment_allocations WHERE invoice_id = $1', [inv]),
        2,
      )
      assert.equal(
        await scalar(run, 'paid_amount::text AS v FROM public.invoices WHERE id = $1', [inv]),
        '1000',
      )
      assert.equal(
        await scalar(run, 'status AS v FROM public.invoices WHERE id = $1', [inv]),
        'paid',
      )
    },
  },
  {
    name: 'a cash tranche at an open till stamps the drawer in the same transaction',
    run: async (run) => {
      const inv = uid('e0000000')
      await call(run, inv, { payments: [paymentElement(inv, 0, { atTill: true })] })
      assert.equal(await count(run, 'FROM public.invoices WHERE id = $1', [inv]), 1)
      const row = (
        await run(
          'SELECT pos_session_id::text AS session_id, till_amount_minor::text AS minor FROM public.payments WHERE client_request_id = $1',
          [`create-${inv}:payment:0`],
        )
      )[0]!
      assert.equal(row.session_id, TILL)
      assert.equal(row.minor, '40000')
    },
  },
  {
    name: 'a CLOSED till refuses the money and rolls back the WHOLE sale',
    run: async (run) => {
      await run(`UPDATE public.pos_sessions SET status = 'closed' WHERE id = '${TILL}';`)
      const inv = uid('e0000000')
      await assert.rejects(
        call(run, inv, { payments: [paymentElement(inv, 0, { atTill: true })] }),
        /PAYMENT_TILL_NOT_OPEN/,
      )
      assert.equal(await count(run, 'FROM public.invoices WHERE id = $1', [inv]), 0)
      assert.equal(
        await count(run, 'FROM public.payment_allocations WHERE invoice_id = $1', [inv]),
        0,
      )
      await run(`UPDATE public.pos_sessions SET status = 'open' WHERE id = '${TILL}';`)
    },
  },
  {
    name: 'a payment the payments core refuses rolls back the WHOLE sale',
    run: async (run) => {
      const inv = uid('e0000000')
      // 2000 allocated against an invoice of 1000: payments_record refuses.
      await assert.rejects(
        call(run, inv, {
          payments: [paymentElement(inv, 0, { amount: 2000 })],
        }),
        /PAYMENT_ALLOCATION_EXCEEDS_OUTSTANDING/,
      )
      assert.equal(await count(run, 'FROM public.invoices WHERE id = $1', [inv]), 0)
      assert.equal(await count(run, 'FROM public.invoice_items WHERE invoice_id = $1', [inv]), 0)
      assert.equal(
        await count(run, 'FROM public.stock_movements WHERE reference_id = $1', [inv]),
        0,
      )
      assert.equal(
        await count(run, 'FROM public.payments WHERE party_id = $1 AND amount = 2000', [CUST]),
        0,
      )
    },
  },
  {
    name: 'a payment naming ANOTHER invoice is refused before anything is written',
    run: async (run) => {
      const inv = uid('e0000000')
      const other = uid('e0000000')
      const before = await count(run, 'FROM public.payments WHERE workspace_id = $1', [WS])
      await assert.rejects(
        call(run, inv, {
          payments: [paymentElement(inv, 0, { allocationInvoiceId: other })],
        }),
        /another invoice, party or direction/,
      )
      assert.equal(await count(run, 'FROM public.invoices WHERE id = $1', [inv]), 0)
      assert.equal(await count(run, 'FROM public.invoices WHERE id = $1', [other]), 0)
      assert.equal(await count(run, 'FROM public.payments WHERE workspace_id = $1', [WS]), before)
    },
  },
  {
    name: "a payment for ANOTHER party is refused: a customer's money never settles someone else's invoice",
    run: async (run) => {
      const inv = uid('e0000000')
      await assert.rejects(
        call(run, inv, {
          payments: [paymentElement(inv, 0, { partyId: OTHER_CUST })],
        }),
        /another invoice, party or direction/,
      )
      assert.equal(await count(run, 'FROM public.invoices WHERE id = $1', [inv]), 0)
    },
  },
  {
    name: 'a purchase takes money OUT and a supplier payment commits',
    run: async (run) => {
      const inv = uid('e0000000')
      await call(run, inv, {
        type: 'purchase',
        payments: [
          paymentElement(inv, 0, { partyType: 'supplier', partyId: SUP, direction: 'out' }),
        ],
      })
      assert.equal(await count(run, 'FROM public.invoices WHERE id = $1', [inv]), 1)
      assert.equal(
        await count(
          run,
          "FROM public.payments WHERE party_type = 'supplier' AND party_id = $1 AND direction = 'out'",
          [SUP],
        ),
        1,
      )
    },
  },
  {
    name: 'a purchase taking money IN is refused before anything is written',
    run: async (run) => {
      const inv = uid('e0000000')
      await assert.rejects(
        call(run, inv, {
          type: 'purchase',
          payments: [
            paymentElement(inv, 0, { partyType: 'supplier', partyId: SUP, direction: 'in' }),
          ],
        }),
        /another invoice, party or direction/,
      )
      assert.equal(await count(run, 'FROM public.invoices WHERE id = $1', [inv]), 0)
    },
  },
  {
    name: 'a retry of the SAME request records the money ONCE',
    run: async (run) => {
      const inv = uid('e0000000')
      const payments = [paymentElement(inv, 0)]
      await call(run, inv, { payments })
      const before = await count(run, 'FROM public.payments WHERE workspace_id = $1', [WS])
      await assert.rejects(call(run, inv, { payments }))
      assert.equal(await count(run, 'FROM public.payments WHERE workspace_id = $1', [WS]), before)
      assert.equal(
        await scalar(run, 'paid_amount::text AS v FROM public.invoices WHERE id = $1', [inv]),
        '400',
      )
    },
  },
  {
    name: 'a sale with NO money still uses the 10-argument function (both overloads coexist)',
    run: async (run) => {
      const inv = uid('e0000000')
      await call(run, inv, { payments: null })
      assert.equal(await count(run, 'FROM public.invoices WHERE id = $1', [inv]), 1)
      assert.equal(
        await count(run, 'FROM public.payment_allocations WHERE invoice_id = $1', [inv]),
        0,
      )
    },
  },
  {
    name: 'without payments_record_keyed the request is refused and NOTHING is written',
    run: async (run) => {
      await run(
        'DROP FUNCTION IF EXISTS public.payments_record_keyed(uuid, uuid, jsonb, jsonb, text);',
      )
      const inv = uid('e0000000')
      await assert.rejects(
        call(run, inv, { payments: [paymentElement(inv, 0)] }),
        /PAYMENT_IDEMPOTENCY_MIGRATION_REQUIRED/,
      )
      assert.equal(await count(run, 'FROM public.invoices WHERE id = $1', [inv]), 0)
      assert.equal(
        await count(run, 'FROM public.payment_allocations WHERE invoice_id = $1', [inv]),
        0,
      )
      // Restore for any later run of this file.
      await run(doc('offline-idempotency-migration.sql'))
      const restored = await run(
        `SELECT to_regprocedure('public.payments_record_keyed(uuid, uuid, jsonb, jsonb, text)') IS NOT NULL AS ok`,
      )
      assert.equal(restored[0]!.ok, true)
      const after = uid('e0000000')
      await call(run, after, { payments: [paymentElement(after, 0)] })
      assert.equal(await count(run, 'FROM public.invoices WHERE id = $1', [after]), 1)
    },
  },
]
