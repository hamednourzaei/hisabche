// ============================================
// backend/src/services/inventory-costing/repost.domain.ts
//
// Backdated stock, landed cost, and reordering — the three things that make a
// cost layer wrong after it was already right.
//
// ---------------------------------------------------------------------------
// WHY A BACKDATED RECEIPT IS NOT A SMALL PROBLEM
//
// FIFO consumes in date order. A receipt entered today but dated last month
// belongs BEFORE sales that have already been costed and posted — so those
// sales drew from the wrong layers, their cost of goods sold is wrong, and the
// journal entries behind them are wrong.
//
// The tempting fix is to leave history alone and let the new layer apply
// going forward. That produces a ledger where the same physical goods were
// costed two ways, and a stock valuation that cannot be reconciled to the
// stock account.
//
// So: recompute forward from the disturbance, and emit the DIFFERENCE per
// affected document as an adjustment. Never rewrite a posted journal entry —
// the correction is its own entry, with its own date, pointing at what it
// corrects.
// ============================================

import { planConsumption, roundMoney, type CostLayer } from './costing.domain'

export interface CostedIssue {
  /** The document that consumed stock. */
  consumerType: string
  consumerId: string
  consumerLine: string
  productId: string
  quantity: number
  entryDate: string
  /** What it was recorded as costing at the time. */
  recordedCostMinor: number
}

export interface RepostAdjustment {
  consumerType: string
  consumerId: string
  consumerLine: string
  productId: string
  entryDate: string
  recordedCostMinor: number
  recomputedCostMinor: number
  /** recomputed − recorded. Positive means COGS was understated. */
  differenceMinor: number
}

export interface RepostPlan {
  /** The date from which everything had to be recomputed. */
  fromDate: string
  /** Issues that changed. Documents whose cost is unaffected are omitted. */
  adjustments: RepostAdjustment[]
  /** Minor units. The net effect on cost of goods sold. */
  netAdjustmentMinor: number
  /** How many documents were examined, so the scope is stated. */
  examined: number
}

/**
 * What a backdated receipt does to everything costed after it.
 *
 * Replays the issues in date order against the layers as they NOW stand, and
 * reports where the answer differs from what was recorded. It changes nothing
 * — the caller decides whether to post the adjustments, and a locked period
 * may refuse them.
 *
 * Issues are replayed in `entryDate` order with the line id as a tiebreak, so
 * a repost run twice produces identical adjustments.
 */
export function planRepost(
  layers: CostLayer[],
  issues: CostedIssue[],
  fromDate: string,
  options: { method?: 'fifo' | 'avco' | 'standard' } = {},
): RepostPlan {
  const affected = issues
    .filter((issue) => issue.entryDate >= fromDate.slice(0, 10))
    .sort((a, b) =>
      a.entryDate === b.entryDate
        ? a.consumerLine < b.consumerLine
          ? -1
          : 1
        : a.entryDate < b.entryDate
          ? -1
          : 1,
    )

  // A working copy: replaying must not mutate the caller's layers.
  const working = new Map<string, CostLayer[]>()
  for (const layer of layers) {
    working.set(layer.productId, [...(working.get(layer.productId) ?? []), { ...layer }])
  }

  const adjustments: RepostAdjustment[] = []

  for (const issue of affected) {
    const productLayers = working.get(issue.productId) ?? []

    const plan = planConsumption(productLayers, issue.quantity, {
      ...(options.method ? { method: options.method } : {}),
    })

    // Spend the layers so the NEXT issue sees what this one left behind. A
    // replay that does not consume gives every document the same first layer.
    for (const step of plan.steps) {
      if (!step.layerId) continue
      const layer = productLayers.find((candidate) => candidate.id === step.layerId)
      if (layer) layer.remainingQty = roundMoney(layer.remainingQty - step.quantity)
    }

    const recomputedCostMinor = Math.round(plan.totalCost * 100)
    const differenceMinor = recomputedCostMinor - issue.recordedCostMinor

    if (differenceMinor !== 0) {
      adjustments.push({
        consumerType: issue.consumerType,
        consumerId: issue.consumerId,
        consumerLine: issue.consumerLine,
        productId: issue.productId,
        entryDate: issue.entryDate,
        recordedCostMinor: issue.recordedCostMinor,
        recomputedCostMinor,
        differenceMinor,
      })
    }
  }

  return {
    fromDate: fromDate.slice(0, 10),
    adjustments,
    netAdjustmentMinor: adjustments.reduce((sum, row) => sum + row.differenceMinor, 0),
    examined: affected.length,
  }
}

// ─── Landed cost ─────────────────────────────────────────────────────────────

export type AllocationBasis =
  /** By what each line cost. The default: freight tracks value reasonably. */
  | 'value'
  /** By units. Right when the charge is per-item, like a customs stamp. */
  | 'quantity'
  /** By weight. Right for actual freight, when weights are known. */
  | 'weight'

export interface LandedCostLine {
  /** The receipt line this applies to. */
  layerId: string
  quantityMinor: number
  valueMinor: number
  weightGrams?: number
}

