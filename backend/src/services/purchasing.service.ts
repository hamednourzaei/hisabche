// ============================================
// backend/src/services/purchasing.service.ts — Optimized v2.2
// FIXED: PostgrestFilterBuilder → Promise conversion
// ============================================

import { supabase } from '../db'
import { CreatePurchaseOrder, UpdatePurchaseOrder } from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'

// ✅ Column Selection Constants
const PO_LIST_COLUMNS = 'id, supplier_id, order_date, expected_delivery_date, status, notes, received_at, created_at, updated_at'
const PO_MINIMAL = 'id, supplier_id, status, order_date'

const PO_ITEM_COLUMNS = 'id, purchase_order_id, product_id, quantity, unit_price, total_price'
const PO_ITEM_MINIMAL = 'id, product_id, quantity, unit_price'

export class PurchasingService {

  // ─── Cache Keys ──────────────────────────────────────────────
  private getPurchaseOrdersCacheKey(userId: string) {
    return `purchasing:orders:${userId}`
  }

  private getPurchaseOrderCacheKey(userId: string, id: string) {
    return `purchasing:order:${userId}:${id}`
  }

  // ─── List Purchase Orders ────────────────────────────────────
  async listPurchaseOrders(userId: string) {
    const cacheKey = this.getPurchaseOrdersCacheKey(userId)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        ${PO_MINIMAL},
        supplier:suppliers(id, name, phone, email),
        items:purchase_order_items(${PO_ITEM_MINIMAL}, product:products(id, name, unit))
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new DatabaseError('Failed to fetch purchase orders', error)
    
    const result = data || []
    await memoryCache.set(cacheKey, result, 120)
    return result
  }

  // ─── Create Purchase Order ───────────────────────────────────
  async createPurchaseOrder(userId: string, data: CreatePurchaseOrder) {
    const items = data.items || []

    const { data: order, error } = await supabase
      .from('purchase_orders')
      .insert({
        supplier_id: data.supplierId,
        order_date: data.orderDate || new Date().toISOString(),
        expected_delivery_date: data.expectedDeliveryDate || null,
        status: data.status || 'pending',
        notes: data.notes || null,
        user_id: userId,
      })
      .select(PO_LIST_COLUMNS)
      .single()

    if (error || !order) throw new DatabaseError('Failed to create purchase order', error)

    if (items.length > 0) {
      const orderItems = items.map((item: any) => ({
        purchase_order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice || (item.quantity * item.unitPrice),
        user_id: userId,
      }))

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(orderItems)
      
      if (itemsError) {
        await supabase.from('purchase_orders').delete().eq('id', order.id)
        throw new DatabaseError('Failed to create purchase order items', itemsError)
      }
    }

    await this.invalidatePurchaseOrderCache(userId)

    return this.getPurchaseOrder(order.id, userId)
  }

  // ─── Get Purchase Order ──────────────────────────────────────
  async getPurchaseOrder(id: string, userId: string) {
    const cacheKey = this.getPurchaseOrderCacheKey(userId, id)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        ${PO_LIST_COLUMNS},
        supplier:suppliers(id, name, phone, email),
        items:purchase_order_items(${PO_ITEM_COLUMNS}, product:products(id, name, unit))
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !data) throw new DatabaseError('Purchase order not found', error)
    
