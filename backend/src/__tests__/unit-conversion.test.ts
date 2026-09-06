// ============================================
// backend/src/__tests__/unit-conversion.test.ts
//
// L1 — Multi-UOM, and the backward-compatibility rule that makes it safe.
//
// ---------------------------------------------------------------------------
// THE TEST THAT MATTERS MOST IS THE FIRST ONE
//
// Before L1, `unit` is decorative: `batchUpdateStock` writes `item.quantity`
// raw, so a line reading «5 kg» has already stored 5 and `products.quantity`
// is in the product's own unit.
//
// If conversion were driven by `units.conversion_factor` — the dimension
// factor, where a kilogram is 1000 grams — every historical kilogram line
// would be re-read as 5000. `stock_movements` has been the source of truth for
// inventory since Phase C, so that is not a display bug: it is every weighed
// product's stock wrong by three orders of magnitude, permanently.
//
// «No declared units → factor 1» is what prevents it, and it is checked first.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  defaultUnitFor,
  fromBaseQuantity,
  roundToBaseScale,
  toBaseQuantity,
  validateUnitSet,
  type ProductUnitOption,
} from '../services/inventory/unit-conversion.domain'

const unit = (
  code: string,
  factor: number,
  flags: Partial<
    Pick<ProductUnitOption, 'isBaseUnit' | 'isPurchaseDefault' | 'isSaleDefault'>
  > = {},
): ProductUnitOption => ({
  unitId: `id-${code}`,
  unitCode: code,
  conversionFactorToBase: factor,
  isBaseUnit: flags.isBaseUnit ?? false,
  isPurchaseDefault: flags.isPurchaseDefault ?? false,
  isSaleDefault: flags.isSaleDefault ?? false,
})

/** The spec's own example: 1 carton = 24 pieces, base is the piece. */
const CARTONS = [unit('piece', 1, { isBaseUnit: true }), unit('carton', 24)]

describe('⚠️ a product that has not opted in behaves EXACTLY as before', () => {
  it('stores the quantity unchanged when no units are declared', () => {
    // This is every product in every workspace on the day L1 ships.
    expect(toBaseQuantity(5, 'kg', [])).toEqual({
      ok: true,
      baseQuantity: 5,
      baseUnitCode: null,
    })
  })

  it('does NOT apply the dimension factor', () => {
    // The whole hazard in one assertion. `units.conversion_factor` says a
    // kilogram is 1000 grams; applying it here would turn 5 kg of stock into
    // 5000 and corrupt the source of truth for every weighed product.
    const result = toBaseQuantity(5, 'kg', [])
    expect(result).toMatchObject({ baseQuantity: 5 })
    expect(result).not.toMatchObject({ baseQuantity: 5000 })
  })

  it('accepts a unit it has never heard of, when nothing is declared', () => {
    // A pre-L1 client sends whatever `unitSchema` allowed. Refusing would
    // break every existing caller the moment L1 shipped.
    expect(toBaseQuantity(3, 'ton', [])).toMatchObject({ ok: true, baseQuantity: 3 })
    expect(toBaseQuantity(3, 'custom', [])).toMatchObject({ ok: true, baseQuantity: 3 })
  })
})

describe('the core rule: 2 cartons is 48 pieces', () => {
  it('converts by the PRODUCT’s factor', () => {
    expect(toBaseQuantity(2, 'carton', CARTONS)).toEqual({
      ok: true,
      baseQuantity: 48,
      baseUnitCode: 'piece',
    })
  })

  it('leaves the base unit alone', () => {
    expect(toBaseQuantity(7, 'piece', CARTONS)).toMatchObject({ baseQuantity: 7 })
  })

  it('treats "no unit named" as the base', () => {
    // What every pre-L1 client and every internal caller sends.
    expect(toBaseQuantity(7, null, CARTONS)).toMatchObject({
      baseQuantity: 7,
      baseUnitCode: 'piece',
    })
    expect(toBaseQuantity(7, undefined, CARTONS)).toMatchObject({ baseQuantity: 7 })
  })

  it('the same unit code can mean different things on different products', () => {
    // This is why the factor is per-product and not on `units`. A carton of
    // one thing holds 24; of another, 12.
    const dozenCartons = [unit('piece', 1, { isBaseUnit: true }), unit('carton', 12)]
    expect(toBaseQuantity(2, 'carton', CARTONS)).toMatchObject({ baseQuantity: 48 })
    expect(toBaseQuantity(2, 'carton', dozenCartons)).toMatchObject({ baseQuantity: 24 })
  })
})

describe('what it refuses rather than guessing', () => {
  it('refuses a unit the product does not declare', () => {
    // ⚠️ NOT silently treated as the base. That would store a carton count as
    // a piece count — a wrong quantity nothing would ever flag.
    expect(toBaseQuantity(2, 'pallet', CARTONS)).toEqual({
      ok: false,
      code: 'UNIT_NOT_AVAILABLE_FOR_PRODUCT',
    })
  })

  it('refuses a declared set with no base', () => {
    // A data defect, not a default. Guessing which is the base would put a
    // wrong factor into the source of truth.
    expect(toBaseQuantity(2, 'carton', [unit('carton', 24)])).toEqual({
      ok: false,
      code: 'UNIT_NO_BASE_DEFINED',
    })
  })

  it('refuses a quantity that is not a number', () => {
    expect(toBaseQuantity(Number.NaN, 'piece', CARTONS)).toEqual({
      ok: false,
      code: 'UNIT_QUANTITY_INVALID',
    })
    expect(toBaseQuantity(Number.POSITIVE_INFINITY, null, [])).toEqual({
      ok: false,
      code: 'UNIT_QUANTITY_INVALID',
    })
  })

  it('allows a negative quantity — that is a reversal, not an error', () => {
    // `batchUpdateStock` passes `direction * quantity`, so a sale arrives
    // here negative. Refusing it would break every sale.
    expect(toBaseQuantity(-2, 'carton', CARTONS)).toMatchObject({ baseQuantity: -48 })
  })
})

