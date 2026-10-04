// ============================================
// Engine N1 — pricing and promotion.
// Capabilities #19, #114, #115, #116, #117, #120.
//
// ⚠️ WHAT IS WORTH DEFENDING HERE.
//
// The arithmetic is simple. What is NOT simple is the four ways this engine can
// hand back a plausible, wrong number, and each of them is a real class of loss:
//
//   1. PROMOTIONS COMBINE. Two of them both apply, the shop did not mean it, and
//      the line sells for a third of what it should. Nothing balances wrongly;
//      it simply balances to the wrong total.
//   2. THE FLOOR IS SKIPPED. A promotion pushes a line below what the shop is
//      willing to sell for, and the sale completes.
//   3. THE PRICE IS THE CLIENT'S. `computeInvoiceMoney` re-derives the TOTAL
//      from the lines — which means a client sending `unitPrice: 1` produces an
//      invoice that foots perfectly and is wrong. That is the bug this engine
//      exists to make impossible, and it only works if the server says the price.
//   4. AN UNPRICED LINE BECOMES FREE. The most plausible catastrophic value a
//      pricing engine can invent is `0` — the invoice still foots.
//
// Stacking is tested both ways on purpose: exclusive must pick the BEST, not the
// first, or the result depends on the order a shop happened to type its
// promotions in.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  applyPrice,
  basePriceFor,
  quotePrice,
  type PriceRequest,
  type ProductPricing,
  type Promotion,
} from '@hisabche/validation'

const AS_OF = '2026-09-30'

const request = (over: Partial<PriceRequest> = {}): PriceRequest => ({
  productId: 'prod-1',
  kind: 'sale',
  quantity: 1,
  ...over,
})

const pricing = (over: Partial<ProductPricing> = {}): ProductPricing => ({
  productId: 'prod-1',
  baseUnitPrice: 1000,
  ...over,
})

const percent = (id: string, value: number, over: Partial<Promotion> = {}): Promotion => ({
  id,
  kind: 'percentage',
  stacking: 'exclusive',
  value,
  ...over,
})

describe('N1 — the base price comes from the server, not the request', () => {
  it('a price list overrides the product row', () => {
    const base = basePriceFor(
      pricing({ listPrices: [{ priceListId: 'wholesale', unitPrice: 800 }] }),
      request({ priceListId: 'wholesale' }),
    )
    expect(base.minor).toBe(80_000)
  })

  it('an unknown price list falls back to the product row rather than zero', () => {
    const base = basePriceFor(
      pricing({ listPrices: [{ priceListId: 'wholesale', unitPrice: 800 }] }),
      request({ priceListId: 'does-not-exist' }),
    )
    expect(base.minor).toBe(100_000)
  })

  it('a missing base price is REPORTED, not treated as zero', () => {
    const base = basePriceFor(pricing({ baseUnitPrice: Number.NaN }), request())
    expect(base.problems.map((p) => p.code)).toContain('PRICE_BASE_MISSING')
  })

  it('a quantity of zero or less is refused', () => {
    const base = basePriceFor(pricing(), request({ quantity: 0 }))
    expect(base.problems.map((p) => p.code)).toContain('PRICE_QUANTITY_INVALID')
  })
})

describe('N1 — drift between the client price and the server price is visible', () => {
  it('records the difference when the client asked for something else', () => {
    // ⚠️ NOT an error here — a price may legitimately differ if the client
    // computed it from stale data. But the server must be able to SEE it, or
    // the first bug this engine prevents becomes the second one it misses.
    const quote = quotePrice(request({ requestedUnitPrice: 900 }), pricing(), [], AS_OF)

    expect(quote.unitPriceMinor).toBe(100_000)
    expect(quote.driftFromRequest).toEqual({ requestedMinor: 90_000, quotedMinor: 100_000 })
  })

  it('says nothing when the client and the server agree', () => {
    const quote = quotePrice(request({ requestedUnitPrice: 1000 }), pricing(), [], AS_OF)
    expect(quote.driftFromRequest).toBeUndefined()
  })
})

