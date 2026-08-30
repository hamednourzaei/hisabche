// ============================================
// Cost layers and what a sale actually costs.
//
// The headline case is the one from .claude/detail.md: buy a phone at
// 10,000,000, sell it, buy another at 9,000,000, sell that. The correct answer
// is 2,000,000 profit then 4,000,000 — six million in total. The old code,
// which priced every sale at the product's CURRENT buy price, reported three
// million then four: a million of profit that never existed.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  averageUnitCost,
  fifoOrder,
  grossProfit,
  lastKnownCost,
  mayIssue,
  onHand,
  planConsumption,
  stockValue,
  type CostLayer,
} from '../services/inventory-costing/costing.domain'

let seq = 0
const layer = (
  overrides: Partial<CostLayer> & { unitCost: number; remainingQty: number },
): CostLayer => ({
  id: `layer-${(seq += 1)}`,
  productId: 'A35',
  warehouseId: null,
  entryDate: '2026-01-01',
  createdAt: `2026-01-01T00:00:0${seq}.000Z`,
  ...overrides,
})

describe('the A35 case — a sale costs what its own purchase cost', () => {
  it('prices the first sale from the first purchase, not the latest one', () => {
    const first = layer({ remainingQty: 1, unitCost: 10_000_000, entryDate: '2026-01-01' })
    const plan = planConsumption([first], 1)

    expect(plan.totalCost).toBe(10_000_000)
    expect(grossProfit(12_000_000, plan.totalCost)).toBe(2_000_000)
  })

  it('prices the second sale from the second purchase', () => {
    // The first layer is spent; only the cheaper one is left.
    const second = layer({ remainingQty: 1, unitCost: 9_000_000, entryDate: '2026-02-01' })
    const plan = planConsumption([second], 1)

    expect(plan.totalCost).toBe(9_000_000)
    expect(grossProfit(13_000_000, plan.totalCost)).toBe(4_000_000)
  })

  it('totals six million over both trades, not seven', () => {
    const l1 = layer({ remainingQty: 1, unitCost: 10_000_000, entryDate: '2026-01-01' })
    const l2 = layer({ remainingQty: 1, unitCost: 9_000_000, entryDate: '2026-02-01' })

    const sale1 = planConsumption([l1, l2], 1)
    const remaining = [{ ...l1, remainingQty: l1.remainingQty - sale1.steps[0]!.quantity }, l2]
    const sale2 = planConsumption(remaining, 1)

    const profit =
      grossProfit(12_000_000, sale1.totalCost) + grossProfit(13_000_000, sale2.totalCost)
    expect(profit).toBe(6_000_000)
  })
})

describe('FIFO consumption', () => {
  it('empties the oldest layer before touching the next', () => {
    const old = layer({ remainingQty: 3, unitCost: 100, entryDate: '2026-01-01' })
    const recent = layer({ remainingQty: 5, unitCost: 200, entryDate: '2026-03-01' })

    const plan = planConsumption([recent, old], 4)

    expect(plan.steps.map((s) => s.layerId)).toEqual([old.id, recent.id])
    expect(plan.steps[0]!.quantity).toBe(3)
    expect(plan.steps[1]!.quantity).toBe(1)
    expect(plan.totalCost).toBe(3 * 100 + 1 * 200)
  })

  it('consumes a layer in part and leaves the rest', () => {
    const only = layer({ remainingQty: 10, unitCost: 50, entryDate: '2026-01-01' })
    const plan = planConsumption([only], 4)

    expect(plan.steps).toHaveLength(1)
    expect(plan.steps[0]!.quantity).toBe(4)
    expect(plan.shortfall).toBe(0)
  })

  it('breaks a same-day tie by arrival order', () => {
    const a = layer({ remainingQty: 1, unitCost: 10, entryDate: '2026-01-01' })
    const b = layer({ remainingQty: 1, unitCost: 20, entryDate: '2026-01-01' })

    expect(fifoOrder([b, a]).map((l) => l.id)).toEqual([a.id, b.id])
  })

  it('orders by the date the goods ARRIVED, not the row creation', () => {
    // A receipt entered late still takes its rightful place in the queue.
    const arrivedFirst = layer({
      remainingQty: 1,
      unitCost: 10,
      entryDate: '2026-01-01',
      createdAt: '2026-05-01T00:00:00.000Z',
    })
    const arrivedSecond = layer({
      remainingQty: 1,
      unitCost: 20,
      entryDate: '2026-02-01',
      createdAt: '2026-02-01T00:00:00.000Z',
    })

    const plan = planConsumption([arrivedSecond, arrivedFirst], 1)
    expect(plan.steps[0]!.unitCost).toBe(10)
  })
})

