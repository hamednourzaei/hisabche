// ============================================
// backend/src/services/product.service.ts — Optimized v2.4
// FIXED: Removed supabase.raw(), use JavaScript filter
// ============================================

import { supabase } from '../db'
import { scopes } from './authorization/scope.service'
import {
  CreateProduct,
  UpdateProduct,
  ProductFilters,
  normalizeBarcode,
} from '@hisabche/validation'
import { summarizeStock, type StockSummaryRow } from './inventory/stock-summary.domain'
import { stockEditWarehouse, type WarehouseRow } from './inventory/warehouse-summary.domain'
import { ConflictError, DatabaseError, NotFoundError, isFailedRead } from '../errors/database.error'
import { ValidationError } from '../errors/validation.error'
import { mapProduct } from '../utils/product.mapper'
import { memoryCache } from '../utils/pagination'
import type { TenancyContext } from './tenancy.service'
import { logBusinessEvent } from './event-log.service'
import { applyKeyset, decodeCursor, encodeCursor } from '../utils/keyset-cursor'
import {
  asReplay,
  IdempotencyUnavailableError,
  isMissingIdempotencySupport,
} from '../utils/client-request'

/** Characters that cannot break PostgREST's or() filter syntax. */
const BARCODE_SAFE = /^[A-Za-z0-9._-]{3,64}$/

/** A unique violation on the per-workspace barcode index. */
function isBarcodeTaken(error: { code?: string; message?: string } | null | undefined): boolean {
  // Main barcodes, extra barcodes (docs/product-barcodes-migration.sql), and
  // the trigger that stops one code being both.
  return (
    error?.code === '23505' &&
    /products_workspace_barcode_key|product_barcodes_workspace_barcode_key/.test(
      String(error.message ?? ''),
    )
  )
}

/** product_barcodes is absent until its migration runs: «no extra codes». */
const EXTRA_BARCODES_ABSENT = new Set(['42P01', 'PGRST205'])

export interface ExtraBarcode {
  id: string
  barcode: string
  /** The unit this code sells in; null = the product's own. */
  unit: string | null
}

// ✅ Column Selection Constants
const PRODUCT_LIST_COLUMNS = `
  id, name, barcode, sku, category, quantity, unit,
  sell_price, buy_price, wholesale_price, min_stock_level,
  is_active, image_url, created_at, updated_at
`

const PRODUCT_MINIMAL = `
  id, name, quantity, min_stock_level, unit, sell_price
`

const SORT_BY_MAP: Record<string, string> = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  sellPrice: 'sell_price',
  buyPrice: 'buy_price',
  minStockLevel: 'min_stock_level',
}

export class ProductService {
  // ─── Cache Keys ──────────────────────────────────────────────
  //
  // ⚠️ Keyed by WORKSPACE. These were `products:${userId}`, which under the
  // shared-book model hides a product one member added from every other
  // member until the TTL expires. There is no userId fallback: a cache key is
  // a tenancy identity, and a narrower one here would mask a route that never
  // resolved a workspace.
  private getListCacheKey(workspaceId: string, filters: ProductFilters) {
    return `products:${workspaceId}:${JSON.stringify(filters)}`
  }

  private getProductCacheKey(workspaceId: string, id: string) {
    return `product:${workspaceId}:${id}`
  }

  private getLowStockCacheKey(workspaceId: string) {
    return `products:low_stock:${workspaceId}`
  }

