// WP-16: the core charge is a separate liability line and a returned core can
// be refunded only once — both decided by shared rules, no money posted here.

import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, type ClosableLocalDb } from './test-db'

let db: ClosableLocalDb
let engine: ReturnType<typeof createTestEngine>

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe('auto core charge on device (WP-16)', () => {
  it('builds a core deposit line without posting any money', async () => {
    const res = await engine.request<{ accountRole: string; totalMinor: number }>({
      method: 'POST',
      path: '/local-auto/core-deposit',
      body: { productId: 'p1', productName: 'Alternator', quantity: 3, depositPerUnitMinor: 2500 },
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)
    expect(res.data).toMatchObject({ accountRole: 'core_deposit', totalMinor: 7500 })
    const je = db.get<{ count: number }>('SELECT COUNT(*) as count FROM journal_entry')
    expect(je?.count ?? 0).toBe(0)
  })

  it('refuses a double refund of the same core', async () => {
    const ok = await engine.request<{ refundMinor: number }>({
      method: 'POST',
      path: '/local-auto/core-refund',
      body: { depositPerUnitMinor: 2500, returnedQuantity: 2, alreadyRefundedQuantity: 1 },
    })
    expect(ok.data.refundMinor).toBe(2500)
    const again = await engine.request<{ refundMinor: number; doubleRefundBlocked: boolean }>({
      method: 'POST',
      path: '/local-auto/core-refund',
      body: { depositPerUnitMinor: 2500, returnedQuantity: 2, alreadyRefundedQuantity: 2 },
    })
    expect(again.data).toEqual({ refundMinor: 0, doubleRefundBlocked: true })
  })

  it('an unknown deposit is refused, never zero', async () => {
    const res = await engine.request({
      method: 'POST',
      path: '/local-auto/core-refund',
      body: { depositPerUnitMinor: 'bad', returnedQuantity: 1, alreadyRefundedQuantity: 0 },
    })
    expect(res.status).toBe(400)
  })
})