    await memoryCache.set(cacheKey, data, 300)
    return data
  }

  // ─── Update Purchase Order ───────────────────────────────────
  async updatePurchaseOrder(userId: string, id: string, data: UpdatePurchaseOrder) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.supplierId !== undefined) updates.supplier_id = data.supplierId
    if (data.status !== undefined) updates.status = data.status
    if (data.expectedDeliveryDate !== undefined) updates.expected_delivery_date = data.expectedDeliveryDate
    if (data.notes !== undefined) updates.notes = data.notes

    const { data: order, error } = await supabase
      .from('purchase_orders')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select(PO_LIST_COLUMNS)
      .single()

    if (error || !order) throw new DatabaseError('Failed to update purchase order', error)

    await this.invalidatePurchaseOrderCache(userId, id)
    
    return order
  }

  // ─── Receive Goods — FULLY FIXED ────────────────────────────
  async receiveGoods(userId: string, id: string) {
    const { data: order, error } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        items:purchase_order_items(product_id, quantity)
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !order) throw new DatabaseError('Purchase order not found', error)

    const items = (order as any).items || []
    
    if (items.length === 0) {
      const { data: updated, error: updateError } = await supabase
        .from('purchase_orders')
        .update({ 
          status: 'received', 
          received_at: new Date().toISOString(), 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select(PO_LIST_COLUMNS)
        .single()

      if (updateError || !updated) {
        throw new DatabaseError('Failed to update purchase order status', updateError)
      }

      await this.invalidatePurchaseOrderCache(userId, id)
      return updated
    }

    // ✅ گرفتن همه محصولات با یک کوئری
    const productIds = items.map((item: any) => item.product_id)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, quantity')
      .in('id', productIds)
      .eq('user_id', userId)

    if (productsError) {
      throw new DatabaseError('Failed to fetch products', productsError)
    }

    const productMap = new Map<string, number>()
    for (const product of products || []) {
      productMap.set(product.id, product.quantity || 0)
    }

    // ✅ FIX: استفاده از async IIFE برای تبدیل به Promise
    const updatePromises: Promise<any>[] = []

    for (const item of items) {
      const currentQuantity = productMap.get(item.product_id) || 0
      const newQuantity = currentQuantity + item.quantity
      
      updatePromises.push(
        (async () => {
          const result = await supabase
            .from('products')
            .update({ quantity: newQuantity })
            .eq('id', item.product_id)
            .eq('user_id', userId)
          return result
        })()
      )
    }

    // ✅ به‌روزرسانی status order
    updatePromises.push(
      (async () => {
        const result = await supabase
          .from('purchase_orders')
          .update({ 
            status: 'received', 
            received_at: new Date().toISOString(), 
            updated_at: new Date().toISOString() 
          })
          .eq('id', id)
          .eq('user_id', userId)
        return result
      })()
    )

    // ✅ اجرای همه به‌روزرسانی‌ها به صورت موازی
    const results = await Promise.all(updatePromises)

    for (const result of results) {
      if (result.error) {
        console.error('Receive goods error:', result.error)
        throw new DatabaseError('Failed to receive goods', result.error)
      }
    }

    const { data: updated, error: fetchError } = await supabase
      .from('purchase_orders')
      .select(PO_LIST_COLUMNS)
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchError || !updated) {
      throw new DatabaseError('Failed to fetch updated purchase order', fetchError)
    }

    await this.invalidatePurchaseOrderCache(userId, id)

    return updated
  }

  // ─── Delete Purchase Order ──────────────────────────────────
  async deletePurchaseOrder(userId: string, id: string): Promise<void> {
    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .delete()
      .eq('purchase_order_id', id)

    if (itemsError) {
      throw new DatabaseError('Failed to delete purchase order items', itemsError)
    }

    const { error } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw new DatabaseError('Failed to delete purchase order', error)

    await this.invalidatePurchaseOrderCache(userId, id)
  }

  // ─── Get Purchase Order Stats ────────────────────────────────
  async getPurchaseOrderStats(userId: string) {
    const cacheKey = `purchasing:stats:${userId}`
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const [pendingResult, receivedResult, cancelledResult] = await Promise.all([
      supabase.from('purchase_orders').select('id', { count: 'estimated', head: true }).eq('user_id', userId).eq('status', 'pending'),
      supabase.from('purchase_orders').select('id', { count: 'estimated', head: true }).eq('user_id', userId).eq('status', 'received'),
      supabase.from('purchase_orders').select('id', { count: 'estimated', head: true }).eq('user_id', userId).eq('status', 'cancelled'),
    ])

    const result = {
      pending: pendingResult.count || 0,
      received: receivedResult.count || 0,
      cancelled: cancelledResult.count || 0,
      total: (pendingResult.count || 0) + (receivedResult.count || 0) + (cancelledResult.count || 0),
    }

    await memoryCache.set(cacheKey, result, 60)
    return result
  }

  // ─── Invalidate Cache ────────────────────────────────────────
  private async invalidatePurchaseOrderCache(userId: string, orderId?: string) {
    await memoryCache.invalidate(this.getPurchaseOrdersCacheKey(userId))
    await memoryCache.invalidate(`purchasing:stats:${userId}`)
    if (orderId) {
      await memoryCache.invalidate(this.getPurchaseOrderCacheKey(userId, orderId))
    }
  }
}

export default PurchasingService