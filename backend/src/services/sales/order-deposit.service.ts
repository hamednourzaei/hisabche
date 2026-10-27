// ============================================
// backend/src/services/sales/order-deposit.service.ts
//
// Order Deposits Service (Made-to-order & Sales Order Pre-payments)
// Enforces workspace_id tenancy boundary on every query.
// ============================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../db'

export class OrderDepositService {
  constructor(private readonly db: SupabaseClient = supabase) {}

  async getOrderDeposits(workspaceId: string, orderId: string) {
    const { data, error } = await this.db
      .from('order_deposits')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('order_id', orderId)

    if (error) throw error
    return data ?? []
  }

  async createOrderDeposit(
    workspaceId: string,
    input: {
      orderId: string
      customerId: string
      amountMinor: number
      paymentMethod?: string | undefined
    },
  ) {
    const { data, error } = await this.db
      .from('order_deposits')
      .insert({
        workspace_id: workspaceId,
        order_id: input.orderId,
        customer_id: input.customerId,
        amount_minor: input.amountMinor,
        payment_method: input.paymentMethod ?? 'cash',
      })
      .select()
      .single()

    if (error) throw error
    return data
  }
}
