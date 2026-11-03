// ============================================
// The cycle-count-02 scenarios, written once against the tiny SQL runner (scripts/pg/run-scenarios.mjs).
//
// They apply the REAL migration twice on tables with the real columns the index and the function use, and prove:
//   · the unique index — a count adjusts a product once; another count / product / business is unaffected; movements of other
//     kinds are untouched; a table that ALREADY holds a duplicate makes the migration stop and change nothing;
//   · cycle_count_complete — ONE transaction writes the movements (with the counted warehouse), freezes the figures and closes
//     the count; a second completion is refused; a failure half way rolls everything back; movements an older non-atomic
//     completion already wrote are not duplicated; another business's count is not found.
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

const DOCS = process.env.CYCLE02_DOCS ?? join(__dirname, '..', '..', '..', '..', 'docs')
const doc = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_WS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const WAREHOUSE = '30000000-0000-4000-8000-000000000001'
const COUNT_A = 'c1000000-0000-4000-8000-00000000000a'
const COUNT_B = 'c1000000-0000-4000-8000-00000000000b'
const P1 = '20000000-0000-4000-8000-000000000001'
const P2 = '20000000-0000-4000-8000-000000000002'
const USER = '11111111-1111-4111-8111-111111111111'

const INDEX = 'stock_movements_cycle_count_once_idx'

export async function setupCycleCount02(run: Run): Promise<void> {
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await run(
      `DO $r$ BEGIN CREATE ROLE ${role} NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $r$`,
    )
  }
  // The columns of the real tables (docs/phase-l-03-cycle-counts-migration.sql) the function touches.
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
  const migration = doc('cycle-count-02-migration.sql')
  await run(migration)
  await run(migration) // idempotent
}

const movement = (
  run: Run,
  workspaceId: string,
  productId: string,
  referenceType: string,
  referenceId: string,
  quantity = -1,
) =>
  run(
    `INSERT INTO public.stock_movements (workspace_id, product_id, type, quantity, reference_type, reference_id, to_warehouse_id)
     VALUES ($1, $2, 'adjustment', $3, $4, $5, $6)`,
    [workspaceId, productId, quantity, referenceType, referenceId, WAREHOUSE],
  )

const count = async (run: Run) =>
  Number((await run('SELECT count(*)::int AS n FROM public.stock_movements'))[0]!.n)

async function reset(run: Run): Promise<void> {
  await run('TRUNCATE public.stock_movements')
  await run('TRUNCATE public.cycle_count_lines, public.cycle_counts CASCADE')
}

/** A count in the 'counting' state; each line is [productId, expectedQty, countedQty]. */
async function openCount(
  run: Run,
  lines: ReadonlyArray<readonly [string, number, number]>,
): Promise<string> {
  const id = (
    await run(
      "INSERT INTO public.cycle_counts (workspace_id, warehouse_id, status) VALUES ($1, $2, 'counting') RETURNING id",
      [WS, WAREHOUSE],
    )
  )[0]!.id as string
  for (const [product, expected, counted] of lines) {
    await run(
      'INSERT INTO public.cycle_count_lines (workspace_id, count_id, product_id, expected_qty, counted_qty) VALUES ($1, $2, $3, $4, $5)',
      [WS, id, product, expected, counted],
    )
  }
  return id
}

async function complete(
  run: Run,
  countId: string,
  lines: ReadonlyArray<{ product_id: string; variance_qty: number; variance_value: number }>,
): Promise<string> {
  const net = lines.reduce(
    (sum, l) => sum + (l.variance_qty < 0 ? l.variance_value : -l.variance_value),
    0,
  )
  const rows = await run(
    'SELECT public.cycle_count_complete($1, $2, $3, $4::jsonb, $5, $6, $7) AS r',
    [WS, countId, USER, JSON.stringify(lines), Math.max(net, 0), Math.max(-net, 0), net],
  )
  return String(rows[0]!.r)
}

const cycleMovements = async (run: Run) =>
  Number(
    (
      await run(
        "SELECT count(*)::int AS n FROM public.stock_movements WHERE reference_type = 'cycle_count'",
      )
    )[0]!.n,
  )

