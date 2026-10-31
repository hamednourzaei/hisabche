// ============================================
// packages/local-engine/src/routes/pricing.ts
//
// Price lists (#19) and promotions (#114–#117) on the device.
//
// NO RULE LIVES HERE. The shape of a saved list/promotion, the detail, the
// hundredths conversion and the retire-not-delete change set of `setItems` are
// @hisabche/validation (price-list-view) — what the server's `PriceListService`
// and `PromotionService` call. This file reads SQLite rows into them.
//
// ⚠️ A LIST, A PRICE AND A PROMOTION ARE RETIRED, NEVER DELETED.
// ⚠️ IDS IN A SCOPE ARE CHECKED AGAINST THE WORKSPACE.
// ============================================

import {
  buildCustomerPriceList,
  buildPriceListDetail,
  planPriceListChanges,
  priceListInputSchema,
  priceListItemsSchema,
  promotionColumns,
  promotionInputSchema,
  toSavedPriceList,
  toSavedPromotion,
  type PriceListItemRow,
  type PriceListRow,
  type PromotionRow,
} from '@hisabche/validation'
import { z } from 'zod'
import type { LocalDb } from '../db'
import { NotFoundError, ValidationError } from '../errors'
import { requireCapability } from '../auth'
import type { Router } from '../router'
import type { LocalContext, RouteHandlerContext } from '../types'
import { derivedId } from './derived-id'

const LIST_COLUMNS = 'id, name, currency, valid_from, valid_to, is_active, created_at'
const PROMOTION_COLUMNS =
  'id, name, kind, value, currency, stacking, product_ids, customer_ids, valid_from, valid_to, is_active, created_at'

function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, raw: unknown): T {
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new ValidationError(result.error.errors[0]?.message ?? 'Validation failed')
  }
  return result.data
}

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : derivedId('local', 'id', String(Date.now()), String(Math.random()))

function listRow(db: LocalDb, ctx: LocalContext, id: string): PriceListRow {
  const row = db.get<PriceListRow>(
    `SELECT ${LIST_COLUMNS} FROM price_list WHERE workspace_id = ? AND id = ?`,
    [ctx.workspaceId, id],
  )
  if (!row) throw new NotFoundError('Price list')
  return row
}

/** Live prices of one list, or (`null`) of every list of the workspace. */
function activeItems(db: LocalDb, ctx: LocalContext, listId: string | null): PriceListItemRow[] {
  return db.all<PriceListItemRow>(
    `SELECT price_list_id, product_id, unit_price_minor, is_active FROM price_list_item
     WHERE workspace_id = ? AND is_active = 1 ${listId ? 'AND price_list_id = ?' : ''}
     ORDER BY price_list_id ASC, product_id ASC`,
    listId ? [ctx.workspaceId, listId] : [ctx.workspaceId],
  )
}

function customersOn(db: LocalDb, ctx: LocalContext, listId: string | null) {
  return db.all<{ id: string; full_name: string; price_list_id: string | null }>(
    `SELECT id, full_name, price_list_id FROM customer
     WHERE workspace_id = ? AND deleted_at IS NULL AND ${
       listId ? 'price_list_id = ?' : 'price_list_id IS NOT NULL'
     } ORDER BY id ASC`,
    listId ? [ctx.workspaceId, listId] : [ctx.workspaceId],
  )
}

function detailOf(db: LocalDb, ctx: LocalContext, id: string) {
  const list = listRow(db, ctx, id)
  const items = activeItems(db, ctx, id)
  const products = new Map<string, { name: string; unit: string | null; sell_price: unknown }>()
  for (const item of items) {
    const product = db.get<{ id: string; name: string; unit: string | null; sell_price: number }>(
      'SELECT id, name, unit, sell_price FROM product WHERE workspace_id = ? AND id = ?',
      [ctx.workspaceId, item.product_id],
    )
    if (product) {
      products.set(product.id, {
        name: String(product.name ?? ''),
        unit: product.unit ?? null,
        sell_price: product.sell_price,
      })
    }
  }
  return buildPriceListDetail({ list, items, products, customers: customersOn(db, ctx, id) })
}

