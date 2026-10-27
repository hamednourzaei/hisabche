// ============================================
// backend/src/services/sales/warranty.service.ts
//
// Warranty Service (Option 18 / RMA & Warranties)
// Enforces workspace_id tenancy boundary on every query.
// ============================================

import { calculateWarrantyEndDate } from '@hisabche/validation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../db'

export class WarrantyService {
  constructor(private readonly db: SupabaseClient = supabase) {}

  async getWarranties(workspaceId: string) {
    const { data, error } = await this.db
      .from('warranties')
      .select('*')
      .eq('workspace_id', workspaceId)

    if (error) throw error
    return data ?? []
  }

  async registerWarranty(
    workspaceId: string,
    input: {
      invoiceId: string
      productId: string
      serialNumber?: string | undefined
      startDate: string
      warrantyMonths: number
      customerId?: string | undefined
    },
  ) {
    const endDate = calculateWarrantyEndDate(input.startDate, input.warrantyMonths)

    const { data, error } = await this.db
      .from('warranties')
      .insert({
        workspace_id: workspaceId,
        invoice_id: input.invoiceId,
        product_id: input.productId,
        serial_number: input.serialNumber ?? null,
        start_date: input.startDate,
        end_date: endDate,
        warranty_months: input.warrantyMonths,
        customer_id: input.customerId ?? null,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }
}
