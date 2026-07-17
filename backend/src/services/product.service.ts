// ============================================
// backend/src/services/product.service.ts — Optimized v2.1 + Cursor Pagination
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

const SORT_BY_MAP: Record<string, string> = {
  createdAt: 'created_at', updatedAt: 'updated_at',
  sellPrice: 'sell_price', buyPrice: 'buy_price', minStockLevel: 'min_stock_level',
}

export class ProductService {
  // ─── List — Cursor-based Pagination ───
  async list(userId: string, filters: ProductFilters) {
    const {
      search, category, isActive, lowStock, minPrice, maxPrice, barcode,
      limit = 20, cursor, sortBy = 'created_at', sortDirection = 'desc'
    } = filters

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

    // ✅ Cursor-based
    if (cursor) {
      if (sortDirection === 'desc') {
        query = query.lt(dbSortBy, cursor)
      } else {
        query = query.gt(dbSortBy, cursor)
      }
    }

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to fetch products', error)

    const hasMore = (data?.length || 0) > maxLimit
    const items = hasMore ? data.slice(0, maxLimit) : data
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]?.id : null

    // Apply lowStock filter in memory
    let products = (items || []).map(mapProduct)
    if (lowStock !== undefined) {
      products = lowStock
        ? products.filter((product: any) => product.quantity <= product.minStockLevel)
        : products.filter((product: any) => product.quantity > product.minStockLevel)
    }

    // Count total (اختیاری)
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    return {
      products,
      nextCursor,
      hasMore,
      total: count || 0,
      limit: maxLimit,
    }
  }

  // ─── Get By ID ───
  async getById(id: string, userId: string) {
    const { data: product, error } = await supabase
      .from('products').select(PRODUCT_LIST_COLUMNS).eq('id', id).eq('user_id', userId).single()
    if (error || !product) throw new NotFoundError('Product')
    return mapProduct(product)
  }

  // ─── Create ───
  async create(userId: string, data: CreateProduct) {
    const { data: product, error } = await supabase
      .from('products').insert({
        name: data.name, barcode: data.barcode || '', sku: data.sku || '',
        category: data.category || 'general', description: data.description || '',
        image_url: data.imageUrl || '', quantity: data.quantity || 0,
        unit: data.unit || 'piece', min_stock_level: data.minStockLevel || 5,
        buy_price: data.buyPrice || 0, sell_price: data.sellPrice || 0,
        wholesale_price: data.wholesalePrice || null, is_active: data.isActive !== false, user_id: userId,
      })
      .select(PRODUCT_LIST_COLUMNS).single()

    if (error) throw new DatabaseError('Failed to create product', error)

    memoryCache.invalidate(`products:${userId}`)
    memoryCache.invalidate(`dashboard:${userId}`)

    return mapProduct(product)
  }

  // ─── Update ───
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
      .from('products').update(updates).eq('id', id).eq('user_id', userId)
      .select(PRODUCT_LIST_COLUMNS).single()

    if (error) throw new DatabaseError('Failed to update product', error)
    if (!product) throw new NotFoundError('Product')

    memoryCache.invalidate(`products:${userId}`)
    memoryCache.invalidate(`dashboard:${userId}`)

    return mapProduct(product)
  }

  // ─── Delete ───
  async delete(id: string, userId: string): Promise<void> {
    const { count } = await supabase.from('invoice_items').select('id', { count: 'exact', head: true }).eq('product_id', id)
    if (count && count > 0) throw new DatabaseError('Product has invoice items, cannot delete')

    const { count: stockCount } = await supabase.from('stock_movements').select('id', { count: 'exact', head: true }).eq('product_id', id)
    if (stockCount && stockCount > 0) throw new DatabaseError('Product has stock movements, cannot delete')

    const { error } = await supabase.from('products').delete().eq('id', id).eq('user_id', userId)
    if (error) throw new DatabaseError('Failed to delete product', error)

    memoryCache.invalidate(`products:${userId}`)
    memoryCache.invalidate(`dashboard:${userId}`)
  }

  // ─── Get Low Stock ───
  async getLowStock(userId: string) {
    const { data, error } = await supabase
      .from('products').select('id, name, quantity, min_stock_level, unit, sell_price')
      .eq('user_id', userId).eq('is_active', true).order('quantity', { ascending: true })

    if (error) throw new DatabaseError('Failed to fetch low stock products', error)
    return (data || []).map(mapProduct).filter((product: any) => product.quantity <= product.minStockLevel)
  }
}