/** Every product and customer a promotion names must belong to this workspace. */
function assertOwned(
  db: LocalDb,
  ctx: LocalContext,
  table: 'product' | 'customer',
  ids: readonly string[] | null,
  code: string,
) {
  if (!ids) return
  const unique = [...new Set(ids)]
  if (unique.length === 0) return
  const found =
    db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${table} WHERE workspace_id = ? AND id IN (${unique
        .map(() => '?')
        .join(', ')})`,
      [ctx.workspaceId, ...unique],
    )?.n ?? 0
  if (found !== unique.length) throw new ValidationError(code)
}

export function registerPricingRoutes(router: Router): void {
  // ─── Price lists ───────────────────────────────────────────
  router.get('/price-lists', ({ db, ctx }: RouteHandlerContext) => {
    const lists = db.all<PriceListRow>(
      `SELECT ${LIST_COLUMNS} FROM price_list WHERE workspace_id = ?
       ORDER BY created_at DESC, id ASC`,
      [ctx.workspaceId],
    )
    const items = activeItems(db, ctx, null)
    const customers = customersOn(db, ctx, null)
    return {
      priceLists: lists.map((row) =>
        toSavedPriceList(
          row,
          items.filter((item) => item.price_list_id === row.id).length,
          customers.filter((customer) => customer.price_list_id === row.id).length,
        ),
      ),
    }
  })

  router.get(
    '/price-lists/for-customer/:customerId',
    ({ db, ctx, params }: RouteHandlerContext) => {
      const customer = db.get<{ id: string; price_list_id: string | null }>(
        'SELECT id, price_list_id FROM customer WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL',
        [ctx.workspaceId, params.customerId ?? ''],
      )
      if (!customer) throw new NotFoundError('Customer')
      if (!customer.price_list_id) return { priceList: null }
      return {
        priceList: buildCustomerPriceList(
          listRow(db, ctx, customer.price_list_id),
          activeItems(db, ctx, customer.price_list_id),
        ),
      }
    },
  )

  router.get('/price-lists/:id', ({ db, ctx, params }: RouteHandlerContext) =>
    detailOf(db, ctx, params.id ?? ''),
  )

  router.post('/price-lists', ({ db, ctx, body }: RouteHandlerContext) => {
    requireCapability(ctx, 'pricing.write')
    const input = parse(priceListInputSchema, body ?? {})
    const id = newId()
    const now = new Date().toISOString()
    try {
      db.run(
        `INSERT INTO price_list
           (id, workspace_id, name, currency, valid_from, valid_to, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          ctx.workspaceId,
          input.name,
          input.currency.toUpperCase(),
          input.validFrom,
          input.validTo,
          ctx.userId,
          now,
          now,
        ],
      )
    } catch (error) {
      // The one-live-list-per-name index.
      if (/UNIQUE/i.test(error instanceof Error ? error.message : String(error))) {
        throw new ValidationError('PRICE_LIST_NAME_TAKEN')
      }
      throw error
    }
    return toSavedPriceList(listRow(db, ctx, id), 0, 0)
  })

  router.patch('/price-lists/:id/active', ({ db, ctx, params, body }: RouteHandlerContext) => {
    requireCapability(ctx, 'pricing.write')
    const { isActive } = parse(z.object({ isActive: z.boolean() }), body ?? {})
    const id = params.id ?? ''
    listRow(db, ctx, id)
    try {
      db.run(
        'UPDATE price_list SET is_active = ?, updated_at = ? WHERE workspace_id = ? AND id = ?',
        [isActive ? 1 : 0, new Date().toISOString(), ctx.workspaceId, id],
      )
    } catch (error) {
      if (/UNIQUE/i.test(error instanceof Error ? error.message : String(error))) {
        throw new ValidationError('PRICE_LIST_NAME_TAKEN')
      }
      throw error
    }
    return toSavedPriceList(
      listRow(db, ctx, id),
      activeItems(db, ctx, id).length,
      customersOn(db, ctx, id).length,
    )
  })

  router.put('/price-lists/:id/items', ({ db, ctx, params, body }: RouteHandlerContext) => {
    requireCapability(ctx, 'pricing.write')
    const { items } = parse(priceListItemsSchema, body ?? {})
    const id = params.id ?? ''
    listRow(db, ctx, id)

    const ids = [...new Set(items.map((item) => item.productId))]
    if (ids.length !== items.length) throw new ValidationError('PRICE_LIST_PRODUCT_TWICE')
    assertOwned(db, ctx, 'product', ids, 'PRICE_LIST_PRODUCT_NOT_FOUND')

    const existing = new Map(
      db
        .all<{ product_id: string; unit_price_minor: number }>(
          'SELECT product_id, unit_price_minor FROM price_list_item WHERE workspace_id = ? AND price_list_id = ?',
          [ctx.workspaceId, id],
        )
        .map((row) => [row.product_id, Number(row.unit_price_minor)]),
    )
    const change = planPriceListChanges(items, existing)
    if ('refusal' in change) throw new ValidationError(change.refusal)

    const now = new Date().toISOString()
    db.transaction(() => {
      for (const row of change.rows) {
        db.run(
          `INSERT INTO price_list_item
             (price_list_id, product_id, workspace_id, unit_price_minor, is_active, updated_by, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(price_list_id, product_id) DO UPDATE SET
             unit_price_minor = excluded.unit_price_minor, is_active = excluded.is_active,
             updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
          [
            id,
            row.product_id,
            ctx.workspaceId,
            row.unit_price_minor,
            row.is_active ? 1 : 0,
            ctx.userId,
            now,
          ],
        )
      }
    })
    return detailOf(db, ctx, id)
  })

  router.put(
    '/price-lists/customers/:customerId',
    ({ db, ctx, params, body }: RouteHandlerContext) => {
      requireCapability(ctx, 'pricing.write')
      const { priceListId } = parse(
        z.object({ priceListId: z.string().uuid().nullable() }),
        body ?? {},
      )
      const customerId = params.customerId ?? ''
      if (priceListId) {
        const list = listRow(db, ctx, priceListId)
        if (!list.is_active) throw new ValidationError('PRICE_LIST_RETIRED')
      }
      const result = db.run(
        'UPDATE customer SET price_list_id = ?, updated_at = ? WHERE workspace_id = ? AND id = ?',
        [priceListId, new Date().toISOString(), ctx.workspaceId, customerId],
      )
      if (result.changes === 0) throw new NotFoundError('Customer')
      return { customerId, priceListId }
    },
  )

  // ─── Promotions ────────────────────────────────────────────
  router.get('/promotions', ({ db, ctx, query }: RouteHandlerContext) => {
    const { active } = parse(z.object({ active: z.enum(['0', '1']).optional() }), query)
    const rows = db.all<PromotionRow>(
      `SELECT ${PROMOTION_COLUMNS} FROM promotion WHERE workspace_id = ?
       ${active === '1' ? 'AND is_active = 1' : ''} ORDER BY created_at DESC, id ASC`,
      [ctx.workspaceId],
    )
    return { promotions: rows.map(toSavedPromotion) }
  })

  router.post('/promotions', ({ db, ctx, body }: RouteHandlerContext) => {
    requireCapability(ctx, 'pricing.write')
    const input = parse(promotionInputSchema, body ?? {})
    assertOwned(db, ctx, 'product', input.productIds, 'PROMOTION_PRODUCT_NOT_FOUND')
    assertOwned(db, ctx, 'customer', input.customerIds, 'PROMOTION_CUSTOMER_NOT_FOUND')
    const columns = promotionColumns(input)
    const id = newId()
    const now = new Date().toISOString()
    db.run(
      `INSERT INTO promotion
         (id, workspace_id, name, kind, value, currency, stacking, product_ids, customer_ids,
          valid_from, valid_to, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        ctx.workspaceId,
        columns.name,
        columns.kind,
        columns.value,
        columns.currency,
        columns.stacking,
        columns.product_ids === null ? null : JSON.stringify(columns.product_ids),
        columns.customer_ids === null ? null : JSON.stringify(columns.customer_ids),
        columns.valid_from,
        columns.valid_to,
        ctx.userId,
        now,
        now,
      ],
    )
    return toSavedPromotion(
      db.get<PromotionRow>(`SELECT ${PROMOTION_COLUMNS} FROM promotion WHERE id = ?`, [id])!,
    )
  })

  router.patch('/promotions/:id/active', ({ db, ctx, params, body }: RouteHandlerContext) => {
    requireCapability(ctx, 'pricing.write')
    const { isActive } = parse(z.object({ isActive: z.boolean() }), body ?? {})
    const result = db.run(
      'UPDATE promotion SET is_active = ?, updated_at = ? WHERE workspace_id = ? AND id = ?',
      [isActive ? 1 : 0, new Date().toISOString(), ctx.workspaceId, params.id ?? ''],
    )
    if (result.changes === 0) throw new NotFoundError('Promotion')
    return toSavedPromotion(
      db.get<PromotionRow>(`SELECT ${PROMOTION_COLUMNS} FROM promotion WHERE id = ?`, [
        params.id ?? '',
      ])!,
    )
  })
}
