// ============================================
// backend/src/services/inventory-costing/transfer.domain.ts
//
// A3 · Stock between two warehouses, and what to reorder.
//
// ---------------------------------------------------------------------------
// GOODS IN A TRUCK BELONG TO NEITHER WAREHOUSE AND STILL BELONG TO YOU
//
// The existing `warehouse_transfer_stock` moves quantity out of one warehouse
// and into another in one step. That is correct when the two are rooms in the
// same building. It is wrong the moment a transfer takes a day: for that day
// the goods are counted in Herat, physically in a truck outside Kabul, and any
// count of either warehouse disagrees with the system.
//
// So a transfer has three states, and the middle one is a real place:
//
//   dispatched   left the source, not yet arrived   → in transit
//   received     arrived at the destination
//   cancelled    never left, or came back
//
// ⚠️ Total stock NEVER changes across any of this. A transfer moves goods; it
// does not create or destroy them, and it must not touch the ledger. Stock in
// transit is still an asset at the same cost — treating a dispatch as a
// disposal and a receipt as a purchase would book a loss and a profit on
// moving your own goods across town.
// ============================================

import { roundQty } from './costing.domain'

export type TransferState = 'dispatched' | 'received' | 'cancelled'

export interface TransferLine {
  productId: string
  quantity: number
}

export interface Transfer {
  id: string
  fromWarehouseId: string
  toWarehouseId: string
  state: TransferState
  lines: TransferLine[]
}

export type TransferRefusal =
  'SAME_WAREHOUSE' | 'NO_LINES' | 'NON_POSITIVE_QUANTITY' | 'INSUFFICIENT_STOCK' | 'ALREADY_SETTLED'

export function validateDispatch(
  input: { fromWarehouseId: string; toWarehouseId: string; lines: readonly TransferLine[] },
  availableByProduct: ReadonlyMap<string, number>,
  negativeStockPolicy: 'block' | 'allow',
): { ok: true } | { ok: false; reason: TransferRefusal; productId?: string } {
  // Moving stock to where it already is is not a transfer; it is a typo that
  // would leave a permanent record of goods travelling nowhere.
  if (input.fromWarehouseId === input.toWarehouseId) return { ok: false, reason: 'SAME_WAREHOUSE' }
  if (input.lines.length === 0) return { ok: false, reason: 'NO_LINES' }

  for (const line of input.lines) {
    if (!(line.quantity > 0)) {
      return { ok: false, reason: 'NON_POSITIVE_QUANTITY', productId: line.productId }
    }

    if (negativeStockPolicy === 'block') {
      const available = availableByProduct.get(line.productId) ?? 0
      if (roundQty(line.quantity) > roundQty(available)) {
        return { ok: false, reason: 'INSUFFICIENT_STOCK', productId: line.productId }
      }
    }
  }

  return { ok: true }
}

/**
 * What a state change is allowed to be.
 *
 * A transfer that has already been received or cancelled is finished. Letting
 * it be received twice would double the destination's stock — and the second
 * receipt would look exactly like the first in the log.
 */
export function canSettle(current: TransferState): boolean {
  return current === 'dispatched'
}

export interface StockEffect {
  warehouseId: string
  productId: string
  /** Negative leaves, positive arrives. */
  delta: number
}

/**
 * What a dispatch does to warehouse stock.
 *
 * ⚠️ Only the SOURCE moves. The destination gets nothing until the goods
 * arrive — that gap is the whole point, and closing it early is the bug this
 * module exists to prevent.
 */
export function dispatchEffects(transfer: Transfer): StockEffect[] {
  return transfer.lines.map((line) => ({
    warehouseId: transfer.fromWarehouseId,
    productId: line.productId,
    delta: -roundQty(line.quantity),
  }))
}

/** What a receipt does. The mirror image, at the other end. */
export function receiveEffects(transfer: Transfer): StockEffect[] {
  return transfer.lines.map((line) => ({
    warehouseId: transfer.toWarehouseId,
    productId: line.productId,
    delta: roundQty(line.quantity),
  }))
}

/**
 * A cancelled transfer returns the goods to where they started.
 *
 * Not a receipt at the source — an explicit reversal, so the log reads
 * "dispatched, cancelled, returned" rather than implying the goods completed a
 * journey they never made.
 */
export function cancelEffects(transfer: Transfer): StockEffect[] {
  return transfer.lines.map((line) => ({
    warehouseId: transfer.fromWarehouseId,
    productId: line.productId,
    delta: roundQty(line.quantity),
  }))
}

/** Stock currently in a truck, by product. */
export function inTransitTotals(transfers: readonly Transfer[]): Map<string, number> {
  const totals = new Map<string, number>()

  for (const transfer of transfers) {
    if (transfer.state !== 'dispatched') continue
    for (const line of transfer.lines) {
      totals.set(line.productId, roundQty((totals.get(line.productId) ?? 0) + line.quantity))
    }
  }

  return totals
}

/* ─── What to reorder ─────────────────────────────────────────────────────── */

export interface ReorderInput {
  productId: string
  name: string
  onHand: number
  /** From `products.min_stock_level`, which already exists. */
  reorderLevel: number
  /** Already on a purchase order and not yet received. */
  onOrder: number
  /** In a truck between two of your own warehouses. */
  inTransit: number
}

export interface ReorderSuggestion {
  productId: string
  name: string
  /** onHand + onOrder + inTransit. What will exist without further action. */
  projected: number
  reorderLevel: number
  /** How many to buy to reach the level. Always positive. */
  suggestedQty: number
  urgency: 'out_of_stock' | 'below_level' | 'at_risk'
}

/**
 * What genuinely needs buying.
 *
 * ⚠️ The comparison is against PROJECTED stock, not on-hand.
 *
 * A product with none on the shelf and two hundred arriving tomorrow does not
 * need reordering, and suggesting it is how a shop ends up with four hundred.
 * Goods in transit count for the same reason: they are yours and they are
 * coming.
 *
 * Sorted worst first, because the list is read from the top and the shop that
 * has run out entirely is the one losing sales today.
 */
export function suggestReorders(items: readonly ReorderInput[]): ReorderSuggestion[] {
  const suggestions: ReorderSuggestion[] = []

  for (const item of items) {
    // A product with no reorder level has not been given one, which is not the
    // same as having a level of zero. Suggesting for it would flood the list
    // with every item somebody never configured.
    if (!(item.reorderLevel > 0)) continue

    const projected = roundQty(item.onHand + item.onOrder + item.inTransit)
    if (projected >= item.reorderLevel) continue

    suggestions.push({
      productId: item.productId,
      name: item.name,
      projected,
      reorderLevel: item.reorderLevel,
      suggestedQty: roundQty(item.reorderLevel - projected),
      urgency:
        item.onHand <= 0
          ? 'out_of_stock'
          : projected <= item.reorderLevel / 2
            ? 'below_level'
            : 'at_risk',
    })
  }

  const RANK: Record<ReorderSuggestion['urgency'], number> = {
    out_of_stock: 0,
    below_level: 1,
    at_risk: 2,
  }

  return suggestions.sort((left, right) => {
    const byUrgency = RANK[left.urgency] - RANK[right.urgency]
    return byUrgency !== 0 ? byUrgency : right.suggestedQty - left.suggestedQty
  })
}
