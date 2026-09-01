// ============================================
// backend/src/services/inventory-costing/stock-count.domain.ts
//
// A3 · Counting the shelves, and what the count costs.
//
// ---------------------------------------------------------------------------
// A COUNT IS A FINANCIAL EVENT, NOT A CORRECTION
//
// The tempting implementation is `UPDATE products SET quantity = counted`. It
// is also wrong twice over.
//
// First, stock has a COST. Ten missing bottles are not a number that needs
// fixing — they are money that left the business, and it has to appear in the
// books as a loss. Silently overwriting the quantity makes the balance sheet
// disagree with the shelves in the opposite direction.
//
// Second, it destroys the evidence. A shopkeeper looking at last month's
// figures needs to see "we counted, and 10 were gone" — not a quantity that
// changed with no record of why.
//
// So a count produces a VARIANCE, the variance produces a stock movement, and
// the movement produces a journal entry. Same path as every other reason stock
// moves.
//
// ---------------------------------------------------------------------------
// THE COST OF A SHORTAGE IS NOT THE COST OF A SURPLUS
//
// A shortage is valued at what those units actually cost — read from the cost
// layers, oldest first, exactly as a sale would consume them. A surplus has no
// such history: nobody bought those units. They enter at the current average,
// because inventing a purchase price for goods that appeared from nowhere is
// the more dishonest of the two options, and the average is at least a figure
// the books already believe.
// ============================================

import { averageUnitCost, roundMoney, roundQty, type CostLayer } from './costing.domain'

export interface CountLine {
  productId: string
  /** What the system believed before the count. */
  expectedQty: number
  /** What a person actually found on the shelf. */
  countedQty: number
}

export type VarianceDirection = 'shortage' | 'surplus' | 'none'

export interface VarianceLine {
  productId: string
  expectedQty: number
  countedQty: number
  /** counted − expected. Negative is a shortage. */
  varianceQty: number
  direction: VarianceDirection
  /** Always positive; the direction carries the sign. */
  varianceValue: number
}

export function directionOf(varianceQty: number): VarianceDirection {
  if (varianceQty < 0) return 'shortage'
  if (varianceQty > 0) return 'surplus'
  return 'none'
}

/**
 * What a shortage of `quantity` units costs, taken from the layers oldest
 * first.
 *
 * ⚠️ The same order a sale consumes them in. Valuing a shortage at the newest
 * layer instead would leave the oldest, cheapest stock on the books forever
 * and quietly inflate the inventory value with every count.
 *
 * When the layers do not cover the shortage — which happens when the books
 * already believed less than they should — whatever remains is valued at the
 * average rather than at zero. Zero would say the missing goods were free.
 */
export function valueShortage(layers: readonly CostLayer[], quantity: number): number {
  let remaining = roundQty(quantity)
  let value = 0

  for (const layer of layers) {
    if (remaining <= 0) break
    const take = Math.min(layer.remainingQty, remaining)
    value += take * layer.unitCost
    remaining = roundQty(remaining - take)
  }

  if (remaining > 0) value += remaining * averageUnitCost([...layers])

  return roundMoney(value)
}

/**
 * One line of a count, priced.
 *
 * `layers` are that product's open cost layers, already in FIFO order.
 */
export function priceLine(line: CountLine, layers: readonly CostLayer[]): VarianceLine {
  const varianceQty = roundQty(line.countedQty - line.expectedQty)
  const direction = directionOf(varianceQty)

  const varianceValue =
    direction === 'shortage'
      ? valueShortage(layers, Math.abs(varianceQty))
      : direction === 'surplus'
        ? // No purchase history exists for goods that appeared. The current
          // average is the only figure the books already believe.
          roundMoney(varianceQty * averageUnitCost([...layers]))
        : 0

  return {
    productId: line.productId,
    expectedQty: line.expectedQty,
    countedQty: line.countedQty,
    varianceQty,
    direction,
    varianceValue,
  }
}

export interface CountSummary {
  lines: VarianceLine[]
  shortageValue: number
  surplusValue: number
  /** shortage − surplus. Positive is a net loss to write off. */
  netLoss: number
  countedProducts: number
  /** Lines where the shelf agreed with the system. */
  matchedProducts: number
}

/**
 * The whole count.
 *
 * ⚠️ Lines with no variance are KEPT in the summary. A count where 400 of 410
 * products matched is a different fact from a count of 10 products, and a
 * report that shows only the discrepancies cannot tell you which one happened.
 */
export function summariseCount(lines: readonly VarianceLine[]): CountSummary {
  let shortageMinor = 0
  let surplusMinor = 0
  let matched = 0

  for (const line of lines) {
    if (line.direction === 'shortage') shortageMinor += Math.round(line.varianceValue * 100)
    else if (line.direction === 'surplus') surplusMinor += Math.round(line.varianceValue * 100)
    else matched += 1
  }

  return {
    lines: [...lines],
    shortageValue: shortageMinor / 100,
    surplusValue: surplusMinor / 100,
    netLoss: (shortageMinor - surplusMinor) / 100,
    countedProducts: lines.length,
    matchedProducts: matched,
  }
}

/* ─── The journal entry a count produces ──────────────────────────────────── */

export interface VarianceEntry {
  lines: Array<{ accountId: string; debit: number; credit: number }>
  netLoss: number
}

/**
 * The adjusting entry.
 *
 * A net shortage DEBITS the shrinkage expense and CREDITS inventory: value has
 * left the business. A net surplus does the reverse.
 *
 * ⚠️ Returns `null` when the net is zero. Posting a balanced pair of zero
 * lines would put a meaningless entry in the journal after every clean count,
 * and a journal full of nothing is one nobody reads.
 */
export function varianceEntry(
  summary: CountSummary,
  accounts: { inventory: string; shrinkage: string },
): VarianceEntry | null {
  const netMinor = Math.round(summary.netLoss * 100)
  if (netMinor === 0) return null

  const amount = Math.abs(netMinor) / 100

  return {
    netLoss: summary.netLoss,
    lines:
      netMinor > 0
        ? [
            { accountId: accounts.shrinkage, debit: amount, credit: 0 },
            { accountId: accounts.inventory, debit: 0, credit: amount },
          ]
        : [
            { accountId: accounts.inventory, debit: amount, credit: 0 },
            { accountId: accounts.shrinkage, debit: 0, credit: amount },
          ],
  }
}