export interface LandedCostAllocation {
  layerId: string
  /** Minor units added to this layer's total cost. */
  allocatedMinor: number
  /** The layer's new unit cost, in minor units. */
  newUnitCostMinor: number
}

/**
 * Spread a shipment charge across the goods it brought in.
 *
 * Customs, freight and handling are part of what the goods cost. Expensing
 * them instead understates inventory and overstates this month's expenses,
 * then overstates profit on every sale of those goods for the rest of their
 * life.
 *
 * The REMAINDER is given to the largest line rather than dropped, so the
 * allocated total equals the charge exactly.
 */
export function allocateLandedCost(
  chargeMinor: number,
  lines: LandedCostLine[],
  basis: AllocationBasis = 'value',
): LandedCostAllocation[] {
  if (lines.length === 0 || chargeMinor === 0) return []

  const weightOf = (line: LandedCostLine): number => {
    if (basis === 'quantity') return line.quantityMinor
    if (basis === 'weight') return line.weightGrams ?? 0
    return line.valueMinor
  }

  const total = lines.reduce((sum, line) => sum + weightOf(line), 0)

  // Every line weighs zero on the chosen basis — no weights recorded, say.
  // Falling back to an equal split is better than allocating nothing, and
  // better than dividing by zero.
  const useEqualSplit = total <= 0

  const allocations = lines.map((line) => {
    const share = useEqualSplit ? 1 / lines.length : weightOf(line) / total
    return {
      layerId: line.layerId,
      allocatedMinor: Math.round(chargeMinor * share),
      newUnitCostMinor: 0,
    }
  })

  // The rounding remainder goes to the largest line, where one minor unit is
  // least surprising — and so the allocation sums to the charge exactly.
  const allocated = allocations.reduce((sum, row) => sum + row.allocatedMinor, 0)
  const remainder = chargeMinor - allocated

  if (remainder !== 0) {
    const largest = allocations.reduce((a, b) => (b.allocatedMinor > a.allocatedMinor ? b : a))
    largest.allocatedMinor += remainder
  }

  const byId = new Map(lines.map((line) => [line.layerId, line]))

  return allocations.map((row) => {
    const line = byId.get(row.layerId)!
    const units = line.quantityMinor
    return {
      ...row,
      newUnitCostMinor: units > 0 ? Math.round((line.valueMinor + row.allocatedMinor) / units) : 0,
    }
  })
}

// ─── Reordering ──────────────────────────────────────────────────────────────

export interface ReorderInput {
  productId: string
  productName: string
  onHand: number
  /** Already ordered and not yet received. Prevents ordering twice. */
  onOrder: number
  reorderLevel: number
  reorderQuantity: number
  /** Average units sold per day, over the observed window. */
  dailyDemand?: number
  /** Days between placing an order and receiving it. */
  leadTimeDays?: number
}

export interface ReorderSuggestion {
  productId: string
  productName: string
  onHand: number
  onOrder: number
  /** onHand + onOrder. What the shop can actually count on. */
  availableQty: number
  suggestedQty: number
  /** Days of cover left at current demand. Null when demand is unknown. */
  daysOfCover: number | null
  urgency: 'critical' | 'soon' | 'planned'
}

/**
 * What to reorder, and how urgently.
 *
 * `onOrder` is subtracted before anything else. Ignoring it is the classic
 * reorder bug: the report fires every day until the goods physically arrive,
 * and a shop that trusts it ends up with four deliveries of the same item.
 *
 * Urgency comes from DAYS OF COVER, not from how far below the level the stock
 * is. Being 10 units below the level means nothing on its own — ten units is a
 * week for one product and an hour for another.
 */
export function suggestReorders(items: ReorderInput[], asOfDays = 0): ReorderSuggestion[] {
  return (
    items
      .map((item) => {
        const availableQty = item.onHand + item.onOrder
        const daysOfCover =
          item.dailyDemand && item.dailyDemand > 0 ? availableQty / item.dailyDemand : null

        const leadTime = item.leadTimeDays ?? 0

        const urgency: ReorderSuggestion['urgency'] =
          daysOfCover === null
            ? availableQty <= 0
              ? 'critical'
              : 'planned'
            : daysOfCover <= leadTime
              ? // The goods will run out before a replacement could arrive.
                'critical'
              : daysOfCover <= leadTime * 2
                ? 'soon'
                : 'planned'

        return {
          productId: item.productId,
          productName: item.productName,
          onHand: item.onHand,
          onOrder: item.onOrder,
          availableQty,
          suggestedQty: item.reorderQuantity,
          daysOfCover: daysOfCover === null ? null : Math.round(daysOfCover * 10) / 10,
          urgency,
        }
      })
      // Only what is actually at or below the level, counting what is on order.
      .filter((row, index) => row.availableQty <= items[index]!.reorderLevel)
      .sort((a, b) => {
        const rank = { critical: 0, soon: 1, planned: 2 }
        if (rank[a.urgency] !== rank[b.urgency]) return rank[a.urgency] - rank[b.urgency]
        return (a.daysOfCover ?? 1e9) - (b.daysOfCover ?? 1e9)
      })
  )
}
