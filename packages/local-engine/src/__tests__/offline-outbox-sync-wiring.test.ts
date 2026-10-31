// ============================================
// Target C: Offline Sync Outbox Enqueue Wiring
//
// Asserts that local mutating endpoints enqueue changes to sync_queue
// when x-hisabche-queue: '1' is provided, ensuring offline changes
// sync cleanly to cloud without orphan children or missed mutations.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalEngine } from '../index'
import { createTestDb, TEST_WORKSPACE_ID } from './test-db'

describe('Target C: Offline Sync Outbox Enqueue Wiring', () => {
  let db: ReturnType<typeof createTestDb>
  let engine: ReturnType<typeof createLocalEngine>

  const WH_FROM = '11111111-2222-3333-4444-555555555551'
  const WH_TO = '11111111-2222-3333-4444-555555555552'
  const PROD_UUID = '99999999-8888-7777-6666-555555555555'
  const CUST_UUID = '44444444-4444-4444-4444-444444444444'

  beforeEach(() => {
    db = createTestDb()
    engine = createLocalEngine(db)

    // Seed two warehouses for transfer testing
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
  })

  it('enqueues customer create and update only when x-hisabche-queue: 1', async () => {
    // 1. Without header: no enqueue
    const resNoQueue = await engine.request({
      method: 'POST',
      path: '/customers',
      body: { fullName: 'مشتری آزمایشی ۱', phone: '0701111111' },
      headers: {},
    })
    expect(resNoQueue.status).toBe(201)
    const queueRows1 = db.all('SELECT * FROM sync_queue WHERE entity = ?', ['customer'])
    expect(queueRows1.length).toBe(0)

    // 2. With header: enqueued
    const resQueued = await engine.request({
      method: 'POST',
      path: '/customers',
      body: { fullName: 'مشتری آزمایشی ۲', phone: '0702222222' },
      headers: { 'x-hisabche-queue': '1' },
    })
    expect(resQueued.status).toBe(201)
    const custId = (resQueued.data as { id: string }).id
    const queueRows2 = db.all<{ entity: string; operation: string; client_id: string }>(
      'SELECT * FROM sync_queue WHERE entity = ? AND operation = ?',
      ['customer', 'create'],
    )
    expect(queueRows2.length).toBe(1)
    expect(queueRows2[0]?.client_id).toBe(custId)

    // 3. Update with header: enqueued update
    const resUpdate = await engine.request({
      method: 'PATCH',
      path: `/customers/${custId}`,
      body: { fullName: 'مشتری آزمایشی ۲ (ویرایش)' },
      headers: { 'x-hisabche-queue': '1' },
    })
    expect(resUpdate.status).toBe(200)
    const queueRows3 = db.all<{ entity: string; operation: string }>(
      'SELECT * FROM sync_queue WHERE entity = ? AND operation = ?',
      ['customer', 'update'],
    )
    expect(queueRows3.length).toBe(1)
    expect(queueRows3[0]?.operation).toBe('update')
  })

  it('enqueues product create and delete when x-hisabche-queue: 1', async () => {
    const res = await engine.request({
      method: 'POST',
      path: '/products',
      body: {
        name: 'کالای تست ۲',
        buyPrice: 100,
        sellPrice: 150,
        quantity: 10,
        warehouseId: WH_FROM,
      },
      headers: { 'x-hisabche-queue': '1' },
    })
    expect(res.status).toBe(201)
    const prodId = (res.data as { id: string }).id

    const queueProd = db.all<{ entity: string; operation: string }>(
      'SELECT * FROM sync_queue WHERE entity = ? AND client_id = ?',
      ['product', prodId],
    )
    expect(queueProd.length).toBe(1)
    expect(queueProd[0]?.operation).toBe('create')

    // Delete product
    const delRes = await engine.request({
      method: 'DELETE',
      path: `/products/${prodId}`,
      headers: { 'x-hisabche-queue': '1' },
    })
    expect(delRes.status).toBe(200)

    const queueDel = db.all<{ entity: string; operation: string }>(
      'SELECT * FROM sync_queue WHERE entity = ? AND operation = ?',
      ['product', 'delete'],
    )
    expect(queueDel.length).toBe(1)
    expect(queueDel[0]?.operation).toBe('delete')
  })

  it('enqueues invoice cancel when x-hisabche-queue: 1', async () => {
    // Seed an invoice
    const invId = 'inv-test-cancel-queue'
    db.run(
      `INSERT INTO invoice (
        id, workspace_id, invoice_number, type, status, total, subtotal,
        tax_total, discount_total, paid_amount, date, currency,
        created_at, updated_at
      ) VALUES (?, ?, 'INV-999', 'sale', 'finalized', 1000, 1000, 0, 0, 0, '2026-10-01', 'AFN', '2026-10-01', '2026-10-01')`,
      [invId, TEST_WORKSPACE_ID],
    )

    const cancelRes = await engine.request({
      method: 'POST',
      path: `/invoices/${invId}/cancel`,
      headers: { 'x-hisabche-queue': '1' },
    })
    expect(cancelRes.status).toBe(200)

    const queueCancel = db.all<{ entity: string; operation: string }>(
      'SELECT * FROM sync_queue WHERE entity = ? AND operation = ?',
      ['invoice', 'delete'],
    )
    expect(queueCancel.length).toBe(1)
    expect(queueCancel[0]?.operation).toBe('delete')
  })

  it('enqueues payment and payment cancel when x-hisabche-queue: 1', async () => {
    // Seed customer and account
    db.run(
      `INSERT INTO customer (id, workspace_id, full_name, created_at, updated_at) VALUES (?, ?, 'مشتری تست پرداخت', '2026-10-01', '2026-10-01')`,
      [CUST_UUID, TEST_WORKSPACE_ID],
    )

    const payRes = await engine.request({
      method: 'POST',
      path: '/payments',
      body: {
        partyId: CUST_UUID,
        partyType: 'customer',
        amount: 500,
        currency: 'AFN',
        method: 'cash',
        direction: 'in',
      },
      headers: { 'x-hisabche-queue': '1' },
    })
    expect(payRes.status).toBe(201)
    const payId = (payRes.data as { id: string }).id

    const queuePay = db.all<{ entity: string; operation: string }>(
      'SELECT * FROM sync_queue WHERE entity = ? AND client_id = ?',
      ['payment', payId],
    )
    expect(queuePay.length).toBe(1)
    expect(queuePay[0]?.operation).toBe('create')

    // Cancel payment
    const cancelPayRes = await engine.request({
      method: 'POST',
      path: `/payments/${payId}/cancel`,
      body: { reason: 'اشتباه کاربری' },
      headers: { 'x-hisabche-queue': '1' },
    })
    expect(cancelPayRes.status).toBe(200)

    const queuePayCancel = db.all<{ entity: string; operation: string }>(
      'SELECT * FROM sync_queue WHERE entity = ? AND operation = ?',
      ['payment', 'delete'],
    )
    expect(queuePayCancel.length).toBe(1)
    expect(queuePayCancel[0]?.operation).toBe('delete')
  })

  it('enqueues stock-transfers as inventory_movement create when x-hisabche-queue: 1', async () => {
    // Seed product and stock
    db.run(
      `INSERT INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, created_at, updated_at)
       VALUES (?, ?, 'کالای انبار', 200, 300, 20, 1, '2026-10-01', '2026-10-01')`,
      [PROD_UUID, TEST_WORKSPACE_ID],
    )
    db.run(
      `INSERT INTO product_stock (id, workspace_id, product_id, warehouse_id, qty, created_at, updated_at)
       VALUES ('stk-wh1', ?, ?, ?, 20, '2026-10-01', '2026-10-01')`,
      [TEST_WORKSPACE_ID, PROD_UUID, WH_FROM],
    )
    db.run(
      `INSERT INTO cost_layer (id, workspace_id, product_id, warehouse_id, source_type, source_id, source_line, received_qty, remaining_qty, unit_cost, currency, entry_date, created_at, updated_at)
       VALUES ('layer-wh1', ?, ?, ?, 'invoice', 'inv-1', '1', 20, 20, 200, 'AFN', '2026-10-01', '2026-10-01', '2026-10-01')`,
      [TEST_WORKSPACE_ID, PROD_UUID, WH_FROM],
    )

    const transferRes = await engine.request({
      method: 'POST',
      path: '/stock-transfers',
      body: {
        productId: PROD_UUID,
        fromWarehouseId: WH_FROM,
        toWarehouseId: WH_TO,
        quantity: 5,
        notes: 'انتقال برای تکمیل موجودی شعبه',
      },
      headers: { 'x-hisabche-queue': '1' },
    })
    expect(transferRes.status).toBe(201)
    const transferId = (transferRes.data as { transferId: string }).transferId

    const queueTransfer = db.all<{ entity: string; operation: string; client_id: string }>(
      'SELECT * FROM sync_queue WHERE entity = ? AND client_id = ?',
      ['inventory_movement', transferId],
    )
    expect(queueTransfer.length).toBe(1)
    expect(queueTransfer[0]?.operation).toBe('create')
  })
})
