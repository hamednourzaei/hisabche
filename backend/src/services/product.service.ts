// ============================================
// backend/src/services/product.service.ts — Optimized v2.4
// FIXED: Removed supabase.raw(), use JavaScript filter
// ============================================

import { supabase } from '../db'
import { scopes } from './authorization/scope.service'
import { CreateProduct, UpdateProduct, ProductFilters } from '@hisabche/validation'
import { summarizeStock, type StockSummaryRow } from './inventory/stock-summary.domain'
import { DatabaseError, NotFoundError } from '../errors/database.error'
import { mapProduct } from '../utils/product.mapper'
import { memoryCache } from '../utils/pagination'
import type { TenancyContext } from './tenancy.service'
import { logBusinessEvent } from './event-log.service'

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

    let query = supabase
      .from('products')
      .select(PRODUCT_LIST_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order(dbSortBy, { ascending: sortDirection === 'asc' })
      .limit(fetchLimit)

    if (search) query = query.ilike('name', `%${search}%`)
    if (category) query = query.eq('category', category)
    if (isActive !== undefined) query = query.eq('is_active', isActive)
    if (barcode) query = query.eq('barcode', barcode)
    if (minPrice !== undefined) query = query.gte('sell_price', minPrice)
    if (maxPrice !== undefined) query = query.lte('sell_price', maxPrice)

    if (cursor) {
      if (sortDirection === 'desc') {
        query = query.lt(dbSortBy, cursor)
      } else {
        query = query.gt(dbSortBy, cursor)
      }
    }

    const [{ data, error }, { count }, summary] = await Promise.all([
      query,
      supabase
        .from('products')
        .select('id', { count: 'estimated', head: true })
        .eq('workspace_id', workspaceId),
      includeSummary ? this.summarizeStock(workspaceId) : Promise.resolve(undefined),
    ])

    if (error) throw new DatabaseError('Failed to fetch products', error)

    const hasMore = (data?.length || 0) > maxLimit
    const items = hasMore ? data.slice(0, maxLimit) : data
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]?.id : null

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
      total: count || 0,
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

    if (error || !product) throw new NotFoundError('Product')

    const result = mapProduct(product)
    await memoryCache.set(cacheKey, result, 300)
    return result
  }

  // ─── Create ──────────────────────────────────────────────────
  async create(ctx: TenancyContext, data: CreateProduct) {
    const { workspaceId, userId } = ctx
    const { data: product, error } = await supabase
      .from('products')
      .insert({
        name: data.name,
        barcode: data.barcode || '',
        sku: data.sku || '',
        category: data.category || 'general',
        description: data.description || '',
        image_url: data.imageUrl || '',
        quantity: data.quantity || 0,
        unit: data.unit || 'piece',
        min_stock_level: data.minStockLevel || 5,
        buy_price: data.buyPrice || 0,
        sell_price: data.sellPrice || 0,
        wholesale_price: data.wholesalePrice || null,
        is_active: data.isActive !== false,
        workspace_id: workspaceId,
        user_id: userId,
      })
      .select(PRODUCT_LIST_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create product', error)

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
    if (data.barcode !== undefined) updates.barcode = data.barcode
    if (data.sku !== undefined) updates.sku = data.sku
    if (data.category !== undefined) updates.category = data.category
    if (data.description !== undefined) updates.description = data.description
    if (data.imageUrl !== undefined) updates.image_url = data.imageUrl
    if (data.quantity !== undefined) updates.quantity = data.quantity
    if (data.unit !== undefined) updates.unit = data.unit
    if (data.minStockLevel !== undefined) updates.min_stock_level = data.minStockLevel
    if (data.buyPrice !== undefined) updates.buy_price = data.buyPrice
    if (data.sellPrice !== undefined) updates.sell_price = data.sellPrice
    if (data.wholesalePrice !== undefined) updates.wholesale_price = data.wholesalePrice
    if (data.isActive !== undefined) updates.is_active = data.isActive

    const { data: product, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select(PRODUCT_LIST_COLUMNS)
      .single()

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

    const [{ count }, { count: stockCount }] = await Promise.all([
      supabase
        .from('invoice_items')
        .select('id', { count: 'estimated', head: true })
        .eq('product_id', id),
      supabase
        .from('stock_movements')
        .select('id', { count: 'estimated', head: true })
        .eq('product_id', id),
    ])

    if (count && count > 0) {
      throw new DatabaseError('Product has invoice items, cannot delete')
    }
    if (stockCount && stockCount > 0) {
      throw new DatabaseError('Product has stock movements, cannot delete')
    }

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

  // ─── Get Product by Barcode ──────────────────────────────────
  async getByBarcode(ctx: TenancyContext, barcode: string) {
    const { workspaceId } = ctx
    const cacheKey = `product:barcode:${workspaceId}:${barcode}`
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_LIST_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('barcode', barcode)
      .single()

    if (error || !data) return null

    const result = mapProduct(data)
    await memoryCache.set(cacheKey, result, 300)
    return result
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
    await memoryCache.invalidate(`product:barcode:${workspaceId}:*`)
    await memoryCache.invalidate(`dashboard:${workspaceId}`)
  }
}

export default ProductService
