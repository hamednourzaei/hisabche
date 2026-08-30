// ============================================
// Batches, serial numbers and expiry.
//
// The rule that shapes the whole core: for anything that expires, FIFO is the
// WRONG allocation. Goods received later can expire sooner, and shipping the
// older carton leaves the sooner-expiring one on the shelf to be written off.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  bucketByExpiry,
  daysUntilExpiry,
  expiredValueMinor,
  expiryState,
  isIssuable,
  orderBatches,
  planAllocation,
  serialCostMinor,
  validateSerialIssue,
  type SerialUnit,
  type StockBatch,
} from '../services/traceability/lot.domain'

const TODAY = '2026-06-15'

const batch = (over: Partial<StockBatch> & { id: string }): StockBatch => ({
  productId: 'p1',
  batchNumber: over.id.toUpperCase(),
  expiryDate: null,
  receivedQty: 10,
  remainingQty: 10,
  costLayerId: `layer-${over.id}`,
  receivedOn: '2026-01-01',
  ...over,
})

describe('expiry', () => {
  it('counts whole days to the expiry date', () => {
    expect(daysUntilExpiry('2026-06-30', TODAY)).toBe(15)
  })

  it('TREATS A BATCH EXPIRING TODAY AS EXPIRED', () => {
    // The last day is the last day it may be sold. Treating "0 days left" as
    // usable is how expired stock reaches a customer.
    expect(expiryState(TODAY, TODAY)).toBe('expired')
  })

  it('calls a batch past its date expired', () => {
    expect(expiryState('2026-06-01', TODAY)).toBe('expired')
  })

  it('flags one inside the near-expiry window', () => {
    expect(expiryState('2026-07-01', TODAY)).toBe('near_expiry')
  })

  it('calls a distant one fresh', () => {
    expect(expiryState('2027-01-01', TODAY)).toBe('fresh')
  })

  it('distinguishes "does not expire" from "fresh"', () => {
    expect(expiryState(null, TODAY)).toBe('no_expiry')
  })

  it('refuses to issue an expired batch', () => {
    expect(isIssuable(batch({ id: 'b1', expiryDate: '2026-01-01' }), TODAY)).toBe(false)
    expect(isIssuable(batch({ id: 'b2', expiryDate: '2027-01-01' }), TODAY)).toBe(true)
  })

  it('refuses to issue an empty batch', () => {
    expect(isIssuable(batch({ id: 'b1', remainingQty: 0 }), TODAY)).toBe(false)
  })
})

describe('FEFO takes the soonest to expire, not the oldest received', () => {
  const receivedFirstExpiresLater = batch({
    id: 'old',
    receivedOn: '2026-01-01',
    expiryDate: '2026-12-31',
  })
  const receivedLaterExpiresSooner = batch({
    id: 'new',
    receivedOn: '2026-05-01',
    expiryDate: '2026-07-01',
  })

  const stock = [receivedFirstExpiresLater, receivedLaterExpiresSooner]

  it('FIFO would ship the wrong one', () => {
    expect(orderBatches(stock, 'fifo')[0]!.id).toBe('old')
  })

  it('FEFO ships the one that expires first', () => {
    expect(orderBatches(stock, 'fefo')[0]!.id).toBe('new')
  })

  it('allocates from the soonest-expiring batch', () => {
    const plan = planAllocation(stock, 5, { strategy: 'fefo', asOf: TODAY })
    expect(plan.allocations[0]!.batchId).toBe('new')
  })

  it('PUTS NON-EXPIRING BATCHES LAST', () => {
    // A batch with no expiry is not "infinitely fresh and therefore urgent" —
    // it is the one thing that can safely wait.
    const withPerishable = [
      batch({ id: 'forever', expiryDate: null }),
      batch({ id: 'soon', expiryDate: '2026-07-01' }),
    ]
    expect(orderBatches(withPerishable, 'fefo')[0]!.id).toBe('soon')
  })

  it('orders identically whatever order the batches arrive in', () => {
    const forward = orderBatches(stock, 'fefo').map((b) => b.id)
    const backward = orderBatches([...stock].reverse(), 'fefo').map((b) => b.id)
    expect(backward).toEqual(forward)
  })
})

