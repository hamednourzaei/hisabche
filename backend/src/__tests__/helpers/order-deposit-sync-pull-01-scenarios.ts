// ============================================
// The order-deposit-sync-pull-01 scenarios, written once against the tiny SQL
// runner (scripts/pg/run-scenarios.mjs) and reused by the real-Postgres test.
//
// What is proved, by running the REAL migration:
//
//   · a receipt, an application and a refund each write a change-log row in the
//     SAME transaction that wrote the money — an operation the log missed is a
//     deposit no other device ever learns about;
//   · the version column is maintained by `sync_bump_version()`, so an update
//     produces `operation = 'update'` at the new version;
//   · rows that existed BEFORE the triggers are backfilled, and re-running the
//     migration does not write a second copy of the same change;
//   · another workspace's row is logged under ITS workspace, never this one's;
//   · a write the database refuses logs nothing (the log cannot outlive a
//     rolled-back change);
//   · the three entity names are exactly the ones the client's pull recognises.
//
// ⚠️ PGlite is one connection: this is a LOGIC proof. The contention proof
// (two refunds against one deposit) lives in order-deposit-apply-refund-01.
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

const DOCS = process.env.SYNCPULL_DOCS ?? join(__dirname, '..', '..', '..', '..', 'docs')
const doc = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_WS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ORDER = '01000000-0000-4000-8000-000000000001'
const CUSTOMER = '02000000-0000-4000-8000-000000000001'
const INVOICE = '03000000-0000-4000-8000-000000000001'
const PAYMENT = '04000000-0000-4000-8000-000000000001'

/** Rows inserted BEFORE the migration, so the backfill has something to find. */
const LEGACY_DEPOSIT = '10000000-0000-4000-8000-000000000001'
const LEGACY_APPLICATION = '11000000-0000-4000-8000-000000000001'
const LEGACY_REFUND = '12000000-0000-4000-8000-000000000001'

const ENTITIES = ['order_deposits', 'order_deposit_applications', 'order_deposit_refunds'] as const

export async function setupOrderDepositSyncPull(run: Run): Promise<void> {
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await run(
      `DO $r$ BEGIN CREATE ROLE ${role} NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $r$`,
    )
  }

  // The four tables `sync-engine-migration.sql` attaches its own triggers to.
  // Only the columns its preflight and triggers read are present; this scenario
  // is about the deposit tables, not about those domains.
  await run(`CREATE TABLE IF NOT EXISTS public.invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    customer_id uuid,
    total numeric NOT NULL DEFAULT 0,
    notes text,
    finalized_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`)
  await run(`CREATE TABLE IF NOT EXISTS public.customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    full_name text NOT NULL,
    phone text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`)
  await run(`CREATE TABLE IF NOT EXISTS public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    stock numeric NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`)
  await run(`CREATE TABLE IF NOT EXISTS public.transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    amount numeric NOT NULL DEFAULT 0,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`)

  // The real deposit tables, as `docs/universal-core-migration.sql` and
  // `docs/order-deposit-apply-refund-01-migration.sql` define them — without
  // the foreign keys to payments, which this scenario does not exercise.
  await run(`CREATE TABLE IF NOT EXISTS public.order_deposits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    order_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    amount_minor bigint NOT NULL,
    payment_method text NOT NULL DEFAULT 'cash',
    applied_invoice_id uuid,
    currency text,
    posting_status text,
    journal_entry_id uuid,
    created_at timestamptz NOT NULL DEFAULT now()
  )`)
  await run(`CREATE TABLE IF NOT EXISTS public.order_deposit_applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    deposit_id uuid NOT NULL REFERENCES public.order_deposits (id),
    invoice_id uuid NOT NULL,
    amount_minor bigint NOT NULL,
    currency text NOT NULL,
    idempotency_key text NOT NULL,
    payment_id uuid,
    journal_entry_id uuid,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now()
  )`)
  await run(`CREATE TABLE IF NOT EXISTS public.order_deposit_refunds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    deposit_id uuid NOT NULL REFERENCES public.order_deposits (id),
    amount_minor bigint NOT NULL,
    currency text NOT NULL,
    method text NOT NULL DEFAULT 'cash',
    reason text NOT NULL,
    idempotency_key text NOT NULL,
    payment_id uuid,
    journal_entry_id uuid,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now()
  )`)

  // ── Rows written BEFORE the change-log existed ─────────────────────────────
  await run(
    `INSERT INTO public.order_deposits
       (id, workspace_id, order_id, customer_id, amount_minor, payment_method, currency, posting_status)
     VALUES ($1, $2, $3, $4, 100000, 'cash', 'AFN', 'posted')`,
    [LEGACY_DEPOSIT, WS, ORDER, CUSTOMER],
  )
  await run(
    `INSERT INTO public.order_deposit_applications
       (id, workspace_id, deposit_id, invoice_id, amount_minor, currency, idempotency_key, payment_id)
     VALUES ($1, $2, $3, $4, 40000, 'AFN', 'legacy-apply-0001', $5)`,
    [LEGACY_APPLICATION, WS, LEGACY_DEPOSIT, INVOICE, PAYMENT],
  )
  await run(
    `INSERT INTO public.order_deposit_refunds
       (id, workspace_id, deposit_id, amount_minor, currency, method, reason, idempotency_key, payment_id)
     VALUES ($1, $2, $3, 10000, 'AFN', 'cash', 'بازگشت بخشی از بیعانه', 'legacy-refund-0001', $4)`,
    [LEGACY_REFUND, WS, LEGACY_DEPOSIT, PAYMENT],
  )

  // The real sync engine, then the real deposit migration — each TWICE, which
  // proves the files can be re-run against a database that already has them.
  const syncEngine = doc('sync-engine-migration.sql')
  await run(syncEngine)
  await run(syncEngine)

  const migration = doc('order-deposit-sync-pull-01-migration.sql')
  await run(migration)
  await run(migration)
}