  // ─── List ────────────────────────────────────────────────────
  async list(ctx: TenancyContext, filters: ProductFilters) {
    const { workspaceId } = ctx
    const {
      search,
      category,
      isActive,
      lowStock,
      minPrice,
      maxPrice,
      barcode,
      includeSummary,
      limit = 20,
      page = 1,
      cursor,
      sortBy = 'created_at',
      sortDirection = 'desc',
    } = filters

    const cacheKey = this.getListCacheKey(workspaceId, filters)
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const maxLimit = Math.min(limit, 100)
    const fetchLimit = maxLimit + 1
    const dbSortBy = SORT_BY_MAP[sortBy] ?? sortBy ?? 'created_at'

    const keyset = cursor ? decodeCursor(cursor, dbSortBy) : null
    // ⚠️ THE TOTAL IS COUNTED ON THIS QUERY (27 Sep 2026). It came from a
    // second HEAD request with `count: 'estimated'` over the WHOLE workspace:
    // one extra round trip plus a planner EXPLAIN per list call, and with a
    // search active the page count was the unfiltered one — «page 1 of 20»
    // for three matches. PostgREST counts the filtered set and ignores the
    // range, which is exactly the number the pager needs. On the keyset
    // (cursor) path there is no total: a count after the cursor would be
    // «rows remaining», not the size of the list.
    let query = supabase
      .from('products')
      .select(PRODUCT_LIST_COLUMNS, keyset ? undefined : { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order(dbSortBy, { ascending: sortDirection === 'asc' })
      .order('id', { ascending: sortDirection === 'asc' })

    // `page` used to be ignored: page 2 of the products table was page 1 again.
    const pageNumber = Number(page) || 1
    if (!keyset && pageNumber > 1) {
      const offset = (pageNumber - 1) * maxLimit
      query = query.range(offset, offset + maxLimit)
    } else {
      query = query.limit(fetchLimit)
    }

    if (search) {
      // Name, OR the exact barcode — so a scanner typing into the invoice
      // row's product box finds the product (the search used to be name-only
      // and a scanned code matched nothing). Only for text that is safe inside
      // PostgREST's or() syntax; anything else searches the name alone.
      const code = normalizeBarcode(search)
      query = BARCODE_SAFE.test(code)
        ? query.or(`name.ilike.%${code}%,barcode.eq.${code}`)
        : query.ilike('name', `%${search}%`)
    }
    if (category) query = query.eq('category', category)
    if (isActive !== undefined) query = query.eq('is_active', isActive)
    if (barcode) query = query.eq('barcode', barcode)
    if (minPrice !== undefined) query = query.gte('sell_price', minPrice)
    if (maxPrice !== undefined) query = query.lte('sell_price', maxPrice)

    if (keyset) query = applyKeyset(query, dbSortBy, sortDirection, keyset)

    const [{ data, error, count }, summary] = await Promise.all([
      query,
      includeSummary ? this.summarizeStock(workspaceId) : Promise.resolve(undefined),
    ])

    if (error) throw new DatabaseError('Failed to fetch products', error)

    const hasMore = (data?.length || 0) > maxLimit
    const items = hasMore ? data.slice(0, maxLimit) : data
    const last =
      items && items.length > 0 ? (items[items.length - 1] as Record<string, unknown>) : null
    const nextCursor = hasMore && last ? encodeCursor(last, dbSortBy) : null

    let products = (items || []).map(mapProduct)
    if (lowStock !== undefined) {
      products = lowStock
        ? products.filter((product: any) => product.quantity <= product.minStockLevel)
        : products.filter((product: any) => product.quantity > product.minStockLevel)
    }

    const result = {
      products,
      nextCursor,
      hasMore,
      ...(keyset ? {} : { total: count ?? 0 }),
      limit: maxLimit,
      // Additive, and only when asked: pickers and searches keep the response
      // they had and do not pay for a full scan.
      ...(summary ? { summary } : {}),
    }

    await memoryCache.set(cacheKey, result, 30)
    return result
  }

  /**
   * Stock value and stock-state counts over EVERY product in the workspace.
   * Deliberately ignores the list's search/filters: the cards describe the
   * warehouse, not the current search.
   *
   * Ordered 1000-row pages, because PostgREST truncates an unbounded select
   * at max-rows without an error. See stock-summary.domain.ts.
   */
  private async summarizeStock(workspaceId: string) {
    const PAGE = 1000
    const rows: StockSummaryRow[] = []

    for (let from = 0; ; from += PAGE) {
      const { data: page, error } = await supabase
        .from('products')
        .select('quantity, sell_price, min_stock_level')
        .eq('workspace_id', workspaceId)
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)

      if (error) throw new DatabaseError('Failed to summarize stock', error)

      rows.push(...((page ?? []) as StockSummaryRow[]))
      if (!page || page.length < PAGE) break
    }

    return summarizeStock(rows)
  }

  // ─── Get By ID ──────────────────────────────────────────────
  async getById(id: string, ctx: TenancyContext) {
    const { workspaceId } = ctx
    const cacheKey = this.getProductCacheKey(workspaceId, id)
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data: product, error } = await supabase
      .from('products')
      .select(PRODUCT_LIST_COLUMNS)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (isFailedRead(error)) throw new DatabaseError('Failed to read product', error)
    if (!product) throw new NotFoundError('Product')

    const result = mapProduct(product)
    await memoryCache.set(cacheKey, result, 300)
    return result
  }

