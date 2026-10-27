// ============================================
// packages/local-engine/src/routes/metal-rates.ts
//
// Local Engine handlers for Metal Rates (Option 21 / Gold)
// ============================================

import { ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface RowRecord {
  [key: string]: any
}

export function registerMetalRatesRoutes(router: Router) {
  router.get('/metal-rates/latest', async (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const row = db.get<RowRecord>(
      `SELECT * FROM metal_rates
       WHERE workspace_id = ? AND deleted_at IS NULL
       ORDER BY rate_date DESC LIMIT 1`,
      [ctx.workspaceId],
    )

    if (!row) {
      return { status: 200, data: null }
    }

    return {
      status: 200,
      data: {
        id: row.id,
        rateDate: row.rate_date,
        rate24kMinorPerGram: row.rate_24k_minor_per_gram,
      },
    }
  })

  router.post('/metal-rates', async (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const payload = body as any
    if (!payload?.rateDate || payload?.rate24kMinorPerGram === undefined) {
      throw new ValidationError('rateDate and rate24kMinorPerGram are required')
    }

    const id = payload.id || `mr-${Date.now()}`
    const now = new Date().toISOString()

    db.run(
      `INSERT INTO metal_rates
       (id, workspace_id, rate_date, rate_24k_minor_per_gram, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, ctx.workspaceId, payload.rateDate, payload.rate24kMinorPerGram, now, now],
    )

    return {
      status: 201,
      data: {
        id,
        rateDate: payload.rateDate,
        rate24kMinorPerGram: payload.rate24kMinorPerGram,
      },
    }
  })
}