describe('allocation', () => {
  it('spans several batches when one is not enough', () => {
    const plan = planAllocation(
      [
        batch({ id: 'a', remainingQty: 3, expiryDate: '2026-07-01' }),
        batch({ id: 'b', remainingQty: 10, expiryDate: '2026-08-01' }),
      ],
      8,
      { asOf: TODAY },
    )
    expect(plan.allocations.map((a) => a.quantity)).toEqual([3, 5])
    expect(plan.shortfall).toBe(0)
  })

  it('reports what it could not cover', () => {
    const plan = planAllocation([batch({ id: 'a', remainingQty: 2 })], 5, { asOf: TODAY })
    expect(plan.shortfall).toBe(3)
  })

  it('EXCLUDES expired stock and says so separately', () => {
    // Expired stock is still on the shelf and still worth money. Quietly
    // skipping it would leave the operator wondering why the quantity does
    // not add up.
    const plan = planAllocation(
      [
        batch({ id: 'dead', remainingQty: 100, expiryDate: '2026-01-01' }),
        batch({ id: 'good', remainingQty: 4, expiryDate: '2027-01-01' }),
      ],
      10,
      { asOf: TODAY },
    )

    expect(plan.allocations.map((a) => a.batchId)).toEqual(['good'])
    expect(plan.shortfall).toBe(6)
    expect(plan.blockedByExpiry[0]).toMatchObject({ batchId: 'dead', quantity: 100 })
  })

  it('carries the cost layer through, so identity stays tied to money', () => {
    const plan = planAllocation([batch({ id: 'a', expiryDate: '2027-01-01' })], 1, { asOf: TODAY })
    expect(plan.allocations[0]!.costLayerId).toBe('layer-a')
  })

  it('respects a manual choice', () => {
    const stock = [
      batch({ id: 'soon', expiryDate: '2026-07-01' }),
      batch({ id: 'later', expiryDate: '2027-07-01' }),
    ]
    const plan = planAllocation(stock, 2, {
      strategy: 'manual',
      asOf: TODAY,
      manual: [
        {
          batchId: 'later',
          batchNumber: 'LATER',
          quantity: 2,
          expiryDate: null,
          costLayerId: null,
        },
      ],
    })
    expect(plan.allocations[0]!.batchId).toBe('later')
  })

  it('STILL REFUSES an expired batch the operator picked by hand', () => {
    // The refusal is not a preference.
    const stock = [batch({ id: 'dead', expiryDate: '2026-01-01' })]
    const plan = planAllocation(stock, 2, {
      strategy: 'manual',
      asOf: TODAY,
      manual: [
        { batchId: 'dead', batchNumber: 'DEAD', quantity: 2, expiryDate: null, costLayerId: null },
      ],
    })
    expect(plan.allocations).toEqual([])
    expect(plan.blockedByExpiry).toHaveLength(1)
  })
})