  // ─── Create ──────────────────────────────────────────────────
  private async findByClientRequestId(workspaceId: string, key: string) {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_LIST_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('client_request_id', key)
      .maybeSingle()
    if (error) {
      if (isMissingIdempotencySupport(error)) throw new IdempotencyUnavailableError('product')
      throw new DatabaseError('Failed to look up the request', error)
    }
    return data ? mapProduct(data) : null
  }

  async create(
    ctx: TenancyContext,
    data: CreateProduct,
    options: { clientRequestId?: string | null } = {},
  ) {
    const { workspaceId, userId } = ctx
    const clientRequestId = options.clientRequestId ?? null
    // Request #94 — «افزودن به انبار»: the opening stock lands in a warehouse —
    // the one named, or the business's only one (stockEditWarehouse).
    const openingWarehouseId =
      (Number(data.quantity) || 0) > 0
        ? await this.stockWarehouse(
            workspaceId,
            (data as { warehouseId?: string | null }).warehouseId,
            'create',
          )
        : null

    if (clientRequestId) {
      const existing = await this.findByClientRequestId(workspaceId, clientRequestId)
      if (existing) return asReplay(existing)
    }

    const { data: product, error } = await supabase
      .from('products')
      .insert({
        name: data.name,
        barcode: normalizeBarcode(data.barcode),
        sku: data.sku || '',
        category: data.category || 'general',
        description: data.description || '',
        image_url: data.imageUrl || '',
        // ⚠️ 0 when the product is being put IN a warehouse: the quantity then
        // arrives as a stock movement below, so `products.quantity` and
        // `warehouse_stock` are both maintained by the Phase C trigger from one
        // row. Writing it here as well would double the opening stock.
        quantity: openingWarehouseId ? 0 : data.quantity || 0,
        unit: data.unit || 'piece',
        // Only when there is one: `products.unit_label` arrives with patch 2,
        // and naming a column a database does not have fails the whole insert.
        ...(data.unitLabel ? { unit_label: data.unitLabel } : {}),
        min_stock_level: data.minStockLevel || 5,
        buy_price: data.buyPrice || 0,
        sell_price: data.sellPrice || 0,
        wholesale_price: data.wholesalePrice || null,
        is_active: data.isActive !== false,
        workspace_id: workspaceId,
        user_id: userId,
        ...(clientRequestId ? { client_request_id: clientRequestId } : {}),
      })
      .select(PRODUCT_LIST_COLUMNS)
      .single()

    // The workspace already has this barcode on another product
    // (docs/product-barcode-unique-migration.sql). Named, not a 500: the form
    // can point at the barcode field.
    if (isBarcodeTaken(error)) throw new ConflictError('BARCODE_TAKEN')
    if (error && clientRequestId) {
      if (error.code === '23505') {
        const winner = await this.findByClientRequestId(workspaceId, clientRequestId)
        if (winner) return asReplay(winner)
      }
      if (isMissingIdempotencySupport(error)) throw new IdempotencyUnavailableError('product')
    }
    if (error) throw new DatabaseError('Failed to create product', error)

    // The opening stock as a MOVEMENT, so the warehouse figure and the product
    // total come from the same row (stock_movements_project).
    if (openingWarehouseId && product) {
      const { error: movementError } = await supabase.from('stock_movements').insert({
        product_id: (product as { id: string }).id,
        type: 'purchase',
        quantity: Number(data.quantity) || 0,
        reference_type: 'product_opening',
        reference_id: (product as { id: string }).id,
        to_warehouse_id: openingWarehouseId,
        workspace_id: workspaceId,
        user_id: userId,
        notes: 'opening stock',
      })
      // Not swallowed: a product whose stock never landed must not report success.
      if (movementError) {
        throw new DatabaseError('Failed to record the opening stock', movementError)
      }
    }

    await this.invalidateWorkspaceCache(workspaceId)

    logBusinessEvent({
      userId,
      workspaceId,
      entityType: 'product',
      entityId: product.id,
      action: 'created',
      title: `کالای جدید: ${product.name}`,
      description: product.sku ? `کد: ${product.sku}` : undefined,
      notify: false,
    }).catch((err) => console.error('[ProductService] logBusinessEvent failed:', err))

    return mapProduct(product)
  }

