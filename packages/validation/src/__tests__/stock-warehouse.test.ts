// ============================================
// The warehouse rule of a stock change — the shared copy the device will run.
//
// BUG-080: a product-page edit recorded its movement with NO warehouse while
// sales named theirs, so the product page said 20 and the warehouse said −10
// for the same item. The rule is what stops that, and the offline edition
// requires the device to reach the same answer with no server to ask.
//
// ⚠️ EVERY FIXTURE HAS TWO WAREHOUSES where the case allows it — «more than
// one» is exactly where a guess would happen, and a one-warehouse fixture
// cannot see the difference between a rule and a default.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  checkAssign,
  productWarehouseBreakdown,
  stockEditWarehouse,
  type WarehouseRow,
} from '../schemas/stock'

const w = (id: string, is_active: boolean | null = true): WarehouseRow => ({
  id,
  name: id,
  location: null,
  is_active,
})

describe('stockEditWarehouse — where a product-page stock change lands', () => {
  it('into the named warehouse, when it is a live one of this business', () => {
    expect(stockEditWarehouse([w('haji'), w('kabul')], 'kabul', 'edit')).toEqual({
      warehouseId: 'kabul',
    })
  })

  it('refuses an id that is not a live warehouse here', () => {
    expect(stockEditWarehouse([w('haji'), w('kabul')], 'zzz', 'edit')).toEqual({
      refusal: 'PRODUCT_WAREHOUSE_NOT_FOUND',
    })
    // Deactivated, so stock cannot be put in it.
    expect(stockEditWarehouse([w('haji'), w('old', false)], 'old', 'edit')).toEqual({
      refusal: 'PRODUCT_WAREHOUSE_NOT_FOUND',
    })
  })

  it('into the only LIVE warehouse — the case that produced 20 vs −10', () => {
    expect(stockEditWarehouse([w('haji')], undefined, 'edit')).toEqual({ warehouseId: 'haji' })
    expect(stockEditWarehouse([w('haji')], null, 'create')).toEqual({ warehouseId: 'haji' })
    expect(stockEditWarehouse([w('haji'), w('old', false)], undefined, 'edit')).toEqual({
      warehouseId: 'haji',
    })
  })

  it('with two warehouses an edit REFUSES rather than guesses', () => {
    expect(stockEditWarehouse([w('haji'), w('kabul')], undefined, 'edit')).toEqual({
      refusal: 'PRODUCT_WAREHOUSE_REQUIRED',
    })
  })

  it('creation keeps the documented «بدون انبار» so the form can ask', () => {
    expect(stockEditWarehouse([w('haji'), w('kabul')], undefined, 'create')).toEqual({
      warehouseId: null,
    })
  })

  it('with no warehouses at all, nowhere — there is nowhere else', () => {
    expect(stockEditWarehouse([], undefined, 'edit')).toEqual({ warehouseId: null })
    expect(stockEditWarehouse([], 'any', 'edit')).toEqual({
      refusal: 'PRODUCT_WAREHOUSE_NOT_FOUND',
    })
  })
})

describe('checkAssign — moving unassigned stock into a warehouse', () => {
  it('allows up to what is actually unassigned', () => {
    expect(checkAssign(5, 10)).toBeNull()
    expect(checkAssign(10, 10)).toBeNull()
  })

  it('refuses more than the business has, and a quantity that is not one', () => {
    expect(checkAssign(11, 10)).toBe('WAREHOUSE_ASSIGN_EXCEEDS_UNASSIGNED')
    expect(checkAssign(0, 10)).toBe('WAREHOUSE_ASSIGN_QUANTITY_INVALID')
    expect(checkAssign(Number.NaN, 10)).toBe('WAREHOUSE_ASSIGN_QUANTITY_INVALID')
  })
})

describe('productWarehouseBreakdown — «20» and «−10» are the same stock', () => {
  it('reproduces the report: 20 = −10 in the warehouse + 30 in none', () => {
    const b = productWarehouseBreakdown(
      20,
      [w('haji')],
      [{ warehouse_id: 'haji', product_id: 'p', quantity: '-10' }],
    )
    expect(b).toEqual({
      total: 20,
      warehouses: [{ id: 'haji', name: 'haji', quantity: -10 }],
      unassigned: 30,
    })
  })

  it('lists every warehouse, including the ones holding none of it', () => {
    const b = productWarehouseBreakdown(
      5,
      [w('haji'), w('kabul')],
      [{ warehouse_id: 'haji', product_id: 'p', quantity: 5 }],
    )
    expect(b.warehouses).toEqual([
      { id: 'haji', name: 'haji', quantity: 5 },
      { id: 'kabul', name: 'kabul', quantity: 0 },
    ])
    expect(b.unassigned).toBe(0)
  })
})
