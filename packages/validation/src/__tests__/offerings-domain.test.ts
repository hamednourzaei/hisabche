// ============================================
// packages/validation/src/__tests__/offerings-domain.test.ts
//
// Pure domain tests for Offering polymorphism (goods vs service vs package)
// and movesStock predicate.
// ============================================

import { describe, expect, it } from 'vitest'
import {
  movesStock,
  isServiceOffering,
  OFFERING_TYPES,
  offeringTypeSchema,
} from '../schemas/universal-core/offerings.domain'
import { productSchema, createProductSchema } from '../schemas/product.schema'

describe('offerings domain & movesStock predicate', () => {
  it('correctly classifies offering types for inventory movement', () => {
    // Goods move physical stock
    expect(movesStock('goods')).toBe(true)

    // Legacy/default values move stock (backward compatibility)
    expect(movesStock(undefined)).toBe(true)
    expect(movesStock(null)).toBe(true)
    expect(movesStock('')).toBe(true)

    // Services NEVER move physical inventory
    expect(movesStock('service')).toBe(false)
    expect(isServiceOffering('service')).toBe(true)
    expect(isServiceOffering('goods')).toBe(false)

    // Packages represent entitlement bundles and NEVER move warehouse stock
    expect(movesStock('package')).toBe(false)
  })

  it('validates offeringType enum with safe default of goods', () => {
    expect(OFFERING_TYPES).toEqual(['goods', 'service', 'package'])
    expect(offeringTypeSchema.parse(undefined)).toBe('goods')
    expect(offeringTypeSchema.parse('goods')).toBe('goods')
    expect(offeringTypeSchema.parse('service')).toBe('service')
    expect(offeringTypeSchema.parse('package')).toBe('package')
    expect(() => offeringTypeSchema.parse('invalid')).toThrow()
  })

  it('integrates offeringType into productSchema with default goods', () => {
    const rawGoods = {
      name: 'Sample Goods',
      sellPrice: 100,
    }
    const parsed = productSchema.parse(rawGoods)
    expect(parsed.offeringType).toBe('goods')

    const rawService = {
      name: 'Consulting Service',
      sellPrice: 500,
      offeringType: 'service',
    }
    const parsedService = productSchema.parse(rawService)
    expect(parsedService.offeringType).toBe('service')
  })

  it('preserves offeringType in createProductSchema', () => {
    const data = createProductSchema.parse({
      name: 'Haircut',
      sellPrice: 200,
      offeringType: 'service',
    })
    expect(data.offeringType).toBe('service')
  })
})