  // ─── Update ──────────────────────────────────────────────────
  async update(id: string, ctx: TenancyContext, data: UpdateProduct) {
    // Workspace alone is not enough on a row addressed by id. Before this, any
    // member of the workspace could mutate any row in it by knowing an id —
    // including one raised by a colleague in a branch they do not hold.
    // `assertMay` reads the row's own branch and creator and refuses on either.
    await scopes.assertMay(ctx, 'product', id, 'product.write')

    const { workspaceId } = ctx
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.name !== undefined) updates.name = data.name
    if (data.barcode !== undefined) updates.barcode = normalizeBarcode(data.barcode)
    if (data.sku !== undefined) updates.sku = data.sku
    if (data.category !== undefined) updates.category = data.category
    if (data.description !== undefined) updates.description = data.description
    if (data.imageUrl !== undefined) updates.image_url = data.imageUrl
    // ⚠️ QUANTITY IS NOT WRITTEN HERE. Since Phase C `products.quantity` is a
    // projection of `stock_movements` (trigger stock_movements_project). A
    // direct write left the movement history — the stock drawer, the per-
    // warehouse stock, a later recount — disagreeing with the number, and a
    // refill recorded nowhere. The edit becomes an `adjustment` movement for the
    // difference; the trigger moves the stock.
    const quantityTarget = data.quantity
    if (data.unit !== undefined) updates.unit = data.unit
    if (data.minStockLevel !== undefined) updates.min_stock_level = data.minStockLevel
    if (data.buyPrice !== undefined) updates.buy_price = data.buyPrice
    if (data.sellPrice !== undefined) updates.sell_price = data.sellPrice
    if (data.wholesalePrice !== undefined) updates.wholesale_price = data.wholesalePrice
    if (data.isActive !== undefined) updates.is_active = data.isActive

    if (quantityTarget !== undefined) {
      const target = Number(quantityTarget)
      if (!Number.isFinite(target)) throw new ValidationError('PRODUCT_QUANTITY_INVALID')

      const { data: current, error: readError } = await supabase
        .from('products')
        .select('quantity')
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      if (readError) throw new DatabaseError('Failed to read product stock', readError)
      if (!current) throw new NotFoundError('Product')

      const delta = target - (Number((current as { quantity: unknown }).quantity) || 0)
      if (delta !== 0) {
        // ⚠️ INTO A WAREHOUSE. Recorded with none, a refill sat in «بدون انبار»
        // while sales left the warehouse: 20 on the product page, −10 in the
        // warehouse (BUG-080).
        const warehouseId = await this.stockWarehouse(
          workspaceId,
          (data as { warehouseId?: string | null }).warehouseId,
          'edit',
        )
        const { error: movementError } = await supabase.from('stock_movements').insert({
          product_id: id,
          type: 'adjustment',
          quantity: delta,
          reference_type: 'product_edit',
          reference_id: id,
          ...(warehouseId ? { to_warehouse_id: warehouseId } : {}),
          workspace_id: workspaceId,
          user_id: ctx.userId,
          notes: `stock set to ${target} from the product page`,
        })
        // Not swallowed: a stock edit that did not land must not report success.
        if (movementError)
          throw new DatabaseError('Failed to record the stock adjustment', movementError)
      }
    }

