// ============================================
// Counting the shelves, transferring between them, and knowing what to buy.
//
// The three decisions worth defending:
//   · a shortage costs what those units cost, not what today's cost
//   · goods in a truck belong to neither warehouse and still belong to you
//   · what needs reordering is judged on PROJECTED stock, not on-hand
// ============================================

import { describe, expect, it } from 'vitest'

import type { CostLayer } from '../services/inventory-costing/costing.domain'
import {
  priceLine,
  summariseCount,
  valueShortage,
  varianceEntry,
} from '../services/inventory-costing/stock-count.domain'
import {
  canSettle,
  cancelEffects,
  dispatchEffects,
  inTransitTotals,
  receiveEffects,
  suggestReorders,
  validateDispatch,
  type Transfer,
} from '../services/inventory-costing/transfer.domain'

const layer = (remainingQty: number, unitCost: number, day: string): CostLayer => ({
  id: `l-${day}-${unitCost}`,
  productId: 'p1',
  warehouseId: null,
  remainingQty,
  unitCost,
  entryDate: `2026-01-${day}`,
  createdAt: `2026-01-${day}`,
})

/** Oldest first — 10 @ 5, then 10 @ 9. */
const LAYERS = [layer(10, 5, '01'), layer(10, 9, '02')]

describe('a shortage costs what those units cost', () => {
  it('takes the oldest layer first', () => {
    // Valuing at the NEWEST layer would leave the oldest, cheapest stock on
    // the books forever and inflate inventory with every count.
    expect(valueShortage(LAYERS, 4)).toBe(20)
  })

  it('spills into the next layer when the first runs out', () => {
    expect(valueShortage(LAYERS, 12)).toBe(10 * 5 + 2 * 9)
  })

  it('values what the layers cannot cover at the average, never at zero', () => {
    // Zero would say the missing goods were free. The average of 10@5 and
    // 10@9 is 7, so the 5 uncovered units are worth 35.
    expect(valueShortage(LAYERS, 25)).toBe(10 * 5 + 10 * 9 + 5 * 7)
  })

  it('costs nothing when nothing is missing', () => {
    expect(valueShortage(LAYERS, 0)).toBe(0)
  })
})

describe('a surplus is not the mirror of a shortage', () => {
  it('enters at the current average, because it has no purchase history', () => {
    const line = priceLine({ productId: 'p1', expectedQty: 20, countedQty: 23 }, LAYERS)
    expect(line.direction).toBe('surplus')
    expect(line.varianceValue).toBe(21) // 3 × average of 7
  })

  it('while a shortage is priced from the layers', () => {
    const line = priceLine({ productId: 'p1', expectedQty: 20, countedQty: 16 }, LAYERS)
    expect(line.direction).toBe('shortage')
    expect(line.varianceValue).toBe(20) // 4 × 5, oldest first
  })

  it('reports the value as positive and puts the sign in the direction', () => {
    const line = priceLine({ productId: 'p1', expectedQty: 20, countedQty: 16 }, LAYERS)
    expect(line.varianceQty).toBe(-4)
    expect(line.varianceValue).toBeGreaterThan(0)
  })
})

describe('the count summary', () => {
  const lines = [
    priceLine({ productId: 'a', expectedQty: 20, countedQty: 16 }, LAYERS), // −20
    priceLine({ productId: 'b', expectedQty: 20, countedQty: 23 }, LAYERS), // +21
    priceLine({ productId: 'c', expectedQty: 5, countedQty: 5 }, LAYERS), // matched
  ]

  it('keeps the lines that matched', () => {
    // A count where 400 of 410 matched is a different fact from a count of 10,
    // and a report showing only discrepancies cannot tell you which happened.
    const summary = summariseCount(lines)
    expect(summary.countedProducts).toBe(3)
    expect(summary.matchedProducts).toBe(1)
  })

  it('nets shortage against surplus', () => {
    const summary = summariseCount(lines)
    expect(summary.shortageValue).toBe(20)
    expect(summary.surplusValue).toBe(21)
    expect(summary.netLoss).toBe(-1)
  })
})

describe('the entry a count posts', () => {
  const accounts = { inventory: 'acc-inv', shrinkage: 'acc-shrink' }

  it('debits shrinkage and credits inventory on a net loss', () => {
    const summary = summariseCount([
      priceLine({ productId: 'a', expectedQty: 20, countedQty: 16 }, LAYERS),
    ])
    const entry = varianceEntry(summary, accounts)

    expect(entry?.lines).toEqual([
      { accountId: 'acc-shrink', debit: 20, credit: 0 },
      { accountId: 'acc-inv', debit: 0, credit: 20 },
    ])
  })

  it('reverses on a net surplus', () => {
    const summary = summariseCount([
      priceLine({ productId: 'a', expectedQty: 20, countedQty: 23 }, LAYERS),
    ])
    const entry = varianceEntry(summary, accounts)
    expect(entry?.lines[0]).toMatchObject({ accountId: 'acc-inv', debit: 21 })
  })

  it('posts NOTHING when the count was clean', () => {
    // A balanced pair of zero lines after every clean count fills the journal
    // with entries nobody reads.
    const summary = summariseCount([
      priceLine({ productId: 'a', expectedQty: 5, countedQty: 5 }, LAYERS),
    ])
    expect(varianceEntry(summary, accounts)).toBeNull()
  })

  it('always balances', () => {
    const summary = summariseCount([
      priceLine({ productId: 'a', expectedQty: 20, countedQty: 16 }, LAYERS),
    ])
    const entry = varianceEntry(summary, accounts)!
    const debit = entry.lines.reduce((sum, line) => sum + line.debit, 0)
    const credit = entry.lines.reduce((sum, line) => sum + line.credit, 0)
    expect(debit).toBe(credit)
  })
})