describe('serial numbers', () => {
  const units: SerialUnit[] = [
    {
      id: 'u1',
      productId: 'p1',
      serialNumber: 'IMEI-1',
      status: 'in_stock',
      costLayerId: 'l1',
      unitCostMinor: 1_000_000,
      receivedOn: '2026-01-01',
    },
    {
      id: 'u2',
      productId: 'p1',
      serialNumber: 'IMEI-2',
      status: 'in_stock',
      costLayerId: 'l2',
      unitCostMinor: 900_000,
      receivedOn: '2026-03-01',
    },
    {
      id: 'u3',
      productId: 'p1',
      serialNumber: 'IMEI-3',
      status: 'sold',
      costLayerId: 'l1',
      unitCostMinor: 1_000_000,
      receivedOn: '2026-01-01',
    },
  ]

  it('accepts exactly as many serials as units sold', () => {
    expect(
      validateSerialIssue(['IMEI-1', 'IMEI-2'], units, { productId: 'p1', quantity: 2 }),
    ).toEqual([])
  })

  it('REFUSES a count that does not match the quantity', () => {
    // "Sell 3" with two serials is a line where nobody knows which third unit
    // left the building.
    expect(validateSerialIssue(['IMEI-1'], units, { productId: 'p1', quantity: 3 })).toContain(
      'SERIAL_COUNT_MISMATCH',
    )
  })

  it('refuses the same serial twice', () => {
    expect(
      validateSerialIssue(['IMEI-1', 'IMEI-1'], units, { productId: 'p1', quantity: 2 }),
    ).toContain('SERIAL_DUPLICATE')
  })

  it('refuses a serial that is already sold', () => {
    expect(validateSerialIssue(['IMEI-3'], units, { productId: 'p1', quantity: 1 })).toContain(
      'SERIAL_NOT_IN_STOCK',
    )
  })

  it('refuses a serial belonging to another product', () => {
    expect(validateSerialIssue(['IMEI-1'], units, { productId: 'p2', quantity: 1 })).toContain(
      'SERIAL_WRONG_PRODUCT',
    )
  })

  it('refuses a serial nobody has heard of', () => {
    expect(validateSerialIssue(['GHOST'], units, { productId: 'p1', quantity: 1 })).toContain(
      'SERIAL_UNKNOWN',
    )
  })

  it('COSTS EACH UNIT FROM ITS OWN LAYER, not an average', () => {
    // The point of serial tracking: the profit on the phone with this IMEI is
    // exact, not the average of every phone of that model ever bought.
    expect(serialCostMinor(['IMEI-1', 'IMEI-2'], units)).toBe(1_900_000)
    expect(serialCostMinor(['IMEI-2'], units)).toBe(900_000)
  })
})

describe('the expiry report', () => {
  const stock = [
    batch({ id: 'dead', remainingQty: 5, expiryDate: '2026-01-01', costLayerId: 'l1' }),
    batch({ id: 'soon', remainingQty: 3, expiryDate: '2026-06-20', costLayerId: 'l2' }),
    batch({ id: 'fine', remainingQty: 8, expiryDate: '2027-06-20', costLayerId: 'l3' }),
    batch({ id: 'forever', remainingQty: 2, expiryDate: null, costLayerId: 'l4' }),
  ]

  it('puts expired first — the only deadline that has already passed', () => {
    expect(bucketByExpiry(stock, TODAY)[0]!.state).toBe('expired')
  })

  it('groups every state', () => {
    expect(bucketByExpiry(stock, TODAY).map((b) => b.state)).toEqual([
      'expired',
      'near_expiry',
      'fresh',
      'no_expiry',
    ])
  })

  it('orders the soonest first inside a bucket', () => {
    const near = bucketByExpiry(stock, TODAY).find((b) => b.state === 'near_expiry')!
    expect(near.batches[0]!.daysRemaining).toBe(5)
  })

  it('ignores empty batches', () => {
    const withEmpty = [...stock, batch({ id: 'gone', remainingQty: 0, expiryDate: '2026-01-01' })]
    const expired = bucketByExpiry(withEmpty, TODAY).find((b) => b.state === 'expired')!
    expect(expired.batches).toHaveLength(1)
  })

  it('VALUES the expired stock, which is what a write-off decision needs', () => {
    // Inventory the balance sheet still counts and the shop can no longer
    // sell. The gap between those two facts is the decision.
    const costs = new Map([['l1', 20_000]])
    expect(expiredValueMinor(stock, costs, TODAY)).toBe(100_000)
  })

  it('values nothing when nothing has expired', () => {
    expect(expiredValueMinor([stock[2]!], new Map([['l3', 500]]), TODAY)).toBe(0)
  })
})
