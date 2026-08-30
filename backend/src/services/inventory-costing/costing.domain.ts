// ============================================
// backend/src/services/inventory-costing/costing.domain.ts
//
// How much a quantity of goods COST, with no database in sight.
//
// The authoritative consumption happens inside Postgres, under a row lock,
// because two sales of the last unit must not both succeed. These functions
// are the same arithmetic, kept pure so the rules can be stated and tested on
// their own: what FIFO takes from which layer, what a weighted average is,
// what a shortfall is worth.
// ============================================

export type CostingMethod = 'fifo' | 'avco' | 'standard'
export type NegativeStockPolicy = 'block' | 'allow'

export interface CostLayer {
  id: string
  productId: string
  warehouseId: string | null
  remainingQty: number
  unitCost: number
  /** The date the goods ARRIVED — the FIFO order, not the row's creation. */
  entryDate: string
  createdAt: string
}

export interface ConsumptionStep {
  layerId: string | null
  quantity: number
  unitCost: number
  amount: number
  /**
   * True when no layer covered this quantity. The cost is the last price we
   * actually paid, which is a guess — the row exists so the guess can be
   * found and corrected, rather than disappearing into a clamped subtraction.
   */
  isEstimated: boolean
}

export interface ConsumptionPlan {
  steps: ConsumptionStep[]
  totalCost: number
  /** Quantity no real layer covered. Non-zero means the shop sold air. */
  shortfall: number
}

/** Quantities carry four decimals; money is rounded at the boundary. */
export function roundQty(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 10_000) / 10_000
}

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

/** Oldest arrival first; the row's own creation order breaks a same-day tie. */
export function fifoOrder(layers: CostLayer[]): CostLayer[] {
  return [...layers].sort((a, b) => {
    if (a.entryDate !== b.entryDate) return a.entryDate < b.entryDate ? -1 : 1
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
  })
}

export function onHand(layers: CostLayer[]): number {
  return roundQty(layers.reduce((sum, l) => sum + l.remainingQty, 0))
}

/** Σ(remaining × unit cost) — the figure the stock account must agree with. */
export function stockValue(layers: CostLayer[]): number {
  return roundMoney(layers.reduce((sum, l) => sum + l.remainingQty * l.unitCost, 0))
}

/**
 * The weighted average of what is still open.
 *
 * Not the average of the unit costs: two units at 10 and eight at 5 average to
 * 6, not 7.5. Getting this wrong misprices every sale under AVCO.
 */
export function averageUnitCost(layers: CostLayer[]): number {
  const quantity = layers.reduce((sum, l) => sum + l.remainingQty, 0)
  if (quantity <= 0) return 0
  return layers.reduce((sum, l) => sum + l.remainingQty * l.unitCost, 0) / quantity
}

/**
 * What consuming `quantity` takes, and what it costs.
 *
 * FIFO empties the oldest layer before touching the next, and a layer may be
 * consumed in part — the case the old code could not express at all, because
 * it had one buy price per product and no layers to consume.
 *
 * AVCO draws the quantity in the same order so the trail from a sale back to
 * its purchases survives, but prices every unit at the current average.
 *
 * `standard` prices at `standardCost` when one is given, falling back to the
 * average so a misconfigured product cannot silently cost zero.
 */
export function planConsumption(
  layers: CostLayer[],
  quantity: number,
  options: {
    method?: CostingMethod
    /** Cost for the part no layer covers. The last price actually paid. */
    fallbackUnitCost?: number
    standardCost?: number
  } = {},
): ConsumptionPlan {
  const method = options.method ?? 'fifo'
  const needed = roundQty(quantity)

  if (needed <= 0) return { steps: [], totalCost: 0, shortfall: 0 }

  const open = fifoOrder(layers).filter((l) => l.remainingQty > 0)

  const average = averageUnitCost(open)
  const fixedCost =
    method === 'avco' ? average : method === 'standard' ? (options.standardCost ?? average) : null

  const steps: ConsumptionStep[] = []
  let taken = 0
  let totalCost = 0

  for (const layer of open) {
    if (taken >= needed) break

    const take = roundQty(Math.min(layer.remainingQty, needed - taken))
    if (take <= 0) continue

    const unitCost = fixedCost ?? layer.unitCost
    const amount = roundMoney(take * unitCost)

    steps.push({ layerId: layer.id, quantity: take, unitCost, amount, isEstimated: false })
    taken = roundQty(taken + take)
    totalCost += amount
  }

  const shortfall = roundQty(needed - taken)

  if (shortfall > 0) {
    // Priced from what we last paid rather than from nothing: costing an
    // uncovered sale at zero reports it as pure profit.
    const unitCost = fixedCost ?? options.fallbackUnitCost ?? lastKnownCost(open) ?? 0
    const amount = roundMoney(shortfall * unitCost)
    steps.push({ layerId: null, quantity: shortfall, unitCost, amount, isEstimated: true })
    totalCost += amount
  }

  return { steps, totalCost: roundMoney(totalCost), shortfall }
}

/** The most recent price paid, for costing what no layer covers. */
export function lastKnownCost(layers: CostLayer[]): number | null {
  const ordered = fifoOrder(layers)
  const last = ordered[ordered.length - 1]
  return last ? last.unitCost : null
}

/**
 * Whether an issue may go ahead at all.
 *
 * Separate from the plan on purpose: the policy question ("may this business
 * sell what it does not have") and the arithmetic question ("what would it
 * cost") are different questions with different owners.
 */
export function mayIssue(
  available: number,
  quantity: number,
  policy: NegativeStockPolicy,
): { allowed: boolean; reason?: 'INVENTORY_INSUFFICIENT_STOCK' } {
  if (quantity <= available) return { allowed: true }
  if (policy === 'allow') return { allowed: true }
  return { allowed: false, reason: 'INVENTORY_INSUFFICIENT_STOCK' }
}

/**
 * Gross profit for one line, from the cost that was actually consumed.
 *
 * Stated here so it has exactly one definition. Revenue − COGS, where COGS is
 * the layer cost and NOT the product's current buy price: a phone bought at
 * 10,000,000 and later restocked at 9,000,000 must still show a 2,000,000
 * profit on the first sale, not 3,000,000.
 */
export function grossProfit(revenue: number, consumedCost: number): number {
  return roundMoney(revenue - consumedCost)
}
