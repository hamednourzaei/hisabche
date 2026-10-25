// ============================================
// packages/local-engine/src/routes/stock-insights.ts
//
// What to reorder and what is not moving, on the device.
//
// ⚠️ NOT A SECOND SET OF RULES. The device reads its own products and sale
// movements and hands them to `buildReorderSuggestions` / `buildDeadStock` from
// @hisabche/validation — the functions the server's ReorderService calls.
// Nothing is ordered; both are read models.
//
// A transfer on the device is immediate, so nothing is ever "in transit" here.
// ============================================

import { DEMAND_WINDOW_DAYS, buildDeadStock, buildReorderSuggestions } from '@hisabche/validation'
import type { LocalDb } from '../db'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

function activeProducts(db: LocalDb, workspaceId: string) {
  return db
    .all<{ id: string; name: string; quantity: number }>(
      `SELECT id, name, quantity FROM product
        WHERE workspace_id = ? AND deleted_at IS NULL AND is_active = 1 ORDER BY id`,
      [workspaceId],
    )
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      quantity: Number(row.quantity) || 0,
    }))
}

export function registerStockInsightRoutes(router: Router): void {
  // ─── GET /inventory/reorder-suggestions ─────────────────────
  router.get('/inventory/reorder-suggestions', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const since = new Date(Date.now() - DEMAND_WINDOW_DAYS * 86_400_000).toISOString()

    // ⚠️ type = 'sale' ONLY: summing every movement would count purchases and
    // transfers as demand, and a product restocked twice would look like a
    // bestseller and be reordered again.
    const sold = new Map<string, number>()
    for (const row of db.all<{ product_id: string; quantity: number }>(
      `SELECT product_id, quantity FROM inventory_movement
        WHERE workspace_id = ? AND type = 'sale' AND created_at >= ? AND deleted_at IS NULL`,
      [ctx.workspaceId, since],
    )) {
      sold.set(
        row.product_id,
        (sold.get(row.product_id) ?? 0) + Math.abs(Number(row.quantity) || 0),
      )
    }

    return buildReorderSuggestions({
      products: activeProducts(db, ctx.workspaceId),
      soldInWindow: sold,
      inTransit: new Map(),
    })
  })

  // ─── GET /inventory/dead-stock?days= ────────────────────────
  router.get('/inventory/dead-stock', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const parsed = Number(query.days)
    // Clamped: a negative or absurd window is a typo, and answering it with
    // «everything is dead» is worse than answering the default.
    const days = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 3650) : undefined

    const lastSold = new Map<string, string>()
    for (const row of db.all<{ product_id: string; last: string }>(
      `SELECT product_id, max(created_at) AS last FROM inventory_movement
        WHERE workspace_id = ? AND type = 'sale' AND deleted_at IS NULL GROUP BY product_id`,
      [ctx.workspaceId],
    )) {
      lastSold.set(row.product_id, row.last)
    }

    return buildDeadStock({
      products: activeProducts(db, ctx.workspaceId),
      lastSold,
      asOf: new Date(),
      ...(days === undefined ? {} : { days }),
    })
  })
}
