// ============================================
// The inventory-void-receipt-01 scenarios, written once against the tiny SQL runner (scripts/pg/run-scenarios.mjs).
//
// They apply the REAL migration twice on a table with the real cost_layers columns and constraint, and prove: an untouched
// receipt is voided (remaining 0, rows kept), a receipt any of whose layers was drawn from is refused WHOLE and nothing changes,
// another business's layers are never touched, a second void is a no-op, and a document with no layers is not an error.
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
const OTHER_WS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER = '11111111-1111-4111-8111-111111111111'
const PRODUCT = '20000000-0000-4000-8000-000000000001'

export async function setupVoidReceipt(run: Run): Promise<void> {
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await run(
      `DO $r$ BEGIN CREATE ROLE ${role} NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $r$`,
    )
  }
  await run(`CREATE TABLE IF NOT EXISTS public.cost_layers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL,
    product_id uuid NOT NULL,
    warehouse_id uuid,
    source_type text NOT NULL,
    source_id uuid,
    source_line text,
    received_qty numeric(18, 4) NOT NULL,
    remaining_qty numeric(18, 4) NOT NULL,
    unit_cost numeric(18, 4) NOT NULL,
    currency text NOT NULL DEFAULT 'AFN',
    entry_date date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    CONSTRAINT cost_layers_qty_check CHECK (received_qty > 0 AND remaining_qty >= 0 AND remaining_qty <= received_qty),
    CONSTRAINT cost_layers_cost_check CHECK (unit_cost >= 0)
  )`)
  const migration = doc('inventory-void-receipt-01-migration.sql')
  await run(migration)
  await run(migration) // idempotent
}

let seq = 0
const uid = () => `c0000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`

async function receipt(run: Run, workspace: string, layers: Array<[number, number]>) {
  const id = uid()
  for (const [index, [received, remaining]] of layers.entries()) {
    await run(
      `INSERT INTO public.cost_layers (workspace_id, product_id, source_type, source_id, source_line, received_qty, remaining_qty, unit_cost, entry_date)
       VALUES ($1, $2, 'invoice', $3, $4, $5, $6, 10, '2026-10-01')`,
      [workspace, PRODUCT, id, `line-${index}`, received, remaining],
    )
  }
  return id
}

const voidIt = (run: Run, workspace: string, id: string) =>
  run(`SELECT public.inventory_void_receipt($1::uuid, $2::uuid, 'invoice', $3::uuid) AS result`, [
    workspace,
    USER,
    id,
  ])

const remaining = async (run: Run, id: string) =>
  (
    await run(
      `SELECT remaining_qty::float AS r FROM public.cost_layers WHERE source_id = $1 ORDER BY source_line`,
      [id],
    )
  ).map((row) => Number(row.r))

export const scenarios: Scenario[] = [
  {
    name: 'an untouched receipt is voided: remaining 0 on every layer, rows kept',
    run: async (run) => {
      const id = await receipt(run, WS, [
        [5, 5],
        [3, 3],
      ])
      const result = (await voidIt(run, WS, id))[0]!.result as { layers: number; quantity: number }
      assert.deepEqual(result, { layers: 2, quantity: 8 })
      assert.deepEqual(await remaining(run, id), [0, 0])
      assert.equal(
        (await run(`SELECT 1 FROM public.cost_layers WHERE source_id = $1`, [id])).length,
        2,
      ) // audit rows stay
    },
  },
  {
    name: 'a receipt with ONE layer already drawn from is refused whole and nothing changes',
    run: async (run) => {
      const id = await receipt(run, WS, [
        [5, 5],
        [3, 2],
      ])
      await assert.rejects(voidIt(run, WS, id), /PURCHASE_LAYER_CONSUMED/)
      assert.deepEqual(await remaining(run, id), [5, 2]) // the untouched layer was NOT zeroed either
    },
  },
  {
    name: 'a fully consumed layer refuses too',
    run: async (run) => {
      const id = await receipt(run, WS, [[4, 0]])
      await assert.rejects(voidIt(run, WS, id), /PURCHASE_LAYER_CONSUMED/)
    },
  },
  {
    name: "another business's layers are never touched",
    run: async (run) => {
      const mine = await receipt(run, WS, [[5, 5]])
      const theirs = await receipt(run, OTHER_WS, [[5, 5]])
      await voidIt(run, WS, theirs) // wrong workspace for that document: finds nothing
      assert.deepEqual(await remaining(run, theirs), [5])
      await voidIt(run, WS, mine)
      assert.deepEqual(await remaining(run, mine), [0])
    },
  },
  {
    name: 'a second void is a no-op and a document with no layers is not an error',
    run: async (run) => {
      const id = await receipt(run, WS, [[2, 2]])
      await voidIt(run, WS, id)
      await voidIt(run, WS, id)
      assert.deepEqual(await remaining(run, id), [0])
      const none = (await voidIt(run, WS, uid()))[0]!.result as { layers: number }
      assert.equal(none.layers, 0)
    },
  },
]
