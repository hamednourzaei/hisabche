// WP-18: a package is granted on the DEVICE so it can be consumed offline;
// a repeated idempotency key never grants twice, and the grant is not queued as
// a second command (the invoice is the one server-side grant).

import { beforeEach, describe, expect, it } from 'vitest'
import type { LocalDb } from '../db'
import { createTestDb, createTestEngine, TEST_USER_ID, TEST_WORKSPACE_ID } from './test-db'

const ws = TEST_WORKSPACE_ID
const CUST = '44444444-4444-4444-8444-444444444444'
const PACKAGE = '66666666-6666-4666-8666-666666666666'

let db: LocalDb
let engine: ReturnType<typeof createTestEngine>

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
  db.run(
    `INSERT OR REPLACE INTO customer (id, workspace_id, full_name, created_at, updated_at) VALUES (?, ?, 'x', '2026-11-01', '2026-11-01')`,
    [CUST, ws],
  )
})

function grant(key?: string) {
  return engine.request<{ entry: { id: string; quantity: number }; alreadyGranted: boolean }>({
    method: 'POST',
    path: '/local-package-credits/grant',
    body: {
      customerId: CUST,
      packageProductId: PACKAGE,
      quantity: 10,
      idempotencyKey: key,
      sourceDocumentType: 'invoice',
    },
  })
}

describe('offline package credit grant (WP-18)', () => {
  it('grants a balance that can be read offline', async () => {
    const res = await grant('sale-inv-1')
    expect(res.status, JSON.stringify(res.data)).toBe(201)
    expect(res.data.entry.quantity).toBe(10)
    const rows = db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM package_credit_ledger WHERE workspace_id = ? AND entry_type = 'GRANT'`,
      [ws],
    )
    expect(rows?.count).toBe(1)
  })

  it('the same idempotency key grants only once', async () => {
    const a = await grant('sale-inv-2')
    const b = await grant('sale-inv-2')
    expect(a.data.alreadyGranted).toBe(false)
    expect(b.data.alreadyGranted).toBe(true)
    expect(b.data.entry.id).toBe(a.data.entry.id)
    const rows = db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM package_credit_ledger WHERE workspace_id = ? AND idempotency_key = 'sale-inv-2'`,
      [ws],
    )
    expect(rows?.count).toBe(1)
  })

  it('a non-positive quantity is refused', async () => {
    const res = await engine.request({
      method: 'POST',
      path: '/local-package-credits/grant',
      body: { customerId: CUST, packageProductId: PACKAGE, quantity: 0 },
    })
    expect(res.status).toBe(400)
  })

  it('the GRANT is never queued as a second command', async () => {
    await engine.request({
      method: 'POST',
      path: '/local-package-credits/grant',
      headers: { 'x-user-id': TEST_USER_ID, 'x-hisabche-queue': '1' },
      body: { customerId: CUST, packageProductId: PACKAGE, quantity: 5, idempotencyKey: 'k-q' },
    })
    const outbox = db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE entity = 'package_credit_ledger'`,
    )
    expect(outbox?.count ?? 0).toBe(0)
  })
})
