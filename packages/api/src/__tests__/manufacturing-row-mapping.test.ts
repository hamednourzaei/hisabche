// ============================================
// GET /boms and GET /work-orders send RAW rows — `product_id`, `is_active`,
// `start_date`. The hooks used to type them camelCase and read them as such, so
// `productId` was undefined on every row and only the embedded product name
// kept the table from printing it. tsc was silent: a type is not a runtime
// check. These pin the mapping to the shape the service actually returns.
// ============================================

import { describe, expect, it } from 'vitest'

import { mapBom, mapWorkOrder } from '../hooks/manufacturing'

describe('mapBom', () => {
  it('reads the snake_case row the service sends', () => {
    const bom = mapBom({
      id: 'b1',
      product_id: 'p1',
      version: 3,
      is_active: true,
      currency: 'AFN',
      unit_cost: '45.5000',
      product: { id: 'p1', name: 'finished', unit: 'piece' },
      items: [{ id: 'i1' }, { id: 'i2' }],
    })
    expect(bom).toEqual({
      id: 'b1',
      productId: 'p1',
      version: 3,
      isActive: true,
      currency: 'AFN',
      unitCost: 45.5,
      product: { name: 'finished' },
      itemsCount: 2,
    })
  })

  it('a product that is gone is null — not a made-up name, and not a crash', () => {
    const bom = mapBom({ id: 'b1', product_id: 'p1', version: 1, is_active: false, product: null })
    expect(bom.product).toBeNull()
    expect(bom.isActive).toBe(false)
    expect(bom.itemsCount).toBe(0)
    expect(bom.currency).toBeNull()
  })
})

describe('mapWorkOrder', () => {
  it('reads the snake_case row the service sends', () => {
    const order = mapWorkOrder({
      id: 'w1',
      product_id: 'p1',
      quantity: '2.5000',
      bom_id: 'b1',
      status: 'planned',
      start_date: '2026-10-01T00:00:00',
      currency: null,
      total_cost: null,
      product: { id: 'p1', name: 'finished' },
    })
    expect(order.productId).toBe('p1')
    expect(order.quantity).toBe(2.5)
    expect(order.bomId).toBe('b1')
    expect(order.startDate).toBe('2026-10-01T00:00:00')
    expect(order.product).toEqual({ name: 'finished' })
  })

  it('an order that was never costed has NO total — null, not zero', () => {
    expect(mapWorkOrder({ id: 'w1', status: 'planned', total_cost: null }).totalCost).toBeNull()
    expect(mapWorkOrder({ id: 'w1', status: 'completed', total_cost: '0' }).totalCost).toBe(0)
    expect(mapWorkOrder({ id: 'w1', status: 'completed', total_cost: '90.0000' }).totalCost).toBe(
      90,
    )
  })
})
