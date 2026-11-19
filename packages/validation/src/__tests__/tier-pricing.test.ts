// WP-08: quantity breaks are evaluated by ONE server-authoritative rule;
// client, server and local engine must all return the same number.

import { describe, expect, it } from 'vitest'
import {
  quoteTieredPrice,
  tierUnitPrice,
  type QuantityBreak,
} from '../schemas/universal-core/tier-pricing.domain'

const breaks: readonly QuantityBreak[] = [
  { minQty: 1, unitPrice: 10 },
  { minQty: 10, unitPrice: 9 },
  { minQty: 50, unitPrice: 8 },
]

const base = { productId: 'p1', baseUnitPrice: 10 }
const request = (quantity: number) => ({ productId: 'p1', kind: 'sale' as const, quantity })

describe('tiered pricing (WP-08)', () => {
  it('1, 10 and 50 units get three different earned prices', () => {
    expect(tierUnitPrice(1, breaks)?.unitPrice).toBe(10)
    expect(tierUnitPrice(10, breaks)?.unitPrice).toBe(9)
    expect(tierUnitPrice(50, breaks)?.unitPrice).toBe(8)
  })

  it('the highest earned tier wins, independent of the declared order', () => {
    expect(tierUnitPrice(60, [...breaks].reverse())?.minQty).toBe(50)
    expect(tierUnitPrice(9, breaks)?.minQty).toBe(1)
  })

  it('no tier earns means the base price stands — never a silent zero', () => {
    expect(tierUnitPrice(0, breaks)).toBeNull()
    expect(tierUnitPrice(5, [])).toBeNull()
    expect(tierUnitPrice(5, [{ minQty: 10, unitPrice: 9 }])).toBeNull()
  })

  it('the quote flows the tier price through the SAME promotion/floor engine', () => {
    const quoted = quoteTieredPrice(request(50), base, breaks, [], '2026-01-01')
    expect(quoted.baseUnitPriceMinor).toBe(800)
    expect(quoted.unitPriceMinor).toBe(800)
    expect(quoted.tierMinQty).toBe(50)
    expect(quoted.baseUnitPriceFromTier).toBe(true)
  })

  it('a promotion still applies on top of the earned tier price', () => {
    const promo = {
      id: 'loyalty',
      label: 'Loyalty',
      kind: 'percentage' as const,
      value: 10,
      stacking: 'exclusive' as const,
      minQty: 1,
      startsAt: '2026-01-01',
      endsAt: null,
    }
    const quoted = quoteTieredPrice(request(50), base, breaks, [promo], '2026-02-01')
    expect(quoted.baseUnitPriceMinor).toBe(800)
    expect(quoted.unitPriceMinor).toBe(720)
    expect(quoted.applied[0]?.discountMinor).toBe(80)
  })
})
