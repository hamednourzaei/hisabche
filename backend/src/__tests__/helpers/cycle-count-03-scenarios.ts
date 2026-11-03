// ============================================
// The cycle-count-03 scenarios, written once against the tiny SQL runner (scripts/pg/run-scenarios.mjs).
//
// They apply the REAL migrations (cycle-count-02, then cycle-count-03, twice) and the REAL
// accounting_post_journal_entry (sliced out of docs/accounting-core-migration.sql) on tables with the real columns
// they use, and prove: a count that moved value posts its balanced entry on TWO separate accounts in the same
// transaction as the stock; a clean count posts nothing; a locked period / invalid account / unbalanced entry
// rolls EVERYTHING back (count still open, no movement, no entry); a count waiting for its accounts can be
// finished; the role check knows the two new roles and still refuses a made-up one.
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

const DOCS = process.env.CYCLE03_DOCS ?? join(__dirname, '..', '..', '..', '..', 'docs')
const doc = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_WS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const WAREHOUSE = '30000000-0000-4000-8000-000000000001'
const USER = '11111111-1111-4111-8111-111111111111'
const P1 = '20000000-0000-4000-8000-000000000001'
const P2 = '20000000-0000-4000-8000-000000000002'

/** The real posting function, cut out of the accounting-core migration. */
function postingFunction(): string {
  const text = doc('accounting-core-migration.sql')
  const start = text.indexOf('CREATE OR REPLACE FUNCTION accounting_post_journal_entry(')
  if (start < 0) throw new Error('accounting_post_journal_entry not found')
  const endMarker = '$fn$;'
  const end = text.indexOf(endMarker, text.indexOf('AS $fn$', start))
  if (end < 0) throw new Error('end of accounting_post_journal_entry not found')
  return text.slice(start, end + endMarker.length)
}

export async function setupCycleCount03(run: Run): Promise<void> {
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await run(
      `DO $r$ BEGIN CREATE ROLE ${role} NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $r$`,
    )
  }
  await run(`CREATE TABLE IF NOT EXISTS public.accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    role text,
    is_group boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    deleted_at timestamptz
  )`)
  await run(`CREATE TABLE IF NOT EXISTS public.accounting_period_locks (
    workspace_id uuid PRIMARY KEY,
    locked_until date
  )`)
  await run(`CREATE TABLE IF NOT EXISTS public.journal_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    user_id uuid,
    date date NOT NULL,
    description text,
    reference text,
    status text,
    entry_number text,
    source_type text,
    source_id uuid,
    reversal_of uuid,
    posted_at timestamptz,
    posted_by uuid,
    UNIQUE (workspace_id, entry_number)
  )`)
  await run(`CREATE TABLE IF NOT EXISTS public.journal_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id uuid NOT NULL REFERENCES public.journal_entries (id),
    workspace_id uuid NOT NULL,
    user_id uuid,
    account_id uuid NOT NULL,
    debit numeric(18, 2) NOT NULL DEFAULT 0,
    credit numeric(18, 2) NOT NULL DEFAULT 0
  )`)
  await run(postingFunction())

  await run(`CREATE TABLE IF NOT EXISTS public.cycle_counts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    completed_by uuid,
    completed_at timestamptz,
    shortage_value numeric(18, 4),
    surplus_value numeric(18, 4),
    net_loss numeric(18, 4),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT cycle_counts_status_check CHECK (status IN ('draft', 'counting', 'completed', 'cancelled'))
  )`)
  await run(`CREATE TABLE IF NOT EXISTS public.cycle_count_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    count_id uuid NOT NULL REFERENCES public.cycle_counts (id) ON DELETE CASCADE,
    product_id uuid NOT NULL,
    expected_qty numeric(18, 4) NOT NULL,
    counted_qty numeric(18, 4),
    variance_qty numeric(18, 4),
    variance_value numeric(18, 4),
    CONSTRAINT cycle_count_lines_unique UNIQUE (count_id, product_id)
  )`)
  await run(`CREATE TABLE IF NOT EXISTS public.stock_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    product_id uuid NOT NULL,
    type text NOT NULL,
    quantity numeric NOT NULL,
    reference_type text,
    reference_id uuid,
    to_warehouse_id uuid,
    user_id uuid,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`)

  const m02 = doc('cycle-count-02-migration.sql')
  const m03 = doc('cycle-count-03-migration.sql')
  await run(m02)
  await run(m03)
  await run(m03) // idempotent
}

async function reset(run: Run): Promise<void> {
  await run('TRUNCATE public.journal_lines, public.journal_entries CASCADE')
  await run('TRUNCATE public.stock_movements')
  await run('TRUNCATE public.cycle_count_lines, public.cycle_counts CASCADE')
  await run('TRUNCATE public.accounts')
  await run('TRUNCATE public.accounting_period_locks')
}

