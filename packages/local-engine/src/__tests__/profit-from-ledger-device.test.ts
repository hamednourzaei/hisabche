// ============================================
// packages/local-engine/src/__tests__/profit-from-ledger-device.test.ts
//
// M5 / C2 (+ M6-A): the profit report headline is the LEDGER; per-product rows are drill-down and RECONCILE to it:
//     totals.revenue + reconciliation.revenue == ledger.revenue        (cost likewise, with the inventory loss)
// A difference is shown, never hidden. Goods, service, package + deferral, delivery, cancellation, foreign currency, unpaid/paid.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import type { LocalDb } from '../db'
import { createTestDb, createTestEngine, TEST_USER_ID, TEST_WORKSPACE_ID } from './test-db'

const ws = TEST_WORKSPACE_ID
const CUST = '44444444-4444-4444-8444-444444444444'
const SERVICE = '55555555-5555-4555-8555-555555555555'
const PACKAGE = '66666666-6666-4666-8666-666666666666'
const GOODS = '88888888-8888-4888-8888-888888888801'
const headers = {
  'x-workspace-id': ws,
  'x-user-id': TEST_USER_ID,
  'x-user-role': 'owner',
  'x-hisabche-queue': '1',
}

let db: LocalDb
let engine: ReturnType<typeof createTestEngine>

interface Totals {
  revenue: number
  cost: number
  basis: 'ledger' | 'drill_down'
  drillDown?: { revenue: number; cost: number }
  deferredRevenueChange?: number
  ledger?: { revenue: number; cost: number; inventoryLoss: number; grossProfit: number }
  reconciliation?: { revenue: number; cost: number }
}

const profit = async (): Promise<Totals> =>
  (
    await engine.request<{ totals: Totals }>({
      method: 'GET',
      path: '/accounting/profit-report?from=2026-01-01&to=2026-12-31&currency=AFN',
      headers,
    })
  ).data.totals

const sell = (body: Record<string, unknown>) =>
  engine.request<{ id: string }>({
    method: 'POST',
    path: '/invoices',
    headers,
    body: { type: 'sale', customerId: CUST, currency: 'AFN', date: '2026-11-01', ...body },
  })

const buyPens = () =>
  engine.request({
    method: 'POST',
    path: '/invoices',
    headers,
    body: {
      type: 'purchase',
      currency: 'AFN',
      date: '2026-10-01',
      items: [{ productId: GOODS, productName: 'Pen', quantity: 5, unitPrice: 100 }],
    },
  })

/** sum(drill-down) + reconciliation == ledger, for revenue and for cost + loss. */
function expectReconciles(totals: Totals) {
  expect(totals.ledger, 'the ledger block is present').toBeDefined()
  expect(totals.reconciliation, 'the reconciliation row is present').toBeDefined()
  expect(totals.basis).toBe('ledger')
  expect(totals.revenue, 'the headline IS the ledger').toBe(totals.ledger!.revenue)
  expect(Math.round((totals.drillDown!.revenue + totals.reconciliation!.revenue) * 100) / 100).toBe(
    totals.ledger!.revenue,
  )
  expect(Math.round((totals.drillDown!.cost + totals.reconciliation!.cost) * 100) / 100).toBe(
    Math.round((totals.ledger!.cost + totals.ledger!.inventoryLoss) * 100) / 100,
  )
}

async function deliver(date = '2026-11-02') {
  const session = await engine.request<{ id: string }>({
    method: 'POST',
    path: '/service-delivery/sessions',
    headers,
    body: {
      workspaceId: ws,
      customerId: CUST,
      serviceOfferingId: SERVICE,
      sessionDate: date,
      startTime: '10:00',
      endTime: '11:00',
      settlementMethod: 'package_credit',
    },
  })
  const res = await engine.request({
    method: 'POST',
    path: `/service-delivery/sessions/${session.data.id}/deliver`,
    headers,
    body: { packageProductId: PACKAGE },
  })
  expect(res.status, JSON.stringify(res.data)).toBe(200)
  return session.data.id
}

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
  db.run(
    `INSERT OR REPLACE INTO customer (id, workspace_id, full_name, created_at, updated_at) VALUES (?, ?, 'Zahra', '2026-11-01', '2026-11-01')`,
    [CUST, ws],
  )
  for (const [id, type, buy] of [
    [SERVICE, 'service', 0],
    [PACKAGE, 'package', 0],
    [GOODS, 'goods', 100],
  ] as const) {
    db.run(
      `INSERT OR REPLACE INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, offering_type, updated_at) VALUES (?, ?, 'x', ?, 100, 0, 1, ?, '2026-11-01')`,
      [id, ws, buy, type],
    )
  }
})

