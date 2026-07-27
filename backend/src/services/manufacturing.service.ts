// ============================================
// backend/src/services/manufacturing.service.ts — Optimized v2.2
// FIXED: Supabase raw() error
// ============================================

import { supabase } from '../db'
import { DatabaseError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'
import { logBusinessEvent } from './event-log.service'

// ✅ Column Selection Constants
const BOM_LIST_COLUMNS = 'id, product_id, version, is_active, created_at, updated_at'
const BOM_ITEM_COLUMNS = 'id, bom_id, raw_material_id, quantity, unit_cost'
const BOM_MINIMAL = 'id, product_id, version, is_active'

const WORK_ORDER_COLUMNS = 'id, product_id, quantity, bom_id, status, start_date, end_date, created_at, updated_at'
const WORK_ORDER_MINIMAL = 'id, product_id, quantity, status, created_at'

export class ManufacturingService {

  // ─── Cache Keys ──────────────────────────────────────────────
  private getBomsCacheKey(userId: string, productId?: string) {
    return `manufacturing:boms:${userId}:${productId || 'all'}`
  }

  private getWorkOrdersCacheKey(userId: string, status?: string) {
    return `manufacturing:workorders:${userId}:${status || 'all'}`
  }

  private getBomCacheKey(userId: string, id: string) {
    return `manufacturing:bom:${userId}:${id}`
  }

  private getWorkOrderCacheKey(userId: string, id: string) {
    return `manufacturing:workorder:${userId}:${id}`
  }

  // ─── BOMs ─────────────────────────────────────────────────────
  async listBoms(userId: string, productId?: string) {
    const cacheKey = this.getBomsCacheKey(userId, productId)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    let query = supabase
      .from('boms')
      .select(`
        ${BOM_MINIMAL},
        product:products(id, name),
        items:bom_items(${BOM_ITEM_COLUMNS}, raw_material:products(id, name, unit))
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (productId) {
      query = query.eq('product_id', productId)
    }

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to fetch BOMs', error)
    
    const result = data || []
    await memoryCache.set(cacheKey, result, 120)
    return result
  }

  async createBom(userId: string, data: any) {
    const { data: bom, error } = await supabase
      .from('boms')
      .insert({
        product_id: data.productId,
        version: data.version || 1,
        is_active: true,
        user_id: userId,
      })
      .select(BOM_LIST_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create BOM', error)

    if (data.items?.length) {
      const items = data.items.map((item: any) => ({
        bom_id: bom.id,
        raw_material_id: item.rawMaterialId,
        quantity: item.quantity,
        unit_cost: item.unitCost || 0,
        user_id: userId,
      }))
      
      const { error: itemsError } = await supabase.from('bom_items').insert(items)
      if (itemsError) {
        await supabase.from('boms').delete().eq('id', bom.id)
        throw new DatabaseError('Failed to create BOM items', itemsError)
      }
    }

    await this.invalidateBomCache(userId)
    return bom
  }

  async updateBom(userId: string, id: string, data: any) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.version !== undefined) updates.version = data.version
    if (data.isActive !== undefined) updates.is_active = data.isActive

    const { data: bom, error } = await supabase
      .from('boms')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select(BOM_LIST_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update BOM', error)

    if (data.items) {
      await supabase.from('bom_items').delete().eq('bom_id', id)
      const items = data.items.map((item: any) => ({
        bom_id: id,
        raw_material_id: item.rawMaterialId,
        quantity: item.quantity,
        unit_cost: item.unitCost || 0,
        user_id: userId,
      }))
      await supabase.from('bom_items').insert(items)
    }

    await this.invalidateBomCache(userId, id)
    return bom
  }

  // ─── Get BOM by ID ───────────────────────────────────────────
  async getBom(userId: string, id: string) {
    const cacheKey = this.getBomCacheKey(userId, id)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('boms')
      .select(`
        ${BOM_LIST_COLUMNS},
        product:products(id, name, unit),
        items:bom_items(${BOM_ITEM_COLUMNS}, raw_material:products(id, name, unit, buy_price))
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !data) throw new DatabaseError('BOM not found', error)
    
    await memoryCache.set(cacheKey, data, 300)
    return data
  }

  // ─── Work Orders ─────────────────────────────────────────────
  async listWorkOrders(userId: string, status?: string) {
    const cacheKey = this.getWorkOrdersCacheKey(userId, status)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    let query = supabase
      .from('work_orders')
      .select(`
        ${WORK_ORDER_MINIMAL},
        product:products(id, name),
        bom:boms(id, version)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to fetch work orders', error)
    
    const result = data || []
    await memoryCache.set(cacheKey, result, 60)
    return result
  }

  async createWorkOrder(userId: string, data: any) {
    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .insert({
        product_id: data.productId,
        quantity: data.quantity,
        bom_id: data.bomId || null,
        status: 'planned',
        start_date: data.startDate || null,
        end_date: data.endDate || null,
        user_id: userId,
      })
      .select(WORK_ORDER_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create work order', error)

    await this.invalidateWorkOrderCache(userId)

    logBusinessEvent({
      userId,
      entityType: 'work_order',
      entityId: workOrder.id,
      action: 'created',
      title: `دستور تولید جدید ثبت شد`,
      notify: false,
    }).catch((err) => console.error('[ManufacturingService] logBusinessEvent failed:', err))

    return workOrder
  }

  async updateWorkOrder(userId: string, id: string, data: any) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.status !== undefined) updates.status = data.status
    if (data.quantity !== undefined) updates.quantity = data.quantity
    if (data.startDate !== undefined) updates.start_date = data.startDate
    if (data.endDate !== undefined) updates.end_date = data.endDate

    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select(WORK_ORDER_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update work order', error)
    
    await this.invalidateWorkOrderCache(userId, id)
    return workOrder
  }

  // ─── Get Work Order by ID ────────────────────────────────────
  async getWorkOrder(userId: string, id: string) {
    const cacheKey = this.getWorkOrderCacheKey(userId, id)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        ${WORK_ORDER_COLUMNS},
        product:products(id, name, unit),
        bom:boms(id, version),
        items:bom_items(*)
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !data) throw new DatabaseError('Work order not found', error)
    
    await memoryCache.set(cacheKey, data, 300)
    return data
  }

  // ─── Complete Work Order — FIXED ────────────────────────────
  async completeWorkOrder(userId: string, id: string) {
    // ۱. گرفتن work order
    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .select('id, product_id, quantity, status')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !workOrder) throw new DatabaseError('Work order not found', error)
    if (workOrder.status === 'completed') {
      throw new DatabaseError('Work order already completed')
    }

    // ✅ FIX: به‌روزرسانی work order
    const { error: updateError } = await supabase
      .from('work_orders')
      .update({ 
        status: 'completed', 
        end_date: new Date().toISOString(), 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .eq('user_id', userId)

    if (updateError) {
      throw new DatabaseError('Failed to update work order', updateError)
    }

    // ✅ FIX: به‌روزرسانی product quantity (با دو کوئری مجزا)
    if (workOrder.product_id && workOrder.quantity) {
      // ۱. گرفتن product فعلی
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('quantity')
        .eq('id', workOrder.product_id)
        .single()

      if (productError) {
        console.error('Failed to fetch product:', productError)
        // ❗ ادامه می‌دهیم چون work order قبلاً completed شده
      } else if (product) {
        // ۲. به‌روزرسانی با مقدار جدید
        const newQuantity = (product.quantity || 0) + workOrder.quantity
        const { error: updateProductError } = await supabase
          .from('products')
          .update({ quantity: newQuantity })
          .eq('id', workOrder.product_id)

        if (updateProductError) {
          console.error('Failed to update product quantity:', updateProductError)
          // ❗ ادامه می‌دهیم چون work order قبلاً completed شده
        }
      }
    }

    // ✅ Invalidate cache
    await this.invalidateWorkOrderCache(userId, id)
    await memoryCache.invalidate(`manufacturing:workorder:${userId}:${id}`)

    return { success: true, workOrderId: id }
  }

  // ─── Get Work Order Statistics ───────────────────────────────
  async getWorkOrderStats(userId: string) {
    const cacheKey = `manufacturing:workorder:stats:${userId}`
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const [plannedResult, inProgressResult, completedResult, cancelledResult] = await Promise.all([
      supabase.from('work_orders').select('id', { count: 'estimated', head: true }).eq('user_id', userId).eq('status', 'planned'),
      supabase.from('work_orders').select('id', { count: 'estimated', head: true }).eq('user_id', userId).eq('status', 'in_progress'),
      supabase.from('work_orders').select('id', { count: 'estimated', head: true }).eq('user_id', userId).eq('status', 'completed'),
      supabase.from('work_orders').select('id', { count: 'estimated', head: true }).eq('user_id', userId).eq('status', 'cancelled'),
    ])

    const result = {
      planned: plannedResult.count || 0,
      inProgress: inProgressResult.count || 0,
      completed: completedResult.count || 0,
      cancelled: cancelledResult.count || 0,
      total: (plannedResult.count || 0) + (inProgressResult.count || 0) + 
             (completedResult.count || 0) + (cancelledResult.count || 0),
    }

    await memoryCache.set(cacheKey, result, 60)
    return result
  }

  // ─── Invalidate Cache ────────────────────────────────────────
  private async invalidateBomCache(userId: string, bomId?: string) {
    await memoryCache.invalidate(this.getBomsCacheKey(userId))
    if (bomId) {
      await memoryCache.invalidate(this.getBomCacheKey(userId, bomId))
    }
  }

  private async invalidateWorkOrderCache(userId: string, workOrderId?: string) {
    await memoryCache.invalidate(this.getWorkOrdersCacheKey(userId))
    await memoryCache.invalidate(`manufacturing:workorder:stats:${userId}`)
    if (workOrderId) {
      await memoryCache.invalidate(this.getWorkOrderCacheKey(userId, workOrderId))
    }
  }
}

export default ManufacturingService