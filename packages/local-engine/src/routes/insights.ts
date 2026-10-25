// ============================================
// packages/local-engine/src/routes/insights.ts
//
// The dashboard's smart suggestions, offline: `GET /ai/insights`.
//
// ⚠️ NOT A SECOND SET OF RULES. The device reads its own products and sales and
// hands them to `buildInsights` from @hisabche/validation — the function the
// server's `AIService.getInsights` calls. The suggestions are written from the
// business's OWN data; nothing leaves the device.
// ============================================

import { buildInsights } from '@hisabche/validation'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function registerInsightRoutes(router: Router): void {
  router.get('/ai/insights', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const products = db.all<{
      name: string
      quantity: number
      min_stock_level: number
      buy_price: number
    }>(
      'SELECT name, quantity, min_stock_level, buy_price FROM product WHERE workspace_id = ? AND deleted_at IS NULL AND is_active = 1',
      [ctx.workspaceId],
    )
    const sales = db.all<{ total: number; paid_amount: number; currency: string }>(
      "SELECT total, paid_amount, currency FROM invoice WHERE workspace_id = ? AND type = 'sale' AND status <> 'cancelled' AND deleted_at IS NULL",
      [ctx.workspaceId],
    )
    const since = new Date(Date.now() - WEEK_MS).toISOString()
    const weekSales = db.all<{ total: number; currency: string }>(
      "SELECT total, currency FROM invoice WHERE workspace_id = ? AND type = 'sale' AND status <> 'cancelled' AND deleted_at IS NULL AND created_at >= ?",
      [ctx.workspaceId, since],
    )
    return buildInsights({
      products,
      sales,
      weekSales,
      booksCurrency: ctx.baseCurrency,
    })
  })
}
