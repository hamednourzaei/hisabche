// ============================================
// Purchase orders on the device: open, create, receive.
// Receiving is the money-and-stock act: a cost layer first, then the shelf,
// and exactly once.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalEngine } from '../index'
import { createTestDb, TEST_WAREHOUSE_ID, TEST_WORKSPACE_ID } from './test-db'

const SUPPLIER = '55555555-5555-4555-8555-555555555555'

describe('purchase orders on the device', () => {
  let db: ReturnType<typeof createTestDb>
  let engine: ReturnType<typeof createLocalEngine>
  let productId: string

  beforeEach(async () => {
    db = createTestDb()
    engine = createLocalEngine(db)
    db.run(
      `INSERT INTO supplier (id, workspace_id, name, phone, email, notes, is_active, created_at, updated_at)
       VALUES (?, ?, 'تأمین‌کننده', '0700', '', '', 1, datetime('now'), datetime('now'))`,
      [SUPPLIER, TEST_WORKSPACE_ID],
    )
    const res = await engine.request({
      method: 'POST',
      path: '/products',
      body: {
        name: 'آرد',
        buyPrice: 0,
        sellPrice: 90,
        quantity: 0,
        warehouseId: TEST_WAREHOUSE_ID,
      },
    })
    productId = (res.data as { id: string }).id
  })

  const create = (extra: Record<string, unknown> = {}) =>
    engine.request<{ id: string; status: string; items: Array<{ total_price: number }> }>({
      method: 'POST',
      path: '/purchase-orders',
      body: {
        supplierId: SUPPLIER,
        items: [{ productId, quantity: 10, unitPrice: 50, totalPrice: 480 }],
        ...extra,
      },
    })

  it('lists suppliers as the server does (camelCase, active filter)', async () => {
    const all = await engine.request<Array<{ id: string; name: string; isActive: boolean }>>({
      method: 'GET',
      path: '/suppliers?isActive=true',
    })
    expect(all.data).toHaveLength(1)
    expect(all.data[0]).toMatchObject({ id: SUPPLIER, name: 'تأمین‌کننده', isActive: true })
    const none = await engine.request({ method: 'GET', path: '/suppliers?isActive=false' })
    expect(none.data).toEqual([])
  })

  it('creates an order, opens it with supplier and lines, and lists it', async () => {
    const made = await create()
    expect(made.status).toBe(201)
    expect(made.data.status).toBe('pending')

    const opened = await engine.request<{
      supplier: { name: string }
      items: Array<{ total_price: number; product: { name: string } }>
    }>({ method: 'GET', path: `/purchase-orders/${made.data.id}` })
    expect(opened.data.supplier.name).toBe('تأمین‌کننده')
    expect(opened.data.items[0]).toMatchObject({ total_price: 480, product: { name: 'آرد' } })

    const list = await engine.request<Array<{ id: string }>>({
      method: 'GET',
      path: '/purchase-orders',
    })
    expect(list.data.map((o) => o.id)).toEqual([made.data.id])
  })

  it('refuses an unknown supplier and an unknown product', async () => {
    const noSupplier = await create({ supplierId: '66666666-6666-4666-8666-666666666666' })
    expect(noSupplier.status).toBe(404)
    const noProduct = await create({
      items: [
        {
          productId: '77777777-7777-4777-8777-777777777777',
          quantity: 1,
          unitPrice: 1,
          totalPrice: 1,
        },
      ],
    })
    expect(noProduct.status).toBe(400)
  })

  it('a retried submit names the same order — nothing is created twice', async () => {
    const id = '88888888-8888-4888-8888-888888888888'
    const first = await create({ id })
    const again = await create({ id })
    expect(first.status).toBe(201)
    expect(again.status).toBe(200)
    expect(again.data.id).toBe(first.data.id)
    expect(db.all('SELECT id FROM purchase_order')).toHaveLength(1)
  })

  it('receiving puts the goods on the shelf at what was PAID, once', async () => {
    const order = (await create()).data
    const received = await engine.request<{ status: string; received_at: string }>({
      method: 'POST',
      path: `/purchase-orders/${order.id}/receive`,
    })
    expect(received.status).toBe(200)
    expect(received.data.status).toBe('received')

    // 480 paid for 10 units = 48 a unit — not the 50 list price.
    const layer = db.get<{ remaining_qty: number; unit_cost: number; source_type: string }>(
      'SELECT remaining_qty, unit_cost, source_type FROM cost_layer WHERE product_id = ?',
      [productId],
    )
    expect(layer).toMatchObject({ remaining_qty: 10, unit_cost: 48, source_type: 'purchase_order' })
    expect(
      db.get<{ quantity: number }>('SELECT quantity FROM product WHERE id = ?', [productId]),
    ).toEqual({
      quantity: 10,
    })
    expect(
      db.all("SELECT id FROM inventory_movement WHERE product_id = ? AND type = 'purchase'", [
        productId,
      ]),
    ).toHaveLength(1)

    // The second receive is refused and moves nothing.
    const second = await engine.request({
      method: 'POST',
      path: `/purchase-orders/${order.id}/receive`,
    })
    expect(second.status).toBe(409)
    expect(
      db.get<{ quantity: number }>('SELECT quantity FROM product WHERE id = ?', [productId]),
    ).toEqual({
      quantity: 10,
    })
    expect(db.all('SELECT id FROM cost_layer WHERE product_id = ?', [productId])).toHaveLength(1)
  })

  it('a cancelled order cannot be received', async () => {
    const order = (await create({ status: 'cancelled' })).data
    const res = await engine.request({
      method: 'POST',
      path: `/purchase-orders/${order.id}/receive`,
    })
    expect(res.status).toBe(409)
    expect(db.all('SELECT id FROM cost_layer')).toHaveLength(0)
  })

  it('refuses to open or receive an order that is not there', async () => {
    const missing = '99999999-9999-4999-8999-999999999999'
    expect(
      (await engine.request({ method: 'GET', path: `/purchase-orders/${missing}` })).status,
    ).toBe(404)
    expect(
      (await engine.request({ method: 'POST', path: `/purchase-orders/${missing}/receive` }))
        .status,
    ).toBe(404)
  })
})
