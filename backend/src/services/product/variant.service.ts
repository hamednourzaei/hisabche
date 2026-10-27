// ============================================
// backend/src/services/product/variant.service.ts
//
// Product Variants Service (G-05 / Option 11)
// Manages template products and variant rows with attributes and pricing overrides.
// Enforces workspace_id tenancy boundary on every query.
// ============================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../db'

export class VariantService {
  constructor(private readonly db: SupabaseClient = supabase) {}

  async getVariants(workspaceId: string, templateProductId: string) {
    const { data, error } = await this.db
      .from('product_variants')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('template_product_id', templateProductId)
      .eq('is_active', true)

    if (error) throw error
    return data ?? []
  }

  async createVariant(
    workspaceId: string,
    input: {
      templateProductId: string
      sku: string
      barcode?: string | undefined
      attributes: Array<{ name: string; value: string }>
      priceOverrideMinor?: number | undefined
      costOverrideMinor?: number | undefined
    },
  ) {
    const { data, error } = await this.db
      .from('product_variants')
      .insert({
        workspace_id: workspaceId,
        template_product_id: input.templateProductId,
        sku: input.sku,
        barcode: input.barcode ?? null,
        attributes: input.attributes,
        price_override_minor: input.priceOverrideMinor ?? null,
        cost_override_minor: input.costOverrideMinor ?? null,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }
}
