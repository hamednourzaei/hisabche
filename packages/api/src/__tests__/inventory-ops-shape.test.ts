// ============================================
// packages/api/src/__tests__/inventory-ops-shape.test.ts
//
// «پیشنهاد سفارش» and «کالای راکد» crashed the warehouse hub (17 Oct 2026):
// `Cannot read properties of undefined (reading 'toLocaleString')`. The hooks
// were typed with names the server never sent (`productName`, `stockValue`,
// `reorderLevel`, `suggestedQuantity`) and `asList<T>()` let the rows through.
//
// These rows are written in the SERVER's shape — the fields of
// `reorder.service#suggestions` and `findDeadStock` + `name` — and every number
// the screen formats must come out a number.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { deadStockFromServer, reorderFromServer } from '../hooks/inventory-operations'

const ROOT = join(__dirname, '..', '..', '..', '..')

describe('reorder suggestions, as the server sends them', () => {
  it("name / reorderPoint / suggestedQty become the screen's fields, all numbers", () => {
    const row = reorderFromServer({
      productId: 'p1',
      name: 'روغن آشپزی',
      onHand: 3,
      inTransit: 0,
      onOrder: 0,
      availablePosition: 3,
      avgDailySales: 2,
      leadTimeDays: 7,
      safetyStock: 4,
      reorderPoint: 18,
      suggestedQty: 15,
    })
    expect(row).toEqual({
      productId: 'p1',
      productName: 'روغن آشپزی',
      onHand: 3,
      reorderLevel: 18,
      suggestedQuantity: 15,
      daysOfCover: null,
    })
  })
})

describe('dead stock, as the server sends it', () => {
  it('a sold-long-ago line and a never-sold line', () => {
    expect(
      deadStockFromServer({
        productId: 'p1',
        name: 'برنج',
        onHand: 40,
        lastSoldAt: '2026-05-01T00:00:00.000Z',
        daysSinceSale: 169,
        neverSold: false,
      }),
    ).toEqual({
      productId: 'p1',
      productName: 'برنج',
      onHand: 40,
      lastSoldAt: '2026-05-01T00:00:00.000Z',
      daysSinceSale: 169,
      neverSold: false,
    })
    const never = deadStockFromServer({
      productId: 'p2',
      onHand: 5,
      lastSoldAt: null,
      daysSinceSale: null,
      neverSold: true,
    })
    expect(never.neverSold).toBe(true)
    expect(never.daysSinceSale).toBeNull()
    expect(typeof never.onHand).toBe('number')
  })

  it('there is no stock value: the server does not compute one, and the screen does not show one', () => {
    expect(Object.keys(deadStockFromServer({ productId: 'p', onHand: 1 }))).not.toContain(
      'stockValue',
    )
    const view = readFileSync(
      join(
        ROOT,
        'packages',
        'ui',
        'src',
        'components',
        'ui',
        'inventory-ops',
        'inventory-ops-view.tsx',
      ),
      'utf8',
    )
    expect(view).not.toContain('stockValue')
    expect(view).not.toContain('lastMovementAt')
  })

  it('the server sends the name the screen reads', () => {
    const service = readFileSync(
      join(ROOT, 'backend', 'src', 'services', 'inventory', 'reorder.service.ts'),
      'utf8',
    )
    expect(service).toContain("name: names.get(line.productId) ?? ''")
  })
})
