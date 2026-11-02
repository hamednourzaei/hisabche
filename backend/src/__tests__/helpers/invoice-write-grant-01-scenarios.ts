// ============================================
// The invoice-write-grant-01 scenarios (M5 slice D), written once against the tiny SQL runner (scripts/pg/run-scenarios.mjs).
//
// They run the REAL migrations in the order a person runs them - package-credit-ledger-01, invoice-write-document-migration,
// invoice-write-grant-01 (twice) - and drive `invoice_write_document` with and without GRANT rows:
//   · invoice + items + GRANT commit together; if the GRANT cannot be written NOTHING is (no invoice without its credit);
//   · a sale WITHOUT a package keeps calling the 10-argument function (both overloads coexist, no 42725 "not unique");
//   · a retry of the same request grants once;
//   · re-running the OLDER migration afterwards does not remove the new function or break the grant.
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

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER = '11111111-1111-4111-8111-111111111111'
const CUST = 'c0000000-0000-4000-8000-000000000001'
const PACKAGE = '20000000-0000-4000-8000-000000000002'

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
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY, workspace_id uuid, customer_id uuid, invoice_number text, type text, total numeric,
  version bigint DEFAULT 1, finalized_at timestamptz, updated_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY, invoice_id uuid, workspace_id uuid, product_id uuid, quantity numeric, unit_price numeric, total_price numeric
);
CREATE TABLE IF NOT EXISTS public.invoice_item_details (invoice_item_id uuid, title text);
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid, user_id uuid, product_id uuid, type text, quantity numeric,
  from_warehouse_id uuid, to_warehouse_id uuid, reference_type text, reference_id uuid
);
`

export async function setupInvoiceWriteGrant(run: Run): Promise<void> {
  await run(STUB_SCHEMA)
  await run(
    `INSERT INTO public.workspaces VALUES ('${WS}'); INSERT INTO public.customers VALUES ('${CUST}', '${WS}'); INSERT INTO public.products VALUES ('${PACKAGE}', '${WS}');`,
  )
  await run(doc('package-credit-ledger-01-migration.sql'))
  await run(doc('invoice-write-document-migration.sql'))
  const migration = doc('invoice-write-grant-01-migration.sql')
  await run(migration)
  await run(migration) // idempotent
}

let seq = 100
const uid = (p: string) => `${p}-0000-4000-8000-${String(++seq).padStart(12, '0')}`

function call(run: Run, invoiceId: string, lineId: string, grants: unknown[] | null) {
  const header = {
    id: invoiceId,
    workspace_id: WS,
    customer_id: CUST,
    invoice_number: `INV-${seq}`,
    type: 'sale',
    total: 1000,
  }
  const items = [
    {
      id: lineId,
      invoice_id: invoiceId,
      workspace_id: WS,
      product_id: PACKAGE,
      quantity: 10,
      unit_price: 100,
      total_price: 1000,
    },
  ]
  if (grants === null) {
    return run(
      `SELECT public.invoice_write_document($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5::jsonb, '[]'::jsonb, '[]'::jsonb, false, NULL::jsonb, NULL::bigint) AS r`,
      [WS, invoiceId, USER, JSON.stringify(header), JSON.stringify(items)],
    )
  }
  return run(
    `SELECT public.invoice_write_document($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5::jsonb, '[]'::jsonb, '[]'::jsonb, false, NULL::jsonb, NULL::bigint, $6::jsonb) AS r`,
    [WS, invoiceId, USER, JSON.stringify(header), JSON.stringify(items), JSON.stringify(grants)],
  )
}

const grantRow = (invoiceId: string, lineId: string, over: Record<string, unknown> = {}) => ({
  id: uid('90000000'),
  workspace_id: WS,
  customer_id: CUST,
  package_product_id: PACKAGE,
  entry_type: 'GRANT',
  quantity: 10,
  source_document_type: 'invoice',
  source_document_id: invoiceId,
  source_line_id: lineId,
  idempotency_key: `invoice:${invoiceId}:${lineId}`,
  effective_date: '2026-11-02',
  ...over,
})

const count = async (run: Run, sql: string, params: unknown[] = []) =>
  Number((await run(`SELECT COUNT(*)::int AS n ${sql}`, params))[0]!.n)

export const scenarios: Scenario[] = [
  {
    name: 'a package sale commits invoice + items + GRANT together',
    run: async (run) => {
      const inv = uid('e0000000'),
        line = uid('e1000000')
      await call(run, inv, line, [grantRow(inv, line)])
      assert.equal(await count(run, 'FROM public.invoices WHERE id = $1', [inv]), 1)
      assert.equal(await count(run, 'FROM public.invoice_items WHERE invoice_id = $1', [inv]), 1)
      assert.equal(
        await count(
          run,
          "FROM public.package_credit_ledger WHERE source_document_id = $1 AND entry_type = 'GRANT'",
          [inv],
        ),
        1,
      )
    },
  },
  {
    name: 'a GRANT that cannot be written rolls back the WHOLE sale: no invoice without its credit',
    run: async (run) => {
      const inv = uid('e0000000'),
        line = uid('e1000000')
      await assert.rejects(
        // an entry type the ledger forbids - the grant insert fails inside the function
        call(run, inv, line, [grantRow(inv, line, { entry_type: 'GRANT', quantity: null })]),
      )
      assert.equal(await count(run, 'FROM public.invoices WHERE id = $1', [inv]), 0)
      assert.equal(await count(run, 'FROM public.invoice_items WHERE invoice_id = $1', [inv]), 0)
      assert.equal(
        await count(run, 'FROM public.package_credit_ledger WHERE source_document_id = $1', [inv]),
        0,
      )
    },
  },
  {
    name: 'a grant naming ANOTHER workspace or document is refused before anything is written',
    run: async (run) => {
      const inv = uid('e0000000'),
        line = uid('e1000000')
      await assert.rejects(
        call(run, inv, line, [
          grantRow(inv, line, { workspace_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
        ]),
        /another workspace or document/,
      )
      await assert.rejects(
        call(run, inv, line, [grantRow(uid('e9000000'), line)]),
        /another workspace or document/,
      )
      assert.equal(await count(run, 'FROM public.invoices WHERE id = $1', [inv]), 0)
    },
  },
  {
    name: 'a sale WITHOUT a package still works through the 10-argument function (both overloads coexist, nothing ambiguous)',
    run: async (run) => {
      const inv = uid('e0000000'),
        line = uid('e1000000')
      await call(run, inv, line, null)
      assert.equal(await count(run, 'FROM public.invoices WHERE id = $1', [inv]), 1)
      assert.equal(
        await count(run, 'FROM public.package_credit_ledger WHERE source_document_id = $1', [inv]),
        0,
      )
    },
  },
  {
    name: 'a retry of the SAME sale grants once (the same invoice id cannot be written twice)',
    run: async (run) => {
      const inv = uid('e0000000'),
        line = uid('e1000000')
      const grants = [grantRow(inv, line)]
      await call(run, inv, line, grants)
      await assert.rejects(call(run, inv, line, [grantRow(inv, line)]))
      assert.equal(
        await count(
          run,
          "FROM public.package_credit_ledger WHERE source_document_id = $1 AND entry_type = 'GRANT'",
          [inv],
        ),
        1,
      )
    },
  },
  {
    name: 're-running the OLDER migration AFTER the new one keeps the 11-argument function and the grant path',
    run: async (run) => {
      await run(doc('invoice-write-document-migration.sql'))
      const fn = await run(
        `SELECT to_regprocedure('public.invoice_write_document(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, boolean, jsonb, bigint, jsonb)') IS NOT NULL AS ok`,
      )
      assert.equal(fn[0]!.ok, true)
      const inv = uid('e0000000'),
        line = uid('e1000000')
      await call(run, inv, line, [grantRow(inv, line)])
      assert.equal(
        await count(
          run,
          "FROM public.package_credit_ledger WHERE source_document_id = $1 AND entry_type = 'GRANT'",
          [inv],
        ),
        1,
      )
    },
  },
]
