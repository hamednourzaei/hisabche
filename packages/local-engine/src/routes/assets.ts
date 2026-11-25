// ============================================
// packages/local-engine/src/routes/assets.ts
//
// Offline fixed asset register draft & read cache backed by local SQLite.
// Binding depreciation journal posting remains on the server once synced.
// ============================================

import { requireCapability } from '../auth'
import { ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'
import { newId, nowIso } from './people-common'

export function registerAssetRoutes(router: Router): void {
  router.get('/local-ops/assets', (c: RouteHandlerContext) => {
    const rows = c.db.all(
      `SELECT * FROM local_assets WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY acquired_on DESC`,
      [c.ctx.workspaceId],
    )
    return { data: rows }
  })

  router.post('/local-ops/assets', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const raw = (c.body || {}) as Record<string, unknown>
    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    const costMinor = Number(raw.costMinor)
    const salvageMinor = raw.salvageMinor === undefined ? 0 : Number(raw.salvageMinor)
    const method = typeof raw.method === 'string' ? raw.method.trim() : ''
    const periods = Number(raw.periods)
    const periodMonths = raw.periodMonths === undefined ? 1 : Number(raw.periodMonths)
    const firstPeriodOn = typeof raw.firstPeriodOn === 'string' ? raw.firstPeriodOn.trim() : ''
    const acquiredOn = typeof raw.acquiredOn === 'string' ? raw.acquiredOn.trim() : ''
    const currency =
      typeof raw.currency === 'string' && raw.currency.trim()
        ? raw.currency.trim().toUpperCase()
        : c.ctx.baseCurrency

    if (
      !name ||
      !Number.isSafeInteger(costMinor) ||
      costMinor <= 0 ||
      !Number.isSafeInteger(salvageMinor) ||
      salvageMinor < 0 ||
      !['straight_line', 'declining', 'declining_then_straight'].includes(method) ||
      !Number.isSafeInteger(periods) ||
      periods < 1 ||
      firstPeriodOn.length < 8 ||
      acquiredOn.length < 8
    ) {
      throw new ValidationError('LOCAL_ASSET_INPUT_INVALID')
    }

    const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : newId()
    const now = nowIso()
    c.db.run(
      `INSERT INTO local_assets
       (id, workspace_id, name, cost_minor, salvage_minor, method, periods, period_months,
        first_period_on, acquired_on, currency, created_at, updated_at, origin, sync_state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
      [
        id,
        c.ctx.workspaceId,
        name,
        costMinor,
        salvageMinor,
        method,
        periods,
        periodMonths,
        firstPeriodOn,
        acquiredOn,
        currency,
        now,
        now,
      ],
    )
    return {
      __status: 201,
      __data: { data: c.db.get('SELECT * FROM local_assets WHERE id = ?', [id]) },
    }
  })
}
