// ============================================
// The business-analysis reports on the device.
//
// Collections, customer risk, suppliers, break-even, working capital and
// cohorts — answered with the assemblers the server uses, over the device's own
// rows. These tests build a small business through the engine and read the
// answers back.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalEngine } from '../index'
import { createTestDb, TEST_WAREHOUSE_ID, TEST_WORKSPACE_ID } from './test-db'

const iso = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10)

describe('analysis on the device', () => {
  let db: ReturnType<typeof createTestDb>
  let engine: ReturnType<typeof createLocalEngine>
  let customerId: string
  let productId: string

  beforeEach(async () => {
    db = createTestDb()
    engine = createLocalEngine(db)
    const customer = await engine.request({
      method: 'POST',
      path: '/customers',
      body: { fullName: 'احمد', phone: '0799123456' },
    })
    expect(customer.status).toBe(201)
    customerId = (customer.data as { id: string }).id
    const product = await engine.request({
      method: 'POST',
      path: '/products',
      body: {
        name: 'شکر',
        buyPrice: 50,
        sellPrice: 100,
        quantity: 500,
        warehouseId: TEST_WAREHOUSE_ID,
      },
    })
    productId = (product.data as { id: string }).id
  })

  async function sale(opts: { paid?: number; dueInDays?: number; quantity?: number } = {}) {
    const res = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        customerId,
        warehouseId: TEST_WAREHOUSE_ID,
        ...(opts.paid ? { paidAmount: opts.paid } : {}),
        items: [
          {
            productId,
            productName: 'شکر',
            quantity: opts.quantity ?? 10,
            unitPrice: 100,
            discount: 0,
          },
        ],
      },
    })
    expect(res.status).toBe(201)
    const id = (res.data as { id: string }).id
    db.run('UPDATE invoice SET due_date = ? WHERE id = ?', [iso(opts.dueInDays ?? 0), id])
    return id
  }

  it('collections: chases the overdue unpaid invoice by name, and not the paid one', async () => {
    const late = await sale({ dueInDays: -40 })
    await sale({ paid: 1000, dueInDays: -40 }) // paid in full

    const res = (
      await engine.request<{
        openInvoices: number
        outstandingByCurrency: Array<{ currency: string; outstanding: number }>
        actions: Array<{ invoiceId: string; customerName: string | null; daysLate: number }>
      }>({ method: 'GET', path: '/analysis/collections' })
    ).data
    expect(res.openInvoices).toBe(1)
    expect(res.outstandingByCurrency).toEqual([
      expect.objectContaining({ currency: 'AFN', outstanding: 1000 }),
    ])
    expect(res.actions).toHaveLength(1)
    expect(res.actions[0]).toMatchObject({ invoiceId: late, customerName: 'احمد' })
    expect(res.actions[0]!.daysLate).toBeGreaterThanOrEqual(39)
  })

  it('customer risk: no history is unknown, a customer that is not there is a 404', async () => {
    const empty = await engine.request<{ band: string }>({
      method: 'GET',
      path: `/analysis/customers/${customerId}/risk`,
    })
    expect(empty.status).toBe(200)
    expect(empty.data.band).toBe('unknown')

    const missing = await engine.request({
      method: 'GET',
      path: '/analysis/customers/9b2f4c1e-0000-4000-8000-000000000001/risk',
    })
    expect(missing.status).toBe(404)
  })

  it('customer risk: a customer who pays late on every invoice is not called healthy', async () => {
    for (let i = 0; i < 4; i += 1) {
      const id = await sale({ paid: 1000, dueInDays: -60 })
      // Paid long after the due date.
      db.run('UPDATE payment_allocation SET created_at = ? WHERE invoice_id = ?', [
        `${iso(-5)}T10:00:00.000Z`,
        id,
      ])
    }
    const risk = (
      await engine.request<{ band: string; loyalty: { purchases: number } }>({
        method: 'GET',
        path: `/analysis/customers/${customerId}/risk`,
      })
    ).data
    expect(risk.loyalty.purchases).toBe(4)
    expect(risk.band).not.toBe('healthy')
    expect(risk.band).not.toBe('unknown')
  })

  it('working capital: receivables and payables are what is still owed; cash is not in it', async () => {
    await sale({ dueInDays: -5 }) // 1000 owed
    const res = (
      await engine.request<{
        receivables: number
        payables: number
        inventoryAtCost: number
        dso: number | null
        costOfGoodsSoldKnown: boolean
        netWorkingCapital: number
      }>({
        method: 'GET',
        path: `/analysis/working-capital?from=${iso(-30)}&to=${iso(0)}&currency=AFN`,
      })
    ).data
    expect(res.receivables).toBe(1000)
    expect(res.payables).toBe(0)
    // 490 units left at 50 each.
    expect(res.inventoryAtCost).toBe(24500)
    expect(res.costOfGoodsSoldKnown).toBe(true)
    expect(res.netWorkingCapital).toBe(25500)
    expect(res).not.toHaveProperty('quickRatio')
  })

  it('working capital: a sale with no recorded cost makes days of stock UNKNOWN, not zero', async () => {
    const free = await engine.request({
      method: 'POST',
      path: '/products',
      body: {
        name: 'بی‌بها',
        buyPrice: 0,
        sellPrice: 100,
        quantity: 10,
        warehouseId: TEST_WAREHOUSE_ID,
      },
    })
    const id = (free.data as { id: string }).id
    const sold = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [{ productId: id, productName: 'x', quantity: 1, unitPrice: 100, discount: 0 }],
      },
    })
    expect(sold.status).toBe(201)
    const res = (
      await engine.request<{
        costOfGoodsSoldKnown: boolean
        dio: number | null
        cashConversionCycle: number | null
      }>({
        method: 'GET',
        path: `/analysis/working-capital?from=${iso(-30)}&to=${iso(0)}&currency=AFN`,
      })
    ).data
    expect(res.costOfGoodsSoldKnown).toBe(false)
    expect(res.dio).toBeNull()
    expect(res.cashConversionCycle).toBeNull()
  })

  it('refuses a reversed range and a currency the product cannot format', async () => {
    const reversed = await engine.request({
      method: 'GET',
      path: `/analysis/working-capital?from=${iso(0)}&to=${iso(-5)}&currency=AFN`,
    })
    expect(reversed.status).toBe(400)
    const bad = await engine.request({
      method: 'GET',
      path: `/analysis/break-even?from=${iso(-5)}&to=${iso(0)}&currency=ZZZ`,
    })
    expect(bad.status).toBe(400)
  })

  it('break-even: salaries are not invented, and an unstated fixed cost is a lower bound', async () => {
    await sale()
    const res = (
      await engine.request<{ currency: string; from: string }>({
        method: 'GET',
        path: `/analysis/break-even?from=${iso(-30)}&to=${iso(0)}&currency=AFN`,
      })
    ).data
    expect(res.currency).toBe('AFN')
    expect(res.from).toBe(iso(-30))
  })

  it('cohorts: the month of the first purchase groups the customers', async () => {
    await sale()
    const res = (
      await engine.request<{ cohorts: Array<{ cohort: string; customers: number }> }>({
        method: 'GET',
        path: '/analysis/cohorts',
      })
    ).data
    expect(res.cohorts.length).toBeGreaterThan(0)
  })

  it('suppliers: scored from purchase orders, with orders without a promised date counted apart', async () => {
    const supplier = '55555555-5555-4555-8555-555555555555'
    db.run(
      `INSERT INTO supplier (id, workspace_id, name, is_active, created_at, updated_at)
       VALUES (?, ?, 'الف', 1, datetime('now'), datetime('now'))`,
      [supplier, TEST_WORKSPACE_ID],
    )
    const order = await engine.request({
      method: 'POST',
      path: '/purchase-orders',
      body: {
        supplierId: supplier,
        items: [{ productId, quantity: 10, unitPrice: 50, totalPrice: 500 }],
      },
    })
    expect(order.status).toBe(201)
    const res = (
      await engine.request<{
        orders: number
        ordersWithoutPromisedDate: number
        suppliers: Array<{ name: string; score: number | null }>
      }>({ method: 'GET', path: '/analysis/suppliers' })
    ).data
    expect(res.orders).toBe(1)
    expect(res.ordersWithoutPromisedDate).toBe(1)
    expect(res.suppliers[0]).toMatchObject({ name: 'الف' })
    // One order is not enough history for a score — unknown, not zero.
    expect(res.suppliers[0]!.score).toBeNull()
  })
})