describe('N1 — promotions do not stack unless a promotion says they may', () => {
  it('two exclusive promotions: the BEST one wins, not the first', () => {
    // ⚠️ Order-independence is the point. Picking the first would make the
    // result depend on the order a shop typed its promotions in, which is not a
    // thing anyone can see or control.
    const forwards = quotePrice(
      request(),
      pricing(),
      [percent('ten', 10), percent('twenty', 20)],
      AS_OF,
    )
    const backwards = quotePrice(
      request(),
      pricing(),
      [percent('twenty', 20), percent('ten', 10)],
      AS_OF,
    )

    expect(forwards.unitPriceMinor).toBe(80_000)
    expect(backwards.unitPriceMinor).toBe(80_000)
    expect(forwards.applied.map((a) => a.id)).toEqual(['twenty'])
  })

  it('a stacking promotion combines with the exclusive one', () => {
    const quote = quotePrice(
      request(),
      pricing(),
      [percent('season', 20), percent('loyalty', 5, { stacking: 'stacking' })],
      AS_OF,
    )

    // 1000 − 20% = 800; then − 5% of 800 = 760. Multiplying, not summing.
    expect(quote.unitPriceMinor).toBe(76_000)
    expect(quote.applied).toHaveLength(2)
  })

  it('a promotion outside its window does not apply', () => {
    const quote = quotePrice(
      request(),
      pricing(),
      [
        percent('expired', 50, { validTo: '2026-01-31' }),
        percent('future', 50, { validFrom: '2026-12-01' }),
      ],
      AS_OF,
    )

    expect(quote.unitPriceMinor).toBe(100_000)
    expect(quote.applied).toEqual([])
  })

  it('a promotion for another product does not apply', () => {
    const quote = quotePrice(
      request(),
      pricing(),
      [percent('other', 90, { productIds: ['prod-2'] })],
      AS_OF,
    )

    expect(quote.unitPriceMinor).toBe(100_000)
  })

  it('a customer-only promotion does not apply to a walk-in', () => {
    const quote = quotePrice(
      request(),
      pricing(),
      [percent('vip', 30, { customerIds: ['cust-1'] })],
      AS_OF,
    )

    expect(quote.unitPriceMinor).toBe(100_000)
  })
})

describe('N1 — no promotion may sell below the floor', () => {
  it('clamps to the floor and says it did', () => {
    // ⚠️ Both halves matter. Clamping without saying so is a silent refusal of
    // the shop's own promotion, and they would spend a week wondering why the
    // discount does not appear.
    const quote = quotePrice(
      request(),
      pricing({ floorUnitPrice: 950 }),
      [percent('big', 50)],
      AS_OF,
    )

    expect(quote.unitPriceMinor).toBe(95_000)
    expect(quote.applied[0]?.clampedByFloor).toBe(true)
  })

  it('the floor applies AFTER stacking, so two promotions cannot go under it', () => {
    // ⚠️ Applying it per-promotion would let the second one push the price back
    // below the floor the first one honoured.
    const quote = quotePrice(
      request(),
      pricing({ floorUnitPrice: 900 }),
      [
        percent('a', 5, { stacking: 'stacking' }),
        percent('b', 5, { stacking: 'stacking' }),
        percent('c', 5, { stacking: 'stacking' }),
      ],
      AS_OF,
    )

    expect(quote.unitPriceMinor).toBe(90_000)
  })

  it('an ABSENT floor means promotions apply as written', () => {
    // ⚠️ Not zero. Inventing a floor from buy_price would silently clamp every
    // promotion in the product and nobody could say why.
    const quote = quotePrice(request(), pricing(), [percent('big', 90)], AS_OF)
    expect(quote.unitPriceMinor).toBe(10_000)
    expect(quote.applied[0]?.clampedByFloor).toBe(false)
  })

  it("a promotion's own minimum wins over a lower product floor", () => {
    const quote = quotePrice(
      request(),
      pricing({ floorUnitPrice: 500 }),
      [percent('clearance', 20, { minPriceAfter: 800 })],
      AS_OF,
    )

    expect(quote.unitPriceMinor).toBe(80_000)
  })
})

describe('N1 — a fixed-amount promotion never goes below zero', () => {
  it('a 2000 discount on a 1000 price takes it to zero, not to -1000', () => {
    const quote = quotePrice(
      request(),
      pricing(),
      [{ id: 'fixed', kind: 'fixed_amount', stacking: 'exclusive', value: 2000 }],
      AS_OF,
    )

    expect(quote.unitPriceMinor).toBe(0)
  })

  it('a negative promotion value is inert', () => {
    const quote = quotePrice(request(), pricing(), [percent('backwards', -50)], AS_OF)

    expect(quote.unitPriceMinor).toBe(100_000)
    expect(quote.applied).toEqual([])
  })
})

describe('N1 — an unpriced line is unpriced, never free', () => {
  it('a line with no quote comes back null, not zero', () => {
    // ⚠️ THE most plausible catastrophic value in this engine. A zero here
    // makes the invoice foot and the shop give the goods away.
    const applied = applyPrice([{ productId: 'prod-1', quantity: 1, requestedUnitPrice: 1000 }], [])

    expect(applied[0]).toEqual({
      productId: 'prod-1',
      quantity: 1,
      unitPrice: null,
      reason: 'NO_QUOTE',
    })
  })

  it('a quoted line comes back in major units for computeInvoiceMoney', () => {
    const quote = quotePrice(request(), pricing(), [], AS_OF)
    const applied = applyPrice([{ productId: 'prod-1', quantity: 2 }], [quote])

    expect(applied[0]?.unitPrice).toBe(1000)
    expect(applied[0]?.reason).toBeUndefined()
  })
})
