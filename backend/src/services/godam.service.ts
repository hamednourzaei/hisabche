// ============================================
// backend/src/services/godam.service.ts
// ============================================

import { supabase } from '../db'
import { 
  CreateGodam, 
  UpdateGodam, 
  StockTransfer 
} from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'

export class GodamService {
  // ─── List Godams ──────────────────────────────────────────
  async listGodams(userId: string) {
    const { data, error } = await supabase
      .from('godams')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new DatabaseError('Failed to fetch godams', error)
    return data || []
  }

  // ─── Create Godam ────────────────────────────────────────
  async createGodam(userId: string, data: CreateGodam) {
    const { data: godam, error } = await supabase
      .from('godams')
      .insert({
        name: data.name,
        location: data.location || '',
        is_active: data.isActive !== false,
        user_id: userId,
      })
      .select()
      .single()

    if (error) throw new DatabaseError('Failed to create godam', error)
    return godam
  }

  // ─── Update Godam ────────────────────────────────────────
  async updateGodam(userId: string, id: string, data: UpdateGodam) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.name !== undefined) updates.name = data.name
    if (data.location !== undefined) updates.location = data.location
    if (data.isActive !== undefined) updates.is_active = data.isActive

    const { data: godam, error } = await supabase
      .from('godams')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw new DatabaseError('Failed to update godam', error)
    return godam
  }

  // ─── Delete Godam (soft delete) ──────────────────────────
  async deleteGodam(userId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('godams')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw new DatabaseError('Failed to delete godam', error)
  }

  // ─── Stock Transfer (بین گدام‌ها) ───────────────────────
  async transferStock(userId: string, data: StockTransfer) {
    // ۱. بررسی موجودی در گدام مبدأ
    const { data: fromStock, error: fromError } = await supabase
      .from('warehouse_stock')
      .select('quantity')
      .eq('godam_id', data.fromGodamId)
      .eq('product_id', data.productId)
      .single()

    if (fromError || !fromStock || fromStock.quantity < data.quantity) {
      throw new DatabaseError('Insufficient stock in source godam')
    }

    // ۲. کاهش موجودی از گدام مبدأ
    const { error: deductError } = await supabase
      .from('warehouse_stock')
      .update({ quantity: fromStock.quantity - data.quantity })
      .eq('godam_id', data.fromGodamId)
      .eq('product_id', data.productId)

    if (deductError) throw new DatabaseError('Failed to deduct stock', deductError)

    // ۳. افزایش موجودی در گدام مقصد (یا ایجاد رکورد جدید)
    const { data: toStock } = await supabase
      .from('warehouse_stock')
      .select('quantity')
      .eq('godam_id', data.toGodamId)
      .eq('product_id', data.productId)
      .single()

    if (toStock) {
      // اگر موجود است، افزایش بده
      const { error: addError } = await supabase
        .from('warehouse_stock')
        .update({ quantity: toStock.quantity + data.quantity })
        .eq('godam_id', data.toGodamId)
        .eq('product_id', data.productId)

      if (addError) throw new DatabaseError('Failed to add stock', addError)
    } else {
      // اگر نیست، ایجاد کن
      const { error: insertError } = await supabase
        .from('warehouse_stock')
        .insert({
          godam_id: data.toGodamId,
          product_id: data.productId,
          quantity: data.quantity,
          user_id: userId,
        })

      if (insertError) throw new DatabaseError('Failed to create stock record', insertError)
    }

    // ۴. ثبت حرکت موجودی در stock_movements
    const { error: movementError } = await supabase
      .from('stock_movements')
      .insert({
        product_id: data.productId,
        type: 'transfer',
        quantity: data.quantity,
        from_godam_id: data.fromGodamId,
        to_godam_id: data.toGodamId,
        notes: data.notes || '',
        user_id: userId,
        reference_type: 'transfer',
      })

    if (movementError) throw new DatabaseError('Failed to record stock movement', movementError)

    return { success: true, transferred: data.quantity }
  }

  // ─── Get Stock by Godam ──────────────────────────────────
  async getStockByGodam(userId: string, godamId: string) {
    const { data, error } = await supabase
      .from('warehouse_stock')
      .select(`
        *,
        product:products(*)
      `)
      .eq('godam_id', godamId)
      .eq('user_id', userId)

    if (error) throw new DatabaseError('Failed to fetch stock', error)
    return data || []
  }
}