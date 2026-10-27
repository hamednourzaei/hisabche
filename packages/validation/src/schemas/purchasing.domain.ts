// ============================================
// packages/validation/src/schemas/purchasing.domain.ts
//
// The rules of a purchase order that do not depend on where it is stored: what
// a line is worth, what a unit cost when the goods arrive, and when an order may
// be received. The server's PurchasingService and the device both call these.
// ============================================

/** A line's value: the stated total, else quantity × unit price. */
export function orderLineTotal(item: {
  quantity: number
  unitPrice: number
  totalPrice?: number | null | undefined
}): number {
  return item.totalPrice ?? item.quantity * item.unitPrice
}

/**
 * What one unit cost when a purchase-order line arrived.
 *
 * ⚠️ WHAT WAS ACTUALLY PAID per unit (line total ÷ quantity), not the list
 * price: the list price would overstate the layer and every profit drawn from
 * it. `null` for a line that brought nothing.
 */
export function receiptUnitCost(item: {
  quantity: number | string
  unit_price: number | string
  total_price: number | string | null
}): number | null {
  const quantity = Number(item.quantity) || 0
  if (quantity <= 0) return null
  const lineTotal = Number(item.total_price) || quantity * (Number(item.unit_price) || 0)
  return lineTotal / quantity
}

/**
 * May an order in this status be received? An order is received ONCE: the second
 * receive of a double-click, a retry or a second device is refused, and so is a
 * cancelled one.
 */
export function receiveRefusal(
  status: string,
): 'PURCHASE_ORDER_ALREADY_RECEIVED' | 'PURCHASE_ORDER_CANCELLED' | null {
  if (status === 'received') return 'PURCHASE_ORDER_ALREADY_RECEIVED'
  if (status === 'cancelled') return 'PURCHASE_ORDER_CANCELLED'
  return null
}

// ─── Option 5: Three-Way Match ──────────────────────────────────────────────
export interface ThreeWayMatchLine {
  poQuantity: number
  poUnitPriceMinor: number
  receivedQuantity: number
  invoiceQuantity: number
  invoiceUnitPriceMinor: number
}

export type MatchVariance = 'none' | 'quantity_variance' | 'price_variance' | 'both_variance'

export interface ThreeWayMatchResult {
  variance: MatchVariance
  quantityVariance: number
  priceVarianceMinor: number
  passed: boolean
}

/**
 * Three-Way Match (Purchase Order vs Goods Receipt vs Supplier Invoice).
 * Pure domain logic: integer minor units, detects quantity and price variances.
 */
export function threeWayMatch(line: ThreeWayMatchLine, tolerancePercent = 0): ThreeWayMatchResult {
  const qtyDiff = line.invoiceQuantity - line.receivedQuantity
  const priceDiff = line.invoiceUnitPriceMinor - line.poUnitPriceMinor

  const hasQtyVariance = Math.abs(qtyDiff) > tolerancePercent
  const hasPriceVariance = Math.abs(priceDiff) > tolerancePercent

  let variance: MatchVariance = 'none'
  if (hasQtyVariance && hasPriceVariance) variance = 'both_variance'
  else if (hasQtyVariance) variance = 'quantity_variance'
  else if (hasPriceVariance) variance = 'price_variance'

  return {
    variance,
    quantityVariance: qtyDiff,
    priceVarianceMinor: priceDiff,
    passed: variance === 'none',
  }
}
