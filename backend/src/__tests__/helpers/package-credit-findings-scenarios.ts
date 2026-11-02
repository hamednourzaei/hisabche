// ============================================
// The five blocks of docs/FINDING-package-credit-liability.sql, run on a stand-in schema with data whose answers are known.
//
// A measuring instrument is only worth trusting when it has been shown to find a planted problem and to stay silent about a healthy
// account. Each scenario plants one case and asserts what the block says — including that an UNKNOWN value comes back NULL, not 0.
// ============================================

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  OTHER_WS,
  WS,
  setupServiceDelivery,
  type Run,
  type Scenario,
} from './service-delivery-02-scenarios'

export { setupServiceDelivery as setupFindings }

const DOCS = process.env.RETURN05_DOCS ?? join(__dirname, '..', '..', '..', '..', 'docs')

const blocks = (): Record<string, string> => {
  const text = readFileSync(join(DOCS, 'FINDING-package-credit-liability.sql'), 'utf8')
  const parts = text.split(/^-- ── BLOCK (\d) ──.*$/m)
  const found: Record<string, string> = {}
  for (let i = 1; i < parts.length; i += 2)
    found[parts[i]!] = parts[i + 1]!.replace(/^--.*$/gm, '').trim()
  return found
}

const id = (n: number) => `f0000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const C1 = 'c0000000-0000-4000-8000-000000000001'
const C2 = 'c0000000-0000-4000-8000-000000000002'
const SERVICE = '20000000-0000-4000-8000-000000000001'
const PACKAGE = '20000000-0000-4000-8000-000000000002'

let planted = false
async function plant(run: Run): Promise<void> {
  if (planted) return
  planted = true
  await run(`ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS currency text, ADD COLUMN IF NOT EXISTS status text;
             ALTER TABLE public.products ADD COLUMN IF NOT EXISTS offering_type text;
             CREATE TABLE IF NOT EXISTS public.invoice_items (
               id uuid PRIMARY KEY, invoice_id uuid, workspace_id uuid, product_id uuid, quantity numeric, total_price numeric);
             UPDATE public.products SET offering_type = 'package' WHERE id = '${PACKAGE}';
             UPDATE public.products SET offering_type = 'service' WHERE id = '${SERVICE}';`)
  // C1 bought 10 units for 1000 AFN (invoice I1, line L1) and has a grant for it; C1 also bought 5 for 500 (I2, L2) with NO grant.
  await run(
    `INSERT INTO public.invoices (id, workspace_id, customer_id, currency, status) VALUES
       ('${id(1)}', '${WS}', '${C1}', 'AFN', 'paid'), ('${id(2)}', '${WS}', '${C1}', 'AFN', 'paid'),
       ('${id(9)}', '${WS}', '${C1}', 'AFN', 'cancelled');
     INSERT INTO public.invoice_items (id, invoice_id, workspace_id, product_id, quantity, total_price) VALUES
       ('${id(11)}', '${id(1)}', NULL, '${PACKAGE}', 10, 1000),
       ('${id(12)}', '${id(2)}', '${WS}', '${PACKAGE}', 5, 500),
       ('${id(19)}', '${id(9)}', '${WS}', '${PACKAGE}', 3, 300);
     INSERT INTO public.package_credit_ledger (id, workspace_id, customer_id, package_product_id, entry_type, quantity,
        source_document_type, source_document_id, source_line_id) VALUES
       ('${id(21)}', '${WS}', '${C1}', '${PACKAGE}', 'GRANT', 10, 'invoice', '${id(1)}', '${id(11)}');
     INSERT INTO public.package_credit_ledger (workspace_id, customer_id, package_product_id, entry_type, quantity) VALUES
       ('${WS}', '${C2}', '${PACKAGE}', 'GRANT', 3);`,
  )
  // a session delivered by package credit whose consume is missing, and a cancelled one whose credit was never returned
  await run(
    `INSERT INTO public.service_delivery_sessions (id, workspace_id, customer_id, service_offering_id, session_date,
        start_time, end_time, status, settlement_method, package_credit_id)
       VALUES ('${id(31)}', '${WS}', '${C1}', '${SERVICE}', '2026-11-02', '10:00', '11:00', 'delivered', 'package_credit', '${id(21)}');
     INSERT INTO public.service_delivery_sessions (id, workspace_id, customer_id, service_offering_id, session_date,
        start_time, end_time, status, settlement_method, package_credit_id, cancellation_reason)
       VALUES ('${id(32)}', '${WS}', '${C1}', '${SERVICE}', '2026-11-02', '12:00', '13:00', 'cancelled', 'package_credit', '${id(21)}', 'test');`,
  )
  // a negative account (a consume with no credit behind it, written around the function)
  await run(
    `INSERT INTO public.customers VALUES ('c0000000-0000-4000-8000-000000000003', '${OTHER_WS}') ON CONFLICT DO NOTHING;
     INSERT INTO public.package_credit_ledger (workspace_id, customer_id, package_product_id, entry_type, quantity)
       VALUES ('${OTHER_WS}', 'c0000000-0000-4000-8000-000000000003', '${PACKAGE}', 'CONSUME', 1);`,
  )
}

export const scenarios: Scenario[] = [
  {
    name: 'block 0 says what the database lacks BEFORE the other blocks fail on it (a missing column is a false, not an error)',
    run: async (run) => {
      // the stand-in has no offering_type until `plant` adds it - exactly the situation of a database that skipped offering-type-01
      const before = await run(blocks()['0']!)
      assert.equal(before[0]!.has_products_offering_type, false)
      assert.equal(before[0]!.has_package_credit_ledger, true)
      assert.equal(before[0]!.has_service_delivery_sessions, true)
      await plant(run)
      const after = await run(blocks()['0']!)
      assert.deepEqual(Object.values(after[0]!), [true, true, true, true])
    },
  },
  {
    name: 'block 1 finds the paid package line with no grant - and ignores the cancelled invoice and the line that has one',
    run: async (run) => {
      await plant(run)
      const rows = await run(blocks()['1']!)
      assert.equal(rows.length, 1)
      assert.equal(rows[0]!.workspace_id, WS)
      assert.equal(Number(rows[0]!.package_lines_without_grant), 1)
      assert.equal(Number(rows[0]!.invoices_affected), 1)
    },
  },
  {
    name: 'block 2 reports the units per account and hides empty accounts',
    run: async (run) => {
      await plant(run)
      const rows = await run(blocks()['2']!)
      const c1 = rows.find((r) => r.customer_id === C1)!
      assert.equal(Number(c1.granted), 10)
      assert.equal(Number(c1.balance), 10)
      assert.ok(rows.some((r) => r.customer_id === C2))
    },
  },
  {
    name: 'block 3: the liability is units × the price paid per unit, and UNKNOWN is null - never zero',
    run: async (run) => {
      await plant(run)
      const rows = await run(blocks()['3']!)
      const priced = rows.find((r) => r.currency === 'AFN' && r.workspace_id === WS)!
      assert.equal(Number(priced.units_outstanding), 10)
      assert.equal(Number(priced.liability), 1000) // 10 units × (1000 / 10)
      assert.equal(Number(priced.accounts_with_unknown_value), 0)
      const unknown = rows.find((r) => r.workspace_id === WS && r.currency === null)!
      assert.equal(Number(unknown.units_outstanding), 3)
      assert.equal(
        unknown.liability,
        null,
        'a manual grant has no price: the value is unknown, not 0',
      )
      assert.equal(Number(unknown.accounts_with_unknown_value), 1)
    },
  },
  {
    name: 'block 4 finds a delivered session with no consume and a cancelled one whose credit was never returned',
    run: async (run) => {
      await plant(run)
      const rows = await run(blocks()['4']!)
      const problems = rows.map((r) => `${r.problem}:${r.session_id}`).sort()
      assert.deepEqual(problems, [
        `cancelled_session_credit_not_returned:${id(32)}`,
        `delivered_without_consume:${id(31)}`,
      ])
    },
  },
  {
    name: 'block 5 finds the negative account and only that',
    run: async (run) => {
      await plant(run)
      const rows = await run(blocks()['5']!)
      assert.equal(rows.length, 1)
      assert.equal(rows[0]!.workspace_id, OTHER_WS)
      assert.equal(Number(rows[0]!.balance), -1)
    },
  },
  {
    name: 'the instrument writes nothing: the ledger and the sessions are exactly as planted after all five blocks',
    run: async (run) => {
      await plant(run)
      const count = async () =>
        Number(
          (
            await run(
              'SELECT (SELECT COUNT(*) FROM public.package_credit_ledger) + (SELECT COUNT(*) FROM public.service_delivery_sessions) AS n',
            )
          )[0]!.n,
        )
      const before = await count()
      for (const key of ['1', '2', '3', '4', '5']) await run(blocks()[key]!)
      assert.equal(await count(), before)
    },
  },
]
