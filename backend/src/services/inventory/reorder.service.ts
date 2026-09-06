// ============================================
// backend/src/services/inventory/reorder.service.ts
//
// L3 + L4 — what to reorder, and what is not moving.
//
// Both are READ MODELS. Neither writes anything, and L3 explicitly creates no
// purchase order: «Read Model / Suggestion only, no automatic PO».
// ============================================

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import type { TenancyContext } from '../tenancy.service'

import {
  DEAD_STOCK_DEFAULT_DAYS,
  DEMAND_WINDOW_DAYS,
  availablePosition,
  findDeadStock,
  reorderPointFor,
  suggestedOrderQuantity,
  type DeadStockLine,
} from './reorder.domain'

export interface ReorderLine {
  productId: string
  name: string
  onHand: number
  inTransit: number
  onOrder: number
  availablePosition: number
  avgDailySales: number
  leadTimeDays: number
  safetyStock: number
  reorderPoint: number
  suggestedQty: number
}

export class ReorderService {
  /**
   * L3 — the reorder suggestion, computed from what actually sold.
   *
   * ⚠️ SUGGESTION ONLY. Nothing is ordered. The spec forbids an automatic
   * purchase order, and `/purchasing` has no create form anyway (open gap 11),
   * so this returns a list a person acts on.
   */
  async suggestions(ctx: TenancyContext): Promise<ReorderLine[]> {
    const since = new Date(Date.now() - DEMAND_WINDOW_DAYS * 86_400_000).toISOString()

    const [products, sales, inTransit] = await Promise.all([
      this.products(ctx),
      this.soldSince(ctx, since),
      this.inTransit(ctx),
    ])

    const lines: ReorderLine[] = []

    for (const product of products) {
      const point = reorderPointFor({
        productId: product.id,
        unitsSoldInWindow: sales.get(product.id) ?? 0,
        windowDays: DEMAND_WINDOW_DAYS,
        // No lead time exists anywhere in the schema — the domain's default of
        // 7 applies. Deliberately not a setting (G4).
      })

      const position = availablePosition({
        onHand: product.quantity,
        inTransit: inTransit.get(product.id) ?? 0,
        // ⚠️ ALWAYS 0 — see below.
        onOrder: 0,
      })

      const suggestedQty = suggestedOrderQuantity(position, point.reorderPoint)
      if (suggestedQty <= 0) continue

      lines.push({
        productId: product.id,
        name: product.name,
        onHand: product.quantity,
        inTransit: inTransit.get(product.id) ?? 0,
        onOrder: 0,
        availablePosition: position,
        avgDailySales: point.avgDailySales,
        leadTimeDays: point.leadTimeDays,
        safetyStock: point.safetyStock,
        reorderPoint: point.reorderPoint,
        suggestedQty,
      })
    }

    // Largest shortfall first — the list is read from the top.
    return lines.sort((a, b) => b.suggestedQty - a.suggestedQty)
  }

  /**
   * L4 — stock that has not sold in `days`.
   *
   * `days` is a QUERY PARAMETER, not a setting. A greengrocer and a machine-
   * parts dealer mean entirely different things by «dead», and neither has
   * told the product which it is.
   */
  async deadStock(
    ctx: TenancyContext,
    days: number = DEAD_STOCK_DEFAULT_DAYS,
  ): Promise<DeadStockLine[]> {
    const products = await this.products(ctx)
    const lastSold = await this.lastSaleByProduct(ctx)

    return findDeadStock(
      products.map((product) => ({
        productId: product.id,
        onHand: product.quantity,
        lastSoldAt: lastSold.get(product.id) ?? null,
      })),
      new Date(),
      days,
    )
  }

  private async products(ctx: TenancyContext) {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, quantity')
      .eq('workspace_id', ctx.workspaceId)
      .eq('is_active', true)
      .limit(5000)

    if (error) throw new DatabaseError('Failed to read products', error)
    return (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      quantity: Number(row.quantity) || 0,
    }))
  }

  /**
   * Units SOLD per product in the window.
   *
   * ⚠️ `type = 'sale'` ONLY. Summing every movement would count purchases,
   * transfers and adjustments as demand — a product restocked twice would look
   * like a bestseller and be reordered again.
   *
   * Sale movements are negative, so the magnitude is the demand.
   */
  private async soldSince(ctx: TenancyContext, since: string): Promise<Map<string, number>> {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('product_id, quantity')
      .eq('workspace_id', ctx.workspaceId)
      .eq('type', 'sale')
      .gte('created_at', since)
      .limit(20000)

    if (error) throw new DatabaseError('Failed to read sales history', error)

    const byProduct = new Map<string, number>()
    for (const row of data ?? []) {
      const id = String(row.product_id)
      byProduct.set(id, (byProduct.get(id) ?? 0) + Math.abs(Number(row.quantity) || 0))
    }
    return byProduct
  }

  /** The most recent SALE per product, for L4. */
  private async lastSaleByProduct(ctx: TenancyContext): Promise<Map<string, string>> {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('product_id, created_at')
      .eq('workspace_id', ctx.workspaceId)
      .eq('type', 'sale')
      .order('created_at', { ascending: false })
      .limit(20000)

    if (error) throw new DatabaseError('Failed to read sales history', error)

    const latest = new Map<string, string>()
    // Ordered newest first, so the FIRST time a product is seen is its latest
    // sale — no comparison needed.
    for (const row of data ?? []) {
      const id = String(row.product_id)
      if (!latest.has(id)) latest.set(id, String(row.created_at))
    }
    return latest
  }

  /**
   * K3's derived in-transit, per product.
   *
   * Empty when phase-k-01 has not run — no transfers can exist, so nothing is
   * in transit, and an empty map is the correct answer rather than an error.
   */
  private async inTransit(ctx: TenancyContext): Promise<Map<string, number>> {
    const { data, error } = await supabase
      .from('stock_in_transit')
      .select('product_id, quantity_in_transit')
      .eq('workspace_id', ctx.workspaceId)
      .limit(5000)

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') return new Map()
      throw new DatabaseError('Failed to read goods in transit', error)
    }

    const byProduct = new Map<string, number>()
    for (const row of data ?? []) {
      const id = String(row.product_id)
      byProduct.set(id, (byProduct.get(id) ?? 0) + (Number(row.quantity_in_transit) || 0))
    }
    return byProduct
  }
}

// ⚠️ `onOrder` IS HARDCODED TO 0 THROUGHOUT, AND THAT IS DOCUMENTED.
//
// The spec: «if `open_purchase_order_quantity` has no concept in the system,
// take it as 0 and explain in a comment — do not build a fake model».
//
// `purchase_orders` exists and has a status, but `purchase_order_items` is not
// reachable as an OPEN quantity: nothing tracks how much of a line is still
// outstanding, and `received_at` is a single timestamp on the header rather
// than a per-line receipt. Deriving «still on order» from that would be a
// guess that gets worse with every partial delivery.
//
// The effect is CONSERVATIVE in the right direction: without on-order, the
// suggestion over-orders rather than under-orders. That is visible to the user
// (they can see their own open POs) rather than silent.
