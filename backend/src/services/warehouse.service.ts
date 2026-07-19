// ============================================
// backend/src/services/warehouse.service.ts — Optimized v2.3
// FIXED: Proper Promise conversion for PostgrestFilterBuilder
// ============================================

import { supabase } from '../db'
import {
  createwarehouseSchema,
  updatewarehouseSchema,
  stockTransferSchema,
} from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'

type CreateWarehouse = any
type UpdateWarehouse = any

export class WarehouseService {

  // ─── Cache Keys ──────────────────────────────────────────────
  private getWarehousesCacheKey(userId: string) {
    return `warehouses:${userId}`
  }

  private getWarehouseStockCacheKey(warehouseId: string) {
    return `warehouse:stock:${warehouseId}`
  }

  private getWarehouseCacheKey(userId: string, id: string) {
    return `warehouse:${userId}:${id}`
  }

  // ─── List warehouses ──────────────────────────────────────────
  async listWarehouses(userId: string) {
    const cacheKey = this.getWarehousesCacheKey(userId)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('warehouses')
      .select('id, name, location, is_active, created_at')
      .eq('user_id', userId)
      .eq('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) throw new DatabaseError('Failed to fetch warehouses', error)
    
    const result = data || []
    await memoryCache.set(cacheKey, result, 120)
    return result
  }

  // ─── Create warehouse ─────────────────────────────────────────
  async createWarehouse(userId: string, data: CreateWarehouse) {
    const { data: warehouse, error } = await supabase
      .from('warehouses')
      .insert({
        name: data.name,
        location: data.location || '',
        is_active: data.isActive !== false,
        user_id: userId,
      })
      .select('id, name, location, is_active, created_at')
      .single()

    if (error) throw new DatabaseError('Failed to create warehouse', error)

    await memoryCache.invalidate(this.getWarehousesCacheKey(userId))
    
    return warehouse
  }

  // ─── Update warehouse ─────────────────────────────────────────
  async updateWarehouse(userId: string, id: string, data: UpdateWarehouse) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.name !== undefined) updates.name = data.name
    if (data.location !== undefined) updates.location = data.location
    if (data.isActive !== undefined) updates.is_active = data.isActive

    const { data: warehouse, error } = await supabase
      .from('warehouses')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select('id, name, location, is_active, created_at, updated_at')
      .single()

    if (error) throw new DatabaseError('Failed to update warehouse', error)

    await this.invalidateWarehouseCache(userId, id)
    