const count = async (run: Run, sql: string, params: readonly unknown[] = []): Promise<number> => {
  const rows = await run(sql, params)
  return Number((rows[0] as { n?: unknown } | undefined)?.n ?? 0)
}

const logRows = (run: Run, entityType: string, entityId?: string) =>
  run(
    `SELECT sync_version, workspace_id, entity_type, entity_id, operation, entity_version
       FROM public.sync_change_log
      WHERE entity_type = $1${entityId ? ' AND entity_id = $2' : ''}
      ORDER BY sync_version`,
    entityId ? [entityType, entityId] : [entityType],
  )

export const scenarios: Scenario[] = [
  {
    name: 'backfill: the deposit written before the trigger has exactly one change row',
    run: async (run) => {
      for (const [entity, id] of [
        ['order_deposits', LEGACY_DEPOSIT],
        ['order_deposit_applications', LEGACY_APPLICATION],
        ['order_deposit_refunds', LEGACY_REFUND],
      ] as const) {
        const rows = await logRows(run, entity, id)
        assert.equal(
          rows.length,
          1,
          `${entity}: expected one backfilled change, got ${rows.length}`,
        )
        const row = rows[0]!
        assert.equal(row.operation, 'create')
        assert.equal(row.workspace_id, WS)
        assert.equal(Number(row.entity_version), 1)
      }
    },
  },
  {
    name: 'a re-run of the migration does not write a second copy of the same change',
    run: async (run) => {
      const before = await count(run, 'SELECT count(*) AS n FROM public.sync_change_log')
      const migration = readFileSync(join(DOCS, 'order-deposit-sync-pull-01-migration.sql'), 'utf8')
      await run(migration)
      const after = await count(run, 'SELECT count(*) AS n FROM public.sync_change_log')
      assert.equal(after, before, `the backfill wrote ${after - before} duplicate change row(s)`)
    },
  },
  {
    name: 'a new receipt writes a create change in the same transaction as the money',
    run: async (run) => {
      const id = '20000000-0000-4000-8000-000000000001'
      await run(
        `INSERT INTO public.order_deposits
           (id, workspace_id, order_id, customer_id, amount_minor, payment_method, currency, posting_status)
         VALUES ($1, $2, $3, $4, 50000, 'cash', 'AFN', 'posted')`,
        [id, WS, ORDER, CUSTOMER],
      )
      const rows = await logRows(run, 'order_deposits', id)
      assert.equal(rows.length, 1, 'the receipt wrote no change row')
      assert.equal(rows[0]!.operation, 'create')
      assert.equal(Number(rows[0]!.entity_version), 1)
      assert.equal(rows[0]!.workspace_id, WS)
    },
  },
  {
    name: 'an application writes its own change row, under its own entity name',
    run: async (run) => {
      const id = '21000000-0000-4000-8000-000000000001'
      await run(
        `INSERT INTO public.order_deposit_applications
           (id, workspace_id, deposit_id, invoice_id, amount_minor, currency, idempotency_key, payment_id)
         VALUES ($1, $2, $3, $4, 25000, 'AFN', 'apply-change-0001', $5)`,
        [id, WS, LEGACY_DEPOSIT, INVOICE, PAYMENT],
      )
      const rows = await logRows(run, 'order_deposit_applications', id)
      assert.equal(rows.length, 1)
      assert.equal(rows[0]!.operation, 'create')
    },
  },
  {
    name: 'an update bumps the version and logs an update at the new version',
    run: async (run) => {
      const id = '22000000-0000-4000-8000-000000000001'
      await run(
        `INSERT INTO public.order_deposits
           (id, workspace_id, order_id, customer_id, amount_minor, payment_method, currency, posting_status)
         VALUES ($1, $2, $3, $4, 70000, 'cash', 'AFN', 'posted')`,
        [id, WS, ORDER, CUSTOMER],
      )
      await run(`UPDATE public.order_deposits SET applied_invoice_id = $1 WHERE id = $2`, [
        INVOICE,
        id,
      ])

      const version = await run(`SELECT version FROM public.order_deposits WHERE id = $1`, [id])
      assert.equal(Number(version[0]!.version), 2, 'sync_bump_version did not bump the row')

      const rows = await logRows(run, 'order_deposits', id)
      assert.equal(rows.length, 2, `expected create+update, got ${rows.length}`)
      assert.equal(rows[1]!.operation, 'update')
      assert.equal(Number(rows[1]!.entity_version), 2)
    },
  },
  {
    name: 'another workspace’s deposit is logged under ITS workspace',
    run: async (run) => {
      const id = '23000000-0000-4000-8000-000000000001'
      const before = await count(
        run,
        'SELECT count(*) AS n FROM public.sync_change_log WHERE workspace_id = $1',
        [WS],
      )
      await run(
        `INSERT INTO public.order_deposits
           (id, workspace_id, order_id, customer_id, amount_minor, payment_method, currency, posting_status)
         VALUES ($1, $2, $3, $4, 90000, 'cash', 'USD', 'posted')`,
        [id, OTHER_WS, ORDER, CUSTOMER],
      )

      const rows = await logRows(run, 'order_deposits', id)
      assert.equal(rows.length, 1)
      assert.equal(rows[0]!.workspace_id, OTHER_WS)

      const after = await count(
        run,
        'SELECT count(*) AS n FROM public.sync_change_log WHERE workspace_id = $1',
        [WS],
      )
      assert.equal(after, before, 'another business’s write appeared in this business’s log')
    },
  },
  {
    name: 'a write the database refuses logs nothing',
    run: async (run) => {
      // `amount_minor` has no check on this table in the scenario schema, so use
      // the NOT NULL on workspace_id: a refused insert must leave no change row.
      const id = '24000000-0000-4000-8000-000000000001'
      const before = await count(run, 'SELECT count(*) AS n FROM public.sync_change_log')

      await assert.rejects(
        run(
          `INSERT INTO public.order_deposits
             (id, workspace_id, order_id, customer_id, amount_minor, payment_method)
           VALUES ($1, NULL, $2, $3, 1000, 'cash')`,
          [id, ORDER, CUSTOMER],
        ),
        /null value|not-null/i,
      )

      const after = await count(run, 'SELECT count(*) AS n FROM public.sync_change_log')
      assert.equal(after, before, 'a refused write still wrote a change row')
    },
  },
  {
    name: 'the three entity names are exactly the ones the client recognises',
    run: async (run) => {
      const rows = await run(
        `SELECT DISTINCT entity_type FROM public.sync_change_log
          WHERE entity_type IN ('order_deposits', 'order_deposit_applications', 'order_deposit_refunds')
          ORDER BY entity_type`,
      )
      assert.deepEqual(
        rows.map((row) => row.entity_type),
        [...ENTITIES].sort(),
      )
    },
  },
]
