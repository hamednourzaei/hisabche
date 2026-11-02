// ============================================
// The invoice-return-06 scenarios (scrap = loss), written once against the tiny SQL runner (scripts/pg/run-scenarios.mjs).
//
// They run the REAL return core (01, 03, 04, 05 via setupReturn05) and then migration 06 (twice), and drive the real
// `invoice_return_create` function with `scrap` lines. They prove the entry the owner asked for - purchase cost to LOSS -
// and that inventory is NOT touched (the sale already took the goods out of it).
// ============================================

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { setupReturn05, type Run, type Scenario, WS } from './invoice-return-05-scenarios'

const DOCS = process.env.RETURN05_DOCS ?? join(__dirname, '..', '..', '..', '..', 'docs')
const doc = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const USER = '11111111-1111-4111-8111-111111111111'
const PRODUCT = '20000000-0000-4000-8000-000000000001'
const WAREHOUSE = '30000000-0000-4000-8000-000000000001'

export async function setupReturn06(run: Run): Promise<void> {
  await setupReturn05(run)
  await run(`INSERT INTO public.accounts (workspace_id, role) VALUES ($1, 'inventory_loss')`, [WS])
  const migration = doc('invoice-return-06-scrap-loss-migration.sql')
  await run(migration)
  await run(migration) // idempotent
}

let seq = 600
const uid = (prefix: string) => `${prefix}-0000-4000-8000-${String(++seq).padStart(12, '0')}`

async function soldInvoice(
  run: Run,
  opts: { cost?: [number, number] | null } = { cost: [5, 300] },
) {
  const id = uid('e6000000')
  const line = uid('e6100000')
  await run(
    `INSERT INTO public.invoices (id, workspace_id, invoice_number, type, total, paid_amount, tax_total, exchange_rate, warehouse_id)
     VALUES ($1, $2, $3, 'sale', 500, 500, 0, 1, $4)`,
    [id, WS, `INV-6${seq}`, WAREHOUSE],
  )
  await run(
    `INSERT INTO public.invoice_items (id, invoice_id, workspace_id, product_id, quantity, unit_price, discount, total)
     VALUES ($1, $2, $3, $4, 5, 100, 0, 500)`,
    [line, id, WS, PRODUCT],
  )
  if (opts.cost) {
    await run(
      `INSERT INTO public.cost_consumptions (workspace_id, product_id, warehouse_id, consumer_type, consumer_id, quantity,
         unit_cost, amount, entry_date) VALUES ($1, $2, $3, 'invoice', $4, $5, $6, $7, '2026-10-01')`,
      [WS, PRODUCT, WAREHOUSE, id, opts.cost[0], opts.cost[1] / opts.cost[0], opts.cost[1]],
    )
  }
  return { id, line }
}

async function returnOf(
  run: Run,
  invoiceId: string,
  lines: Array<{ lineId: string; quantity: number; choice: 'restock' | 'scrap' }>,
  date = '2026-11-01',
) {
  const number = `RET-6${++seq}`
  const rows = await run(
    `SELECT public.invoice_return_create($1::uuid, $2::uuid, 2, $3::jsonb, $4::jsonb, '[]'::jsonb) AS result`,
    [
      WS,
      USER,
      JSON.stringify({
        originalInvoiceId: invoiceId,
        returnType: 'sale_return',
        returnNumber: number,
        returnDate: date,
      }),
      JSON.stringify(
        lines.map((l) => ({
          originalLineId: l.lineId,
          quantity: l.quantity,
          restockChoice: l.choice,
          reasonCode: 'other',
        })),
      ),
    ],
  )
  return rows[0]!.result as Record<string, any>
}

const entriesOf = (run: Run, sourceType: string, sourceId: string) =>
  run(
    `SELECT header, lines FROM public.test_journal WHERE header->>'source_type' = $1 AND header->>'source_id' = $2`,
    [sourceType, sourceId],
  )

async function refuses(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (e: Error) => {
    assert.match(String(e.message), new RegExp(code))
    return true
  })
}

