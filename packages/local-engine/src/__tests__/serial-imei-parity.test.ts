import { describe, expect, it } from 'vitest'
import {
  createTestDb,
  createTestEngine,
  TEST_USER_ID,
  TEST_WAREHOUSE_ID,
  TEST_WORKSPACE_ID,
} from './test-db'

describe('8.3 Offline Workspace-Wide IMEI Uniqueness', () => {
  it('refuses receiving an already registered IMEI under a second phone model', async () => {
    const db = createTestDb()
    const engine = createTestEngine(db)
    const now = new Date().toISOString()

    db.run(
      `INSERT INTO product (id, workspace_id, name, sell_price, buy_price, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      ['p-a', TEST_WORKSPACE_ID, 'iPhone 15', 50000, 42000, now],
    )
    db.run(
      `INSERT INTO product (id, workspace_id, name, sell_price, buy_price, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      ['p-b', TEST_WORKSPACE_ID, 'Galaxy S24', 45000, 38000, now],
    )

    const r1 = await engine.request({
      method: 'POST',
      path: '/operations/serials',
      headers: { 'x-user-id': TEST_USER_ID },
      body: {
        productId: 'p-a',
        warehouseId: TEST_WAREHOUSE_ID,
        unitCostMinor: 42000,
        serialNumbers: ['356789012345679'],
      },
    })
    expect(r1.status).toBe(201)

    const r2 = await engine.request<{ code: string }>({
      method: 'POST',
      path: '/operations/serials',
      headers: { 'x-user-id': TEST_USER_ID },
      body: {
        productId: 'p-b',
        warehouseId: TEST_WAREHOUSE_ID,
        unitCostMinor: 38000,
        serialNumbers: ['356789012345679'],
      },
    })
    expect(r2.status).toBe(409)
    expect(r2.data.code).toContain('SERIAL_DUPLICATE')
  })
})
