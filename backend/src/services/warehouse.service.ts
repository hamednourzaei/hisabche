// backend/src/services/warehouse.service.ts
// ============================================

import { supabase } from '../db'
import {
  createwarehouseSchema,
  updatewarehouseSchema,
  stockTransferSchema,
} from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'

type createWarehouse = any
type updateWarehouse = any

export class WarehouseService {
  // ─── List warehouses ─── بهینه‌شده: فقط ستون‌های ضروری
  async listwarehouses(userId: string) {
    const { data, error } = await supabase
      .from('warehouses')
      .select('id, name, location, is_active, created_at') // ✅ فقط ۵ ستون
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new DatabaseError('Failed to fetch warehouses', error)
    return data || []
  }

  // ─── Create warehouse ─── بدون تغییر (از .select() پیش‌فرض استفاده می‌کند)
  async createWarehouse(userId: string, data: createWarehouse) {
    const { data: warehouse, error } = await supabase
      .from('warehouses')
      .insert({
        name: data.name,
        location: data.location || '',
        is_active: data.isActive !== false,
        user_id: userId,
      })
      .select('id, name, location, is_active, created_at') // ✅ فقط ستون‌های لازم
      .single()

    if (error) throw new DatabaseError('Failed to create warehouse', error)
    return warehouse
  }

  // ─── Update warehouse ───
  async updateWarehouse(userId: string, id: string, data: updateWarehouse) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.name !== undefined) updates.name = data.name
    if (data.location !== undefined) updates.location = data.location
    if (data.isActive !== undefined) updates.is_active = data.isActive

    const { data: warehouse, error } = await supabase
      .from('warehouses')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select('id, name, location, is_active, created_at, updated_at') // ✅
      .single()

    if (error) throw new DatabaseError('Failed to update warehouse', error)
    return warehouse
  }

  // ─── Delete warehouse (soft delete) ─── بدون select
  async deleteWarehouse(userId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('warehouses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw new DatabaseError('Failed to delete warehouse', error)
  }

  // ─── Stock Transfer ───
  async transferStock(userId: string, data: any) {
    const { data: fromStock, error: fromError } = await supabase
      .from('warehouse_stock')
      .select('quantity') // ✅ فقط quantity
      .eq('warehouse_id', data.fromWarehouseId)
      .eq('product_id', data.productId)
      .single()

    if (fromError || !fromStock || fromStock.quantity < data.quantity) {
      throw new DatabaseError('Insufficient stock in source warehouse')
    }

    const { error: deductError } = await supabase
      .from('warehouse_stock')
      .update({ quantity: fromStock.quantity - data.quantity })
      .eq('warehouse_id', data.fromWarehouseId)
      .eq('product_id', data.productId)

    if (deductError) throw new DatabaseError('Failed to deduct stock', deductError)

    const { data: toStock } = await supabase
      .from('warehouse_stock')
      .select('quantity') // ✅ فقط quantity
      .eq('warehouse_id', data.toWarehouseId)
      .eq('product_id', data.productId)
      .single()

    if (toStock) {
      const { error: addError } = await supabase
        .from('warehouse_stock')
        .update({ quantity: toStock.quantity + data.quantity })
        .eq('warehouse_id', data.toWarehouseId)
        .eq('product_id', data.productId)

      if (addError) throw new DatabaseError('Failed to add stock', addError)
    } else {
      const { error: insertError } = await supabase
        .from('warehouse_stock')
        .insert({
          warehouse_id: data.toWarehouseId,
          product_id: data.productId,
          quantity: data.quantity,
          user_id: userId,
        })

      if (insertError) throw new DatabaseError('Failed to create stock record', insertError)
    }

    const { error: movementError } = await supabase
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

    if (movementError) throw new DatabaseError('Failed to record stock movement', movementError)

    return { success: true, transferred: data.quantity }
  }

  // ─── Get Stock by warehouse ─── بهینه‌شده
  async getStockByWarehouse(userId: string, warehouseId: string) {
    const { data, error } = await supabase
      .from('warehouse_stock')
      .select(`
        quantity,
        product:products(id, name, sku, sell_price, quantity, unit)
      `) // ✅ فقط ستون‌های ضروری از products
      .eq('warehouse_id', warehouseId)
      .eq('user_id', userId)

    if (error) throw new DatabaseError('Failed to fetch stock', error)
    return data || []
  }
}