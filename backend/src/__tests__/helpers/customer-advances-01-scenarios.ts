// ============================================
// The customer-advances-01 scenarios, written once against the tiny SQL runner
// (scripts/pg/run-scenarios.mjs).
//
// They apply the REAL migration TWICE on an accounts table that still carries
// the previous constraint, and prove:
//   · the migration is idempotent — two runs leave ONE check constraint;
//   · the new role `customer_advances` is accepted;
//   · every role the earlier migration allowed is STILL accepted (widening a
//     check must never narrow it by accident);
//   · a role that has never existed is still refused (the check is a check);
//   · rows written before the migration are untouched.
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

const DOCS = process.env.ADVANCES01_DOCS ?? join(__dirname, '..', '..', '..', '..', 'docs')
const doc = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CASH_ID = 'a0000000-0000-4000-8000-000000000001'

/** Every role the migration before this one allowed. */
const PREVIOUS_ROLES = [
  'bank',
  'cash',
  'receivable',
  'payable',
  'tax',
  'inventory',
  'cogs',
  'sales',
  'purchase',
  'retained_earnings',
  'current_year_earnings',
  'salary_expense',
  'fx_gain_loss',
  'owner_capital',
  'bank_fees',
  'deferred_revenue',
  'inventory_loss',
] as const

let nextId = 100
function newId(): string {
  nextId += 1
  return `a0000000-0000-4000-8000-${String(nextId).padStart(12, '0')}`
}

async function insertAccount(run: Run, role: string | null): Promise<void> {
  await run(
    `INSERT INTO public.accounts (id, workspace_id, code, name, type, role)
     VALUES ($1, $2, $3, $4, 'liability', $5)`,
    [newId(), WS, `X${nextId}`, `role ${role ?? 'null'}`, role],
  )
}

export async function setupCustomerAdvances(run: Run): Promise<void> {
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await run(
      `DO $r$ BEGIN CREATE ROLE ${role} NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $r$`,
    )
  }

  // The accounts table as the previous migrations left it: the constraint does
  // NOT know customer_advances yet.
  await run(`CREATE TABLE IF NOT EXISTS public.accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    role text,
    is_active boolean NOT NULL DEFAULT true
  )`)
  await run(`ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_role_check`)
  await run(`ALTER TABLE public.accounts ADD CONSTRAINT accounts_role_check CHECK (
    role IS NULL OR role IN (
      'bank', 'cash', 'receivable', 'payable', 'tax',
      'inventory', 'cogs', 'sales', 'purchase',
      'retained_earnings', 'current_year_earnings',
      'salary_expense', 'fx_gain_loss', 'owner_capital', 'bank_fees',
      'deferred_revenue', 'inventory_loss'
    )
  )`)

  // A row that existed before the migration; it must survive untouched.
  await run(
    `INSERT INTO public.accounts (id, workspace_id, code, name, type, role)
     VALUES ($1, $2, '1010', 'صندوق', 'asset', 'cash')
     ON CONFLICT (id) DO NOTHING`,
    [CASH_ID, WS],
  )

  // The REAL migration, twice.
  await run(doc('customer-advances-01-migration.sql'))
  await run(doc('customer-advances-01-migration.sql'))
}

export const scenarios: Scenario[] = [
  {
    name: 'the migration runs twice and leaves exactly ONE check constraint, validated',
    async run(run) {
      const rows = await run(
        `SELECT count(*)::int AS n, bool_and(c.convalidated) AS validated
           FROM pg_constraint c
           JOIN pg_class t ON t.oid = c.conrelid
          WHERE t.relname = 'accounts' AND c.conname = 'accounts_role_check'`,
      )
      assert.equal(rows[0]?.n, 1)
      assert.equal(rows[0]?.validated, true)
    },
  },
  {
    name: 'the new role customer_advances is accepted',
    async run(run) {
      await insertAccount(run, 'customer_advances')
      const rows = await run(
        `SELECT count(*)::int AS n FROM public.accounts WHERE role = 'customer_advances'`,
      )
      assert.equal(rows[0]?.n, 1)
    },
  },
  {
    name: 'every role the earlier migration allowed is STILL accepted',
    async run(run) {
      for (const role of PREVIOUS_ROLES) await insertAccount(run, role)
      const rows = await run(
        `SELECT count(*)::int AS n FROM public.accounts
          WHERE role = ANY($1::text[]) AND id <> $2`,
        [PREVIOUS_ROLES, CASH_ID],
      )
      assert.equal(rows[0]?.n, PREVIOUS_ROLES.length)
    },
  },
  {
    name: 'a role that has never existed is still refused',
    async run(run) {
      await assert.rejects(
        () => insertAccount(run, 'revenue'),
        (err: Error) => String(err.message).includes('accounts_role_check'),
      )
    },
  },
  {
    name: 'a NULL role is still allowed (an account need not be a standard one)',
    async run(run) {
      await insertAccount(run, null)
      const rows = await run(`SELECT count(*)::int AS n FROM public.accounts WHERE role IS NULL`)
      assert.equal(rows[0]?.n, 1)
    },
  },
  {
    name: 'the row written before the migration is untouched',
    async run(run) {
      const rows = await run(`SELECT code, name, role FROM public.accounts WHERE id = $1`, [
        CASH_ID,
      ])
      assert.equal(rows[0]?.code, '1010')
      assert.equal(rows[0]?.role, 'cash')
    },
  },
]
