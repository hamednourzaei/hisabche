// ============================================
// backend/src/services/manufacturing.service.ts
// ============================================

import { supabase } from '../db'
import { DatabaseError } from '../errors/database.error'

export class ManufacturingService {
  
  // ─── BOMs ──────────────────────────────────────────────
  async listBoms(userId: string) {
    const { data, error } = await supabase
      .from('boms')
      .select(`
        *,
        product:products(name),
        items:bom_items(*, raw_material:products(name, unit))
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new DatabaseError('Failed to fetch BOMs', error)
    return data || []
  }

  // ─── Work Orders ────────────────────────────────────────
  async listWorkOrders(userId: string) {
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        product:products(name),
        bom:boms(version)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new DatabaseError('Failed to fetch work orders', error)
    return data || []
  }
}

export default ManufacturingService