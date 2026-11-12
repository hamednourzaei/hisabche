import { describe, expect, it } from 'vitest'
import {
  expandBundleStockAndCost,
  evaluateConsignmentValuationAndPayable,
  computeSellerCommission,
} from '@hisabche/validation'

describe('B.2.8, B.2.10, B.2.9 Bundles, Consignment, Seller Commission', () => {
  it('expands bundle components and sums component costs', () => {
    const res = expandBundleStockAndCost(3, [
      { componentProductId: 'c1', quantity: 2, unitCostMinor: 150 },
      { componentProductId: 'c2', quantity: 1, unitCostMinor: 400 },
    ])
    expect(res.movements).toEqual([
      { productId: 'c1', quantity: 6 },
      { productId: 'c2', quantity: 3 },
    ])
    expect(res.totalCostMinor).toBe(2100)
  })

  it('excludes consignment-in from owned inventory value and computes supplier payable', () => {
    const res = evaluateConsignmentValuationAndPayable(
      {
        direction: 'in',
        quantity: 10,
        unitCostMinor: 500,
        unitAgreedPriceMinor: 600,
        status: 'open',
      },
      4,
    )
    expect(res).toEqual({ ownedInventoryValueMinor: 0, supplierPayableMinor: 2400 })
  })

  it('reduces seller commission on returns and returns null on unknown margin cost', () => {
    const net = computeSellerCommission([
      {
        sellerEmployeeId: 'e1',
        kind: 'sale',
        revenueMinor: 10000,
        costMinor: 6000,
        ratePercent: 10,
        basis: 'margin',
      },
      {
        sellerEmployeeId: 'e1',
        kind: 'return',
        revenueMinor: 2000,
        costMinor: 1000,
        ratePercent: 10,
        basis: 'margin',
      },
    ])
    expect(net).toBe(300)

    const unknown = computeSellerCommission([
      {
        sellerEmployeeId: 'e1',
        kind: 'sale',
        revenueMinor: 10000,
        costMinor: null,
        ratePercent: 10,
        basis: 'margin',
      },
    ])
    expect(unknown).toBeNull()
  })
})