describe('a shortfall is recorded, never clamped away', () => {
  it('reports what could not be covered', () => {
    const only = layer({ remainingQty: 2, unitCost: 100, entryDate: '2026-01-01' })
    const plan = planConsumption([only], 5)

    expect(plan.shortfall).toBe(3)
  })

  it('costs the uncovered part at the last price actually paid', () => {
    // Costing it at zero would report the uncovered units as pure profit.
    const only = layer({ remainingQty: 2, unitCost: 100, entryDate: '2026-01-01' })
    const plan = planConsumption([only], 5)

    const estimated = plan.steps.find((s) => s.isEstimated)
    expect(estimated).toBeDefined()
    expect(estimated!.unitCost).toBe(100)
    expect(plan.totalCost).toBe(500)
  })

  it('marks the uncovered step so it can be found and corrected', () => {
    const plan = planConsumption([], 2, { fallbackUnitCost: 7 })
    expect(plan.steps).toEqual([
      { layerId: null, quantity: 2, unitCost: 7, amount: 14, isEstimated: true },
    ])
  })
})

describe('the negative stock policy decides whether an issue happens at all', () => {
  it('blocks by default', () => {
    expect(mayIssue(2, 5, 'block')).toEqual({
      allowed: false,
      reason: 'INVENTORY_INSUFFICIENT_STOCK',
    })
  })

  it('allows when the business has chosen to', () => {
    expect(mayIssue(2, 5, 'allow').allowed).toBe(true)
  })

  it('never blocks an issue that stock covers', () => {
    expect(mayIssue(5, 5, 'block').allowed).toBe(true)
  })
})

describe('AVCO', () => {
  const layers = [
    layer({ remainingQty: 2, unitCost: 10, entryDate: '2026-01-01' }),
    layer({ remainingQty: 8, unitCost: 5, entryDate: '2026-02-01' }),
  ]

  it('weights by quantity, not by the number of layers', () => {
    // Two at 10 and eight at 5 average to 6, not 7.5.
    expect(averageUnitCost(layers)).toBe(6)
  })

  it('prices every consumed unit at that average', () => {
    const plan = planConsumption(layers, 4, { method: 'avco' })
    expect(plan.totalCost).toBe(24)
    expect(plan.steps.every((s) => s.unitCost === 6)).toBe(true)
  })

  it('still draws from the layers in order, so the trail survives', () => {
    const plan = planConsumption(layers, 4, { method: 'avco' })
    expect(plan.steps).toHaveLength(2)
    expect(plan.steps[0]!.layerId).toBe(layers[0]!.id)
  })

  it('is zero with nothing in stock rather than dividing by zero', () => {
    expect(averageUnitCost([])).toBe(0)
  })
})

describe('standard costing', () => {
  it('uses the configured cost', () => {
    const layers = [layer({ remainingQty: 5, unitCost: 42, entryDate: '2026-01-01' })]
    const plan = planConsumption(layers, 2, { method: 'standard', standardCost: 40 })
    expect(plan.totalCost).toBe(80)
  })

  it('falls back to the average rather than costing at zero', () => {
    const layers = [layer({ remainingQty: 5, unitCost: 42, entryDate: '2026-01-01' })]
    const plan = planConsumption(layers, 2, { method: 'standard' })
    expect(plan.totalCost).toBe(84)
  })
})

describe('valuation', () => {
  const layers = [
    layer({ remainingQty: 3, unitCost: 100, entryDate: '2026-01-01' }),
    layer({ remainingQty: 2, unitCost: 250, entryDate: '2026-02-01' }),
  ]

  it('is the sum of what is left times what it cost', () => {
    expect(stockValue(layers)).toBe(800)
  })

  it('counts what is on hand from the layers, not from a cached quantity', () => {
    expect(onHand(layers)).toBe(5)
  })

  it('knows the last price paid', () => {
    expect(lastKnownCost(layers)).toBe(250)
  })

  it('has no last price when nothing was ever bought', () => {
    expect(lastKnownCost([])).toBeNull()
  })
})

describe('edge cases that must not silently produce a cost', () => {
  it('consuming zero costs nothing and takes nothing', () => {
    const only = layer({ remainingQty: 5, unitCost: 100, entryDate: '2026-01-01' })
    expect(planConsumption([only], 0)).toEqual({ steps: [], totalCost: 0, shortfall: 0 })
  })

  it('ignores layers that are already spent', () => {
    const spent = layer({ remainingQty: 0, unitCost: 100, entryDate: '2026-01-01' })
    const open = layer({ remainingQty: 1, unitCost: 200, entryDate: '2026-02-01' })

    const plan = planConsumption([spent, open], 1)
    expect(plan.steps[0]!.layerId).toBe(open.id)
  })
})
