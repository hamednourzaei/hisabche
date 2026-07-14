// ============================================
// backend/src/services/manufacturing.service.ts — Optimized v2.0
// ============================================

import { supabase } from '../db'
import { DatabaseError } from '../errors/database.error'

// ✅ Column Selection Constants
const BOM_LIST_COLUMNS = 'id, product_id, version, is_active, created_at, updated_at'
const BOM_ITEM_COLUMNS = 'id, bom_id, raw_material_id, quantity, unit_cost'
const WORK_ORDER_COLUMNS = 'id, product_id, quantity, bom_id, status, start_date, end_date, created_at, updated_at'

export class ManufacturingService {

  // ─── BOMs ─────────────────────────────────────────────────
  async listBoms(userId: string, productId?: string) {
    let query = supabase
      .from('boms')
      .select(`
        ${BOM_LIST_COLUMNS},
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
    return data || []
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

    // Insert BOM items if provided
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

    // Update items if provided
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

    return bom
  }

  // ─── Work Orders ──────────────────────────────────────────
  async listWorkOrders(userId: string, status?: string) {
    let query = supabase
      .from('work_orders')
      .select(`
        ${WORK_ORDER_COLUMNS},
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
    return data || []
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
    return workOrder
  }

  async completeWorkOrder(userId: string, id: string) {
    // Get work order details
    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .select('id, product_id, quantity, status')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !workOrder) throw new DatabaseError('Work order not found', error)
    if (workOrder.status === 'completed') throw new DatabaseError('Work order already completed')

    // Update work order status
    const { error: updateError } = await supabase
      .from('work_orders')
      .update({ status: 'completed', end_date: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)

    if (updateError) throw new DatabaseError('Failed to complete work order', updateError)

    // Update product quantity (add manufactured items to inventory)
    if (workOrder.product_id && workOrder.quantity) {
      const { data: product } = await supabase
        .from('products')
        .select('quantity')
        .eq('id', workOrder.product_id)
        .single()

      if (product) {
        await supabase
          .from('products')
          .update({ quantity: product.quantity + workOrder.quantity })
          .eq('id', workOrder.product_id)
      }
    }

    return { success: true, workOrderId: id }
  }
}

export default ManufacturingService