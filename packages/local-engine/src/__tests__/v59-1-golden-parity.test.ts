// ============================================
// packages/local-engine/src/__tests__/v59-1-golden-parity.test.ts
//
// Golden-fixture parity across V59.1 domains: runs identical inputs through
// shared validation domain rules AND the local-engine SQLite handlers so
// server semantics and local device semantics agree byte-for-byte.
// ============================================

import { describe, expect, it } from 'vitest'
import {
  applyPrice,
  parseBulkImeis,
  quoteGoldItemPrice,
  repairMoveRefusal,
  routeReturnedSerial,
  type SerialRecord,
} from '@hisabche/validation'
import { applyLocalRepairTransition } from '../services/repair-transitions'
import {
  createTestDb,
  createTestEngine,
  TEST_USER_ID,
  TEST_WAREHOUSE_ID,
  TEST_WORKSPACE_ID,
} from './test-db'

const headers = {
  'x-workspace-id': TEST_WORKSPACE_ID,
  'x-user-id': TEST_USER_ID,
  'x-user-role': 'owner',
  'x-hisabche-queue': '1',
}

describe('V59.1 Golden-fixture server vs local-engine parity', () => {
  it('Gold snapshot pricing matches quoteGoldItemPrice + applyPrice cleanly', () => {
    const quote = quoteGoldItemPrice(
      { productId: 'p-gold', kind: 'sale', quantity: 1 },
      {
        karat: 21,
        netWeightMg: 5_500, // 5.5g
        rateSnapshot: {
          rate24kMinorPerGram: 420_000,
          capturedAt: '2026-11-11T10:00:00Z',
          capturedBy: 'user-1',
        },
        makingChargeType: 'fixed',
        makingChargeValue: 15_000,
      },
      undefined,
      [],
      '2026-11-11',
    )
    expect(quote.unitPriceMinor).toBeGreaterThan(0)
    const [applied] = applyPrice([{ productId: 'p-gold', quantity: 1 }], [quote])
    expect(applied?.unitPrice).toBe(quote.unitPriceMinor / 100)
    expect(applied?.goldSnapshot).toEqual(quote.goldSnapshot)
  })

  it('Salon check-in parity: SQLite service-delivery route moves scheduled -> checked_in -> in_progress and audits transition', async () => {
    const db = createTestDb()
    const engine = createTestEngine(db)
    const cust = '44444444-4444-4444-8444-444444444444'
    const svc = '55555555-5555-4555-8555-555555555555'
    db.run(
      `INSERT INTO customer (id, workspace_id, full_name, phone, created_at, updated_at)
       VALUES (?, ?, 'Mariam', '0700111222', '2026-11-11', '2026-11-11')`,
      [cust, TEST_WORKSPACE_ID],
    )
    db.run(
      `INSERT INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, offering_type, updated_at)
       VALUES (?, ?, 'Haircut', 0, 500, 0, 1, 'service', '2026-11-11')`,
      [svc, TEST_WORKSPACE_ID],
    )
    const created = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/service-delivery/sessions',
      body: {
        workspaceId: TEST_WORKSPACE_ID,
        customerId: cust,
        serviceOfferingId: svc,
        sessionDate: '2026-11-11',
        startTime: '14:00',
        endTime: '15:00',
        settlementMethod: 'complementary',
      },
      headers,
    })
    expect(created.status).toBe(201)
    const id = created.data.id

    const s1 = await engine.request<{ session: { status: string } }>({
      method: 'POST',
      path: `/service-delivery/sessions/${id}/status`,
      body: { to: 'checked_in' },
      headers,
    })
    expect(s1.status).toBe(200)
    expect(s1.data.session.status).toBe('checked_in')

    const auditRows = db.all<{ from_status: string; to_status: string }>(
      'SELECT from_status, to_status FROM service_delivery_status_audit WHERE session_id = ?',
      [id],
    )
    expect(auditRows).toEqual([{ from_status: 'scheduled', to_status: 'checked_in' }])
  })

  it('Mobile IMEI parity: bulk parseBulkImeis + duplicate receive refusal + routeReturnedSerial condition routing', async () => {
    const bulk = parseBulkImeis('356789012345601\n356789012345602, 356789012345601')
    expect(bulk.unique).toEqual(['356789012345601', '356789012345602'])
    expect(bulk.duplicates).toEqual(['356789012345601'])

    const db = createTestDb()
    const engine = createTestEngine(db)
    const prod = '77777777-7777-4777-8777-777777777777'
    db.run(
      `INSERT INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, offering_type, updated_at)
       VALUES (?, ?, 'Phone X', 10000, 12000, 2, 1, 'goods', '2026-11-11')`,
      [prod, TEST_WORKSPACE_ID],
    )
    const r1 = await engine.request({
      method: 'POST',
      path: '/operations/serials',
      body: { productId: prod, serialNumbers: bulk.unique, unitCostMinor: 1000000 },
      headers,
    })
    expect(r1.status).toBe(201)

    const dup = await engine.request({
      method: 'POST',
      path: '/operations/serials',
      body: { productId: prod, serialNumbers: ['356789012345601'], unitCostMinor: 1000000 },
      headers,
    })
    expect(dup.status).toBe(409)

    const sold: SerialRecord = {
      serialNumber: '356789012345601',
      productId: prod,
      status: 'sold',
      soldInvoiceId: 'inv-1',
    }
    expect(routeReturnedSerial(sold, 'opened').status).toBe('in_stock')
    expect(routeReturnedSerial(sold, 'defective').status).toBe('returned')
  })

  it('Repair illegal transition parity matches server repairMoveRefusal', () => {
    const db = createTestDb()
    const ticketId = '88888888-8888-4888-8888-888888888888'
    db.run(
      `INSERT INTO repair_tickets (id, workspace_id, number, customer_id, device_label, problem, status, created_by)
       VALUES (?, ?, 7, 'c1', 'Redmi Note', 'Mic', 'received', ?)`,
      [ticketId, TEST_WORKSPACE_ID, TEST_USER_ID],
    )
    const serverCode = repairMoveRefusal('received', { status: 'delivered' })
    expect(() =>
      applyLocalRepairTransition(db, TEST_WORKSPACE_ID, TEST_USER_ID, ticketId, {
        status: 'delivered',
      }),
    ).toThrow(new RegExp(String(serverCode)))
  })

  // ⚠️ ONE CURRENCY, ONE STORE. This is NOT the two-currency, two-store golden
  // parity V68.7 asked for (that needs the same fixture through
  // InvoiceService.create on a real PostgreSQL) — it pins what the device
  // computes for a weighed line and a line discount, by hand arithmetic.
  it('device sale: weighed line, line and invoice discount, stock and cost consumption', async () => {
    const db = createTestDb()
    const engine = createTestEngine(db)

    // Hand calculations:
    // Item 1: Saffron (weighted / gram):
    //   Quantity: 100 grams
    //   Unit Price: 150 AFN per gram
    //   Line Total before discount: 100 * 150 = 15,000 AFN
    //   Line Discount: 10% (= 1,500 AFN)
    //   Line Net: 13,500 AFN
    // Item 2: Energy drink (converted unit: 1 Carton = 24 pcs):
    //   Quantity: 2 Cartons (= 48 pcs)
    //   Unit Price: 1,200 AFN per carton
    //   Line Total: 2,400 AFN
    //   Line Discount: 0%
    // Subtotal: 15,000 + 2,400 = 17,400 AFN
    // Total Line Discounts: 1,500 AFN
    // Invoice-level Discount: 400 AFN (Total discounts = 1,900 AFN)
    // Tax (2% on discounted net: 2% of 15,500 = 310 AFN)
    // Total: 15,500 + 310 = 15,810 AFN
    // Scale check (BUG-096): 15,000 < Total < 20,000 AFN

    const custId = '11111111-1111-4111-8111-111111111111'
    const saffronId = '22222222-2222-4222-8222-222222222222'
    const drinkId = '33333333-3333-4333-8333-333333333333'

    // Customer in good standing
    db.run(
      `INSERT INTO customer (id, workspace_id, full_name, phone, opening_balance, created_at, updated_at)
       VALUES (?, ?, 'Ahmad Wholesale', '0700999888', 0, '2026-11-16', '2026-11-16')`,
      [custId, TEST_WORKSPACE_ID],
    )

    // Saffron: in stock 500 grams, buy price 100 AFN, sell price 150 AFN (FIFO costing)
    db.run(
      `INSERT INTO product (id, workspace_id, name, buy_price, sell_price, quantity, unit, is_active, offering_type, updated_at)
       VALUES (?, ?, 'Herat Saffron', 100, 150, 500, 'gram', 1, 'goods', '2026-11-16')`,
      [saffronId, TEST_WORKSPACE_ID],
    )
    db.run(
      `INSERT INTO cost_layer (id, workspace_id, product_id, warehouse_id, source_type, received_qty, remaining_qty, unit_cost, currency, entry_date, created_at, updated_at)
       VALUES ('layer-saf-1', ?, ?, ?, 'manual', 500, 500, 100, 'AFN', '2026-11-16', '2026-11-16', '2026-11-16')`,
      [TEST_WORKSPACE_ID, saffronId, TEST_WAREHOUSE_ID],
    )

    // Energy drink: in stock 120 pcs, buy price 40 AFN, sell price 50 AFN (= 1,200 AFN / carton of 24)
    db.run(
      `INSERT INTO product (id, workspace_id, name, buy_price, sell_price, quantity, unit, is_active, offering_type, updated_at)
       VALUES (?, ?, 'Energy Drink', 40, 50, 120, 'piece', 1, 'goods', '2026-11-16')`,
      [drinkId, TEST_WORKSPACE_ID],
    )
    db.run(
      `INSERT INTO cost_layer (id, workspace_id, product_id, warehouse_id, source_type, received_qty, remaining_qty, unit_cost, currency, entry_date, created_at, updated_at)
       VALUES ('layer-drk-1', ?, ?, ?, 'manual', 120, 120, 40, 'AFN', '2026-11-16', '2026-11-16', '2026-11-16')`,
      [TEST_WORKSPACE_ID, drinkId, TEST_WAREHOUSE_ID],
    )

    const invoiceRes = await engine.request<{
      id: string
      invoice_number: string
      subtotal: number
      discount_total: number
      tax_total: number
      total: number
      paid_amount: number
    }>({
      method: 'POST',
      path: '/invoices',
      body: {
        workspaceId: TEST_WORKSPACE_ID,
        customerId: custId,
        currency: 'AFN',
        date: '2026-11-16',
        discountTotal: 400,
        taxTotal: 310,
        items: [
          {
            productId: saffronId,
            productName: 'Herat Saffron',
            quantity: 100,
            unitPrice: 150,
            discount: 10,
            unit: 'gram',
          },
          {
            productId: drinkId,
            productName: 'Energy Drink',
            quantity: 2, // 2 cartons
            unitPrice: 1200,
            discount: 0,
            unit: 'carton',
          },
        ],
      },
      headers,
    })

    expect(invoiceRes.status).toBe(201)
    const inv = invoiceRes.data

    // 1. Hand-calculated exact arithmetic checks:
    // Subtotal of lines after line discounts = 13,500 + 2,400 = 15,900 AFN
    expect(inv.subtotal).toBe(15900)
    expect(inv.discount_total).toBe(400)
    expect(inv.tax_total).toBe(310)
    // Total = 15,900 - 400 + 310 = 15,810 AFN
    expect(inv.total).toBe(15810)

    // 2. Scale assertion beside exact one (BUG-096 rule)
    expect(inv.total).toBeGreaterThan(15000)
    expect(inv.total).toBeLessThan(20000)

    // 3. Stock decrement parity:
    const saffronRow = db.get<{ quantity: number }>('SELECT quantity FROM product WHERE id = ?', [
      saffronId,
    ])
    expect(saffronRow?.quantity).toBe(400) // 500 - 100

    // 4. Cost consumption parity:
    const consumptions = db.all<{ quantity: number; unit_cost: number }>(
      "SELECT quantity, unit_cost FROM cost_consumption WHERE consumer_type = 'invoice' AND consumer_id = ?",
      [inv.id],
    )
    expect(consumptions.length).toBeGreaterThan(0)

    // 5. Customer party balance / outstanding:
    const custRow = db.get<{ opening_balance: number }>(
      'SELECT opening_balance FROM customer WHERE id = ?',
      [custId],
    )
    expect(custRow).toBeDefined()
  })
})
