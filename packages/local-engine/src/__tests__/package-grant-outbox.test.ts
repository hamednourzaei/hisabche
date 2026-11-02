// ============================================
// packages/local-engine/src/__tests__/package-grant-outbox.test.ts
//
// A package sold on the device grants its credit LOCALLY (so it can be used offline) - and the credit reaches the server
// THROUGH THE INVOICE, which grants it there under its own key.
//
// What used to happen: the device ALSO queued a `package_credit_ledger` command for the grant, and the sync engine routed every
// ledger entry that was not REVERSAL / EXPIRE / ADJUSTMENT to `/package-credits/consume` - so a GRANT of 10 units was sent as a
// CONSUME of 10 units: it spent the credit the invoice had just granted (or was refused for lack of credit, leaving the device
// and the server disagreeing). One command per fact, and the invoice is the command.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'
import type { LocalDb } from '../db'
import {
  createTestDb,
  createTestEngine,
  TEST_USER_ID,
  TEST_WAREHOUSE_ID,
  TEST_WORKSPACE_ID,
} from './test-db'

const ws = TEST_WORKSPACE_ID
const CUST = '44444444-4444-4444-8444-444444444444'
const PACKAGE = '66666666-6666-4666-8666-666666666666'

let db: LocalDb
let engine: ReturnType<typeof createTestEngine>

const headers = {
  'x-workspace-id': ws,
  'x-user-id': TEST_USER_ID,
  'x-user-role': 'owner',
  'x-hisabche-queue': '1',
}

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
  db.run(
    `INSERT OR REPLACE INTO customer (id, workspace_id, full_name, created_at, updated_at) VALUES (?, ?, 'x', '2026-11-01', '2026-11-01')`,
    [CUST, ws],
  )
  db.run(
    `INSERT OR REPLACE INTO product (id, workspace_id, name, buy_price, sell_price, quantity, is_active, offering_type, updated_at)
     VALUES (?, ?, '10-session course', 0, 1000, 0, 1, 'package', '2026-11-01')`,
    [PACKAGE, ws],
  )
})

describe('selling a package on the device', () => {
  it('grants the credit locally, and queues the INVOICE only - no separate ledger command', async () => {
    const res = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/invoices',
      headers,
      body: {
        type: 'sale',
        customerId: CUST,
        currency: 'AFN',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [{ productId: PACKAGE, productName: 'course', quantity: 10, unitPrice: 100 }],
      },
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)

    const granted = db.all<{ n: number; q: number }>(
      "SELECT COUNT(*) AS n, COALESCE(SUM(quantity), 0) AS q FROM package_credit_ledger WHERE entry_type = 'GRANT'",
    )[0]!
    expect(granted).toEqual({ n: 1, q: 10 })

    const queued = db.all<{ entity: string }>(
      'SELECT entity FROM sync_queue ORDER BY created_at, rowid',
    )
    expect(queued.map((row) => row.entity)).toEqual(['invoice'])
  })
})

describe('the period lock and a package sale', () => {
  it('a package invoice dated inside a closed period is refused whole: no invoice, NO credit granted, nothing queued', async () => {
    await engine.request({
      method: 'PUT',
      path: '/accounting/period-lock',
      body: { lockedUntil: '2026-10-16' },
    })
    const res = await engine.request<{ code: string }>({
      method: 'POST',
      path: '/invoices',
      headers,
      body: {
        type: 'sale',
        customerId: CUST,
        currency: 'AFN',
        date: '2026-10-10T00:00:00.000Z',
        warehouseId: TEST_WAREHOUSE_ID,
        items: [{ productId: PACKAGE, productName: 'course', quantity: 10, unitPrice: 100 }],
      },
    })
    expect(res.status).toBe(409)
    expect(res.data.code).toBe('ACCOUNTING_PERIOD_LOCKED')
    const count = (sql: string) => db.all<{ n: number }>(sql)[0]!.n
    expect(count('SELECT COUNT(*) AS n FROM package_credit_ledger')).toBe(0)
    expect(count('SELECT COUNT(*) AS n FROM invoice')).toBe(0)
    expect(count('SELECT COUNT(*) AS n FROM sync_queue')).toBe(0)
  })
})
