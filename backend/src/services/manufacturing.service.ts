// ============================================
// backend/src/services/manufacturing.service.ts
// ============================================

import { supabase } from '../db'
import { 
  CreateBOM, 
  UpdateBOM, 
  CreateWorkOrder, 
  UpdateWorkOrder 
} from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'

export class ManufacturingService {
  // ─── BOM ──────────────────────────────────────────────────
  async listBoms(userId: string, productId?: string) {
    let query = supabase
      .from('boms')
      .select('*, items:bom_items(*)')
      .eq('user_id', userId)

    if (productId) {
      query = query.eq('product_id', productId)
    }

    const { data, error } = await query

    if (error) throw new DatabaseError('Failed to fetch BOMs', error)
    return data || []
  }

  async createBom(userId: string, data: CreateBOM) {
    // ۱. ایجاد BOM
    const { data: bom, error: bomError } = await supabase
      .from('boms')
      .insert({
        product_id: data.productId,
        version: data.version || 1,
        is_active: data.isActive !== false,
        user_id: userId,
      })
      .select()
      .single()

    if (bomError || !bom) {
      throw new DatabaseError('Failed to create BOM', bomError)
    }

    // ۲. ایجاد آیتم‌های BOM
    const items = data.items.map(item => ({
      bom_id: bom.id,
      raw_material_id: item.rawMaterialId,
      quantity: item.quantity,
      unit_cost: item.unitCost || 0,
      user_id: userId,
    }))

    const { error: itemsError } = await supabase
      .from('bom_items')
      .insert(items)

    if (itemsError) {
      // Rollback
      await supabase.from('boms').delete().eq('id', bom.id)
      throw new DatabaseError('Failed to create BOM items', itemsError)
    }

    return this.getBom(bom.id, userId)
  }

  async getBom(id: string, userId: string) {
    const { data, error } = await supabase
      .from('boms')
      .select('*, items:bom_items(*, raw_material:products(*))')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      throw new DatabaseError('BOM not found', error)
    }
    return data
  }

  async updateBom(userId: string, id: string, data: UpdateBOM) {
    // فقط می‌توان isActive را تغییر داد
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.isActive !== undefined) updates.is_active = data.isActive

    const { data: bom, error } = await supabase
      .from('boms')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw new DatabaseError('Failed to update BOM', error)
    return bom
  }

  // ─── Work Orders ──────────────────────────────────────────
  async listWorkOrders(userId: string, status?: string) {
    let query = supabase
      .from('work_orders')
      .select('*, product:products(*), bom:boms(*)')
      .eq('user_id', userId)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw new DatabaseError('Failed to fetch work orders', error)
    return data || []
  }

  async createWorkOrder(userId: string, data: CreateWorkOrder) {
    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .insert({
        product_id: data.productId,
        quantity: data.quantity,
        bom_id: data.bomId,
        status: data.status || 'planned',
        start_date: data.startDate || new Date().toISOString(),
        user_id: userId,
      })
      .select()
      .single()

    if (error) throw new DatabaseError('Failed to create work order', error)
    return workOrder
  }

  async updateWorkOrder(userId: string, id: string, data: UpdateWorkOrder) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.status !== undefined) updates.status = data.status
    if (data.startDate !== undefined) updates.start_date = data.startDate
    if (data.endDate !== undefined) updates.end_date = data.endDate

    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw new DatabaseError('Failed to update work order', error)
    return workOrder
  }

  // ─── Complete Work Order ──────────────────────────────────
  async completeWorkOrder(userId: string, id: string) {
    // ۱. دریافت دستور کار
    const workOrder = await this.getWorkOrder(id, userId)

    if (workOrder.status === 'completed') {
      throw new DatabaseError('Work order already completed')
    }

    // ۲. محاسبه هزینه تولید
    const bom = await this.getBom(workOrder.bom_id, userId)
    const totalCost = bom.items.reduce((sum: number, item: any) => {
      return sum + (item.quantity * item.unit_cost)
    }, 0) * workOrder.quantity

    // ۳. به‌روزرسانی موجودی محصول نهایی
    const { error: stockError } = await supabase
      .from('warehouse_stock')
      .upsert({
        godam_id: 'default',
        product_id: workOrder.product_id,
        quantity: workOrder.quantity,
      }, {
        onConflict: 'godam_id, product_id',
      })

    if (stockError) throw new DatabaseError('Failed to update stock', stockError)

    // ۴. ثبت حرکت موجودی
    const { error: movementError } = await supabase
      .from('stock_movements')
      .insert({
        product_id: workOrder.product_id,
        type: 'in',
        quantity: workOrder.quantity,
        reference_type: 'production',
        reference_id: workOrder.id,
        notes: `Produced ${workOrder.quantity} units`,
        user_id: userId,
      })

    if (movementError) throw new DatabaseError('Failed to record stock movement', movementError)

    // ۵. به‌روزرسانی وضعیت
    const { error: updateError } = await supabase
      .from('work_orders')
      .update({
        status: 'completed',
        end_date: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)

    if (updateError) throw new DatabaseError('Failed to complete work order', updateError)

    return { 
      success: true, 
      workOrderId: id, 
      totalCost 
    }
  }

  async getWorkOrder(id: string, userId: string) {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*, product:products(*), bom:boms(*)')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      throw new DatabaseError('Work order not found', error)
    }
    return data
  }
}