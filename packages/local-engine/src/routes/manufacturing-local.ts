// ============================================
// packages/local-engine/src/routes/manufacturing-local.ts
//
// Offline BOM & production recipe draft store backed by local SQLite.
// ============================================

import { requireCapability } from '../auth'
import { ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'
import { newId, nowIso } from './people-common'

export function registerManufacturingLocalRoutes(router: Router): void {
  router.get('/local-ops/manufacturing-defs', (c: RouteHandlerContext) => {
    const rows = c.db.all<{
      id: string
      product_id: string
      definition_json: string
      updated_at: string
    }>(
      `SELECT id, product_id, definition_json, updated_at FROM local_manufacturing_defs
       WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC`,
      [c.ctx.workspaceId],
    )
    return {
      data: rows.map((r) => ({
        id: r.id,
        productId: r.product_id,
        definition: JSON.parse(r.definition_json) as unknown,
        updatedAt: r.updated_at,
      })),
    }
  })

  router.post('/local-ops/manufacturing-defs', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const raw = (c.body || {}) as Record<string, unknown>
    const productId = typeof raw.productId === 'string' ? raw.productId.trim() : ''
    if (!productId || typeof raw.definition !== 'object' || raw.definition === null) {
      throw new ValidationError('LOCAL_MANUFACTURING_DEF_INVALID')
    }
    const now = nowIso()
    const json = JSON.stringify(raw.definition)
    const existing = c.db.get<{ id: string }>(
      `SELECT id FROM local_manufacturing_defs WHERE workspace_id = ? AND product_id = ?`,
      [c.ctx.workspaceId, productId],
    )
    const id = existing?.id ?? newId()
    if (existing) {
      c.db.run(
        `UPDATE local_manufacturing_defs SET definition_json = ?, updated_at = ?, sync_state = 'local_only' WHERE id = ?`,
        [json, now, id],
      )
    } else {
      c.db.run(
        `INSERT INTO local_manufacturing_defs (id, workspace_id, product_id, definition_json, created_at, updated_at, origin, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
        [id, c.ctx.workspaceId, productId, json, now, now],
      )
    }
    return {
      __status: 201,
      __data: { data: { id, productId, definition: raw.definition, updatedAt: now } },
    }
  })
}