describe('rounding matches what the columns actually hold', () => {
  it('keeps four decimals, the numeric(18,4) of Phase C', () => {
    expect(roundToBaseScale(1.00005)).toBe(1.0001)
    expect(roundToBaseScale(1.000049)).toBe(1)
  })

  it('rounds a fractional conversion to something storable', () => {
    // 1/3 of a base unit cannot be stored exactly; the service decides the
    // number, so the projection trigger does not silently round differently.
    const thirds = [unit('piece', 1, { isBaseUnit: true }), unit('third', 1 / 3)]
    expect(toBaseQuantity(1, 'third', thirds)).toMatchObject({ baseQuantity: 0.3333 })
  })

  it('handles the classic float case', () => {
    // 0.1 + 0.2 territory. Without the epsilon nudge this rounds the wrong way.
    expect(roundToBaseScale(1.0049999999999999 * 1)).toBeCloseTo(1.005, 3)
  })
})

describe('display conversion is one-way', () => {
  it('converts out of the base for display', () => {
    expect(fromBaseQuantity(48, 'carton', CARTONS)).toBe(2)
  })

  it('returns the base unchanged when nothing is declared', () => {
    expect(fromBaseQuantity(5, 'kg', [])).toBe(5)
  })

  it('refuses a unit the product does not declare', () => {
    expect(fromBaseQuantity(48, 'pallet', CARTONS)).toBeNull()
  })

  it('a round trip through a STORED display quantity does not come back', () => {
    // In full float precision the trip is lossless: 1/24 × 24 rounds back to 1.
    const exact = fromBaseQuantity(1, 'carton', CARTONS)!
    expect(toBaseQuantity(exact, 'carton', CARTONS)).toMatchObject({ baseQuantity: 1 })

    // But a display quantity that was WRITTEN DOWN is stored at four decimals
    // like everything else — 0.0417 cartons — and 0.0417 × 24 is 1.0008.
    //
    // That is the reason the base is what `stock_movements` holds. One piece
    // shown as a fraction of a carton, saved, and read back is no longer one
    // piece, and the drift compounds on every edit.
    const stored = roundToBaseScale(exact)
    expect(stored).toBe(0.0417)
    expect(toBaseQuantity(stored, 'carton', CARTONS)).toMatchObject({ baseQuantity: 1.0008 })
  })
})

describe('which unit a document offers', () => {
  it('prefers the sale default on a sale', () => {
    const options = [
      unit('piece', 1, { isBaseUnit: true }),
      unit('carton', 24, { isSaleDefault: true }),
    ]
    expect(defaultUnitFor('sale', options)?.unitCode).toBe('carton')
  })

  it('prefers the purchase default on a purchase', () => {
    const options = [
      unit('piece', 1, { isBaseUnit: true, isSaleDefault: true }),
      unit('carton', 24, { isPurchaseDefault: true }),
    ]
    expect(defaultUnitFor('purchase', options)?.unitCode).toBe('carton')
  })

  it('falls back to the BASE, not to the first row', () => {
    // «First row» depends on insertion order and would change under the user
    // for no visible reason.
    const options = [unit('carton', 24), unit('piece', 1, { isBaseUnit: true })]
    expect(defaultUnitFor('sale', options)?.unitCode).toBe('piece')
  })

  it('offers nothing when the product has not opted in', () => {
    expect(defaultUnitFor('sale', [])).toBeNull()
  })
})

describe('a coherent set of units', () => {
  it('accepts the spec’s example', () => {
    expect(validateUnitSet(CARTONS)).toEqual([])
  })

  it('accepts an empty set — that is «not opted in», not «invalid»', () => {
    expect(validateUnitSet([])).toEqual([])
  })

  it('refuses no base and two bases', () => {
    expect(validateUnitSet([unit('carton', 24)])).toContain('UNIT_SET_NO_BASE')
    expect(
      validateUnitSet([
        unit('piece', 1, { isBaseUnit: true }),
        unit('gram', 1, { isBaseUnit: true }),
      ]),
    ).toContain('UNIT_SET_MULTIPLE_BASES')
  })

  it('refuses a base whose factor is not 1', () => {
    // «Convert to base» would be lossy on the base itself.
    expect(validateUnitSet([unit('piece', 24, { isBaseUnit: true })])).toContain(
      'UNIT_SET_BASE_FACTOR_NOT_ONE',
    )
  })

  it('refuses a zero or negative factor', () => {
    expect(validateUnitSet([unit('piece', 1, { isBaseUnit: true }), unit('carton', 0)])).toContain(
      'UNIT_SET_FACTOR_INVALID',
    )
  })

  it('refuses the same unit twice', () => {
    expect(validateUnitSet([unit('piece', 1, { isBaseUnit: true }), unit('piece', 2)])).toContain(
      'UNIT_SET_DUPLICATE_UNIT',
    )
  })
})
