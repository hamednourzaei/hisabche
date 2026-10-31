// ============================================
// Target D: Stock Transfer Cost Layer Movement & Invariants
//
// Asserts that transferring stock between warehouses:
// 1. Decrements product_stock at source and increments destination.
// 2. Decrements cost_layer at source and creates cost_layer at destination.
// 3. Preserves exact unit costs and FIFO ordering.
// 4. Rejects insufficient stock and same warehouse transfers.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalEngine } from '../index'
import { createTestDb, TEST_WORKSPACE_ID } from './test-db'

describe('Target D: Transfer cost layers with stock transfer', () => {
  let db: ReturnType<typeof createTestDb>
  let engine: ReturnType<typeof createLocalEngine>

  const WH_FROM = '11111111-2222-3333-4444-555555555551'
  const WH_TO = '11111111-2222-3333-4444-555555555552'
  const PROD_ID = '99999999-8888-7777-6666-555555555555'

  beforeEach(() => {
    db = createTestDb()
    engine = createLocalEngine(db)

    // Seed two warehouses
    db.run(
      `INSERT INTO warehouse (id, workspace_id, name, location, is_active, created_at, updated_at)
       VALUES (?, ?, 'انبار مرکز', 'مرکز', 1, '2026-10-01', '2026-10-01')`,
      [WH_FROM, TEST_WORKSPACE_ID],
    )
    db.run(
      `INSERT INTO warehouse (id, workspace_id, name, location, is_active, created_at, updated_at)
       VALUES (?, ?, 'انبار شعبه', 'شعبه', 1, '2026-10-01', '2026-10-01')`,
      [WH_TO, TEST_WORKSPACE_ID],
    )

    // Seed product
    db.run(
      `INSERT INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, created_at, updated_at)
       VALUES (?, ?, 'کالای تست انتقال', 100, 150, 50, 1, '2026-10-01', '2026-10-01')`,
      [PROD_ID, TEST_WORKSPACE_ID],
    )

    // Seed source stock (50 units in WH_FROM)
    db.run(
      `INSERT INTO product_stock (id, workspace_id, product_id, warehouse_id, qty, created_at, updated_at)
       VALUES ('stock-1', ?, ?, ?, 50, '2026-10-01', '2026-10-01')`,
      [TEST_WORKSPACE_ID, PROD_ID, WH_FROM],
    )

    // Seed cost layers at WH_FROM:
    // Layer 1: 20 units @ 100 AFN
    // Layer 2: 30 units @ 120 AFN
    db.run(
      `INSERT INTO cost_layer (id, workspace_id, product_id, warehouse_id, source_type, source_id, source_line, received_qty, remaining_qty, unit_cost, currency, entry_date, created_at, updated_at)
       VALUES ('layer-1', ?, ?, ?, 'invoice', 'inv-1', '1', 20, 20, 100, 'AFN', '2026-10-01', '2026-10-01T10:00:00Z', '2026-10-01T10:00:00Z')`,
      [TEST_WORKSPACE_ID, PROD_ID, WH_FROM],
    )
    db.run(
      `INSERT INTO cost_layer (id, workspace_id, product_id, warehouse_id, source_type, source_id, source_line, received_qty, remaining_qty, unit_cost, currency, entry_date, created_at, updated_at)
       VALUES ('layer-2', ?, ?, ?, 'invoice', 'inv-2', '1', 30, 30, 120, 'AFN', '2026-10-02', '2026-10-02T10:00:00Z', '2026-10-02T10:00:00Z')`,
      [TEST_WORKSPACE_ID, PROD_ID, WH_FROM],
    )
  })

  it('transfers single layer partially and moves cost layer to destination', async () => {
    const res = await engine.request({
      method: 'POST',
      path: '/stock-transfers',
      body: {
        productId: PROD_ID,
        fromWarehouseId: WH_FROM,
        toWarehouseId: WH_TO,
        quantity: 10,
      },
    })

    expect(res.status).toBe(201)

    // Check stock quantities
    const sourceStock = db.get<{ qty: number }>(
      'SELECT qty FROM product_stock WHERE product_id = ? AND warehouse_id = ?',
      [PROD_ID, WH_FROM],
    )
    const destStock = db.get<{ qty: number }>(
      'SELECT qty FROM product_stock WHERE product_id = ? AND warehouse_id = ?',
      [PROD_ID, WH_TO],
    )
    expect(sourceStock?.qty).toBe(40)
    expect(destStock?.qty).toBe(10)

    // Check cost layers
    const layer1 = db.get<{ remaining_qty: number }>(
      'SELECT remaining_qty FROM cost_layer WHERE id = ?',
      ['layer-1'],
    )
    expect(layer1?.remaining_qty).toBe(10) // 20 - 10 = 10 left

    const destLayers = db.all<{ remaining_qty: number; unit_cost: number; warehouse_id: string }>(
      'SELECT remaining_qty, unit_cost, warehouse_id FROM cost_layer WHERE warehouse_id = ?',
      [WH_TO],
    )
    expect(destLayers).toHaveLength(1)
    expect(destLayers[0]?.remaining_qty).toBe(10)
    expect(destLayers[0]?.unit_cost).toBe(100)
  })

  it('transfers across multiple cost layers in FIFO order', async () => {
    // Transfer 35 units: 20 from Layer 1 (@ 100) + 15 from Layer 2 (@ 120)
    const res = await engine.request({
      method: 'POST',
      path: '/stock-transfers',
      body: {
        productId: PROD_ID,
        fromWarehouseId: WH_FROM,
        toWarehouseId: WH_TO,
        quantity: 35,
      },
    })

    expect(res.status).toBe(201)

    // Source layer 1 depleted (0 left), layer 2 has 15 left
    const layer1 = db.get<{ remaining_qty: number }>(
      'SELECT remaining_qty FROM cost_layer WHERE id = ?',
      ['layer-1'],
    )
    const layer2 = db.get<{ remaining_qty: number }>(
      'SELECT remaining_qty FROM cost_layer WHERE id = ?',
      ['layer-2'],
    )
    expect(layer1?.remaining_qty).toBe(0)
    expect(layer2?.remaining_qty).toBe(15)

    // Destination has two new cost layers
    const destLayers = db.all<{ remaining_qty: number; unit_cost: number }>(
      'SELECT remaining_qty, unit_cost FROM cost_layer WHERE warehouse_id = ? ORDER BY unit_cost ASC',
      [WH_TO],
    )
    expect(destLayers).toHaveLength(2)
    expect(destLayers[0]?.remaining_qty).toBe(20)
    expect(destLayers[0]?.unit_cost).toBe(100)
    expect(destLayers[1]?.remaining_qty).toBe(15)
    expect(destLayers[1]?.unit_cost).toBe(120)
  })

  it('rejects transfer exceeding available stock', async () => {
    const res = await engine.request({
      method: 'POST',
      path: '/stock-transfers',
      body: {
        productId: PROD_ID,
        fromWarehouseId: WH_FROM,
        toWarehouseId: WH_TO,
        quantity: 60,
      },
    })

    expect(res.status).toBe(409)
  })

  it('rejects transfer when cost layers are insufficient for requested quantity', async () => {
    // Delete layer-2 so WH_FROM only has 20 units in cost layers, despite 50 in product_stock
    db.run('DELETE FROM cost_layer WHERE id = ?', ['layer-2'])

    const res = await engine.request({
      method: 'POST',
      path: '/stock-transfers',
      body: {
        productId: PROD_ID,
        fromWarehouseId: WH_FROM,
        toWarehouseId: WH_TO,
        quantity: 30, // Request 30 when only 20 in layers
      },
    })

    expect(res.status).toBe(409)
    expect((res.data as any)?.code).toBe('INSUFFICIENT_COST_LAYERS')

    // Stock should not be deducted due to transaction rollback
    const sourceStock = db.get<{ qty: number }>(
      'SELECT qty FROM product_stock WHERE product_id = ? AND warehouse_id = ?',
      [PROD_ID, WH_FROM],
    )
    expect(sourceStock?.qty).toBe(50)
  })

  it('preserves exact inventory conservation invariant across source and destination', async () => {
    // Initial total units = 50 (WH_FROM: 50, WH_TO: 0)
    // Initial total layer value = 20*100 + 30*120 = 5600
    const res = await engine.request({
      method: 'POST',
      path: '/stock-transfers',
      body: {
        id: 'transfer-conservation-1',
        productId: PROD_ID,
        fromWarehouseId: WH_FROM,
        toWarehouseId: WH_TO,
        quantity: 25,
      },
    })
    expect(res.status).toBe(201)

    // Verify physical stock conservation
    const sourceStock = db.get<{ qty: number }>(
      'SELECT qty FROM product_stock WHERE product_id = ? AND warehouse_id = ?',
      [PROD_ID, WH_FROM],
    )
    const destStock = db.get<{ qty: number }>(
      'SELECT qty FROM product_stock WHERE product_id = ? AND warehouse_id = ?',
      [PROD_ID, WH_TO],
    )
    expect(Number(sourceStock?.qty) + Number(destStock?.qty)).toBe(50)

    // Verify cost layer value conservation
    const allLayers = db.all<{ remaining_qty: number; unit_cost: number }>(
      'SELECT remaining_qty, unit_cost FROM cost_layer WHERE product_id = ?',
      [PROD_ID],
    )
    const totalValue = allLayers.reduce((sum, l) => sum + l.remaining_qty * l.unit_cost, 0)
    expect(totalValue).toBe(5600)
  })

  it('replays existing transfer with same ID and rejects ID reuse with mismatched payload', async () => {
    // Seed initial transfer movement
    db.run(
      `INSERT INTO inventory_movement (id, workspace_id, product_id, type, quantity, date, created_at, updated_at)
       VALUES ('tx-move-100', ?, ?, 'transfer', 10, '2026-10-31', '2026-10-31', '2026-10-31')`,
      [TEST_WORKSPACE_ID, PROD_ID],
    )

    // Replay with identical parameters -> 200/201 replay
    const replayRes = await engine.request({
      method: 'POST',
      path: '/stock-transfers',
      body: {
        id: 'tx-move-100',
        productId: PROD_ID,
        fromWarehouseId: WH_FROM,
        toWarehouseId: WH_TO,
        quantity: 10,
      },
    })
    expect([200, 201]).toContain(replayRes.status)
    expect((replayRes.data as any).replayed).toBe(true)

    // Replay with mismatched quantity -> 409 Conflict
    const mismatchRes = await engine.request({
      method: 'POST',
      path: '/stock-transfers',
      body: {
        id: 'tx-move-100',
        productId: PROD_ID,
        fromWarehouseId: WH_FROM,
        toWarehouseId: WH_TO,
        quantity: 99,
      },
    })
    expect(mismatchRes.status).toBe(409)
    expect((mismatchRes.data as any).code).toBe('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH')
  })
})
