// ============================================
// packages/local-engine/src/routes/variants.ts
//
// Local Engine handlers for Product Variants (G-05 / Option 11)
// ============================================

import { ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface RowRecord {
  [key: string]: any
}

export function registerVariantsRoutes(router: Router) {
  router.get('/products/:id/variants', async (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const templateProductId = params.id
    const rows = db.all<RowRecord>(
      `SELECT * FROM product_variants
       WHERE workspace_id = ? AND template_product_id = ? AND is_active = 1 AND deleted_at IS NULL`,
      [ctx.workspaceId, templateProductId],
    )

    return {
      status: 200,
      data: rows.map((r: RowRecord) => ({
        id: r.id,
        templateProductId: r.template_product_id,
        sku: r.sku,
        barcode: r.barcode,
        attributes: JSON.parse(r.attributes || '[]'),
        priceOverrideMinor: r.price_override_minor,
        costOverrideMinor: r.cost_override_minor,
        isActive: Boolean(r.is_active),
      })),
    }
  })

  router.post('/products/:id/variants', async (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    const templateProductId = params.id
    const payload = body as any
    if (!payload?.sku) throw new ValidationError('sku is required')

    const id = payload.id || `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const now = new Date().toISOString()
    const attributes = JSON.stringify(payload.attributes || [])

    db.run(
      `INSERT INTO product_variants
       (id, workspace_id, template_product_id, sku, barcode, attributes, price_override_minor, cost_override_minor, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id,
        ctx.workspaceId,
        templateProductId,
        payload.sku,
        payload.barcode || null,
        attributes,
        payload.priceOverrideMinor ?? null,
        payload.costOverrideMinor ?? null,
        now,
        now,
      ],
    )

    return {
      status: 201,
      data: {
        id,
        templateProductId,
        sku: payload.sku,
        barcode: payload.barcode || null,
        attributes: payload.attributes || [],
        priceOverrideMinor: payload.priceOverrideMinor ?? null,
        costOverrideMinor: payload.costOverrideMinor ?? null,
        isActive: true,
      },
    }
  })
}
