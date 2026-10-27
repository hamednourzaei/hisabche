// ============================================
// backend/src/services/manufacturing/agriculture.service.ts
//
// Agriculture & Livestock Service (Option 27 / Production)
// Crop cycles, Land parcels, and Livestock count groups.
// Enforces workspace_id tenancy boundary on every query.
// ============================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../db'

export class AgricultureService {
  constructor(private readonly db: SupabaseClient = supabase) {}

  // ─── Crop Cycles ────────────────────────────────────────────
  async getCropCycles(workspaceId: string) {
    const { data, error } = await this.db
      .from('crop_cycles')
      .select('*')
      .eq('workspace_id', workspaceId)

    if (error) throw error
    return data ?? []
  }

  async createCropCycle(
    workspaceId: string,
    input: {
      landUnitId: string
      cropName: string
      plantingDate: string
      expectedHarvestDate?: string | undefined
    },
  ) {
    const { data, error } = await this.db
      .from('crop_cycles')
      .insert({
        workspace_id: workspaceId,
        land_unit_id: input.landUnitId,
        crop_name: input.cropName,
        planting_date: input.plantingDate,
        expected_harvest_date: input.expectedHarvestDate ?? null,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  // ─── Livestock Groups ───────────────────────────────────────
  async getLivestockGroups(workspaceId: string) {
    const { data, error } = await this.db
      .from('livestock_groups')
      .select('*')
      .eq('workspace_id', workspaceId)

    if (error) throw error
    return data ?? []
  }

  async recordLivestockGroup(
    workspaceId: string,
    input: {
      category: string
      headCount: number
      birthOrAcquisitionDate: string
      locationBarn?: string | undefined
    },
  ) {
    const { data, error } = await this.db
      .from('livestock_groups')
      .insert({
        workspace_id: workspaceId,
        category: input.category,
        head_count: input.headCount,
        birth_or_acquisition_date: input.birthOrAcquisitionDate,
        location_barn: input.locationBarn ?? null,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }
}
