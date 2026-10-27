// ============================================
// backend/src/services/pricing/metal-rates.service.ts
//
// Metal Rates Service (Option 21 / Gold & Jewellery)
// Enforces workspace_id tenancy boundary on every query.
// ============================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../db'

export class MetalRatesService {
  constructor(private readonly db: SupabaseClient = supabase) {}

  async getLatestMetalRate(workspaceId: string) {
    const { data, error } = await this.db
      .from('metal_rates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('rate_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data
  }

  async recordMetalRate(
    workspaceId: string,
    input: {
      rateDate: string
      rate24kMinorPerGram: number
    },
  ) {
    const { data, error } = await this.db
      .from('metal_rates')
      .insert({
        workspace_id: workspaceId,
        rate_date: input.rateDate,
        rate_24k_minor_per_gram: input.rate24kMinorPerGram,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }
}
