// ============================================
// The costing rules — FIFO, weighted average and the cost of a shortfall.
//
// ⚠️ WHY THIS FILE EXISTS. Phase 2 of the offline edition moved these rules out
// of `backend/src/services/inventory-costing/costing.domain.ts` so the device can
// value a sale from its own cost layers with no server to ask. If the device
// and the server disagree, the same sale shows two different profits.
//
// ⚠️ EVERY MONEY FIXTURE IS RUN IN TWO CURRENCIES — AFN (written with no minor
// unit) and USD (two) — and the expected numbers are computed by hand and
// asserted exactly. A tolerance here would call a one-afghani difference equal.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  averageUnitCost,
  fifoOrder,
  grossProfit,
  lastKnownCost,
  layersValue,
  mayIssue,
  onHand,
  planConsumption,
  roundMoney,
  roundQty,
  type CostLayer,
} from '../schemas/costing.domain'

const layer = (
  id: string,
  remainingQty: number,
  unitCost: number,
  entryDate: string,
  createdAt = `${entryDate}T00:00:00.000Z`,
): CostLayer => ({
  id,
  productId: 'p1',
  warehouseId: null,
  remainingQty,
  unitCost,
  entryDate,
  createdAt,
})

describe('the order layers are consumed in', () => {
  it('is the arrival date, not the order the rows were created', () => {
    const ordered = fifoOrder([
      layer('late', 5, 10, '2026-03-01'),
      layer('early', 5, 10, '2026-01-01'),
    ])
    expect(ordered.map((l) => l.id)).toEqual(['early', 'late'])
  })

  it('breaks a same-day tie by when the row was created', () => {
    const ordered = fifoOrder([
      layer('second', 5, 10, '2026-01-01', '2026-01-01T09:00:00.000Z'),
      layer('first', 5, 10, '2026-01-01', '2026-01-01T08:00:00.000Z'),
    ])
    expect(ordered.map((l) => l.id)).toEqual(['first', 'second'])
  })
})

describe('what is on hand and what it is worth', () => {
  it('averages by quantity, not by unit cost', () => {
    // Two at 10 and eight at 5 average to 6 — the 7.5 an unweighted average
    // would give misprices every sale under AVCO.
    const layers = [layer('a', 2, 10, '2026-01-01'), layer('b', 8, 5, '2026-01-02')]
    expect(onHand(layers)).toBe(10)
    expect(layersValue(layers)).toBe(60)
    expect(averageUnitCost(layers)).toBe(6)
  })

  it('sums the layer value exactly, in two currencies', () => {
    const afn = [layer('a', 3, 100, '2026-01-01'), layer('b', 2, 250, '2026-01-02')]
    expect(layersValue(afn)).toBe(800)

    const usd = [layer('a', 3, 1.25, '2026-01-01'), layer('b', 2, 2.5, '2026-01-02')]
    expect(layersValue(usd)).toBe(8.75)
  })

  it('is zero for nothing on hand, not a division by zero', () => {
    expect(averageUnitCost([])).toBe(0)
    expect(layersValue([])).toBe(0)
    expect(onHand([])).toBe(0)
  })
})

describe('planConsumption — FIFO empties the oldest layer first', () => {
  it('splits a sale across a layer boundary (AFN, whole numbers)', () => {
    const plan = planConsumption(
      [layer('L1', 10, 100, '2026-01-01'), layer('L2', 10, 150, '2026-02-01')],
      15,
    )
    expect(plan.shortfall).toBe(0)
    expect(plan.totalCost).toBe(1750)
    expect(plan.steps).toEqual([
      { layerId: 'L1', quantity: 10, unitCost: 100, amount: 1000, isEstimated: false },
      { layerId: 'L2', quantity: 5, unitCost: 150, amount: 750, isEstimated: false },
    ])
  })

  it('is the same arithmetic in a two-decimal currency (USD)', () => {
    const plan = planConsumption(
      [layer('L1', 10, 1.25, '2026-01-01'), layer('L2', 10, 2.5, '2026-02-01')],
      15,
    )
    expect(plan.totalCost).toBe(25)
    expect(plan.steps.map((s) => s.amount)).toEqual([12.5, 12.5])
  })

  it('AVCO prices every unit at the current average', () => {
    const plan = planConsumption(
      [layer('L1', 2, 10, '2026-01-01'), layer('L2', 8, 5, '2026-01-02')],
      10,
      { method: 'avco' },
    )
    expect(plan.totalCost).toBe(60)
    expect(plan.steps.map((s) => s.unitCost)).toEqual([6, 6])
    expect(plan.steps.map((s) => s.amount)).toEqual([12, 48])
  })

  it('standard cost is used when one is configured', () => {
    const plan = planConsumption([layer('L1', 4, 100, '2026-01-01')], 3, {
      method: 'standard',
      standardCost: 90,
    })
    expect(plan.totalCost).toBe(270)
  })

  it('keeps four decimals on a fractional quantity', () => {
    const plan = planConsumption([layer('L1', 1, 1, '2026-01-01')], 0.3333)
    expect(plan.steps[0]?.quantity).toBe(0.3333)
  })
})

