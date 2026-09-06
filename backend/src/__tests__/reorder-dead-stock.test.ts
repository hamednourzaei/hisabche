// ============================================
// backend/src/__tests__/reorder-dead-stock.test.ts
//
// L3 — the reorder point, computed from what actually sold.
// L4 — stock that is not moving.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  DEAD_STOCK_DEFAULT_DAYS,
  DEFAULT_LEAD_TIME_DAYS,
  availablePosition,
  averageDailySales,
  findDeadStock,
  reorderPointFor,
  suggestedOrderQuantity,
} from '../services/inventory/reorder.domain'

describe('L3 — average daily sales', () => {
  it('divides by the OBSERVED window, not always by 30', () => {
    // ⚠️ The one that matters. A product added six days ago that sold 12 units
    // sells 2/day. Dividing by 30 gives 0.4/day, which makes every new product
    // look dormant and keeps it permanently below its reorder point — the shop
    // would never restock the things selling fastest.
    expect(averageDailySales({ productId: 'p1', unitsSoldInWindow: 12, windowDays: 6 })).toBe(2)
    expect(averageDailySales({ productId: 'p1', unitsSoldInWindow: 12, windowDays: 30 })).toBe(0.4)
  })

  it('never divides by zero', () => {
    expect(averageDailySales({ productId: 'p1', unitsSoldInWindow: 5, windowDays: 0 })).toBe(5)
  })

  it('a product that sold nothing has zero demand, not undefined', () => {
    expect(averageDailySales({ productId: 'p1', unitsSoldInWindow: 0 })).toBe(0)
  })
})

describe('L3 — the reorder point formula', () => {
  it('is lead-time consumption plus a 20% buffer', () => {
    // 2/day × 7 days = 14 consumed during lead time
    // safety = 14 × 0.20 = 2.8
    // point  = 16.8
    const point = reorderPointFor({ productId: 'p1', unitsSoldInWindow: 60, windowDays: 30 })
    expect(point.avgDailySales).toBe(2)
    expect(point.leadTimeDays).toBe(7)
    expect(point.safetyStock).toBe(2.8)
    expect(point.reorderPoint).toBe(16.8)
  })

  it('defaults the lead time to seven days', () => {
    // No `lead_time` column exists on products or suppliers. The spec says use
    // a conservative default and do NOT create a setting for a policy the
    // product has not defined (G4).
    expect(DEFAULT_LEAD_TIME_DAYS).toBe(7)
    expect(reorderPointFor({ productId: 'p1', unitsSoldInWindow: 30 }).leadTimeDays).toBe(7)
  })

  it('honours a supplied lead time when one exists', () => {
    const point = reorderPointFor({
      productId: 'p1',
      unitsSoldInWindow: 30,
      windowDays: 30,
      leadTimeDays: 14,
    })
    // 1/day × 14 = 14, safety 2.8, point 16.8
    expect(point.reorderPoint).toBe(16.8)
  })

  it('a product that never sells has a reorder point of zero', () => {
    // Which means it is never suggested — correct. Reordering something
    // nobody buys is how dead stock is created.
    expect(reorderPointFor({ productId: 'p1', unitsSoldInWindow: 0 }).reorderPoint).toBe(0)
  })
})

describe('L3 — available position', () => {
  it('counts on-hand, in-transit and on-order', () => {
    expect(availablePosition({ onHand: 5, inTransit: 3, onOrder: 2 })).toBe(10)
  })

  it('goods already coming stop a duplicate order', () => {
    // The classic reorder bug: a product with none on the shelf and 200
    // arriving tomorrow does not need reordering, and suggesting it is how a
    // shop ends up with 400.
    expect(
      suggestedOrderQuantity(availablePosition({ onHand: 0, inTransit: 200, onOrder: 0 }), 20),
    ).toBe(0)
  })
})

describe('L3 — the suggestion itself', () => {
  it('suggests the gap up to the reorder point', () => {
    expect(suggestedOrderQuantity(4, 16.8)).toBe(12.8)
  })

  it('suggests nothing when the position is at or above the point', () => {
    expect(suggestedOrderQuantity(16.8, 16.8)).toBe(0)
    expect(suggestedOrderQuantity(50, 16.8)).toBe(0)
  })

  it('never suggests a negative quantity', () => {
    expect(suggestedOrderQuantity(100, 10)).toBe(0)
  })
})

describe('L4 — dead stock', () => {
  const asOf = new Date('2026-09-06T00:00:00Z')
  const daysAgo = (n: number) => new Date(asOf.getTime() - n * 86_400_000).toISOString()

  it('flags stock that has not sold in the window', () => {
    const dead = findDeadStock(
      [{ productId: 'p1', onHand: 10, lastSoldAt: daysAgo(120) }],
      asOf,
      90,
    )
    expect(dead).toHaveLength(1)
    expect(dead[0]).toMatchObject({ productId: 'p1', daysSinceSale: 120, neverSold: false })
  })

  it('does not flag something that sold recently', () => {
    expect(
      findDeadStock([{ productId: 'p1', onHand: 10, lastSoldAt: daysAgo(3) }], asOf, 90),
    ).toEqual([])
  })

  it('⚠️ ignores a product with no stock — that is OUT of stock, not dead', () => {
    // The opposite problem, and it belongs on the reorder list. Including it
    // here would put every sold-out product in the «money stuck on a shelf»
    // report.
    expect(
      findDeadStock([{ productId: 'p1', onHand: 0, lastSoldAt: daysAgo(400) }], asOf, 90),
    ).toEqual([])
    expect(
      findDeadStock([{ productId: 'p1', onHand: -3, lastSoldAt: daysAgo(400) }], asOf, 90),
    ).toEqual([])
  })

  it('⚠️ reports "never sold" as a flag, not as infinite days', () => {
    // A product added last week that has not sold is not dead; one added two
    // years ago that never sold is the deadest thing in the warehouse. The
    // caller has the created date; this refuses to collapse both into a number.
    const [line] = findDeadStock([{ productId: 'p1', onHand: 4, lastSoldAt: null }], asOf, 90)
    expect(line).toMatchObject({ neverSold: true, daysSinceSale: null })
  })

  it('sorts longest-idle first', () => {
    const dead = findDeadStock(
      [
        { productId: 'recent', onHand: 1, lastSoldAt: daysAgo(100) },
        { productId: 'ancient', onHand: 1, lastSoldAt: daysAgo(500) },
      ],
      asOf,
      90,
    )
    expect(dead.map((d) => d.productId)).toEqual(['ancient', 'recent'])
  })

  it('the threshold is a parameter, and 90 is only the default', () => {
    expect(DEAD_STOCK_DEFAULT_DAYS).toBe(90)
    // A greengrocer means 7 days.
    expect(
      findDeadStock([{ productId: 'p1', onHand: 5, lastSoldAt: daysAgo(10) }], asOf, 7),
    ).toHaveLength(1)
    expect(
      findDeadStock([{ productId: 'p1', onHand: 5, lastSoldAt: daysAgo(10) }], asOf, 90),
    ).toEqual([])
  })
})
