import { describe, expect, it } from 'vitest'
import {
  ALLOWED_SALES_ORDER_TRANSITIONS,
  deriveOrderFulfillmentStatus,
  deriveOrderLineQuantities,
  isValidSalesOrderTransition,
  orderDeliveryCreateSchema,
} from '../schemas/sales-order-lifecycle'

describe('V61 §2.4 sales-order lifecycle rules', () => {
  it('enforces valid transitions including quoted and partially_fulfilled', () => {
    expect(isValidSalesOrderTransition('quoted', 'pending')).toBe(true)
    expect(isValidSalesOrderTransition('quoted', 'confirmed')).toBe(true)
    expect(isValidSalesOrderTransition('quoted', 'fulfilled')).toBe(false)
    expect(isValidSalesOrderTransition('pending', 'confirmed')).toBe(true)
    expect(isValidSalesOrderTransition('confirmed', 'partially_fulfilled')).toBe(true)
    expect(isValidSalesOrderTransition('partially_fulfilled', 'fulfilled')).toBe(true)
    expect(isValidSalesOrderTransition('cancelled', 'confirmed')).toBe(false)
    expect(ALLOWED_SALES_ORDER_TRANSITIONS.fulfilled).toEqual([])
  })

  it('derives backorder and remaining quantities without inventing zero', () => {
    expect(
      deriveOrderLineQuantities({
        orderedQuantity: 10,
        reservedQuantity: 6,
        deliveredQuantity: 2,
      }),
    ).toEqual({
      orderedQuantity: 10,
      reservedQuantity: 6,
      deliveredQuantity: 2,
      remainingToDeliver: 8,
      backorderedQuantity: 2,
    })

    expect(
      deriveOrderLineQuantities({
        orderedQuantity: 5,
        reservedQuantity: 5,
        deliveredQuantity: 0,
      }).backorderedQuantity,
    ).toBe(0)
  })

  it('derives partially_fulfilled and fulfilled from line deliveries', () => {
    expect(
      deriveOrderFulfillmentStatus(
        [
          { orderedQuantity: 5, reservedQuantity: 3, deliveredQuantity: 2 },
          { orderedQuantity: 4, reservedQuantity: 4, deliveredQuantity: 0 },
        ],
        'confirmed',
      ),
    ).toBe('partially_fulfilled')

    expect(
      deriveOrderFulfillmentStatus(
        [
          { orderedQuantity: 5, reservedQuantity: 0, deliveredQuantity: 5 },
          { orderedQuantity: 4, reservedQuantity: 0, deliveredQuantity: 4 },
        ],
        'partially_fulfilled',
      ),
    ).toBe('fulfilled')
  })

  it('validates partial delivery payload strictly', () => {
    const parsed = orderDeliveryCreateSchema.safeParse({
      warehouseId: '11111111-1111-4111-8111-111111111111',
      idempotencyKey: 'del-1',
      lines: [{ orderItemId: '22222222-2222-4222-8222-222222222222', quantity: 2 }],
    })
    expect(parsed.success).toBe(true)

    const bad = orderDeliveryCreateSchema.safeParse({
      warehouseId: '11111111-1111-4111-8111-111111111111',
      idempotencyKey: 'del-1',
      lines: [],
    })
    expect(bad.success).toBe(false)
  })
})
