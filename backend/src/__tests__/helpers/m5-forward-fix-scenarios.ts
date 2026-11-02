// ============================================
// The M5 forward-fix proofs, written once against the tiny SQL runner (scripts/pg/run-scenarios.mjs).
//
// FORWARD_FIX_MODE selects ONE database state per run (the runner owns one database):
//   empty    nothing of M5 exists               -> the probe and the combined VERIFY return rows and never error
//   fresh    the full current chain + forward-fix -> every combined VERIFY check passes
//   old      the full chain, then the two ledger functions put back to their FIRST definition (posted rows only), the shape the owner
//            may have applied -> the probe names them OLD, the bug is demonstrable, the forward-fix repairs it
//   double   the full chain + forward-fix TWICE  -> nothing duplicated, no double accounting, no double recognition
//
// NOT_RECONSTRUCTABLE (and not guessed): the first copy of invoice_write_document (it was not valid SQL and could never be installed)
// and an interval-shaped package_credit_suspensions table (CREATE TABLE IF NOT EXISTS never alters it; the probe reports it as S4).
// ============================================

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  setupDeferredRevenue,
  type Run,
  type Scenario,
} from './package-deferred-revenue-01-scenarios'

const DOCS = process.env.RETURN05_DOCS ?? join(__dirname, '..', '..', '..', '..', 'docs')
const doc = (name: string) => readFileSync(join(DOCS, name), 'utf8')
const MODE = process.env.FORWARD_FIX_MODE ?? 'fresh'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

/** What the invoice write and the scrap trigger need on top of the deferred-revenue stand-in schema. */
const EXTRA_STUBS = `
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total numeric;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS version bigint DEFAULT 1;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS finalized_at timestamptz;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY, invoice_id uuid, workspace_id uuid, product_id uuid, quantity numeric, unit_price numeric, total_price numeric
);
CREATE TABLE IF NOT EXISTS public.invoice_item_details (invoice_item_id uuid, title text);
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid, user_id uuid, product_id uuid, type text, quantity numeric,
  from_warehouse_id uuid, to_warehouse_id uuid, reference_type text, reference_id uuid
);
CREATE TABLE IF NOT EXISTS public.invoice_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL, original_invoice_id uuid NOT NULL, return_type text NOT NULL,
  return_number text NOT NULL, return_date date NOT NULL
);
CREATE TABLE IF NOT EXISTS public.invoice_return_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL, return_id uuid NOT NULL, original_line_id uuid, product_id uuid,
  quantity numeric, restock_choice text
);
CREATE TABLE IF NOT EXISTS public.cost_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid, consumer_type text, consumer_id uuid, product_id uuid, quantity numeric, amount numeric
);
`

const EMPTY_STUBS = `
CREATE SCHEMA IF NOT EXISTS auth;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;
`

/** The first definition of the two ledger sums: posted rows only. Derived from the CURRENT text by undoing exactly the fix. */
function firstDefinitionOf(sql: string): string {
  const old = sql.replace("je.status IN ('posted', 'reversed')", "je.status = 'posted'")
  assert.notEqual(old, sql, 'the fix was not found in the current definition')
  return old
}

