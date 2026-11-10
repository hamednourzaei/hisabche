// ============================================
// packages/validation/src/__tests__/variant-sales-availability.test.ts
//
// V55 P2: a sale line that names a variant must be covered by THAT variant's
// stock — not by the product's total. Two lines of one document add up before
// the comparison. The caller applies the negative-stock policy; this rule is
// the arithmetic only (the same split `mayIssue` keeps).
// ============================================

import { describe, expect, it } from 'vitest'

import {
  checkVariantSalesAvailability,
  type VariantSaleDemand,
} from '../schemas/universal-core/variants.domain'

const stock = (variantId: string, warehouseId: string | null, quantity: number) => ({
  variantId,
  warehouseId,
  quantity,
})
const demand = (
  variantId: string,
  warehouseId: string | null,
  quantity: number,
): VariantSaleDemand => ({
  variantId,
  warehouseId,
  quantity,
})

describe('checkVariantSalesAvailability', () => {
  it('a variant with stock is sellable', () => {
    expect(
      checkVariantSalesAvailability({
        demands: [demand('v1', 'w1', 3)],
        stock: [stock('v1', 'w1', 5)],
      }),
    ).toBeNull()
  })

  it('selling a variant with no stock is refused — even when the PRODUCT has stock on another variant', () => {
    expect(
      checkVariantSalesAvailability({
        demands: [demand('v-black', 'w1', 2)],
        stock: [stock('v-white', 'w1', 10)],
      }),
    ).toBe('VARIANT_STOCK_NOT_ENOUGH')
  })

  it('the same variant in two lines of one document adds up before the comparison', () => {
    // 2 + 2 against 3: each line alone would pass, the document must not.
    expect(
      checkVariantSalesAvailability({
        demands: [demand('v1', 'w1', 2), demand('v1', 'w1', 2)],
        stock: [stock('v1', 'w1', 3)],
      }),
    ).toBe('VARIANT_STOCK_NOT_ENOUGH')

    // 2 + 1 against 3 is exactly covered.
    expect(
      checkVariantSalesAvailability({
        demands: [demand('v1', 'w1', 2), demand('v1', 'w1', 1)],
        stock: [stock('v1', 'w1', 3)],
      }),
    ).toBeNull()
  })

  it('the warehouse is part of the answer: stock in another warehouse does not cover the sale', () => {
    expect(
      checkVariantSalesAvailability({
        demands: [demand('v1', 'w1', 1)],
        stock: [stock('v1', 'w2', 10)],
      }),
    ).toBe('VARIANT_STOCK_NOT_ENOUGH')

    expect(
      checkVariantSalesAvailability({
        demands: [demand('v1', 'w1', 1)],
        stock: [stock('v1', 'w1', 1), stock('v1', 'w2', 10)],
      }),
    ).toBeNull()
  })

  it('a demand with no warehouse is covered by the variant total across warehouses', () => {
    expect(
      checkVariantSalesAvailability({
        demands: [demand('v1', null, 7)],
        stock: [stock('v1', 'w1', 4), stock('v1', 'w2', 3)],
      }),
    ).toBeNull()
  })

  it('the same variant in different warehouses of one document does not double-count one shelf', () => {
    expect(
      checkVariantSalesAvailability({
        demands: [demand('v1', 'w1', 2), demand('v1', 'w2', 2)],
        stock: [stock('v1', 'w1', 2), stock('v1', 'w2', 2)],
      }),
    ).toBeNull()
  })

  it('a non-positive demand asks for nothing', () => {
    expect(
      checkVariantSalesAvailability({
        demands: [demand('v1', 'w1', 0)],
        stock: [],
      }),
    ).toBeNull()
  })

  it('float noise from the quantity rounding never refuses a covered sale', () => {
    expect(
      checkVariantSalesAvailability({
        demands: [demand('v1', 'w1', 3.0000000001)],
        stock: [stock('v1', 'w1', 3)],
      }),
    ).toBeNull()
  })
})