/* ─── Transfers ───────────────────────────────────────────────────────────── */

const transfer = (state: Transfer['state'] = 'dispatched'): Transfer => ({
  id: 't1',
  fromWarehouseId: 'kabul',
  toWarehouseId: 'herat',
  state,
  lines: [{ productId: 'p1', quantity: 12 }],
})

describe('a transfer never creates or destroys stock', () => {
  it('takes from the source on dispatch and gives to NOBODY yet', () => {
    // The gap is the point. Closing it early is the bug this module prevents:
    // for a day the goods are counted in Herat and physically outside Kabul.
    const effects = dispatchEffects(transfer())
    expect(effects).toEqual([{ warehouseId: 'kabul', productId: 'p1', delta: -12 }])
  })

  it('gives to the destination on receipt', () => {
    expect(receiveEffects(transfer())).toEqual([
      { warehouseId: 'herat', productId: 'p1', delta: 12 },
    ])
  })

  it('nets to zero across dispatch and receipt', () => {
    const total = [...dispatchEffects(transfer()), ...receiveEffects(transfer())].reduce(
      (sum, effect) => sum + effect.delta,
      0,
    )
    expect(total).toBe(0)
  })

  it('returns the goods to the SOURCE when cancelled', () => {
    expect(cancelEffects(transfer())).toEqual([
      { warehouseId: 'kabul', productId: 'p1', delta: 12 },
    ])
  })
})

describe('a settled transfer cannot be settled again', () => {
  it.each(['received', 'cancelled'] as const)('%s is finished', (state) => {
    // Receiving twice doubles the destination's stock, and the second receipt
    // looks exactly like the first in the log.
    expect(canSettle(state)).toBe(false)
  })

  it('a dispatched one can be', () => {
    expect(canSettle('dispatched')).toBe(true)
  })
})

describe('dispatch validation', () => {
  const available = new Map([['p1', 20]])

  it('refuses a transfer to the same warehouse', () => {
    expect(
      validateDispatch(
        {
          fromWarehouseId: 'kabul',
          toWarehouseId: 'kabul',
          lines: [{ productId: 'p1', quantity: 1 }],
        },
        available,
        'block',
      ),
    ).toEqual({ ok: false, reason: 'SAME_WAREHOUSE' })
  })

  it('refuses more than is on hand when the policy blocks', () => {
    expect(
      validateDispatch(
        {
          fromWarehouseId: 'kabul',
          toWarehouseId: 'herat',
          lines: [{ productId: 'p1', quantity: 50 }],
        },
        available,
        'block',
      ),
    ).toMatchObject({ ok: false, reason: 'INSUFFICIENT_STOCK', productId: 'p1' })
  })

  it('permits it when the workspace allows negative stock', () => {
    expect(
      validateDispatch(
        {
          fromWarehouseId: 'kabul',
          toWarehouseId: 'herat',
          lines: [{ productId: 'p1', quantity: 50 }],
        },
        available,
        'allow',
      ),
    ).toEqual({ ok: true })
  })

  it('refuses a zero or negative quantity', () => {
    expect(
      validateDispatch(
        {
          fromWarehouseId: 'kabul',
          toWarehouseId: 'herat',
          lines: [{ productId: 'p1', quantity: 0 }],
        },
        available,
        'allow',
      ),
    ).toMatchObject({ reason: 'NON_POSITIVE_QUANTITY' })
  })
})

describe('what is in a truck right now', () => {
  it('counts only dispatched transfers', () => {
    const totals = inTransitTotals([transfer('dispatched'), transfer('received')])
    expect(totals.get('p1')).toBe(12)
  })
})

/* ─── Reordering ──────────────────────────────────────────────────────────── */

const item = (over: Partial<Parameters<typeof suggestReorders>[0][number]> = {}) => ({
  productId: 'p1',
  name: 'Bottle',
  onHand: 2,
  reorderLevel: 10,
  onOrder: 0,
  inTransit: 0,
  ...over,
})

describe('what to reorder is judged on PROJECTED stock', () => {
  it('does not suggest a product with stock already arriving', () => {
    // None on the shelf and 200 arriving tomorrow needs no order. Suggesting
    // it is how a shop ends up with four hundred.
    expect(suggestReorders([item({ onHand: 0, onOrder: 200 })])).toEqual([])
  })

  it('counts goods in transit between your own warehouses', () => {
    expect(suggestReorders([item({ onHand: 0, inTransit: 50 })])).toEqual([])
  })

  it('suggests the gap to the reorder level', () => {
    const [suggestion] = suggestReorders([item({ onHand: 2 })])
    expect(suggestion).toMatchObject({ projected: 2, suggestedQty: 8 })
  })

  it('skips products nobody gave a reorder level', () => {
    // Not the same as a level of zero. Suggesting for them floods the list
    // with every item somebody never configured.
    expect(suggestReorders([item({ reorderLevel: 0 })])).toEqual([])
  })

  it('puts what has run out entirely at the top', () => {
    const suggestions = suggestReorders([
      item({ productId: 'low', onHand: 8, reorderLevel: 10 }),
      item({ productId: 'gone', onHand: 0, reorderLevel: 10 }),
    ])
    expect(suggestions.map((suggestion) => suggestion.productId)).toEqual(['gone', 'low'])
  })
})