    return warehouse
  }

  // ─── Delete warehouse (soft delete) ──────────────────────────
  async deleteWarehouse(userId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('warehouses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw new DatabaseError('Failed to delete warehouse', error)

    await this.invalidateWarehouseCache(userId, id)
  }

  // ─── Get Warehouse by ID ──────────────────────────────────────
  async getWarehouse(userId: string, id: string) {
    const cacheKey = this.getWarehouseCacheKey(userId, id)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('warehouses')
      .select('id, name, location, is_active, created_at, updated_at')
      .eq('id', id)
      .eq('user_id', userId)
      .eq('deleted_at', null)
      .single()

    if (error) throw new DatabaseError('Warehouse not found', error)

    await memoryCache.set(cacheKey, data, 300)
    return data
  }

  // ─── Stock Transfer — FULLY FIXED ────────────────────────────
  async transferStock(userId: string, data: any) {
    // ✅ گرفتن موجودی از مبدأ و مقصد به صورت موازی
    const [fromStockResult, toStockResult] = await Promise.all([
      supabase
        .from('warehouse_stock')
        .select('quantity')
        .eq('warehouse_id', data.fromWarehouseId)
        .eq('product_id', data.productId)
        .single(),
      supabase
        .from('warehouse_stock')
        .select('quantity')
        .eq('warehouse_id', data.toWarehouseId)
        .eq('product_id', data.productId)
        .single(),
    ])

    const fromStock = fromStockResult.data
    const toStock = toStockResult.data

    if (fromStockResult.error || !fromStock || fromStock.quantity < data.quantity) {
      throw new DatabaseError('Insufficient stock in source warehouse')
    }

    // ✅ FIX: استفاده از async IIFE برای تبدیل به Promise
    const operations: Promise<any>[] = []

    // 1. کاهش موجودی مبدأ
    operations.push(
      (async () => {
        const result = await supabase
          .from('warehouse_stock')
          .update({ quantity: fromStock.quantity - data.quantity })
          .eq('warehouse_id', data.fromWarehouseId)
          .eq('product_id', data.productId)
        return result
      })()
    )

    // 2. افزایش موجودی مقصد
    if (toStock) {
      operations.push(
        (async () => {
          const result = await supabase
            .from('warehouse_stock')
            .update({ quantity: toStock.quantity + data.quantity })
            .eq('warehouse_id', data.toWarehouseId)
            .eq('product_id', data.productId)
          return result
        })()
      )
    } else {
      operations.push(
        (async () => {
          const result = await supabase
            .from('warehouse_stock')
            .insert({
              warehouse_id: data.toWarehouseId,
              product_id: data.productId,
              quantity: data.quantity,
              user_id: userId,
            })
          return result
        })()
      )
    }

    // 3. ثبت حرکت
    operations.push(
      (async () => {
        const result = await supabase
          .from('stock_movements')
          .insert({
            product_id: data.productId,
            type: 'transfer',
            quantity: data.quantity,
            from_warehouse_id: data.fromWarehouseId,
            to_warehouse_id: data.toWarehouseId,
            notes: data.notes || '',
            user_id: userId,
            reference_type: 'transfer',
          })
        return result
      })()
    )

    // ✅ اجرای همه عملیات‌ها به صورت موازی
    const results = await Promise.all(operations)

    for (const result of results) {
      if (result.error) {
        console.error('Stock transfer error:', result.error)
        throw new DatabaseError('Failed to transfer stock', result.error)
      }
    }

    await this.invalidateStockCache(data.fromWarehouseId, data.toWarehouseId)

    return { success: true, transferred: data.quantity }
  }

  // ─── Get Stock by warehouse ──────────────────────────────────
  async getStockByWarehouse(userId: string, warehouseId: string) {
    const cacheKey = this.getWarehouseStockCacheKey(warehouseId)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('warehouse_stock')
      .select(`
        quantity,
        product:products(id, name, sku, sell_price, quantity, unit)
      `)
      .eq('warehouse_id', warehouseId)
      .eq('user_id', userId)

    if (error) throw new DatabaseError('Failed to fetch stock', error)
    
    const result = data || []
    await memoryCache.set(cacheKey, result, 60)
    return result
  }

  // ─── Get Product Stock in all warehouses ─────────────────────
  async getProductStock(userId: string, productId: string) {
    const cacheKey = `warehouse:product:${productId}`
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('warehouse_stock')
      .select(`
        quantity,
        warehouse:warehouses(id, name, location)
      `)
      .eq('product_id', productId)
      .eq('user_id', userId)

    if (error) throw new DatabaseError('Failed to fetch product stock', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 120)
    return result
  }

  // ─── Get Low Stock Items ──────────────────────────────────────
  async getLowStockItems(userId: string, threshold: number = 10) {
    const cacheKey = `warehouse:low_stock:${userId}:${threshold}`
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('warehouse_stock')
      .select(`
        quantity,
        product:products(id, name, sku, min_stock_level),
        warehouse:warehouses(id, name)
      `)
      .eq('user_id', userId)
      .lt('quantity', threshold)
      .order('quantity', { ascending: true })

    if (error) throw new DatabaseError('Failed to fetch low stock items', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 300)
    return result
  }

  // ─── Get Stock Movement History ──────────────────────────────
  async getStockMovements(userId: string, productId?: string, limit: number = 50) {
    const cacheKey = `warehouse:movements:${userId}:${productId || 'all'}:${limit}`
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    let query = supabase
      .from('stock_movements')
      .select(`
        id, type, quantity, notes, created_at,
        from_warehouse:warehouses!from_warehouse_id(id, name),
        to_warehouse:warehouses!to_warehouse_id(id, name),
        product:products(id, name, sku)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100))

    if (productId) {
      query = query.eq('product_id', productId)
    }

    const { data, error } = await query

    if (error) throw new DatabaseError('Failed to fetch stock movements', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 60)
    return result
  }

  // ─── Invalidate Cache ─────────────────────────────────────────
  private async invalidateWarehouseCache(userId: string, warehouseId?: string) {
    await memoryCache.invalidate(this.getWarehousesCacheKey(userId))
    if (warehouseId) {
      await memoryCache.invalidate(this.getWarehouseCacheKey(userId, warehouseId))
      await memoryCache.invalidate(this.getWarehouseStockCacheKey(warehouseId))
    }
  }

  private async invalidateStockCache(...warehouseIds: string[]) {
    for (const id of warehouseIds) {
      await memoryCache.invalidate(this.getWarehouseStockCacheKey(id))
    }
    await memoryCache.invalidate('warehouse:product:*')
    await memoryCache.invalidate('warehouse:low_stock:*')
    await memoryCache.invalidate('warehouse:movements:*')
  }
}

export default WarehouseService