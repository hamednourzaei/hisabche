// WP-14: the device runs the SAME pack-rounding and three-way-match rules as the
// server — a preview only, no PO changed and no money posted here.

import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, type ClosableLocalDb } from './test-db'

let db: ClosableLocalDb
let engine: ReturnType<typeof createTestEngine>

beforeEach(() => {
  db = createTestDb()
  engine = createTestEngine(db)
})

describe('offline procurement rules (WP-14)', () => {
  it('rounds a reorder deficit up to whole packs on device', async () => {
    const res = await engine.request<{
      lines: Array<{ roundedQuantity: number; packsCount: number }>
    }>({
      method: 'POST',
      path: '/inventory/reorder-suggestions/draft-po-rounded',
      body: {
        suggestions: [
          {
            productId: 'p1',
            supplierId: 's1',
            onHand: 15,
            reservedQuantity: 2,
            openPoQuantity: 2,
            reorderLevel: 20,
            demandForecastDaily: 3,
            leadTimeDays: 10,
            purchasePackSize: 6,
            unitPrice: 120,
          },
        ],
      },
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)
    expect(res.data.lines[0]).toMatchObject({ roundedQuantity: 18, packsCount: 3 })
  })

  it('a short receipt produces a mismatch verdict on device', async () => {
    const res = await engine.request<{
      matched: boolean
      mayApprovePayment: boolean
      mismatches: unknown[]
    }>({
      method: 'POST',
      path: '/inventory/three-way-match/preview',
      body: {
        poLines: [{ productId: 'p1', quantity: 100, unitPriceMinor: 1000 }],
        receiptLines: [{ productId: 'p1', quantity: 98 }],
        invoiceLines: [{ productId: 'p1', quantity: 100, unitPriceMinor: 1000 }],
      },
    })
    expect(res.status, JSON.stringify(res.data)).toBe(201)
    expect(res.data.matched).toBe(false)
    expect(res.data.mayApprovePayment).toBe(false)
    expect(res.data.mismatches.length).toBeGreaterThan(0)
  })

  it('a matched set is accepted', async () => {
    const res = await engine.request<{ matched: boolean; mayApprovePayment: boolean }>({
      method: 'POST',
      path: '/inventory/three-way-match/preview',
      body: {
        poLines: [{ productId: 'p1', quantity: 10, unitPriceMinor: 1000 }],
        receiptLines: [{ productId: 'p1', quantity: 10 }],
        invoiceLines: [{ productId: 'p1', quantity: 10, unitPriceMinor: 1000 }],
      },
    })
    expect(res.data.matched).toBe(true)
    expect(res.data.mayApprovePayment).toBe(true)
  })
})
