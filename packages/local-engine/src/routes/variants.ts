// ============================================
// packages/local-engine/src/routes/variants.ts
//
// Local Engine handlers for Product Variants (G-05 / Option 11)
// ============================================

import { requireCapability } from '../auth'
import { ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'
import { checkVariantBinding, type VariantBindingRow } from '@hisabche/validation'
import type { LocalDb } from '../db'
import { bodyOf } from './people-common'

interface RowRecord {
  [key: string]: unknown
}

/**
 * Every line that names a product is bound to a valid variant, or to none when the product has none —
 * the SAME rule the server keeps for an invoice or purchase line
 * (`InvoiceService.assertVariantBindings` / `PurchasingService.assertPurchaseVariantBindings`),
 * enforced offline from the device's own `product_variants` copy (V55 P2).
 */
export function assertLocalVariantBindings(
  db: LocalDb,
  workspaceId: string,
  lines: Array<{ productId?: string | null | undefined; variantId?: string | null | undefined }>,
): void {
  const productIds = [...new Set(lines.map((l) => l.productId).filter((id): id is string => !!id))]
  if (productIds.length === 0) return

  const placeholders = productIds.map(() => '?').join(',')
  const rows = db.all<{
    id: string
    workspace_id: string
    template_product_id: string
    is_active: number
  }>(
    `SELECT id, workspace_id, template_product_id, is_active
       FROM product_variants
      WHERE workspace_id = ? AND template_product_id IN (${placeholders}) AND deleted_at IS NULL`,
    [workspaceId, ...productIds],
  )
  const bindingRows: VariantBindingRow[] = rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    templateProductId: r.template_product_id,
    isActive: Number(r.is_active) !== 0,
  }))

  for (const line of lines) {
    if (!line.productId) {
      if (line.variantId) throw new ValidationError('VARIANT_ON_PRODUCT_WITHOUT_VARIANTS')
      continue
    }
    const verdict = checkVariantBinding({
      workspaceId,
      productId: line.productId,
      variantId: line.variantId,
      variantsOfProduct: bindingRows.filter((r) => r.templateProductId === line.productId),
    })
    if (!verdict.ok) throw new ValidationError(verdict.code)
  }
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

    // The engine wraps plain returns ({status: 201 for POST}); a handler that
    // returns `{status, data}` ITSELF had that wrapper as the payload, so a
    // variant list reached the caller shaped wrong (V55 P2).
    return rows.map((r: RowRecord) => ({
      id: r.id,
      templateProductId: r.template_product_id,
      sku: r.sku,
      barcode: r.barcode,
      attributes: JSON.parse(String(r.attributes || '[]')),
      priceOverrideMinor: r.price_override_minor,
      costOverrideMinor: r.cost_override_minor,
      isActive: Boolean(r.is_active),
    }))
  })

  router.post('/products/:id/variants', async (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'product.write')
    const { db, ctx, params, body } = c
    const templateProductId = params.id
    const payload = bodyOf(body)
    if (!payload?.sku) throw new ValidationError('sku is required')

    // V55 P2: the id MUST be a uuid. An invoice line's `variantId` is a uuid
    // field (invoice.schema.ts) — the old `v-<timestamp>` id could be created
    // offline but never sold, refused by the schema on every later sale.
    const id =
      payload.id ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch: string) => {
            const r = (Math.random() * 16) | 0
            const v = ch === 'x' ? r : (r & 0x3) | 0x8
            return v.toString(16)
          }))
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

    // The engine gives a POST 201; `{status, data}` would BE the payload.
    return {
      id,
      templateProductId,
      sku: payload.sku,
      barcode: payload.barcode || null,
      attributes: payload.attributes || [],
      priceOverrideMinor: payload.priceOverrideMinor ?? null,
      costOverrideMinor: payload.costOverrideMinor ?? null,
      isActive: true,
    }
  })
}