    const { data: product, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select(PRODUCT_LIST_COLUMNS)
      .single()

    if (isBarcodeTaken(error)) throw new ConflictError('BARCODE_TAKEN')
    if (error) throw new DatabaseError('Failed to update product', error)
    if (!product) throw new NotFoundError('Product')

    await this.invalidateWorkspaceCache(workspaceId)

    return mapProduct(product)
  }

  // ─── Delete ──────────────────────────────────────────────────
  async delete(id: string, ctx: TenancyContext): Promise<void> {
    // Workspace alone is not enough on a row addressed by id. Before this, any
    // member of the workspace could mutate any row in it by knowing an id —
    // including one raised by a colleague in a branch they do not hold.
    // `assertMay` reads the row's own branch and creator and refuses on either.
    await scopes.assertMay(ctx, 'product', id, 'product.write')

    const { workspaceId } = ctx

    // Establish tenancy BEFORE probing the child tables. `invoice_items` and
    // `stock_movements` carry no workspace_id — they are reached through the
    // product — so without this a caller could learn whether some other
    // workspace's product id has invoice items by reading which error came
    // back. The delete below is workspace-scoped either way; this closes the
    // existence oracle in front of it.
    const { data: owned, error: ownedError } = await supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (ownedError) throw new DatabaseError('Failed to verify product', ownedError)
    if (!owned) throw new NotFoundError('Product')

    // ⚠️ THIS CHECK IS THE ONLY GUARD. `invoice_items.product_id` and
    // `stock_movements.product_id` have no foreign key, so the database lets
    // a sold product be deleted and orphans its sales and stock history.
    //
    // It used to be `count: 'estimated'` with the error ignored: a failed read
    // left `count` null, `null && …` is false, and the delete went ahead. An
    // existence check, and a read that fails refuses (lesson 3).
    const [sold, moved] = await Promise.all([
      supabase.from('invoice_items').select('id').eq('product_id', id).limit(1).maybeSingle(),
      supabase.from('stock_movements').select('id').eq('product_id', id).limit(1).maybeSingle(),
    ])

    if (sold.error) throw new DatabaseError('Failed to check product sales', sold.error)
    if (moved.error) throw new DatabaseError('Failed to check product stock history', moved.error)
    // A conflict, not a server fault: the person can deactivate the product instead.
    if (sold.data) throw new ConflictError('PRODUCT_HAS_INVOICE_ITEMS')
    if (moved.data) throw new ConflictError('PRODUCT_HAS_STOCK_MOVEMENTS')

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (error) throw new DatabaseError('Failed to delete product', error)

    await this.invalidateWorkspaceCache(workspaceId)
  }

  // ─── Get Low Stock ───────────────────────────────────────────
  async getLowStock(ctx: TenancyContext) {
    const { workspaceId } = ctx
    const cacheKey = this.getLowStockCacheKey(workspaceId)
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_MINIMAL)
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('quantity', { ascending: true })

    if (error) throw new DatabaseError('Failed to fetch low stock products', error)

    const products = (data || [])
      .map(mapProduct)
      .filter((product: any) => product.quantity <= product.minStockLevel)

