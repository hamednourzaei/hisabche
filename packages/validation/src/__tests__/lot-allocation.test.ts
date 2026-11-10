// ============================================
// packages/validation/src/__tests__/lot-allocation.test.ts
//
// The ONE batch-allocation core (moved here in V55 final completion so the
// server and the offline local engine run the same algorithm). The mandatory
// FEFO behaviours, as pure-function regressions:
//   · FEFO ordering — earlier expiry first; the non-expiring batch LAST
//   · expired batches are never allocated, and are reported, not skipped
//   · shortfall is explicit; partial and multi-batch allocation are exact
//   · the plan never goes negative and never reorders differently between runs
// ============================================

import { describe, expect, it } from 'vitest'
import {
  daysUntilExpiry,
  expiryState,
  isIssuable,
  orderBatches,
  planAllocation,
  type StockBatch,
} from '../schemas/universal-core/lot-allocation.domain'

const AS_OF = '2026-11-11'

function batch(overrides: Partial<StockBatch> & { id: string }): StockBatch {
  return {
    productId: 'p1',
    batchNumber: overrides.id,
    expiryDate: null,
    receivedQty: 10,
    remainingQty: 10,
    costLayerId: null,
    receivedOn: '2026-11-01',
    ...overrides,
  }
}

describe('the shared FEFO allocation core', () => {
  it('orders the soonest expiry first', () => {
    const jan = batch({ id: 'jan', expiryDate: '2026-12-31' })
    const june = batch({ id: 'june', expiryDate: '2027-06-30' })
    expect(orderBatches([june, jan], 'fefo').map((b) => b.id)).toEqual(['jan', 'june'])
  })

  it('puts the non-expiring batch LAST — it is the one that can wait', () => {
    const forever = batch({ id: 'forever', expiryDate: null })
    const jan = batch({ id: 'jan', expiryDate: '2026-12-31' })
    expect(orderBatches([forever, jan], 'fefo').map((b) => b.id)).toEqual(['jan', 'forever'])
  })

  it('a batch expiring TODAY is expired — the last day is the last day', () => {
    expect(expiryState('2026-11-11', AS_OF)).toBe('expired')
    expect(expiryState('2026-11-12', AS_OF)).toBe('near_expiry')
    expect(expiryState(null, AS_OF)).toBe('no_expiry')
    expect(daysUntilExpiry('2026-11-11', AS_OF)).toBe(0)
  })

  it('an expired batch is excluded and reported, never quietly consumed', () => {
    const old = batch({ id: 'old', expiryDate: '2020-01-01', remainingQty: 5 })
    const good = batch({ id: 'good', expiryDate: '2027-01-31', remainingQty: 3 })
    const plan = planAllocation([old, good], 4, { asOf: AS_OF })
    expect(plan.allocations).toEqual([
      {
        batchId: 'good',
        batchNumber: 'good',
        quantity: 3,
        expiryDate: '2027-01-31',
        costLayerId: null,
      },
    ])
    expect(plan.shortfall).toBe(1)
    expect(plan.blockedByExpiry).toEqual([{ batchId: 'old', batchNumber: 'old', quantity: 5 }])
    expect(isIssuable(old, AS_OF)).toBe(false)
  })

  it('one plan can span several batches, partial take included', () => {
    const jan = batch({ id: 'jan', expiryDate: '2026-12-31', remainingQty: 3 })
    const june = batch({ id: 'june', expiryDate: '2027-06-30', remainingQty: 10 })
    const plan = planAllocation([june, jan], 5, { asOf: AS_OF })
    expect(plan.allocations).toEqual([
      {
        batchId: 'jan',
        batchNumber: 'jan',
        quantity: 3,
        expiryDate: '2026-12-31',
        costLayerId: null,
      },
      {
        batchId: 'june',
        batchNumber: 'june',
        quantity: 2,
        expiryDate: '2027-06-30',
        costLayerId: null,
      },
    ])
    expect(plan.shortfall).toBe(0)
  })

  it('never takes more than a batch holds — the quantities cannot go negative', () => {
    const tiny = batch({ id: 'tiny', remainingQty: 2, expiryDate: '2026-12-31' })
    const plan = planAllocation([tiny], 9, { asOf: AS_OF })
    expect(plan.allocations[0]?.quantity).toBe(2)
    expect(plan.shortfall).toBe(7)
  })

  it('FIFO draws by arrival, not expiry', () => {
    const laterArrivalSoonerExpiry = batch({
      id: 'new',
      receivedOn: '2026-11-10',
      expiryDate: '2026-12-01',
    })
    const earlierArrival = batch({
      id: 'old',
      receivedOn: '2026-11-01',
      expiryDate: '2027-01-01',
    })
    expect(
      orderBatches([laterArrivalSoonerExpiry, earlierArrival], 'fifo').map((b) => b.id),
    ).toEqual(['old', 'new'])
  })

  it('an equal-expiry tiebreak is stable across runs', () => {
    const a = batch({ id: 'a', expiryDate: '2026-12-31' })
    const b = batch({ id: 'b', expiryDate: '2026-12-31' })
    const first = orderBatches([b, a], 'fefo').map((x) => x.id)
    const second = orderBatches([b, a], 'fefo').map((x) => x.id)
    expect(first).toEqual(second)
  })

  it("the operator's manual choice is respected — but an expired pick is still refused", () => {
    const expired = batch({ id: 'expired', expiryDate: '2020-01-01', remainingQty: 5 })
    const good = batch({ id: 'good', expiryDate: '2027-01-31', remainingQty: 10 })
    const plan = planAllocation([expired, good], 6, {
      asOf: AS_OF,
      strategy: 'manual',
      manual: [
        {
          batchId: 'expired',
          batchNumber: 'expired',
          quantity: 4,
          expiryDate: null,
          costLayerId: null,
        },
        { batchId: 'good', batchNumber: 'good', quantity: 6, expiryDate: null, costLayerId: null },
      ],
    })
    expect(plan.allocations).toEqual([
      {
        batchId: 'good',
        batchNumber: 'good',
        quantity: 6,
        expiryDate: '2027-01-31',
        costLayerId: null,
      },
    ])
    expect(plan.blockedByExpiry).toEqual([
      { batchId: 'expired', batchNumber: 'expired', quantity: 4 },
    ])
    expect(plan.shortfall).toBe(0)
  })
})
