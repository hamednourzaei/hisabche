// WP-10: a table is a label on the shared sales order; no second order engine,
// no invented bill splits, no two open orders holding the same seat.

import { describe, expect, it } from 'vitest'
import {
  canMoveTableOrder,
  canSendToKitchen,
  splitTableBill,
  tableIsOccupied,
} from '../schemas/universal-core/table-service.domain'

describe('table service on the shared order core (WP-10)', () => {
  it('an open order holds a table; a cancelled one releases it', () => {
    const orders = [
      { tableId: 't1', status: 'confirmed' as const },
      { tableId: 't2', status: 'cancelled' as const },
    ]
    expect(tableIsOccupied(orders, 't1')).toBe(true)
    expect(tableIsOccupied(orders, 't2')).toBe(false)
    expect(tableIsOccupied(orders, 't3')).toBe(false)
  })

  it('KDS stages move forward only, cancellation allowed mid-way', () => {
    expect(canMoveTableOrder('ordered', 'preparing')).toBe(true)
    expect(canMoveTableOrder('preparing', 'ready')).toBe(true)
    expect(canMoveTableOrder('ready', 'served')).toBe(true)
    expect(canMoveTableOrder('served', 'preparing')).toBe(false)
    expect(canMoveTableOrder('preparing', 'cancelled')).toBe(true)
  })

  it('only a confirmed order goes to the kitchen', () => {
    expect(canSendToKitchen('confirmed')).toBe(true)
    expect(canSendToKitchen('quoted')).toBe(false)
    expect(canSendToKitchen('cancelled')).toBe(false)
  })

  it('a bill split must foot to the total, never invent a seat amount', () => {
    expect(splitTableBill(100, [40, 60])).toEqual([40, 60])
    expect(splitTableBill(100, [40, 50])).toBeNull()
    expect(splitTableBill(100, [40, -1])).toBeNull()
  })
})