describe('C2: profit headline = the ledger, drill-down reconciles', () => {
  it('goods sale: revenue and COGS come from the ledger and the drill-down agrees', async () => {
    await buyPens()
    expect(
      (
        await sell({
          items: [{ productId: GOODS, productName: 'Pen', quantity: 2, unitPrice: 150 }],
        })
      ).status,
    ).toBe(201)
    const totals = await profit()
    expect(totals.ledger).toMatchObject({
      revenue: 300,
      cost: 200,
      inventoryLoss: 0,
      grossProfit: 100,
    })
    expect(totals.reconciliation).toEqual({ revenue: 0, cost: 0 })
    expectReconciles(totals)
  })

  it('service sale, unpaid then paid: a payment never changes profit (profit is not cash)', async () => {
    const sale = await sell({
      items: [{ productId: SERVICE, productName: 's', quantity: 1, unitPrice: 500 }],
    })
    const unpaid = await profit()
    expect(unpaid.ledger?.revenue).toBe(500)
    await engine.request({
      method: 'POST',
      path: '/payments',
      headers: { ...headers, 'idempotency-key': 'p1' },
      body: {
        id: 'p1',
        amount: 500,
        direction: 'in',
        partyType: 'customer',
        partyId: CUST,
        method: 'cash',
        currency: 'AFN',
        entryDate: '2026-11-02',
        allocations: [{ invoiceId: sale.data.id, amount: 500 }],
      },
    })
    const paid = await profit()
    expect(paid.ledger).toEqual(unpaid.ledger)
    expectReconciles(paid)
  })

  it('package with deferral ON: sold 1 000, delivered 3 times -> ledger revenue 300 (only what was delivered)', async () => {
    db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES ('package_deferred_revenue', 'on')`)
    await sell({ items: [{ productId: PACKAGE, productName: 'p', quantity: 10, unitPrice: 100 }] })
    for (let i = 0; i < 3; i += 1) await deliver()
    const totals = await profit()
    expect(totals.ledger?.revenue).toBe(300)
    expect(totals.revenue).toBe(300)
    expect(totals.deferredRevenueChange).toBe(700)
    expectReconciles(totals)
  })

  it('cancelling a delivery takes its revenue back out of the ledger and out of the report', async () => {
    db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES ('package_deferred_revenue', 'on')`)
    await sell({ items: [{ productId: PACKAGE, productName: 'p', quantity: 10, unitPrice: 100 }] })
    const first = await deliver()
    await deliver()
    await engine.request({
      method: 'POST',
      path: `/service-delivery/sessions/${first}/cancel`,
      headers,
      body: { reason: 'customer asked' },
    })
    const totals = await profit()
    expect(totals.ledger?.revenue).toBe(100) // one delivery left
    expectReconciles(totals)
  })

  it('foreign currency: 20 USD x 65 = 1 300 AFN in the ledger and in the report, counted once', async () => {
    await buyPens()
    expect(
      (
        await sell({
          currency: 'USD',
          exchangeRate: 65,
          items: [{ productId: GOODS, productName: 'Pen', quantity: 2, unitPrice: 10 }],
        })
      ).status,
    ).toBe(201)
    const totals = await profit()
    expect(totals.ledger).toMatchObject({ revenue: 1300, cost: 200 })
    expect(totals.reconciliation).toEqual({ revenue: 0, cost: 0 })
  })

  it('a difference is SHOWN: a sale booked in the ledger whose lines were lost surfaces as a reconciliation row, not as silence', async () => {
    await sell({ items: [{ productId: SERVICE, productName: 's', quantity: 1, unitPrice: 500 }] })
    db.run(`DELETE FROM invoice_item`)
    const totals = await profit()
    expect(totals.ledger?.revenue).toBe(500)
    expect(totals.revenue).toBe(500) // the headline is the ledger
    expect(totals.drillDown?.revenue).toBe(0) // the operational detail is gone
    expect(totals.reconciliation?.revenue).toBe(500)
    expectReconciles(totals)
  })
})