interface Accounts {
  inventory: string
  shrinkage: string
  gain: string
}

async function accounts(run: Run, workspaceId = WS): Promise<Accounts> {
  const make = async (code: string, type: string, role: string) =>
    (
      await run(
        'INSERT INTO public.accounts (workspace_id, code, name, type, role) VALUES ($1, $2, $2, $3, $4) RETURNING id',
        [workspaceId, code, type, role],
      )
    )[0]!.id as string
  return {
    inventory: await make('1000', 'asset', 'inventory'),
    shrinkage: await make('5210', 'expense', 'inventory_shrinkage'),
    gain: await make('4910', 'revenue', 'inventory_gain'),
  }
}

async function openCount(
  run: Run,
  status: 'counting' | 'pending_accounts' = 'counting',
  workspaceId = WS,
): Promise<string> {
  const id = (
    await run(
      'INSERT INTO public.cycle_counts (workspace_id, warehouse_id, status) VALUES ($1, $2, $3) RETURNING id',
      [workspaceId, WAREHOUSE, status],
    )
  )[0]!.id as string
  for (const product of [P1, P2]) {
    await run(
      'INSERT INTO public.cycle_count_lines (workspace_id, count_id, product_id, expected_qty, counted_qty) VALUES ($1, $2, $3, 10, 10)',
      [workspaceId, id, product],
    )
  }
  return id
}

const LINES = [
  { product_id: P1, variance_qty: -3, variance_value: 30 },
  { product_id: P2, variance_qty: 1, variance_value: 10 },
]

async function finish(
  run: Run,
  countId: string,
  journal: ReadonlyArray<{ account_id: string; debit: number; credit: number }> | null,
  lines: ReadonlyArray<{
    product_id: string
    variance_qty: number
    variance_value: number
  }> = LINES,
  workspaceId = WS,
  date = '2026-11-03',
): Promise<string> {
  const rows = await run(
    'SELECT public.cycle_count_finish($1, $2, $3, $4::jsonb, $5, $6, $7, $8::date, $9::jsonb) AS r',
    [
      workspaceId,
      countId,
      USER,
      JSON.stringify(lines),
      30,
      10,
      20,
      date,
      journal === null ? null : JSON.stringify(journal),
    ],
  )
  return String(rows[0]!.r)
}

const balancedLines = (a: Accounts) => [
  { account_id: a.shrinkage, debit: 30, credit: 0 },
  { account_id: a.inventory, debit: 0, credit: 30 },
  { account_id: a.inventory, debit: 10, credit: 0 },
  { account_id: a.gain, debit: 0, credit: 10 },
]

const count = async (run: Run, table: string) =>
  Number((await run(`SELECT count(*)::int AS n FROM public.${table}`))[0]!.n)

