// ============================================
// backend/src/services/purchasing.service.ts
// ============================================

import { supabase } from '../db'
import {
  CreatePurchaseOrder,
  UpdatePurchaseOrder,
} from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'

export class PurchasingService {
  
  async listPurchaseOrders(userId: string) {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        supplier:suppliers(name, phone, email),
        items:purchase_order_items(
          *,
          product:products(name, unit)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new DatabaseError('Failed to fetch purchase orders', error)
    return data || []
  }

  async createPurchaseOrder(userId: string, data: CreatePurchaseOrder) {
    const items = data.items || []
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.totalPrice || item.quantity * item.unitPrice), 0)
    const total = subtotal

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
      .select()
      .single()

    if (error || !order) {
      throw new DatabaseError('Failed to create purchase order', error)
    }

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

    return this.getPurchaseOrder(order.id, userId)
  }

  async getPurchaseOrder(id: string, userId: string) {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        supplier:suppliers(name, phone, email),
        items:purchase_order_items(
          *,
          product:products(name, unit)
        )
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      throw new DatabaseError('Purchase order not found', error)
    }
    return data
  }

  async updatePurchaseOrder(userId: string, id: string, data: UpdatePurchaseOrder) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    
    if (data.supplierId !== undefined) updates.supplier_id = data.supplierId
    if (data.status !== undefined) updates.status = data.status
    if (data.expectedDeliveryDate !== undefined) {
      updates.expected_delivery_date = data.expectedDeliveryDate
    }
    if (data.notes !== undefined) updates.notes = data.notes

    const { data: order, error } = await supabase
      .from('purchase_orders')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error || !order) {
      throw new DatabaseError('Failed to update purchase order', error)
    }
    return order
  }

  async receiveGoods(userId: string, id: string) {
    const { data: order, error } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        items:purchase_order_items(
          product_id,
          quantity
        )
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !order) {
      throw new DatabaseError('Purchase order not found', error)
    }

    for (const item of order.items || []) {
      const { data: product } = await supabase
        .from('products')
        .select('quantity')
        .eq('id', item.product_id)
        .eq('user_id', userId)
        .single()

      if (product) {
        const newQuantity = (product.quantity || 0) + item.quantity
        await supabase
          .from('products')
          .update({ quantity: newQuantity })
          .eq('id', item.product_id)
          .eq('user_id', userId)
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        status: 'received',
        received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError || !updated) {
      throw new DatabaseError('Failed to update purchase order status', updateError)
    }

    return updated
  }
}

export default PurchasingService