const functionBlock = (file: string, name: string): string => {
  const text = doc(file)
  const start = text.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`)
  assert.ok(start >= 0, `${name} not found in ${file}`)
  const tail = text.slice(start)
  const end = tail.search(/^\$(fn)?\$;\s*$/m)
  return tail.slice(0, end) + tail.slice(end).match(/^\$(fn)?\$;/m)![0]
}

export async function setupForwardFix(run: Run): Promise<void> {
  if (MODE === 'empty') {
    await run(EMPTY_STUBS)
    return
  }
  await setupDeferredRevenue(run) // roles, ledger, delivery, deferred revenue, profit totals - all twice
  await run(EXTRA_STUBS)
  await run(doc('invoice-write-document-migration.sql'))
  await run(doc('invoice-write-grant-01-migration.sql'))
  await run(doc('invoice-return-06-scrap-loss-migration.sql'))

  if (MODE === 'old') {
    await run(
      firstDefinitionOf(
        functionBlock(
          'package-deferred-revenue-01-migration.sql',
          'accounting_deferred_revenue_change',
        ),
      ),
    )
    await run(
      firstDefinitionOf(
        functionBlock('profit-ledger-totals-01-migration.sql', 'accounting_profit_ledger_totals'),
      ),
    )
    return
  }
  const fix = doc('m5-forward-fix-01-migration.sql')
  await run(fix)
  if (MODE === 'double') await run(fix)
}

const probe = (run: Run) => run(readFileSync(join(DOCS, 'PROBE-m5-state.sql'), 'utf8'))
const verify = (run: Run) => run(readFileSync(join(DOCS, 'VERIFY-m5-combined.sql'), 'utf8'))
const deferredChange = (run: Run, from: string, to: string) =>
  run(`SELECT public.accounting_deferred_revenue_change($1::uuid, $2::date, $3::date) AS c`, [
    WS,
    from,
    to,
  ]).then((r) => Number(r[0]!.c))

/** A sale credited 100 deferred, then CANCELLED the way the TypeScript reversal does: original -> 'reversed', offsetting entry 'posted'. */
async function cancelledSale(run: Run, date: string): Promise<void> {
  const deferred = (
    await run(
      `SELECT id FROM public.accounts WHERE workspace_id = $1 AND role = 'deferred_revenue' LIMIT 1`,
      [WS],
    )
  )[0]!.id
  const original = (
    await run(
      `INSERT INTO public.journal_entries (workspace_id, date, source_type, source_id, status) VALUES ($1, $2, 'invoice', gen_random_uuid(), 'reversed') RETURNING id`,
      [WS, date],
    )
  )[0]!.id
  await run(`INSERT INTO public.journal_lines VALUES ($1, $2, 0, 100)`, [original, deferred])
  const offset = (
    await run(
      `INSERT INTO public.journal_entries (workspace_id, date, source_type, source_id, status) VALUES ($1, $2, 'reversal', gen_random_uuid(), 'posted') RETURNING id`,
      [WS, date],
    )
  )[0]!.id
  await run(`INSERT INTO public.journal_lines VALUES ($1, $2, 100, 0)`, [offset, deferred])
}

const emptyScenarios: Scenario[] = [
  {
    name: 'EMPTY database: the state probe returns rows and never errors on a missing object',
    run: async (run) => {
      const rows = await probe(run)
      assert.ok(rows.length > 10, 'the probe must return its table')
      assert.ok(
        rows.every((r) => r.exists === false),
        'nothing of M5 exists in an empty database',
      )
    },
  },
  {
    name: 'EMPTY database: the combined VERIFY returns rows (never "No rows returned"), and the checks fail rather than error',
    run: async (run) => {
      const rows = await verify(run)
      assert.equal(rows.length, 27)
      assert.ok(rows.some((r) => r.pass === false))
      assert.ok(
        rows.every(
          (r) =>
            typeof r.check_name === 'string' && 'expected' in r && 'actual' in r && 'pass' in r,
        ),
      )
    },
  },
]

const freshScenarios: Scenario[] = [
  {
    name: 'FRESH chain + forward-fix: every combined VERIFY check passes',
    run: async (run) => {
      const rows = await verify(run)
      const failed = rows
        .filter((r) => r.pass !== true)
        .map((r) => `${r.check_name}: expected ${r.expected}, actual ${r.actual}`)
      assert.deepEqual(failed, [])
      assert.equal(rows.length, 27)
    },
  },
  {
    name: 'FRESH: the probe reads every function at rev2 with an ok fingerprint',
    run: async (run) => {
      const rows = await probe(run)
      const byObject = new Map(rows.map((r) => [r.object as string, r]))
      for (const name of [
        'package_credit_allocate',
        'accounting_deferred_revenue_change',
        'accounting_profit_ledger_totals',
        'invoice_write_document_11',
        'invoice_return_scrap_loss',
      ]) {
        const row = byObject.get(`function ${name}`)!
        assert.equal(row.exists, true, name)
        assert.match(String(row.version_marker), /^m5:.+:rev2$/, name)
      }
      assert.equal(byObject.get('function accounting_deferred_revenue_change')!.fingerprint, 'ok')
      assert.equal(byObject.get('function accounting_profit_ledger_totals')!.fingerprint, 'ok')
    },
  },
  {
    name: 'FRESH: a cancelled sale (reversed original + posted offset) nets to zero in the deferred change',
    run: async (run) => {
      await cancelledSale(run, '2028-01-10')
      assert.equal(await deferredChange(run, '2028-01-01', '2028-01-31'), 0)
    },
  },
]

const oldScenarios: Scenario[] = [
  {
    name: 'OLD definitions: the probe names the two ledger functions OLD and the combined VERIFY fails the fingerprints',
    run: async (run) => {
      const rows = await probe(run)
      const old = rows.filter((r) => String(r.fingerprint).startsWith('OLD')).map((r) => r.object)
      assert.deepEqual(old.sort(), [
        'function accounting_deferred_revenue_change',
        'function accounting_profit_ledger_totals',
      ])
      const failed = (await verify(run)).filter((r) => r.pass !== true).map((r) => r.check_name)
      assert.ok(failed.some((n) => String(n).startsWith('FINGERPRINT deferred change')))
      assert.ok(failed.some((n) => String(n).startsWith('MARKER')))
    },
  },
  {
    name: 'OLD definitions: the bug is real - a cancelled sale is deducted TWICE (-100) until the forward-fix',
    run: async (run) => {
      await cancelledSale(run, '2028-02-10')
      assert.equal(await deferredChange(run, '2028-02-01', '2028-02-28'), -100)
    },
  },
  {
    name: 'OLD -> forward-fix: the same cancelled sale now nets to zero, the fingerprints are ok and every check passes',
    run: async (run) => {
      await run(doc('m5-forward-fix-01-migration.sql'))
      assert.equal(await deferredChange(run, '2028-02-01', '2028-02-28'), 0)
      const failed = (await verify(run))
        .filter((r) => r.pass !== true)
        .map((r) => `${r.check_name}: ${r.actual}`)
      assert.deepEqual(failed, [])
    },
  },
]

const doubleScenarios: Scenario[] = [
  {
    name: 'DOUBLE forward-fix: still exactly one trigger of each kind, markers unchanged, every check passes',
    run: async (run) => {
      const triggers = await run(
        `SELECT tgname, count(*)::int AS n FROM pg_trigger
          WHERE tgname IN ('trg_package_credit_allocate', 'trg_invoice_return_scrap_loss', 'trg_pkg_alloc_immutable', 'trg_pkg_susp_immutable')
            AND NOT tgisinternal GROUP BY tgname ORDER BY tgname`,
      )
      assert.deepEqual(
        triggers.map((t) => [t.tgname, t.n]),
        [
          ['trg_invoice_return_scrap_loss', 1],
          ['trg_package_credit_allocate', 1],
          ['trg_pkg_alloc_immutable', 1],
          ['trg_pkg_susp_immutable', 1],
        ],
      )
      const failed = (await verify(run)).filter((r) => r.pass !== true).map((r) => r.check_name)
      assert.deepEqual(failed, [])
    },
  },
  {
    name: 'DOUBLE forward-fix: a delivery afterwards still allocates ONCE and recognises revenue ONCE (no double accounting)',
    run: async (run) => {
      const customer = (
        await run(`INSERT INTO public.customers VALUES (gen_random_uuid(), $1) RETURNING id`, [WS])
      )[0]!.id
      const invoice = (
        await run(
          `INSERT INTO public.invoices (id, workspace_id, customer_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`,
          [WS, customer],
        )
      )[0]!.id
      await run(
        `INSERT INTO public.journal_entries (workspace_id, date, source_type, source_id) VALUES ($1, '2028-03-01', 'invoice', $2)`,
        [WS, invoice],
      )
      const pkg = '20000000-0000-4000-8000-000000000002'
      await run(
        `INSERT INTO public.package_credit_ledger (workspace_id, customer_id, package_product_id, entry_type, quantity, source_document_type, source_document_id, deferred_amount, effective_date)
         VALUES ($1, $2, $3, 'GRANT', 4, 'invoice', $4, 400, '2028-03-01')`,
        [WS, customer, pkg, invoice],
      )
      const consume = (
        await run(
          `INSERT INTO public.package_credit_ledger (workspace_id, customer_id, package_product_id, entry_type, quantity, effective_date)
         VALUES ($1, $2, $3, 'CONSUME', 1, '2028-03-02') RETURNING id`,
          [WS, customer, pkg],
        )
      )[0]!.id
      const allocations = await run(
        `SELECT count(*)::int AS n, sum(released_amount)::float AS r FROM public.package_credit_allocations WHERE entry_id = $1`,
        [consume],
      )
      assert.deepEqual([allocations[0]!.n, allocations[0]!.r], [1, 100])
      const entries = await run(
        `SELECT count(*)::int AS n FROM public.journal_entries WHERE source_type = 'package_release' AND source_id = $1`,
        [consume],
      )
      assert.equal(entries[0]!.n, 1)
    },
  },
]

export const scenarios: Scenario[] =
  MODE === 'empty'
    ? emptyScenarios
    : MODE === 'old'
      ? oldScenarios
      : MODE === 'double'
        ? doubleScenarios
        : freshScenarios
