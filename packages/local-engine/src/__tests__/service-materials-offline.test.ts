// V54 5.4 (8 Nov 2026) — materials chosen offline travel to the server in the
// delivery command; the device itself does not deduct them (cost layers and
// the ledger are the server's). Real SQLite.
import { describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, TEST_WORKSPACE_ID, TEST_USER_ID } from './test-db'
import type { ServiceDeliverySession } from '@hisabche/validation'

const ws = TEST_WORKSPACE_ID
const custId = '44444444-4444-4444-8444-444444444444'
const serviceOfferingId = '55555555-5555-4555-8555-555555555555'
const gel = '66666666-6666-4666-8666-666666666666'
const headers = {
  'x-workspace-id': ws,
  'x-user-id': TEST_USER_ID,
  'x-user-role': 'owner',
  'x-hisabche-queue': '1',
}

describe('materials on an offline delivery', () => {
  it('are carried in the queued command, cleaned, and leave local stock alone', async () => {
    const db = createTestDb()
    const engine = createTestEngine(db)
    db.run(
      `INSERT OR REPLACE INTO customer (id, workspace_id, full_name, phone, created_at, updated_at)
       VALUES (?, ?, 'Zahra', '0799887766', '2026-11-01', '2026-11-01')`,
      [custId, ws],
    )
    db.run(
      `INSERT OR REPLACE INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, offering_type, updated_at)
       VALUES (?, ?, 'Gel polish', 0, 1500, 0, 1, 'service', '2026-11-01')`,
      [serviceOfferingId, ws],
    )
    db.run(
      `INSERT OR REPLACE INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, updated_at)
       VALUES (?, ?, 'Gel bottle', 100, 0, 5, 1, '2026-11-01')`,
      [gel, ws],
    )
    const created = await engine.request<ServiceDeliverySession>({
      method: 'POST',
      path: '/service-delivery/sessions',
      body: {
        workspaceId: ws,
        customerId: custId,
        serviceOfferingId,
        sessionDate: '2026-11-08',
        startTime: '10:00',
        endTime: '11:00',
        settlementMethod: 'complementary',
      },
      headers,
    })
    const res = await engine.request({
      method: 'POST',
      path: `/service-delivery/sessions/${created.data.id}/deliver`,
      body: {
        settlementMethod: 'complementary',
        reason: 'trial',
        consumables: [
          { productId: gel, quantity: 2 },
          { productId: gel, quantity: 0 },
          { productId: 7, quantity: 1 },
        ],
      },
      headers,
    })
    expect(res.status).toBe(200)

    const queued = db.all<{ payload: string }>(
      `SELECT payload FROM sync_queue WHERE entity = 'service_delivery_sessions'`,
    )
    const deliver = queued
      .map((row) => JSON.parse(row.payload))
      .find((p) => p.status === 'delivered')
    expect(deliver?.consumables).toEqual([{ productId: gel, quantity: 2 }])
    const stock = db.get<{ quantity: number }>(`SELECT quantity FROM product WHERE id = ?`, [gel])
    expect(stock?.quantity).toBe(5)
  })
})
