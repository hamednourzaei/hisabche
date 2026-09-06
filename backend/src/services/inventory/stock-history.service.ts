// ============================================
// backend/src/services/inventory/stock-history.service.ts
//
// H4 — how a product's on-hand figure got to be what it is.
//
// ---------------------------------------------------------------------------
// WHY THIS ENDPOINT HAD TO EXIST
//
// Phase C made `stock_movements` the SOURCE OF TRUTH for quantity:
// `products.quantity` is a projection maintained by trigger and «never written
// from application code». So when an on-hand number looks wrong — and it is
// the number a shopkeeper argues with most — the movements are the only place
// the answer lives.
//
// Nothing exposed them. `stock_movements` was read by exactly three services
// (a count before delete, an analytics aggregate, a transfer) and by no route
// at all. The one figure users most want explained had no explanation.
//
// ---------------------------------------------------------------------------
// ⚠️ TENANCY — SCOPED THROUGH THE PRODUCT, FIRST
//
// The product's workspace is established BEFORE the movements are read, and
// the read is filtered by workspace too. Two independent reasons:
//
//   1. A `product_id` from the request is not proof the caller may see it.
//   2. Without the ownership check first, the error that comes back differs
//      between «no such product» and «not yours» — an existence oracle over
//      other workspaces' ids. `product.service.delete` already carries this
//      exact note; the same rule applies to a read.
// ============================================

import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import type { TenancyContext } from '../tenancy.service'

export interface StockMovementRecord {
  id: string
  /** 'sale' | 'purchase' | 'production' | 'transfer' | 'adjustment' … */
  type: string
  /**
   * SIGNED. Negative is stock leaving.
   *
   * Not normalised to a magnitude with a separate direction flag: the sum of
   * this column IS the on-hand quantity, and a reader checking the running
   * balance by hand must see the same numbers the trigger added up.
   */
  quantity: number
  /** What caused it — 'invoice', 'purchase_order', 'work_order', or null. */
  referenceType: string | null
  referenceId: string | null
  notes: string | null
  fromWarehouseId: string | null
  toWarehouseId: string | null
  createdAt: string | null
  /** Running total after this movement, oldest first. */
  balance: number
}

export interface StockHistory {
  productId: string
  productName: string
  /** `SUM(quantity)` over every movement — what the projection should equal. */
  movementTotal: number
  /**
   * `products.quantity` as stored.
   *
   * Returned so the caller can SHOW a disagreement rather than pick a side.
   * Phase C says the projection is maintained by trigger, so a difference
   * means the trigger did not run — a fact worth surfacing, never worth
   * silently repairing (§13).
   */
  storedQuantity: number
  movements: StockMovementRecord[]
}

export class StockHistoryService {
  async get(ctx: TenancyContext, productId: string, limit = 200): Promise<StockHistory> {
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, quantity')
      .eq('id', productId)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()

    if (productError) throw new DatabaseError('Failed to load the product', productError)
    if (!product) throw new NotFoundError('Product')

    const { data, error } = await supabase
      .from('stock_movements')
      .select(
        'id, type, quantity, reference_type, reference_id, notes, from_warehouse_id, to_warehouse_id, created_at',
      )
      .eq('workspace_id', ctx.workspaceId)
      .eq('product_id', productId)
      // OLDEST FIRST, because the running balance is built forward. Reversing
      // it for display is the caller's business; computing it backwards here
      // would make every balance wrong by the whole history.
      .order('created_at', { ascending: true })
      .limit(Math.min(limit, 1000))

    if (error) throw new DatabaseError('Failed to load the stock history', error)

    let running = 0
    const movements: StockMovementRecord[] = (data ?? []).map((row: Record<string, any>) => {
      const quantity = Number(row.quantity) || 0
      running += quantity

      return {
        id: String(row.id),
        type: String(row.type ?? ''),
        quantity,
        referenceType: row.reference_type ?? null,
        referenceId: row.reference_id ?? null,
        notes: row.notes ?? null,
        fromWarehouseId: row.from_warehouse_id ?? null,
        toWarehouseId: row.to_warehouse_id ?? null,
        createdAt: row.created_at ?? null,
        balance: running,
      }
    })

    return {
      productId,
      productName: String(product.name ?? ''),
      // ⚠️ From the movements ACTUALLY RETURNED. When the limit truncates the
      // history this is a partial sum, and it will visibly disagree with
      // `storedQuantity` — which is the honest signal that the reader is not
      // seeing the whole story, rather than a total that quietly looks right.
      movementTotal: running,
      storedQuantity: Number(product.quantity) || 0,
      movements,
    }
  }
}