    await memoryCache.set(cacheKey, products, 60)
    return products
  }

  // ─── Look a product up by its exact barcode (scanner) ────────
  //
  // ⚠️ THREE ANSWERS, NOT ONE (27 Sep 2026). This was `.single()` behind a
  // 5-minute cache: no row, two rows and a failed query all came back as
  // `null`, so a barcode shared by two products read as «unknown» and the
  // cashier was invited to create a THIRD. It also served a price up to five
  // minutes stale after an edit. Now: found / ambiguous (the cashier picks —
  // never silently the first) / not found, and an error is thrown, not
  // answered. Uncached: an exact match on an indexed column is cheap, and a
  // price must be the current one.
  async lookupByBarcode(
    ctx: TenancyContext,
    rawBarcode: string,
  ): Promise<
    // `unit`: the unit an EXTRA code sells in (the carton's code), when it names one.
    | { status: 'found'; product: ReturnType<typeof mapProduct>; unit?: string | undefined }
    | { status: 'ambiguous'; products: Array<ReturnType<typeof mapProduct>> }
    | { status: 'not_found' }
  > {
    const barcode = normalizeBarcode(rawBarcode)
    if (!barcode) return { status: 'not_found' }

    // The main barcode and the extra ones, together — one round trip each, in
    // parallel. Either failing is an error, never «not found».
    const [main, extra] = await Promise.all([
      supabase
        .from('products')
        .select(PRODUCT_LIST_COLUMNS)
        .eq('workspace_id', ctx.workspaceId)
        .eq('barcode', barcode)
        .eq('is_active', true)
        .limit(5),
      supabase
        .from('product_barcodes')
        .select(`unit, product:products!inner(${PRODUCT_LIST_COLUMNS})`)
        .eq('workspace_id', ctx.workspaceId)
        .eq('barcode', barcode)
        .eq('product.is_active', true)
        .limit(5),
    ])

    if (main.error) throw new DatabaseError('Failed to look up barcode', main.error)
    if (extra.error && !EXTRA_BARCODES_ABSENT.has(extra.error.code ?? '')) {
      throw new DatabaseError('Failed to look up extra barcodes', extra.error)
    }

    const found = new Map<string, { product: ReturnType<typeof mapProduct>; unit?: string }>()
    for (const row of (main.data ?? []) as Record<string, unknown>[]) {
      const product = mapProduct(row)
      found.set(product.id, { product })
    }
    for (const row of (extra.error ? [] : (extra.data ?? [])) as unknown as Array<{
      unit: string | null
      product: Record<string, unknown>
    }>) {
      const product = mapProduct(row.product)
      if (!found.has(product.id)) {
        found.set(product.id, row.unit ? { product, unit: row.unit } : { product })
      }
    }

    const hits = [...found.values()]
    if (hits.length === 0) return { status: 'not_found' }
    if (hits.length > 1) return { status: 'ambiguous', products: hits.map((h) => h.product) }
    const hit = hits[0]!
    return hit.unit
      ? { status: 'found', product: hit.product, unit: hit.unit }
      : { status: 'found', product: hit.product }
  }

  // ─── Extra barcodes (docs/product-barcodes-migration.sql) ────────────────

  async listBarcodes(ctx: TenancyContext, productId: string): Promise<ExtraBarcode[]> {
    const { data, error } = await supabase
      .from('product_barcodes')
      .select('id, barcode, unit')
      .eq('workspace_id', ctx.workspaceId)
      .eq('product_id', productId)
      .order('created_at', { ascending: true })
    if (error) {
      if (EXTRA_BARCODES_ABSENT.has(error.code ?? '')) return []
      throw new DatabaseError('Failed to read extra barcodes', error)
    }
    return (data ?? []) as ExtraBarcode[]
  }

  async addBarcode(
    ctx: TenancyContext,
    productId: string,
    input: { barcode: string; unit?: string | null | undefined },
  ): Promise<ExtraBarcode> {
    await scopes.assertMay(ctx, 'product', productId, 'product.write')
    const barcode = normalizeBarcode(input.barcode)
    if (!barcode) throw new ValidationError('BARCODE_EMPTY')

    const { data, error } = await supabase
      .from('product_barcodes')
      .insert({
        workspace_id: ctx.workspaceId,
        product_id: productId,
        barcode,
        unit: input.unit?.trim() || null,
        created_by: ctx.userId,
      })
      .select('id, barcode, unit')
      .single()

    if (isBarcodeTaken(error)) throw new ConflictError('BARCODE_TAKEN')
    if (error) {
      if (EXTRA_BARCODES_ABSENT.has(error.code ?? '')) {
        throw new ConflictError('EXTRA_BARCODES_MIGRATION_REQUIRED')
      }
      // 23503: the product is not there (or not in this workspace's reach).
      if (error.code === '23503') throw new NotFoundError('Product')
      throw new DatabaseError('Failed to add the barcode', error)
    }
    await memoryCache.invalidate(`products:${ctx.workspaceId}`)
    return data as ExtraBarcode
  }

  async removeBarcode(ctx: TenancyContext, productId: string, barcodeId: string): Promise<void> {
    await scopes.assertMay(ctx, 'product', productId, 'product.write')
    const { data, error } = await supabase
      .from('product_barcodes')
      .delete()
      .eq('workspace_id', ctx.workspaceId)
      .eq('product_id', productId)
      .eq('id', barcodeId)
      .select('id')
    if (error) throw new DatabaseError('Failed to remove the barcode', error)
    if (!data || data.length === 0) throw new NotFoundError('Barcode')
    await memoryCache.invalidate(`products:${ctx.workspaceId}`)
  }

  // ─── Get Products by Category ────────────────────────────────
  async getByCategory(ctx: TenancyContext, category: string) {
    const { workspaceId } = ctx
    const cacheKey = `products:category:${workspaceId}:${category}`
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_MINIMAL)
      .eq('workspace_id', workspaceId)
      .eq('category', category)
      .eq('is_active', true)
      .order('name')

    if (error) throw new DatabaseError('Failed to fetch products by category', error)

    const result = (data || []).map(mapProduct)
    await memoryCache.set(cacheKey, result, 120)
    return result
  }

  // ─── Get Product Stats — FIXED ──────────────────────────────
  async getStats(ctx: TenancyContext) {
    const { workspaceId } = ctx
    const cacheKey = `products:stats:${workspaceId}`
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    // ✅ FIX: سه کوئری موازی
    const [totalResult, activeResult, productsResult] = await Promise.all([
      supabase
        .from('products')
        .select('id', { count: 'estimated', head: true })
        .eq('workspace_id', workspaceId),
      supabase
        .from('products')
        .select('id', { count: 'estimated', head: true })
        .eq('workspace_id', workspaceId)
        .eq('is_active', true),
      supabase
        .from('products')
        .select('quantity, min_stock_level')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true),
    ])

    // ✅ محاسبه lowStock در JavaScript
    const lowStockCount = (productsResult.data || []).filter(
      (p: any) => Number(p.quantity) < Number(p.min_stock_level),
    ).length

    const result = {
      total: totalResult.count || 0,
      active: activeResult.count || 0,
      lowStock: lowStockCount,
    }

    await memoryCache.set(cacheKey, result, 60)
    return result
  }

  // ─── Invalidate Cache ────────────────────────────────────────
  private async invalidateWorkspaceCache(workspaceId: string) {
    await memoryCache.invalidate(`products:${workspaceId}:*`)
    await memoryCache.invalidate(this.getLowStockCacheKey(workspaceId))
    await memoryCache.invalidate(`products:category:${workspaceId}:*`)
    await memoryCache.invalidate(`products:stats:${workspaceId}`)
    await memoryCache.invalidate(`product:${workspaceId}:*`)
    await memoryCache.invalidate(`dashboard:${workspaceId}`)
  }

  /** Where a product-page stock change lands — the rule is stockEditWarehouse. */
  private async stockWarehouse(
    workspaceId: string,
    requested: string | null | undefined,
    mode: 'edit' | 'create',
  ): Promise<string | null> {
    const { data, error } = await supabase
      .from('warehouses')
      .select('id, name, location, is_active')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
    if (error) throw new DatabaseError('Failed to read the warehouses', error)
    const choice = stockEditWarehouse((data ?? []) as WarehouseRow[], requested, mode)
    if ('refusal' in choice) throw new ValidationError(choice.refusal)
    return choice.warehouseId
  }
}

export default ProductService
