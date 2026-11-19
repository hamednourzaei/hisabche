// WP-10: a table holds one open order; KDS stages move forward only and the
// kitchen never receives an unconfirmed order; bill splits must foot exactly.

import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, type ClosableLocalDb } from './test-db'

let db: ClosableLocalDb
let engine: ReturnType<typeof createTestEngine>

async function seat(tableId: string, total = 10000) {
  return engine.request<{ id: string }>({
    method: 'POST',
    path: '/local-tables/orders',
    body: { tableId, totalMinor: total, orderId: 'o-1' },
  })
}

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe('offline table service (WP-10)', () => {
  it('a second open order cannot take the same table', async () => {
    const a = await seat('t1')
    expect(a.status, JSON.stringify(a.data)).toBe(201)
    const b = await seat('t1')
    expect(b.status).toBe(409)
  })

  it('the kitchen refuses an order that is not confirmed', async () => {
    const a = await seat('t2')
    const res = await engine.request({
      method: 'POST',
      path: `/local-tables/orders/${a.data.id}/stage`,
      body: { to: 'preparing' },
    })
    expect(res.status).toBe(409)
  })

  it('a confirmed order moves through KDS stages in order', async () => {
    const a = await seat('t3')
    db.run(`UPDATE table_orders SET status = 'confirmed' WHERE id = ?`, [a.data.id])
    expect(
      (
        await engine.request({
          method: 'POST',
          path: `/local-tables/orders/${a.data.id}/stage`,
          body: { to: 'preparing' },
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await engine.request({
          method: 'POST',
          path: `/local-tables/orders/${a.data.id}/stage`,
          body: { to: 'ready' },
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await engine.request({
          method: 'POST',
          path: `/local-tables/orders/${a.data.id}/stage`,
          body: { to: 'served' },
        })
      ).status,
    ).toBe(200)
  })

  it('a bill split must foot to the table total', async () => {
    const a = await seat('t4', 10000)
    const ok = await engine.request<{ seatAmountsMinor: number[] }>({
      method: 'POST',
      path: `/local-tables/orders/${a.data.id}/split`,
      body: { seatAmountsMinor: [4000, 6000] },
    })
    expect(ok.data.seatAmountsMinor).toEqual([4000, 6000])
    const bad = await engine.request({
      method: 'POST',
      path: `/local-tables/orders/${a.data.id}/split`,
      body: { seatAmountsMinor: [4000, 5000] },
    })
    expect(bad.status).toBe(400)
  })
})
