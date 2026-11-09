import { describe, expect, it } from 'vitest'
import { advanceDocumentFrom, advanceDocumentInputSchema } from '../schemas/advance-document'

const line = (quantity: number, unitPriceMinor: number, discountMinor = 0) => ({
  name: 'کالا',
  quantity,
  unit: 'piece',
  unitPriceMinor,
  discountMinor,
})

describe('advance document totals (server-side, minor units)', () => {
  it('sums lines, takes the discount, adds tax, rounds once per line', () => {
    const built = advanceDocumentFrom(
      { lines: [line(2.5, 1001), line(3, 2000, 500)], discountMinor: 1000, taxRate: 10 },
      'AFN',
      1000,
    )
    expect(built.ok).toBe(true)
    if (!built.ok) return
    // 2.5 × 1001 = 2502.5 → 2503; 3 × 2000 − 500 = 5500
    expect(built.document.lines.map((l) => l.totalMinor)).toEqual([2503, 5500])
    expect(built.document.subtotalMinor).toBe(8003)
    expect(built.document.taxMinor).toBe(700) // (8003 − 1000) × 10% = 700.3 → 700
    expect(built.document.totalMinor).toBe(7703)
    // scale check: total is between subtotal − discount and that + 10%
    expect(built.document.totalMinor).toBeGreaterThanOrEqual(7003)
    expect(built.document.totalMinor).toBeLessThanOrEqual(7704)
  })

  it('refuses an advance larger than the document', () => {
    expect(advanceDocumentFrom({ lines: [line(1, 100)] }, 'AFN', 101)).toEqual({
      ok: false,
      code: 'ADVANCE_EXCEEDS_DOCUMENT',
    })
  })

  it('refuses a discount over the subtotal and a negative line', () => {
    expect(advanceDocumentFrom({ lines: [line(1, 100)], discountMinor: 101 }, 'AFN', 1).ok).toBe(
      false,
    )
    expect(advanceDocumentFrom({ lines: [line(1, 100, 101)] }, 'AFN', 1).ok).toBe(false)
  })

  it('the schema refuses a float price and an empty document', () => {
    expect(advanceDocumentInputSchema.safeParse({ lines: [line(1, 10.5)] }).success).toBe(false)
    expect(advanceDocumentInputSchema.safeParse({ lines: [] }).success).toBe(false)
  })
})