export const scenarios: Scenario[] = [
  {
    name: 'a count that moved value posts ONE balanced entry on two separate accounts, in the same transaction as the stock',
    run: async (run) => {
      await reset(run)
      const a = await accounts(run)
      const id = await openCount(run)
      assert.equal(await finish(run, id, balancedLines(a)), 'completed')

      const lines = await run(
        `SELECT a.role, jl.debit::float AS d, jl.credit::float AS c
           FROM public.journal_lines jl JOIN public.accounts a ON a.id = jl.account_id
          ORDER BY a.role, jl.debit DESC`,
      )
      assert.deepEqual(
        lines.map((l) => [l.role, l.d, l.c]),
        [
          ['inventory', 10, 0],
          ['inventory', 0, 30],
          ['inventory_gain', 0, 10],
          ['inventory_shrinkage', 30, 0],
        ],
      )
      const entry = (
        await run(
          "SELECT entry_number, source_type, source_id FROM public.journal_entries WHERE source_type = 'cycle_count'",
        )
      )[0]!
      assert.equal(entry.source_id, id)
      assert.match(String(entry.entry_number), /^JV-2026-000001$/)

      const row = (
        await run('SELECT status, journal_entry_id FROM public.cycle_counts WHERE id = $1', [id])
      )[0]!
      assert.equal(row.status, 'completed')
      assert.ok(row.journal_entry_id, 'the count points at the entry it posted')

      const movements = await run(
        "SELECT quantity::float AS q, to_warehouse_id FROM public.stock_movements WHERE reference_type = 'cycle_count' ORDER BY quantity",
      )
      assert.deepEqual(
        movements.map((m) => [m.q, m.to_warehouse_id]),
        [
          [-3, WAREHOUSE],
          [1, WAREHOUSE],
        ],
      )
    },
  },
  {
    name: 'a second finish is refused and posts and moves nothing more',
    run: async (run) => {
      await reset(run)
      const a = await accounts(run)
      const id = await openCount(run)
      assert.equal(await finish(run, id, balancedLines(a)), 'completed')
      assert.equal(await finish(run, id, balancedLines(a)), 'not_open')
      assert.equal(await count(run, 'journal_entries'), 1)
      assert.equal(await count(run, 'stock_movements'), 2)
    },
  },
  {
    name: 'a clean count (no value moved) completes and posts nothing',
    run: async (run) => {
      await reset(run)
      const id = await openCount(run)
      assert.equal(
        await finish(run, id, null, [
          { product_id: P1, variance_qty: 0, variance_value: 0 },
          { product_id: P2, variance_qty: 0, variance_value: 0 },
        ]),
        'completed',
      )
      assert.equal(await count(run, 'journal_entries'), 0)
      assert.equal(await count(run, 'stock_movements'), 0)
    },
  },
  {
    name: 'a LOCKED period rolls everything back: no movement, no entry, the count is still open',
    run: async (run) => {
      await reset(run)
      const a = await accounts(run)
      const id = await openCount(run)
      await run(
        'INSERT INTO public.accounting_period_locks (workspace_id, locked_until) VALUES ($1, $2)',
        [WS, '2026-12-31'],
      )
      await assert.rejects(finish(run, id, balancedLines(a)), /ACCOUNTING_PERIOD_LOCKED/)
      assert.equal(await count(run, 'stock_movements'), 0, 'the stock did not move')
      assert.equal(await count(run, 'journal_entries'), 0)
      const row = (await run('SELECT status FROM public.cycle_counts WHERE id = $1', [id]))[0]!
      assert.equal(row.status, 'counting')
    },
  },
  {
    name: "an account that is not this business's rolls everything back",
    run: async (run) => {
      await reset(run)
      const a = await accounts(run)
      const foreign = await accounts(run, OTHER_WS)
      const id = await openCount(run)
      await assert.rejects(
        finish(run, id, [
          { account_id: foreign.shrinkage, debit: 30, credit: 0 },
          { account_id: a.inventory, debit: 0, credit: 30 },
        ]),
        /JOURNAL_LINE_ACCOUNT_INVALID/,
      )
      assert.equal(await count(run, 'stock_movements'), 0)
      assert.equal(await count(run, 'journal_entries'), 0)
    },
  },
  {
    name: 'an unbalanced entry rolls everything back',
    run: async (run) => {
      await reset(run)
      const a = await accounts(run)
      const id = await openCount(run)
      await assert.rejects(
        finish(run, id, [
          { account_id: a.shrinkage, debit: 30, credit: 0 },
          { account_id: a.inventory, debit: 0, credit: 29 },
        ]),
        /JOURNAL_ENTRY_UNBALANCED/,
      )
      assert.equal(await count(run, 'stock_movements'), 0)
    },
  },
  {
    name: 'a count waiting for its accounts (pending_accounts) can be finished once they exist',
    run: async (run) => {
      await reset(run)
      const id = await openCount(run, 'pending_accounts')
      const a = await accounts(run)
      assert.equal(await finish(run, id, balancedLines(a)), 'completed')
      assert.equal(await count(run, 'journal_entries'), 1)
    },
  },
  {
    name: "another business's count is 'not_found' and nothing is posted",
    run: async (run) => {
      await reset(run)
      const a = await accounts(run)
      const id = await openCount(run)
      assert.equal(await finish(run, id, balancedLines(a), LINES, OTHER_WS), 'not_found')
      assert.equal(await count(run, 'journal_entries'), 0)
    },
  },
  {
    name: 'two counts get consecutive entry numbers',
    run: async (run) => {
      await reset(run)
      const a = await accounts(run)
      await finish(run, await openCount(run), balancedLines(a))
      await finish(run, await openCount(run), balancedLines(a))
      const numbers = await run(
        'SELECT entry_number FROM public.journal_entries ORDER BY entry_number',
      )
      assert.deepEqual(
        numbers.map((n) => n.entry_number),
        ['JV-2026-000001', 'JV-2026-000002'],
      )
    },
  },
  {
    name: 'the role check knows the two new roles and still refuses a made-up one',
    run: async (run) => {
      await reset(run)
      await accounts(run)
      await assert.rejects(
        run(
          "INSERT INTO public.accounts (workspace_id, code, name, type, role) VALUES ($1, '9999', 'x', 'expense', 'made_up')",
          [WS],
        ),
        /accounts_role_check|check constraint/i,
      )
    },
  },
]
