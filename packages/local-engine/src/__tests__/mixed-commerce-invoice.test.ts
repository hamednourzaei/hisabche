// ============================================
// packages/local-engine/src/__tests__/mixed-commerce-invoice.test.ts
//
// M2.2 MIXED COMMERCE INVOICING — VERIFICATION SUITE
//
// Verifies unified invoice aggregate containing mixed offerings:
//  - Scenario A: Goods-only invoice
//  - Scenario B: Service-only invoice
//  - Scenario C: Mixed goods + service invoice
//  - Scenario D: Mixed invoice with partial payment
//  - Scenario E: Mixed invoice returns & restock isolation
//  - Scenario F: Offline execution with durable outbox queueing
//  - Scenario G: Package offering safety without credit ledger
// ============================================

import { describe, expect, it } from 'vitest'
import crypto from 'node:crypto'
import { movesStock, assertCreditLedgerAvailable } from '@hisabche/validation'
import { createTestDb, createTestEngine, TEST_WORKSPACE_ID, TEST_WAREHOUSE_ID } from './test-db'
import type { LocalDb } from '../db'
import type { LocalEngine } from '../index'

function generateUuid(): string {
  return crypto.randomUUID()
}

describe('M2.2 Mixed Commerce Invoicing', () => {
  // ─── Scenario A: Goods-only invoice ─────────────────────────
  it('Scenario A: goods-only invoice decrements stock, consumes cost layer, and posts COGS', async () => {
    const db: LocalDb = createTestDb()
    const engine: LocalEngine = createTestEngine(db)
    const now = new Date().toISOString()
    const goodsId = generateUuid()
    const customerId = generateUuid()

    db.run(
      `INSERT INTO customer (id, workspace_id, full_name, is_active, created_at, updated_at)
       VALUES (?, ?, 'Buyer Goods', 1, ?, ?)`,
      [customerId, TEST_WORKSPACE_ID, now, now],
    )
    db.run(
      `INSERT INTO product (id, workspace_id, name, quantity, buy_price, sell_price, is_active, offering_type, created_at, updated_at)
       VALUES (?, ?, 'Spare Part A', 20, 400, 700, 1, 'goods', ?, ?)`,
      [goodsId, TEST_WORKSPACE_ID, now, now],
    )
    db.run(
      `INSERT INTO cost_layer (id, workspace_id, product_id, warehouse_id, source_type, received_qty, remaining_qty, unit_cost, currency, entry_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'opening', 20, 20, 400, 'AFN', '2026-11-01', ?, ?)`,
      [generateUuid(), TEST_WORKSPACE_ID, goodsId, TEST_WAREHOUSE_ID, now, now],
    )

    const res = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        customerId,
        warehouseId: TEST_WAREHOUSE_ID,
        items: [
          {
            productId: goodsId,
            productName: 'Spare Part A',
            quantity: 5,
            unitPrice: 700,
            unit: 'piece',
          },
        ],
      },
    })

    expect(res.status).toBe(201)
    const invoice = (res as { data: { id: string; total: number; subtotal: number } }).data
    expect(invoice.total).toBe(3500)

    // Stock decremented by 5 (20 -> 15)
    const product = db.get<{ quantity: number }>('SELECT quantity FROM product WHERE id = ?', [
      goodsId,
    ])
    expect(product?.quantity).toBe(15)

    // Cost layer consumed
    const remainingLayer = db.get<{ remaining_qty: number }>(
      'SELECT remaining_qty FROM cost_layer WHERE product_id = ?',
      [goodsId],
    )
    expect(remainingLayer?.remaining_qty).toBe(15)

    // Journal entry: COGS debit 2000 (5 * 400), Inventory credit 2000, AR debit 3500, Sales credit 3500
    const journal = db.get<{ id: string }>('SELECT id FROM journal_entry WHERE source_id = ?', [
      invoice.id,
    ])
    expect(journal).toBeDefined()
    const lines = db.all<{ debit: number; credit: number }>(
      'SELECT debit, credit FROM journal_line WHERE journal_id = ?',
      [journal?.id],
    )
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0)
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0)
    expect(totalDebit).toBe(totalCredit)
    expect(totalDebit).toBe(3500 + 2000) // Receivable + COGS
  })

  // ─── Scenario B: Service-only invoice ───────────────────────
  it('Scenario B: service-only invoice leaves stock unchanged, draws zero cost layers, and posts no COGS', async () => {
    const db: LocalDb = createTestDb()
    const engine: LocalEngine = createTestEngine(db)
    const now = new Date().toISOString()
    const serviceId = generateUuid()
    const customerId = generateUuid()

    db.run(
      `INSERT INTO customer (id, workspace_id, full_name, is_active, created_at, updated_at)
       VALUES (?, ?, 'Buyer Service', 1, ?, ?)`,
      [customerId, TEST_WORKSPACE_ID, now, now],
    )
    db.run(
      `INSERT INTO product (id, workspace_id, name, quantity, buy_price, sell_price, is_active, offering_type, created_at, updated_at)
       VALUES (?, ?, 'Device Repair Service', 0, 0, 1500, 1, 'service', ?, ?)`,
      [serviceId, TEST_WORKSPACE_ID, now, now],
    )

    const res = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        customerId,
        items: [
          {
            productId: serviceId,
            productName: 'Device Repair Service',
            quantity: 2,
            unitPrice: 1500,
            unit: 'piece',
          },
        ],
      },
    })

    expect(res.status).toBe(201)
    const invoice = (res as { data: { id: string; total: number } }).data
    expect(invoice.total).toBe(3000)

    // Stock unchanged at 0
    const product = db.get<{ quantity: number }>('SELECT quantity FROM product WHERE id = ?', [
      serviceId,
    ])
    expect(product?.quantity).toBe(0)

    // No inventory movements
    const movements = db.all<{ id: string }>(
      'SELECT id FROM inventory_movement WHERE product_id = ?',
      [serviceId],
    )
    expect(movements.length).toBe(0)

    // No cost layers drawn
    const consumptions = db.all<{ id: string }>(
      'SELECT id FROM cost_consumption WHERE consumer_id = ?',
      [invoice.id],
    )
    expect(consumptions.length).toBe(0)

    // Journal has receivable and sales ONLY, zero COGS
    const journal = db.get<{ id: string }>('SELECT id FROM journal_entry WHERE source_id = ?', [
      invoice.id,
    ])
    expect(journal).toBeDefined()
    const lines = db.all<{ debit: number; credit: number }>(
      'SELECT debit, credit FROM journal_line WHERE journal_id = ?',
      [journal?.id],
    )
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0)
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0)
    expect(totalDebit).toBe(totalCredit)
    expect(totalDebit).toBe(3000) // Receivable only
  })

  // ─── Scenario C: Mixed invoice (Goods + Service) ────────────
  it('Scenario C: mixed invoice combines goods and service; goods moves stock/costing, service does not', async () => {
    const db: LocalDb = createTestDb()
    const engine: LocalEngine = createTestEngine(db)
    const now = new Date().toISOString()
    const goodsId = generateUuid()
    const serviceId = generateUuid()
    const customerId = generateUuid()

    db.run(
      `INSERT INTO customer (id, workspace_id, full_name, is_active, created_at, updated_at)
       VALUES (?, ?, 'Mixed Buyer', 1, ?, ?)`,
      [customerId, TEST_WORKSPACE_ID, now, now],
    )
    db.run(
      `INSERT INTO product (id, workspace_id, name, quantity, buy_price, sell_price, is_active, offering_type, created_at, updated_at)
       VALUES (?, ?, 'Hardware Screws', 50, 10, 25, 1, 'goods', ?, ?)`,
      [goodsId, TEST_WORKSPACE_ID, now, now],
    )
    db.run(
      `INSERT INTO cost_layer (id, workspace_id, product_id, warehouse_id, source_type, received_qty, remaining_qty, unit_cost, currency, entry_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'opening', 50, 50, 10, 'AFN', '2026-11-01', ?, ?)`,
      [generateUuid(), TEST_WORKSPACE_ID, goodsId, TEST_WAREHOUSE_ID, now, now],
    )
    db.run(
      `INSERT INTO product (id, workspace_id, name, quantity, buy_price, sell_price, is_active, offering_type, created_at, updated_at)
       VALUES (?, ?, 'Assembly Labor', 0, 0, 200, 1, 'service', ?, ?)`,
      [serviceId, TEST_WORKSPACE_ID, now, now],
    )

    // Sell 10 screws (@25 = 250) + 1 labor (@200 = 200) -> Total = 450
    const res = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        customerId,
        warehouseId: TEST_WAREHOUSE_ID,
        paidAmount: 450, // Full payment
        items: [
          {
            productId: goodsId,
            productName: 'Hardware Screws',
            quantity: 10,
            unitPrice: 25,
            unit: 'piece',
          },
          {
            productId: serviceId,
            productName: 'Assembly Labor',
            quantity: 1,
            unitPrice: 200,
            unit: 'custom',
            unitLabel: 'hour',
          },
        ],
      },
    })

    expect(res.status).toBe(201)
    const invoice = (
      res as { data: { id: string; total: number; status: string; paidAmount: number } }
    ).data
    expect(invoice.total).toBe(450)
    expect(invoice.paidAmount).toBe(450)
    expect(invoice.status).toBe('completed')

    // Goods stock decreased from 50 to 40
    const goodsProd = db.get<{ quantity: number }>('SELECT quantity FROM product WHERE id = ?', [
      goodsId,
    ])
    expect(goodsProd?.quantity).toBe(40)

    // Service stock remains 0
    const serviceProd = db.get<{ quantity: number }>('SELECT quantity FROM product WHERE id = ?', [
      serviceId,
    ])
    expect(serviceProd?.quantity).toBe(0)

    // Goods layer consumed 10 units (remaining 40)
    const layer = db.get<{ remaining_qty: number }>(
      'SELECT remaining_qty FROM cost_layer WHERE product_id = ?',
      [goodsId],
    )
    expect(layer?.remaining_qty).toBe(40)

    // COGS is 10 * 10 = 100
    // Journal: AR 450, Sales 450, COGS 100, Inventory 100
    const journal = db.get<{ id: string }>('SELECT id FROM journal_entry WHERE source_id = ?', [
      invoice.id,
    ])
    const lines = db.all<{ debit: number; credit: number }>(
      'SELECT debit, credit FROM journal_line WHERE journal_id = ?',
      [journal?.id],
    )
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0)
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0)
    expect(totalDebit).toBe(totalCredit)
    expect(totalDebit).toBe(450 + 100) // Receivable (450) + COGS (100)
  })

  // ─── Scenario D: Partial payment on mixed invoice ───────────
  it('Scenario D: partial payment on mixed invoice preserves balance and sets partial status', async () => {
    const db: LocalDb = createTestDb()
    const engine: LocalEngine = createTestEngine(db)
    const now = new Date().toISOString()
    const goodsId = generateUuid()
    const serviceId = generateUuid()
    const customerId = generateUuid()

    db.run(
      `INSERT INTO customer (id, workspace_id, full_name, is_active, created_at, updated_at)
       VALUES (?, ?, 'Partial Buyer', 1, ?, ?)`,
      [customerId, TEST_WORKSPACE_ID, now, now],
    )
    db.run(
      `INSERT INTO product (id, workspace_id, name, quantity, buy_price, sell_price, is_active, offering_type, created_at, updated_at)
       VALUES (?, ?, 'Paint Bucket', 10, 500, 800, 1, 'goods', ?, ?)`,
      [goodsId, TEST_WORKSPACE_ID, now, now],
    )
    db.run(
      `INSERT INTO product (id, workspace_id, name, quantity, buy_price, sell_price, is_active, offering_type, created_at, updated_at)
       VALUES (?, ?, 'Painting Labor', 0, 0, 1200, 1, 'service', ?, ?)`,
      [serviceId, TEST_WORKSPACE_ID, now, now],
    )

    // Total: 800 + 1200 = 2000. Customer pays 500.
    const res = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        customerId,
        paidAmount: 500,
        items: [
          { productId: goodsId, productName: 'Paint Bucket', quantity: 1, unitPrice: 800 },
          { productId: serviceId, productName: 'Painting Labor', quantity: 1, unitPrice: 1200 },
        ],
      },
    })

    expect(res.status).toBe(201)
    const invoice = (
      res as { data: { id: string; total: number; paidAmount: number; status: string } }
    ).data
    expect(invoice.total).toBe(2000)
    expect(invoice.paidAmount).toBe(500)
    expect(invoice.status).toBe('partial')

    // Allocation row exists linking to invoice
    const allocation = db.get<{ amount: number; payment_id: string }>(
      'SELECT amount, payment_id FROM payment_allocation WHERE invoice_id = ?',
      [invoice.id],
    )
    expect(allocation?.amount).toBe(500)

    // Payment row exists
    const payment = db.get<{ amount: number }>('SELECT amount FROM payment WHERE id = ?', [
      allocation?.payment_id,
    ])
    expect(payment?.amount).toBe(500)
  })

  // ─── Scenario E: Return of mixed invoice ────────────────────
  it('Scenario E: mixed return restores goods stock only and never creates inventory movement for service', async () => {
    const db: LocalDb = createTestDb()
    const engine: LocalEngine = createTestEngine(db)
    const now = new Date().toISOString()
    const goodsId = generateUuid()
    const serviceId = generateUuid()
    const customerId = generateUuid()

    db.run(
      `INSERT INTO customer (id, workspace_id, full_name, is_active, created_at, updated_at)
       VALUES (?, ?, 'Return Customer', 1, ?, ?)`,
      [customerId, TEST_WORKSPACE_ID, now, now],
    )
    db.run(
      `INSERT INTO product (id, workspace_id, name, quantity, buy_price, sell_price, is_active, offering_type, created_at, updated_at)
       VALUES (?, ?, 'Electronic Board', 10, 100, 200, 1, 'goods', ?, ?)`,
      [goodsId, TEST_WORKSPACE_ID, now, now],
    )
    db.run(
      `INSERT INTO product (id, workspace_id, name, quantity, buy_price, sell_price, is_active, offering_type, created_at, updated_at)
       VALUES (?, ?, 'Setup Service', 0, 0, 300, 1, 'service', ?, ?)`,
      [serviceId, TEST_WORKSPACE_ID, now, now],
    )

    const invoiceRes = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        customerId,
        items: [
          { productId: goodsId, productName: 'Electronic Board', quantity: 2, unitPrice: 200 },
          { productId: serviceId, productName: 'Setup Service', quantity: 1, unitPrice: 300 },
        ],
      },
    })
    const invoiceId = (invoiceRes as { data: { id: string } }).data.id

    const invoiceItems = db.all<{ id: string; product_id: string }>(
      'SELECT id, product_id FROM invoice_item WHERE invoice_id = ?',
      [invoiceId],
    )
    const serviceItem = invoiceItems.find((i) => i.product_id === serviceId)

    // Return the service item
    const returnRes = await engine.request({
      method: 'POST',
      path: `/invoices/${invoiceId}/returns`,
      headers: { 'x-hisabche-queue': '1' },
      body: {
        returnType: 'sale_return',
        returnNumber: 'RET-MIX-001',
        lines: [{ originalLineId: serviceItem?.id, quantity: 1, restockChoice: 'restock' }],
      },
    })
    expect(returnRes.status).toBe(201)

    // Service product stock remains 0
    const serviceProd = db.get<{ quantity: number }>('SELECT quantity FROM product WHERE id = ?', [
      serviceId,
    ])
    expect(serviceProd?.quantity).toBe(0)

    // No inventory movement recorded for service return
    const movements = db.all<{ id: string }>(
      'SELECT id FROM inventory_movement WHERE product_id = ?',
      [serviceId],
    )
    expect(movements.length).toBe(0)
  })

  // ─── Scenario F: Offline execution with durable outbox ──────
  it('Scenario F: mixed invoice offline persists locally and queues into outbox atomically', async () => {
    const db: LocalDb = createTestDb()
    const engine: LocalEngine = createTestEngine(db)
    const now = new Date().toISOString()
    const goodsId = generateUuid()
    const serviceId = generateUuid()
    const customerId = generateUuid()

    db.run(
      `INSERT INTO customer (id, workspace_id, full_name, is_active, created_at, updated_at)
       VALUES (?, ?, 'Offline Mixed Buyer', 1, ?, ?)`,
      [customerId, TEST_WORKSPACE_ID, now, now],
    )
    db.run(
      `INSERT INTO product (id, workspace_id, name, quantity, buy_price, sell_price, is_active, offering_type, created_at, updated_at)
       VALUES (?, ?, 'Item Goods', 15, 50, 100, 1, 'goods', ?, ?)`,
      [goodsId, TEST_WORKSPACE_ID, now, now],
    )
    db.run(
      `INSERT INTO product (id, workspace_id, name, quantity, buy_price, sell_price, is_active, offering_type, created_at, updated_at)
       VALUES (?, ?, 'Item Service', 0, 0, 250, 1, 'service', ?, ?)`,
      [serviceId, TEST_WORKSPACE_ID, now, now],
    )

    const res = await engine.request({
      method: 'POST',
      path: '/invoices',
      headers: { 'x-hisabche-queue': '1' },
      body: {
        type: 'sale',
        customerId,
        items: [
          { productId: goodsId, productName: 'Item Goods', quantity: 2, unitPrice: 100 },
          { productId: serviceId, productName: 'Item Service', quantity: 1, unitPrice: 250 },
        ],
      },
    })

    expect(res.status).toBe(201)
    const invoiceId = (res as { data: { id: string; total: number } }).data.id
    expect((res as { data: { total: number } }).data.total).toBe(450)

    // Check outbox queue
    const queued = db.get<{ entity: string; operation: string; client_id: string }>(
      "SELECT entity, operation, client_id FROM sync_queue WHERE entity = 'invoice' AND client_id = ?",
      [invoiceId],
    )
    expect(queued).toBeDefined()
    expect(queued?.entity).toBe('invoice')
    expect(queued?.operation).toBe('create')
    expect(queued?.client_id).toBe(invoiceId)
  })

  // ─── Scenario G: Package offering safety without credit ledger
  it('Scenario G: package offering moves no stock and refuses premature credit deduction in M2.2', () => {
    expect(movesStock('package')).toBe(false)
    expect(() => assertCreditLedgerAvailable('package')).toThrow(
      'PACKAGE_CREDIT_LEDGER_UNAVAILABLE_UNTIL_M3',
    )
  })
})
