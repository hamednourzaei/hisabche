// ============================================
// backend/src/services/inventory/fitment.service.ts
//
// Automotive Fitment & Vehicle Attributes Service (Option 25 / Dealerships)
// - Fitments: auto make/model/year compatibility rows
// - Vehicle Attributes: linked to existing stock_serials
// Enforces workspace_id tenancy boundary on every query.
// ============================================

import { validateVin } from '@hisabche/validation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../db'

export class FitmentService {
  constructor(private readonly db: SupabaseClient = supabase) {}

  // ─── Fitments ───────────────────────────────────────────────
  async getFitments(workspaceId: string, productId: string) {
    const { data, error } = await this.db
      .from('auto_fitments')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('product_id', productId)

    if (error) throw error
    return data ?? []
  }

  async addFitment(
    workspaceId: string,
    input: {
      productId: string
      make: string
      model: string
      yearStart: number
      yearEnd: number
      notes?: string | undefined
    },
  ) {
    const { data, error } = await this.db
      .from('auto_fitments')
      .insert({
        workspace_id: workspaceId,
        product_id: input.productId,
        make: input.make,
        model: input.model,
        year_start: input.yearStart,
        year_end: input.yearEnd,
        notes: input.notes ?? null,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  // ─── Vehicle Attributes (linked to stock_serials) ───────────
  async getVehicles(workspaceId: string) {
    const { data, error } = await this.db
      .from('vehicle_attributes')
      .select('*, serial:stock_serials(*)')
      .eq('workspace_id', workspaceId)

    if (error) throw error
    return data ?? []
  }

  async createVehicle(
    workspaceId: string,
    input: {
      productId: string
      vin: string
      make: string
      model: string
      year: number
      colour: string
      odometer: number
      receivedDate: string
      basePurchaseCostMinor: number
    },
  ) {
    if (!validateVin(input.vin)) {
      throw new Error('INVALID_VIN')
    }

    // 1. Ensure serial exists in stock_serials
    const { data: serial, error: serialErr } = await this.db
      .from('stock_serials')
      .insert({
        workspace_id: workspaceId,
        product_id: input.productId,
        serial_number: input.vin.toUpperCase(),
        unit_cost_minor: input.basePurchaseCostMinor,
        received_on: input.receivedDate,
        status: 'in_stock',
      })
      .select()
      .single()

    if (serialErr && serialErr.code !== '23505') throw serialErr

    const serialId = serial?.id

    // 2. Insert vehicle attributes
    const { data, error } = await this.db
      .from('vehicle_attributes')
      .insert({
        workspace_id: workspaceId,
        serial_id: serialId,
        make: input.make,
        model: input.model,
        year: input.year,
        colour: input.colour,
        odometer: input.odometer,
      })
      .select()
      .single()

    if (error) throw error
    return {
      ...data,
      vin: input.vin.toUpperCase(),
      productId: input.productId,
      receivedDate: input.receivedDate,
      basePurchaseCostMinor: input.basePurchaseCostMinor,
    }
  }
}
