// ============================================
// backend/src/services/invoices/stock-reversal.domain.ts
//
// What gives back the stock an invoice has moved (27 Sep 2026).
//
// Editing an invoice's lines first returns their stock. That used to be
// re-derived from `invoice_items` WITHOUT the line's unit, so a line of
// «2 cartons» (48 pieces) gave back 2 — every edit of a non-base-unit line
// leaked stock. The exact answer is in the movements already recorded against
// the invoice: whatever units made them, their net per product and warehouse
// is what the invoice took (or brought), and its negative gives it back.
//
// The SAME rule runs inside invoice_write_document (SQL); this copy serves the
// pre-migration path. stock_movements_project() adds a non-transfer
// movement's signed quantity to whichever warehouse it names, so the choice of
// from/to below only labels the direction — the net is what counts.
// ============================================

export interface MovementRow {
  product_id: string
  quantity: number | string
  from_warehouse_id: string | null
  to_warehouse_id: string | null
}

export interface ReversalMovement {
  product_id: string
  type: 'purchase' | 'sale'
  quantity: number
  from_warehouse_id: string | null
  to_warehouse_id: string | null
}

/** Round away float noise the way stock_movements.quantity (numeric) would. */
const round = (n: number) => Math.round(n * 1000) / 1000

export function netReversal(recorded: readonly MovementRow[]): ReversalMovement[] {
  const net = new Map<string, { productId: string; warehouseId: string | null; qty: number }>()
  for (const row of recorded) {
    const warehouseId = row.from_warehouse_id ?? row.to_warehouse_id ?? null
    const key = `${row.product_id}|${warehouseId ?? ''}`
    const entry = net.get(key) ?? { productId: row.product_id, warehouseId, qty: 0 }
    entry.qty = round(entry.qty + (Number(row.quantity) || 0))
    net.set(key, entry)
  }

  const out: ReversalMovement[] = []
  for (const { productId, warehouseId, qty } of net.values()) {
    if (qty === 0) continue
    out.push({
      product_id: productId,
      // A net outflow (a sale) comes back as an inflow, and the other way round.
      type: qty < 0 ? 'purchase' : 'sale',
      quantity: -qty,
      from_warehouse_id: qty > 0 ? warehouseId : null,
      to_warehouse_id: qty < 0 ? warehouseId : null,
    })
  }
  return out
}