export const scenarios: Scenario[] = [
  {
    name: 'a count adjusts a product once; a second write for the same count and product is refused',
    run: async (run) => {
      await run('TRUNCATE public.stock_movements')
      await movement(run, WS, P1, 'cycle_count', COUNT_A)
      await assert.rejects(
        movement(run, WS, P1, 'cycle_count', COUNT_A),
        /duplicate key|23505|unique/i,
      )
      assert.equal(await count(run), 1)
    },
  },
  {
    name: 'another product in the same count, and the same product in another count, are unaffected',
    run: async (run) => {
      await run('TRUNCATE public.stock_movements')
      await movement(run, WS, P1, 'cycle_count', COUNT_A)
      await movement(run, WS, P2, 'cycle_count', COUNT_A)
      await movement(run, WS, P1, 'cycle_count', COUNT_B)
      assert.equal(await count(run), 3)
    },
  },
  {
    name: 'another business may adjust the same ids (the index is per workspace)',
    run: async (run) => {
      await run('TRUNCATE public.stock_movements')
      await movement(run, WS, P1, 'cycle_count', COUNT_A)
      await movement(run, OTHER_WS, P1, 'cycle_count', COUNT_A)
      assert.equal(await count(run), 2)
    },
  },
  {
    name: 'movements of any other kind are never touched by the index',
    run: async (run) => {
      await run('TRUNCATE public.stock_movements')
      await movement(run, WS, P1, 'invoice', COUNT_A)
      await movement(run, WS, P1, 'invoice', COUNT_A)
      await movement(run, WS, P1, 'product_edit', COUNT_A)
      assert.equal(await count(run), 3)
    },
  },
  {
    name: 'cycle_count_complete: one transaction writes the movements (with the counted warehouse), freezes the figures and closes the count',
    run: async (run) => {
      await reset(run)
      const id = await openCount(run, [
        [P1, 10, 7],
        [P2, 5, 5],
      ])
      const result = await complete(run, id, [
        { product_id: P1, variance_qty: -3, variance_value: 30 },
        { product_id: P2, variance_qty: 0, variance_value: 0 },
      ])
      assert.equal(result, 'completed')

      const movements = await run(
        "SELECT product_id, quantity::float AS q, to_warehouse_id FROM public.stock_movements WHERE reference_type = 'cycle_count' ORDER BY product_id",
      )
      assert.deepEqual(
        movements.map((m) => [m.product_id, m.q, m.to_warehouse_id]),
        [[P1, -3, WAREHOUSE]],
        'only the line with a variance moved stock, and it named the warehouse',
      )
      const row = (
        await run('SELECT status, net_loss::float AS n FROM public.cycle_counts WHERE id = $1', [
          id,
        ])
      )[0]!
      assert.deepEqual([row.status, row.n], ['completed', 30])
      const frozen = await run(
        'SELECT product_id, variance_qty::float AS v FROM public.cycle_count_lines WHERE count_id = $1 ORDER BY product_id',
        [id],
      )
      assert.deepEqual(
        frozen.map((l) => [l.product_id, l.v]),
        [
          [P1, -3],
          [P2, 0],
        ],
      )
    },
  },
  {
    name: 'cycle_count_complete: a second completion is refused and adjusts nothing',
    run: async (run) => {
      await reset(run)
      const id = await openCount(run, [[P1, 10, 7]])
      const lines = [{ product_id: P1, variance_qty: -3, variance_value: 30 }]
      assert.equal(await complete(run, id, lines), 'completed')
      assert.equal(await complete(run, id, lines), 'not_open')
      assert.equal(await cycleMovements(run), 1)
    },
  },
  {
    name: 'cycle_count_complete: a failure half way rolls EVERYTHING back — no movement, count still open',
    run: async (run) => {
      await reset(run)
      const id = await openCount(run, [[P1, 10, 7]])
      await assert.rejects(
        complete(run, id, [
          { product_id: P1, variance_qty: -3, variance_value: 30 },
          { product_id: 'not-a-uuid', variance_qty: -1, variance_value: 1 },
        ]),
        /uuid|invalid input/i,
      )
      assert.equal(await cycleMovements(run), 0, 'the first movement was not left behind')
      const row = (await run('SELECT status FROM public.cycle_counts WHERE id = $1', [id]))[0]!
      assert.equal(row.status, 'counting')
    },
  },
  {
    name: 'cycle_count_complete: movements an older, non-atomic completion already wrote are not duplicated',
    run: async (run) => {
      await reset(run)
      const id = await openCount(run, [
        [P1, 10, 7],
        [P2, 5, 8],
      ])
      await movement(run, WS, P1, 'cycle_count', id, -3) // written by the old path before it crashed
      assert.equal(
        await complete(run, id, [
          { product_id: P1, variance_qty: -3, variance_value: 30 },
          { product_id: P2, variance_qty: 3, variance_value: 9 },
        ]),
        'completed',
      )
      assert.equal(await cycleMovements(run), 2, 'P1 once, P2 once')
    },
  },
  {
    name: "cycle_count_complete: another business's count, and an unknown count, are 'not_found'",
    run: async (run) => {
      await reset(run)
      const id = await openCount(run, [[P1, 10, 7]])
      const line = [{ product_id: P1, variance_qty: -3, variance_value: 30 }]
      const wrong = await run(
        'SELECT public.cycle_count_complete($1, $2, $3, $4::jsonb, 0, 0, 0) AS r',
        [OTHER_WS, id, USER, JSON.stringify(line)],
      )
      assert.equal(wrong[0]!.r, 'not_found')
      assert.equal(await complete(run, '99999999-9999-4999-8999-999999999999', line), 'not_found')
      assert.equal(await cycleMovements(run), 0)
    },
  },
  {
    name: 'a table that already holds a duplicate stops the migration and changes nothing',
    run: async (run) => {
      await run('TRUNCATE public.stock_movements')
      await run(`DROP INDEX IF EXISTS public.${INDEX}`)
      await movement(run, WS, P1, 'cycle_count', COUNT_A)
      await movement(run, WS, P1, 'cycle_count', COUNT_A)

      await assert.rejects(
        run(doc('cycle-count-02-migration.sql')),
        /CYCLE_COUNT_DUPLICATE_MOVEMENTS/,
      )

      assert.equal(await count(run), 2, 'no movement was deleted or rewritten')
      const index = await run(`SELECT 1 FROM pg_indexes WHERE indexname = '${INDEX}'`)
      assert.equal(index.length, 0, 'the index was not created')

      // Cleanup so a re-run starts from the migrated state.
      await run('TRUNCATE public.stock_movements')
      await run(doc('cycle-count-02-migration.sql'))
    },
  },
]
