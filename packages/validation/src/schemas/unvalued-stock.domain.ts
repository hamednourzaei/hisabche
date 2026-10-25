// ============================================
// packages/validation/src/schemas/unvalued-stock.domain.ts
//
// Stock that is on the shelf with no cost layer behind it.
//
// ⚠️ WHY THIS EXISTS (INV-000077, 11 Oct 2026). A cost layer was written by a
// purchase invoice and by nothing else. A product created with a quantity and a
// purchase price — the way most shops enter their first stock — had units and
// no layer, so every sale of it was booked with no cost of goods and read as
// pure profit. New opening stock now writes its layer; this file finds the
// stock that was entered before that, so a person can decide to value it.
//
// Nothing here guesses. A product with no purchase price is REPORTED as
// blocked, never valued at zero: a zero-cost layer would turn «unknown» into a
// confirmed 100% margin.
// ============================================

import { roundMoney, roundQty } from './costing.domain'

export interface StockPosition {
  productId: string
  name: string
  /** Units the product says it has. */
  quantity: number
  /** The purchase price on the product card; 0 or less means «not entered». */
  buyPrice: number
  /** Units still open in cost layers. */
  layeredQuantity: number
}

export interface UnvaluedRow {
  productId: string
  name: string
  /** Units with no layer behind them. */
  quantity: number
  /** The price they would be valued at; null when the product has none. */
  unitCost: number | null
  value: number | null
  status: 'ready' | 'no_buy_price'
}

export interface UnvaluedStock {
  rows: UnvaluedRow[]
  /** Can be valued now, at the product's own purchase price. */
  ready: { products: number; quantity: number; value: number }
  /** Cannot be valued: the product has no purchase price. */
  blocked: { products: number; quantity: number }
}

export function findUnvaluedStock(positions: readonly StockPosition[]): UnvaluedStock {
  const rows: UnvaluedRow[] = []
  for (const position of positions) {
    const gap = roundQty(position.quantity - position.layeredQuantity)
    if (gap <= 0) continue
    const priced = Number.isFinite(position.buyPrice) && position.buyPrice > 0
    rows.push({
      productId: position.productId,
      name: position.name,
      quantity: gap,
      unitCost: priced ? position.buyPrice : null,
      value: priced ? roundMoney(gap * position.buyPrice) : null,
      status: priced ? 'ready' : 'no_buy_price',
    })
  }
  rows.sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.name.localeCompare(b.name))

  const ready = rows.filter((row) => row.status === 'ready')
  const blocked = rows.filter((row) => row.status === 'no_buy_price')
  return {
    rows,
    ready: {
      products: ready.length,
      quantity: roundQty(ready.reduce((sum, row) => sum + row.quantity, 0)),
      value: roundMoney(ready.reduce((sum, row) => sum + (row.value ?? 0), 0)),
    },
    blocked: {
      products: blocked.length,
      quantity: roundQty(blocked.reduce((sum, row) => sum + row.quantity, 0)),
    },
  }
}

/**
 * How many units SOLD with no cost still have no layer to draw it from.
 *
 * Layers beyond what the shelf holds are units that already left: they cover the
 * sale as they are. A result <= 0 means the sale is covered.
 */
export function uncoveredSoldUnits(
  position: Pick<StockPosition, 'quantity' | 'layeredQuantity'>,
  soldQuantity: number,
): number {
  const surplus = Math.max(0, position.layeredQuantity - Math.max(0, position.quantity))
  return roundQty(soldQuantity - surplus)
}

/**
 * The ledger key of the cost a sale was given after it was posted, from the hex
 * SHA-256 of `late-cost:<invoiceId>` (each runtime hashes with its own library).
 *
 * A UUID (version 5 / RFC 4122 variant bits): `journal_entries.source_id` is a
 * uuid column and Postgres refuses a readable key. The same invoice always
 * yields the same key, which is what makes the entry idempotent.
 */
export function lateCostKeyFromDigest(hex: string): string {
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join('-')
}
