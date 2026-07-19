// ============================================
// backend/src/services/product.service.ts — Optimized v2.4
// FIXED: Removed supabase.raw(), use JavaScript filter
// ============================================

import { supabase } from '../db'
import { CreateProduct, UpdateProduct, ProductFilters } from '@hisabche/validation'
import { DatabaseError, NotFoundError } from '../errors/database.error'
import { mapProduct } from '../utils/product.mapper'
import { memoryCache } from '../utils/pagination'

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
  createdAt: 'created_at', updatedAt: 'updated_at',
  sellPrice: 'sell_price', buyPrice: 'buy_price', minStockLevel: 'min_stock_level',
}

export class ProductService {

  // ─── Cache Keys ──────────────────────────────────────────────
  private getListCacheKey(userId: string, filters: ProductFilters) {
    return `products:${userId}:${JSON.stringify(filters)}`
  }

  private getProductCacheKey(userId: string, id: string) {
    return `product:${userId}:${id}`
  }

  private getLowStockCacheKey(userId: string) {
    return `products:low_stock:${userId}`
  }

  // ─── List ────────────────────────────────────────────────────
  async list(userId: string, filters: ProductFilters) {
    const {
      search, category, isActive, lowStock, minPrice, maxPrice, barcode,
      limit = 20, cursor, sortBy = 'created_at', sortDirection = 'desc'
    } = filters

    const cacheKey = this.getListCacheKey(userId, filters)
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const maxLimit = Math.min(limit, 100)
    const fetchLimit = maxLimit + 1
    const dbSortBy = SORT_BY_MAP[sortBy] ?? sortBy ?? 'created_at'

    let query = supabase
      .from('products')
      .select(PRODUCT_LIST_COLUMNS)
      .eq('user_id', userId)
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

    const [{ data, error }, { count }] = await Promise.all([
      query,
      supabase
        .from('products')
        .select('id', { count: 'estimated', head: true })
        .eq('user_id', userId),
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
    }

    await memoryCache.set(cacheKey, result, 30)
    return result
  }

  // ─── Get By ID ──────────────────────────────────────────────
  async getById(id: string, userId: string) {
    const cacheKey = this.getProductCacheKey(userId, id)
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data: product, error } = await supabase
      .from('products')
      .select(PRODUCT_LIST_COLUMNS)
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !product) throw new NotFoundError('Product')

    const result = mapProduct(product)
    await memoryCache.set(cacheKey, result, 300)
    return result
  }

  // ─── Create ──────────────────────────────────────────────────
  async create(userId: string, data: CreateProduct) {
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
        user_id: userId,
      })
      .select(PRODUCT_LIST_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create product', error)

    await this.invalidateUserCache(userId)

    return mapProduct(product)
  }

  // ─── Update ──────────────────────────────────────────────────
  async update(id: string, userId: string, data: UpdateProduct) {
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
      .eq('user_id', userId)
      .select(PRODUCT_LIST_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update product', error)
    if (!product) throw new NotFoundError('Product')

    await this.invalidateUserCache(userId)

    return mapProduct(product)
  }

  // ─── Delete ──────────────────────────────────────────────────
  async delete(id: string, userId: string): Promise<void> {
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
      .eq('user_id', userId)

    if (error) throw new DatabaseError('Failed to delete product', error)

    await this.invalidateUserCache(userId)
  }

  // ─── Get Low Stock ───────────────────────────────────────────
  async getLowStock(userId: string) {
    const cacheKey = this.getLowStockCacheKey(userId)
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_MINIMAL)
      .eq('user_id', userId)
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
  async getByBarcode(userId: string, barcode: string) {
    const cacheKey = `product:barcode:${userId}:${barcode}`
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_LIST_COLUMNS)
      .eq('user_id', userId)
      .eq('barcode', barcode)
      .single()

    if (error || !data) return null

    const result = mapProduct(data)
    await memoryCache.set(cacheKey, result, 300)
    return result
  }

  // ─── Get Products by Category ────────────────────────────────
  async getByCategory(userId: string, category: string) {
    const cacheKey = `products:category:${userId}:${category}`
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_MINIMAL)
      .eq('user_id', userId)
      .eq('category', category)
      .eq('is_active', true)
      .order('name')

    if (error) throw new DatabaseError('Failed to fetch products by category', error)

    const result = (data || []).map(mapProduct)
    await memoryCache.set(cacheKey, result, 120)
    return result
  }

  // ─── Get Product Stats — FIXED ──────────────────────────────
  async getStats(userId: string) {
    const cacheKey = `products:stats:${userId}`
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    // ✅ FIX: سه کوئری موازی
    const [totalResult, activeResult, productsResult] = await Promise.all([
      supabase
        .from('products')
        .select('id', { count: 'estimated', head: true })
        .eq('user_id', userId),
      supabase
        .from('products')
        .select('id', { count: 'estimated', head: true })
        .eq('user_id', userId)
        .eq('is_active', true),
      supabase
        .from('products')
        .select('quantity, min_stock_level')
        .eq('user_id', userId)
        .eq('is_active', true),
    ])

    // ✅ محاسبه lowStock در JavaScript
    const lowStockCount = (productsResult.data || [])
      .filter((p: any) => Number(p.quantity) < Number(p.min_stock_level))
      .length

    const result = {
      total: totalResult.count || 0,
      active: activeResult.count || 0,
      lowStock: lowStockCount,
    }

    await memoryCache.set(cacheKey, result, 60)
    return result
  }

  // ─── Invalidate Cache ────────────────────────────────────────
  private async invalidateUserCache(userId: string) {
    await memoryCache.invalidate(`products:${userId}:*`)
    await memoryCache.invalidate(this.getLowStockCacheKey(userId))
    await memoryCache.invalidate(`products:category:${userId}:*`)
    await memoryCache.invalidate(`products:stats:${userId}`)
    await memoryCache.invalidate(`product:${userId}:*`)
    await memoryCache.invalidate(`product:barcode:${userId}:*`)
    await memoryCache.invalidate(`dashboard:${userId}`)
  }
}

export default ProductService