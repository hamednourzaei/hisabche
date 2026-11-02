// ============================================
// packages/local-engine/src/__tests__/return-stock-decision.test.ts
//
// C5 on the device: a sound return goes back on the shelf with the permission a return already has; only SCRAP (goods written
// off, cost to loss) needs stock.adjust - manager by default, delegable. A line that names neither is refused whole.
// ============================================

import { describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, TEST_USER_ID, TEST_WORKSPACE_ID } from './test-db'

function seed() {
  const db = createTestDb()
  const engine = createTestEngine(db)
  db.run(
    `INSERT INTO invoice (id, workspace_id, invoice_number, type, date, currency, subtotal, tax_total, total, status, updated_at)
     VALUES ('inv-1', ?, 'INV-1', 'sale', '2026-11-01', 'AFN', 1000, 0, 1000, 'paid', datetime('now'))`,
    [TEST_WORKSPACE_ID],
  )
  db.run(
    `INSERT INTO product (id, workspace_id, name, quantity, buy_price, sell_price, updated_at)
     VALUES ('p-1', ?, 'x', 10, 100, 200, datetime('now'))`,
    [TEST_WORKSPACE_ID],
  )
  db.run(
    `INSERT INTO invoice_item (id, workspace_id, invoice_id, product_id, product_name, quantity, unit_price, discount, total_price, updated_at)
     VALUES ('line-1', ?, 'inv-1', 'p-1', 'x', 5, 200, 0, 1000, datetime('now'))`,
    [TEST_WORKSPACE_ID],
  )
  return engine
}

const as = (role: string) => ({
  'x-workspace-id': TEST_WORKSPACE_ID,
  'x-user-id': TEST_USER_ID,
  'x-user-role': role,
})

const body = (choice: 'restock' | 'scrap' | undefined) => ({
  returnType: 'sale_return',
  returnNumber: `RET-${choice ?? 'none'}`,
  returnDate: '2026-11-02',
  lines: [
    { originalLineId: 'line-1', returnQuantity: 1, ...(choice ? { restockChoice: choice } : {}) },
  ],
})

const post = (
  engine: ReturnType<typeof seed>,
  role: string,
  choice: 'restock' | 'scrap' | undefined,
) =>
  engine.request({
    method: 'POST',
    path: '/invoices/inv-1/returns',
    headers: as(role),
    body: body(choice),
  })

describe('C5 on the device: RETURN and SCRAP are different events', () => {
  it('return + RESTOCK: an authorized seller needs nothing beyond the return permission', async () => {
    const res = await post(seed(), 'seller', 'restock')
    expect(res.status, JSON.stringify(res.data)).toBe(201)
  })

  it('return + SCRAP without stock.adjust is refused, and nothing is recorded', async () => {
    const engine = seed()
    const res = await post(engine, 'seller', 'scrap')
    expect(res.status, JSON.stringify(res.data)).toBe(403)
  })

  it('return + SCRAP by a manager and by the owner is accepted', async () => {
    for (const role of ['manager', 'owner']) {
      const res = await post(seed(), role, 'scrap')
      expect(res.status, JSON.stringify(res.data)).toBe(201)
    }
  })

  it('an UNDEFINED disposition is refused whole (400), for every role - nothing is defaulted', async () => {
    for (const role of ['seller', 'manager', 'owner']) {
      const res = await post(seed(), role, undefined)
      expect(res.status, role + JSON.stringify(res.data)).toBe(400)
      expect(JSON.stringify(res.data)).toContain('RETURN_DISPOSITION_REQUIRED')
    }
  })
})