describe('a sale the stock cannot cover is priced, and says so', () => {
  it('costs the uncovered part from the last price paid', () => {
    const plan = planConsumption([layer('L1', 3, 100, '2026-01-01')], 5)
    expect(plan.shortfall).toBe(2)
    // Two units at the last known cost of 100, on top of the three at 300.
    expect(plan.totalCost).toBe(500)
    expect(plan.steps.at(-1)).toEqual({
      layerId: null,
      quantity: 2,
      unitCost: 100,
      amount: 200,
      isEstimated: true,
    })
  })

  it('prefers an explicit fallback over the last price', () => {
    const plan = planConsumption([layer('L1', 3, 100, '2026-01-01')], 5, {
      fallbackUnitCost: 120,
    })
    expect(plan.totalCost).toBe(540)
  })

  it('costs nothing, and admits it, when no price is known at all', () => {
    // Unknown is not zero: the row is flagged estimated so the guess can be
    // found, rather than disappearing into a clamped subtraction.
    const plan = planConsumption([], 4)
    expect(plan.shortfall).toBe(4)
    expect(plan.steps).toEqual([
      { layerId: null, quantity: 4, unitCost: 0, amount: 0, isEstimated: true },
    ])
    expect(lastKnownCost([])).toBeNull()
  })

  it('asks for nothing when the quantity is nothing', () => {
    expect(planConsumption([layer('L1', 5, 10, '2026-01-01')], 0)).toEqual({
      steps: [],
      totalCost: 0,
      shortfall: 0,
    })
    expect(planConsumption([layer('L1', 5, 10, '2026-01-01')], -1).steps).toEqual([])
  })
})

describe('mayIssue — the policy question, apart from the arithmetic', () => {
  it('allows what the shelf holds', () => {
    expect(mayIssue(5, 5, 'block')).toEqual({ allowed: true })
  })

  it('refuses more than the shelf holds when the policy blocks', () => {
    expect(mayIssue(3, 5, 'block')).toEqual({
      allowed: false,
      reason: 'INVENTORY_INSUFFICIENT_STOCK',
    })
  })

  it('allows it when the business sells what it does not have', () => {
    expect(mayIssue(3, 5, 'allow')).toEqual({ allowed: true })
  })
})

describe('grossProfit — revenue minus the cost actually consumed', () => {
  it('uses the layer cost, never the product’s current buy price', () => {
    // A phone bought at 10,000,000 and later restocked at 9,000,000 must still
    // show 2,000,000 on the first sale, not 3,000,000.
    expect(grossProfit(12_000_000, 10_000_000)).toBe(2_000_000)
    expect(grossProfit(100.5, 60.25)).toBe(40.25)
    expect(grossProfit(1750, 1750)).toBe(0)
  })
})

describe('the rounding boundary', () => {
  it('keeps four decimals on a quantity and two on money', () => {
    expect(roundQty(1 / 3)).toBe(0.3333)
    expect(roundQty(Number.NaN)).toBe(0)
    expect(roundMoney(1.006)).toBe(1.01)
    // ⚠️ A property of the float, not of the rounding direction (see
    // `money-primitive-guard.test.ts`).
    expect(roundMoney(1.005)).toBe(1)
  })
})