export const scenarios: Scenario[] = [
  {
    name: 'scrap books DEBIT inventory_loss / CREDIT cogs at the cost the sale consumed (2 of 5 units @ 60 = 120)',
    run: async (run) => {
      const inv = await soldInvoice(run)
      const ret = await returnOf(run, inv.id, [{ lineId: inv.line, quantity: 2, choice: 'scrap' }])
      const rows = await entriesOf(run, 'return_scrap_loss', String(ret.id))
      assert.equal(rows.length, 1)
      const accounts = await run(`SELECT id, role FROM public.accounts WHERE workspace_id = $1`, [
        WS,
      ])
      const role = (id: string) => accounts.find((a) => a.id === id)?.role
      const lines = rows[0]!.lines as Array<{ account_id: string; debit: number; credit: number }>
      assert.deepEqual(
        lines.map((l) => [role(l.account_id), Number(l.debit), Number(l.credit)]),
        [
          ['inventory_loss', 120, 0],
          ['cogs', 0, 120],
        ],
      )
    },
  },
  {
    name: 'scrap leaves INVENTORY alone: no stock movement back, no inventory line in any entry of the return',
    run: async (run) => {
      const inv = await soldInvoice(run)
      const ret = await returnOf(run, inv.id, [{ lineId: inv.line, quantity: 2, choice: 'scrap' }])
      const moves = await run(
        `SELECT 1 FROM public.stock_movements WHERE reference_type = 'invoice_return' AND reference_id = $1`,
        [ret.id],
      )
      assert.equal(moves.length, 0, 'a scrapped unit never re-enters the warehouse')
      const accounts = await run(
        `SELECT id FROM public.accounts WHERE workspace_id = $1 AND role = 'inventory'`,
        [WS],
      )
      const inventoryId = accounts[0]!.id
      const all = await run(
        `SELECT lines FROM public.test_journal WHERE header->>'source_id' = $1`,
        [String(ret.id)],
      )
      for (const entry of all) {
        for (const l of entry.lines as Array<{ account_id: string }>)
          assert.notEqual(l.account_id, inventoryId)
      }
    },
  },
  {
    name: 'a restock-only return books no scrap loss (the loss entry exists only for scrap lines)',
    run: async (run) => {
      const inv = await soldInvoice(run)
      const ret = await returnOf(run, inv.id, [
        { lineId: inv.line, quantity: 1, choice: 'restock' },
      ])
      // a second return would be refused (one per invoice); here only the restock part is checked for the old behaviour
      const loss = await entriesOf(run, 'return_scrap_loss', String(ret.id))
      assert.equal(loss.length, 0, 'a restock-only return books no loss')
    },
  },
  {
    name: 'C2: a FOREIGN-currency sale (USD at 65): the scrap loss is the cost in the BOOKS currency (2 x 60 = 120 AFN) - never converted again',
    run: async (run) => {
      const inv = await soldInvoice(run)
      // the sale was made in USD at a frozen rate of 65; cost layers are always in the books currency
      await run(`UPDATE public.invoices SET currency = 'USD', exchange_rate = 65 WHERE id = $1`, [
        inv.id,
      ])
      const ret = await returnOf(run, inv.id, [{ lineId: inv.line, quantity: 2, choice: 'scrap' }])
      const rows = await entriesOf(run, 'return_scrap_loss', String(ret.id))
      assert.equal(rows.length, 1)
      const lines = rows[0]!.lines as Array<{ debit: number; credit: number }>
      assert.deepEqual(
        lines.map((l) => [Number(l.debit), Number(l.credit)]),
        [
          [120, 0],
          [0, 120],
        ],
        'neither 120 / 65 nor 120 x 65: the cost is already in the books currency',
      )
    },
  },
  {
    name: 'unknown cost fails closed: SCRAP_COST_UNKNOWN and the whole return rolls back',
    run: async (run) => {
      const inv = await soldInvoice(run, { cost: null })
      await refuses(
        returnOf(run, inv.id, [{ lineId: inv.line, quantity: 1, choice: 'scrap' }]),
        'SCRAP_COST_UNKNOWN',
      )
      const left = await run(
        `SELECT 1 FROM public.invoice_returns WHERE original_invoice_id = $1`,
        [inv.id],
      )
      assert.equal(left.length, 0)
    },
  },
  {
    name: 'a missing inventory_loss account refuses the return (RETURN_ACCOUNTS_MISSING), nothing is written',
    run: async (run) => {
      const inv = await soldInvoice(run)
      await run(
        `UPDATE public.accounts SET is_active = false WHERE workspace_id = $1 AND role = 'inventory_loss'`,
        [WS],
      )
      try {
        await refuses(
          returnOf(run, inv.id, [{ lineId: inv.line, quantity: 1, choice: 'scrap' }]),
          'RETURN_ACCOUNTS_MISSING',
        )
      } finally {
        await run(
          `UPDATE public.accounts SET is_active = true WHERE workspace_id = $1 AND role = 'inventory_loss'`,
          [WS],
        )
      }
      const left = await run(
        `SELECT 1 FROM public.invoice_returns WHERE original_invoice_id = $1`,
        [inv.id],
      )
      assert.equal(left.length, 0)
    },
  },
]
