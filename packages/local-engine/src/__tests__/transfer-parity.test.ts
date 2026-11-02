// ============================================
// A stock transfer on the device — what the server's `warehouse_transfer_stock_keyed` does that the device did not.
//
//   · the cost layer that arrives keeps the SOURCE layer's currency (it was written as 'AFN' whatever the layer held)
//   · the same movement id with a different warehouse pair is a payload mismatch, not a silent «replayed»
//     (the server compares product, quantity, from and to; the device compared only the first two)
//   · which layers a transfer draws is the SHARED FIFO plan (`planConsumption`), not a loop of its own
// ============================================

import { planConsumption, type CostLayer } from '@hisabche/validation'
import { beforeEach, describe, expect, it } from 'vitest'
import type { LocalDb } from '../db'
import { createTestDb, createTestEngine, TEST_WORKSPACE_ID } from './test-db'

const FROM = '11111111-2222-3333-4444-555555555551'
const TO = '11111111-2222-3333-4444-555555555552'
const OTHER = '11111111-2222-3333-4444-555555555553'
const PRODUCT = '99999999-8888-7777-6666-555555555555'
const MOVEMENT = '99999999-8888-7777-6666-5555555555aa'

let db: LocalDb
let engine: ReturnType<typeof createTestEngine>

function seed(
  layers: Array<{
    id: string
    qty: number
    cost: number
    currency: string
    entry: string
    created: string
  }>,
) {
  for (const [id, name] of [
    [FROM, 'مرکز'],
    [TO, 'شعبه'],
    [OTHER, 'سوم'],
  ] as const) {
    db.run(
      `INSERT INTO warehouse (id, workspace_id, name, location, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, '2026-10-01', '2026-10-01')`,
      [id, TEST_WORKSPACE_ID, name, name],
    )
  }
  const total = layers.reduce((sum, layer) => sum + layer.qty, 0)
  db.run(
    `INSERT INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, created_at, updated_at)
     VALUES (?, ?, 'کالا', 100, 150, ?, 1, '2026-10-01', '2026-10-01')`,
    [PRODUCT, TEST_WORKSPACE_ID, total],
  )
  db.run(
    `INSERT INTO product_stock (id, workspace_id, product_id, warehouse_id, qty, created_at, updated_at)
     VALUES ('stock-1', ?, ?, ?, ?, '2026-10-01', '2026-10-01')`,
    [TEST_WORKSPACE_ID, PRODUCT, FROM, total],
  )
  for (const layer of layers) {
    db.run(
      `INSERT INTO cost_layer (id, workspace_id, product_id, warehouse_id, source_type, source_id, source_line,
         received_qty, remaining_qty, unit_cost, currency, entry_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'invoice', ?, '1', ?, ?, ?, ?, ?, ?, ?)`,
      [
        layer.id,
        TEST_WORKSPACE_ID,
        PRODUCT,
        FROM,
        `inv-${layer.id}`,
        layer.qty,
        layer.qty,
        layer.cost,
        layer.currency,
        layer.entry,
        layer.created,
        layer.created,
      ],
    )
  }
}

const transfer = (quantity: number, to = TO, id = MOVEMENT) =>
  engine.request<{ code?: string; replayed?: boolean }>({
    method: 'POST',
    path: '/stock-transfers',
    body: { id, productId: PRODUCT, fromWarehouseId: FROM, toWarehouseId: to, quantity },
  })

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe('cost layers that travel', () => {
  it("keep the source layer's currency", async () => {
    seed([
      {
        id: 'l1',
        qty: 10,
        cost: 1.5,
        currency: 'USD',
        entry: '2026-10-01',
        created: '2026-10-01T10:00:00Z',
      },
    ])
    expect((await transfer(4)).status).toBe(201)
    const arrived = db.all<{ currency: string }>(
      'SELECT currency FROM cost_layer WHERE warehouse_id = ?',
      [TO],
    )
    expect(arrived).toEqual([{ currency: 'USD' }])
  })

  it('are drawn exactly as the shared FIFO plan says', async () => {
    const layers = [
      {
        id: 'b',
        qty: 5,
        cost: 12,
        currency: 'AFN',
        entry: '2026-10-02',
        created: '2026-10-02T09:00:00Z',
      },
      {
        id: 'a',
        qty: 3,
        cost: 10,
        currency: 'AFN',
        entry: '2026-10-01',
        created: '2026-10-01T09:00:00Z',
      },
      {
        id: 'c',
        qty: 4,
        cost: 11,
        currency: 'AFN',
        entry: '2026-10-02',
        created: '2026-10-02T09:30:00Z',
      },
    ]
    seed(layers)
    const plan = planConsumption(
      layers.map((layer): CostLayer => ({
        id: layer.id,
        productId: PRODUCT,
        warehouseId: FROM,
        remainingQty: layer.qty,
        unitCost: layer.cost,
        entryDate: layer.entry,
        createdAt: layer.created,
      })),
      9,
      { method: 'fifo' },
    )
    expect((await transfer(9)).status).toBe(201)
    const arrived = db.all<{ received_qty: number; unit_cost: number }>(
      'SELECT received_qty, unit_cost FROM cost_layer WHERE warehouse_id = ? ORDER BY unit_cost',
      [TO],
    )
    expect(arrived.map((row) => [row.unit_cost, row.received_qty])).toEqual(
      plan.steps.map((step) => [step.unitCost, step.quantity]).sort((x, y) => x[0]! - y[0]!),
    )
    expect(plan.shortfall).toBe(0)
  })
})

describe('the same movement id', () => {
  it('twice with the same transfer is one movement', async () => {
    seed([
      {
        id: 'l1',
        qty: 10,
        cost: 1,
        currency: 'AFN',
        entry: '2026-10-01',
        created: '2026-10-01T10:00:00Z',
      },
    ])
    expect((await transfer(4)).status).toBe(201)
    const again = await transfer(4)
    expect(again.data.replayed).toBe(true)
    expect(
      db.all<{ n: number }>(
        "SELECT COUNT(*) AS n FROM inventory_movement WHERE type = 'transfer'",
      )[0]!.n,
    ).toBe(1)
    expect(
      db.all<{ qty: number }>('SELECT qty FROM product_stock WHERE warehouse_id = ?', [FROM])[0]!
        .qty,
    ).toBe(6)
  })

  it('with another destination is a payload mismatch and moves nothing more', async () => {
    seed([
      {
        id: 'l1',
        qty: 10,
        cost: 1,
        currency: 'AFN',
        entry: '2026-10-01',
        created: '2026-10-01T10:00:00Z',
      },
    ])
    expect((await transfer(4)).status).toBe(201)
    const other = await transfer(4, OTHER)
    expect(other.status).toBe(409)
    expect(other.data.code).toBe('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH')
    expect(
      db.all<{ qty: number }>('SELECT qty FROM product_stock WHERE warehouse_id = ?', [FROM])[0]!
        .qty,
    ).toBe(6)
  })
})
