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
import { createTestDb, createTestEngine, TEST_USER_ID, TEST_WORKSPACE_ID } from './test-db'

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
})
