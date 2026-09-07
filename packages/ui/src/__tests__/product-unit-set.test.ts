// ============================================
// T11 / L1 — the rules that make a quantity deterministic.
//
// ---------------------------------------------------------------------------
// WHY THIS IS TESTED CLIENT-SIDE TOO
//
// The server validates the same rules and the database enforces the two that
// matter with partial unique indexes. This is not a substitute for either — it
// exists because the rules are properties of the SET, not of the field being
// edited, so without it a person builds an invalid set and only finds out on
// submit, with a code they cannot map back to a row.
//
// ---------------------------------------------------------------------------
// ⚠️ WHAT GOES WRONG IF THESE SLIP
//
// `conversion_factor_to_base` is how «2 cartons» becomes a number in
// `stock_movements`, which is the source of truth for quantity. Every failure
// mode below writes a WRONG QUANTITY into inventory and reports nothing:
//
//   two bases        «convert to base» has two answers
//   base factor ≠ 1  converting the base unit is lossy on itself
//   factor 0 or —    a division that yields Infinity or NaN
//   duplicate unit   the conversion for that unit is ambiguous
// ============================================

import { describe, expect, it } from 'vitest'

import {
  newUnitRow,
  unitSetProblems,
  type ProductUnitDraft,
} from '../components/ui/warehouse/product-units-panel'

const row = (patch: Partial<ProductUnitDraft>): ProductUnitDraft => ({
  ...newUnitRow(),
  unitId: '11111111-1111-1111-1111-111111111111',
  conversionFactorToBase: '1',
  ...patch,
})

/** piece = base, carton = 24 pieces. The example the whole feature exists for. */
const validSet: ProductUnitDraft[] = [
  row({ unitId: 'unit-piece', conversionFactorToBase: '1', isBaseUnit: true, isSaleDefault: true }),
  row({ unitId: 'unit-carton', conversionFactorToBase: '24', isPurchaseDefault: true }),
]

describe('a valid set is accepted', () => {
  it('piece as base, carton at 24', () => {
    expect(unitSetProblems(validSet)).toEqual([])
  })

  it('an EMPTY set is valid — it means «single unit»', () => {
    // `product_units` is opt-in. Refusing empty would make the first
    // experiment with multi-unit permanent, because there would be no way
    // back to a simple product.
    expect(unitSetProblems([])).toEqual([])
  })
})

describe('⚠️ exactly one base', () => {
  it('refuses a set with no base', () => {
    const rows = validSet.map((item) => ({ ...item, isBaseUnit: false }))
    expect(unitSetProblems(rows).length).toBeGreaterThan(0)
  })

  it('refuses two bases', () => {
    // «Convert to base» would have two answers, and every movement for this
    // product would become non-deterministic.
    const rows = validSet.map((item) => ({ ...item, isBaseUnit: true }))
    expect(unitSetProblems(rows).some((problem) => problem.includes('یک واحد'))).toBe(true)
  })
})

describe('⚠️ the base converts to itself', () => {
  it('refuses a base whose factor is not 1', () => {
    const rows = [
      row({ unitId: 'a', conversionFactorToBase: '24', isBaseUnit: true }),
      row({ unitId: 'b', conversionFactorToBase: '1' }),
    ]
    expect(unitSetProblems(rows).some((problem) => problem.includes('۱'))).toBe(true)
  })
})

describe('⚠️ every factor is a positive number', () => {
  it.each(['0', '-1', '', 'abc'])('refuses a factor of %s', (factor) => {
    const rows = [
      row({ unitId: 'a', conversionFactorToBase: '1', isBaseUnit: true }),
      row({ unitId: 'b', conversionFactorToBase: factor }),
    ]
    // Zero divides to Infinity; a blank or unparseable value yields NaN. Both
    // reach `stock_movements` as a quantity if they get through.
    expect(unitSetProblems(rows).length).toBeGreaterThan(0)
  })
})

describe('⚠️ a unit appears at most once', () => {
  it('refuses the same unit twice', () => {
    const rows = [
      row({ unitId: 'same', conversionFactorToBase: '1', isBaseUnit: true }),
      row({ unitId: 'same', conversionFactorToBase: '24' }),
    ]
    expect(unitSetProblems(rows).some((problem) => problem.includes('یک بار'))).toBe(true)
  })

  it('refuses a row with no unit chosen', () => {
    const rows = [row({ unitId: '', conversionFactorToBase: '1', isBaseUnit: true })]
    expect(unitSetProblems(rows).length).toBeGreaterThan(0)
  })
})

describe('at most one default per side', () => {
  it('refuses two purchase defaults', () => {
    const rows = validSet.map((item) => ({ ...item, isPurchaseDefault: true }))
    expect(unitSetProblems(rows).some((problem) => problem.includes('خرید'))).toBe(true)
  })

  it('refuses two sale defaults', () => {
    const rows = validSet.map((item) => ({ ...item, isSaleDefault: true }))
    expect(unitSetProblems(rows).some((problem) => problem.includes('فروش'))).toBe(true)
  })

  it('allows NO default on either side', () => {
    // Optional by design — a product may have units without either being
    // preferred, and the invoice falls back to the base.
    const rows = validSet.map((item) => ({
      ...item,
      isPurchaseDefault: false,
      isSaleDefault: false,
    }))
    expect(unitSetProblems(rows)).toEqual([])
  })

  it('allows the same unit to be both defaults', () => {
    // «We buy and sell in cartons» is ordinary. The constraint is one per
    // side, not one overall.
    const rows = [
      row({ unitId: 'a', conversionFactorToBase: '1', isBaseUnit: true }),
      row({
        unitId: 'b',
        conversionFactorToBase: '24',
        isPurchaseDefault: true,
        isSaleDefault: true,
      }),
    ]
    expect(unitSetProblems(rows)).toEqual([])
  })
})
