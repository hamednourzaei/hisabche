// ============================================
// packages/local-engine/src/__tests__/service-line-stock.test.ts
//
// Guard: A service line creates NO stock movement and consumes NO cost layer
// on the device, and a return of a service line moves no stock.
// ============================================

import { describe, expect, it } from 'vitest'
import crypto from 'node:crypto'
import { createTestDb, createTestEngine, TEST_WORKSPACE_ID } from './test-db'
import type { LocalDb } from '../db'
import type { LocalEngine } from '../index'

function generateUuid(): string {
  return crypto.randomUUID()
}

describe('Service line stock & costing isolation on device', () => {
  it('never moves stock or consumes cost layers for a service line', async () => {
    const db: LocalDb = createTestDb()
    const engine: LocalEngine = createTestEngine(db)
    const workspaceId = TEST_WORKSPACE_ID
    const now = '2026-11-01T10:00:00.000Z'
    const today = '2026-11-01'

    const goodsId = generateUuid()
    const serviceId = generateUuid()
    const customerId = generateUuid()

    // Create customer
    db.run(
      `INSERT INTO customer (id, workspace_id, full_name, is_active, created_at, updated_at)
       VALUES (?, ?, 'Test Customer', 1, ?, ?)`,
      [customerId, workspaceId, now, now],
    )

    // Create goods product with opening stock of 10
    db.run(
      `INSERT INTO product (id, workspace_id, name, quantity, buy_price, sell_price, is_active, offering_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, 'goods', ?, ?)`,
      [goodsId, workspaceId, 'Physical Widget', 10, 1000, 2000, now, now],
    )

    // Add cost layer for goods
    db.run(
      `INSERT INTO cost_layer (id, workspace_id, product_id, source_type, received_qty, remaining_qty, unit_cost, currency, entry_date, created_at, updated_at)
       VALUES (?, ?, ?, 'opening', 10, 10, 1000, 'AFN', ?, ?, ?)`,
      [generateUuid(), workspaceId, goodsId, today, now, now],
    )

    // Create service product with 0 stock
    db.run(
      `INSERT INTO product (id, workspace_id, name, quantity, buy_price, sell_price, is_active, offering_type, created_at, updated_at)
       VALUES (?, ?, ?, 0, 0, 5000, 1, 'service', ?, ?)`,
      [serviceId, workspaceId, 'Consulting Hour', now, now],
    )

    // Sell 2 units of goods and 3 units of service in ONE invoice
    const invoiceRes = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        customerId,
        items: [
          {
            productId: goodsId,
            productName: 'Physical Widget',
            quantity: 2,
            unitPrice: 2000,
            unit: 'piece',
          },
          {
            productId: serviceId,
            productName: 'Consulting Hour',
            quantity: 3,
            unitPrice: 5000,
            unit: 'piece',
          },
        ],
      },
    })

    expect(invoiceRes.status).toBe(201)
    const invoiceBody = (invoiceRes as any).data
    const invoiceId = invoiceBody.id

    // Check inventory movements
    const movements = db.all<{ product_id: string; quantity: number }>(
      'SELECT product_id, quantity FROM inventory_movement WHERE workspace_id = ?',
      [workspaceId],
    )

    // Only GOODS should have a stock movement!
    const goodsMovements = movements.filter((m) => m.product_id === goodsId)
    const serviceMovements = movements.filter((m) => m.product_id === serviceId)

    expect(goodsMovements.length).toBe(1)
    expect(goodsMovements[0]?.quantity).toBe(2)
    // The failing guard: service line must not have stock movements!
    expect(serviceMovements.length).toBe(0)

    // Check product quantities
    const goodsRow = db.get<{ quantity: number }>('SELECT quantity FROM product WHERE id = ?', [
      goodsId,
    ])
    const serviceRow = db.get<{ quantity: number }>('SELECT quantity FROM product WHERE id = ?', [
      serviceId,
    ])

    expect(goodsRow?.quantity).toBe(8) // 10 - 2 = 8
    expect(serviceRow?.quantity).toBe(0) // Unchanged! Never decremented to -3!

    // Check cost consumptions
    const consumptions = db.all<{ product_id: string }>(
      'SELECT product_id FROM cost_consumption WHERE workspace_id = ?',
      [workspaceId],
    )
    const goodsConsumptions = consumptions.filter((c) => c.product_id === goodsId)
    const serviceConsumptions = consumptions.filter((c) => c.product_id === serviceId)

    expect(goodsConsumptions.length).toBeGreaterThan(0)
    expect(serviceConsumptions.length).toBe(0)

    // Check return: returning the service line must NOT create a stock movement
    const returnRes = await engine.request({
      method: 'POST',
      path: `/invoices/${invoiceId}/returns`,
      body: {
        returnNumber: 'RET-001',
        returnType: 'sale_return',
        lines: [
          {
            originalLineId: invoiceBody.items.find((i: any) => i.productId === serviceId)?.id,
            quantity: 1,
            restockChoice: 'restock',
            reasonCode: 'dissatisfied',
          },
        ],
      },
    })

    expect(returnRes.status).toBe(201)

    // Check movements after return: service still has 0 movements
    const postReturnMovements = db.all<{ product_id: string }>(
      'SELECT product_id FROM inventory_movement WHERE workspace_id = ? AND product_id = ?',
      [workspaceId, serviceId],
    )
    expect(postReturnMovements.length).toBe(0)
  })
})
