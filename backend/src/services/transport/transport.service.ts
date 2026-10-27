// ============================================
// backend/src/services/transport/transport.service.ts
//
// Transport Service (Options 22-24, Option 16 / Freight, Passenger, Courier, Delivery Notes)
// Lands in: Sales -> Transport Tab
// Money moves only through invoices, payments, and till; driver pay via payroll.
// Enforces workspace_id tenancy boundary on every query.
// ============================================

import { progressCodStage } from '@hisabche/validation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../db'

export class TransportService {
  constructor(private readonly db: SupabaseClient = supabase) {}

  // ─── Freight Trips ──────────────────────────────────────────
  async getFreightTrips(workspaceId: string) {
    const { data, error } = await this.db
      .from('freight_trips')
      .select('*')
      .eq('workspace_id', workspaceId)

    if (error) throw error
    return data ?? []
  }

  async createFreightTrip(
    workspaceId: string,
    input: {
      origin: string
      destination: string
      startDate: string
      vehicleAssetId?: string | undefined
      driverEmployeeId?: string | undefined
    },
  ) {
    const { data, error } = await this.db
      .from('freight_trips')
      .insert({
        workspace_id: workspaceId,
        origin: input.origin,
        destination: input.destination,
        start_date: input.startDate,
        vehicle_asset_id: input.vehicleAssetId ?? null,
        driver_employee_id: input.driverEmployeeId ?? null,
        status: 'planned',
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  // ─── Courier & COD ──────────────────────────────────────────
  async getCourierDeliveries(workspaceId: string) {
    const { data, error } = await this.db
      .from('courier_deliveries')
      .select('*')
      .eq('workspace_id', workspaceId)

    if (error) throw error
    return data ?? []
  }

  async createCourierDelivery(
    workspaceId: string,
    input: {
      trackingNumber: string
      customerName: string
      destinationAddress: string
      codAmountMinor?: number | undefined
      driverEmployeeId?: string | undefined
    },
  ) {
    const { data, error } = await this.db
      .from('courier_deliveries')
      .insert({
        workspace_id: workspaceId,
        tracking_number: input.trackingNumber,
        customer_name: input.customerName,
        destination_address: input.destinationAddress,
        cod_amount_minor: input.codAmountMinor ?? 0,
        cod_stage: 'to_collect',
        driver_employee_id: input.driverEmployeeId ?? null,
        status: 'unassigned',
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async progressCod(workspaceId: string, deliveryId: string) {
    const { data: existing, error: fetchErr } = await this.db
      .from('courier_deliveries')
      .select('cod_stage')
      .eq('workspace_id', workspaceId)
      .eq('id', deliveryId)
      .single()

    if (fetchErr) throw fetchErr

    const nextStage = progressCodStage(existing.cod_stage)

    const { data, error } = await this.db
      .from('courier_deliveries')
      .update({ cod_stage: nextStage })
      .eq('workspace_id', workspaceId)
      .eq('id', deliveryId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // ─── Delivery Notes ─────────────────────────────────────────
  async getDeliveryNotes(workspaceId: string, invoiceId?: string) {
    let query = this.db
      .from('delivery_notes')
      .select('*, lines:delivery_note_lines(*)')
      .eq('workspace_id', workspaceId)

    if (invoiceId) {
      query = query.eq('invoice_id', invoiceId)
    }

    const { data, error } = await query
    if (error) throw error
    return data ?? []
  }

  async createDeliveryNote(
    workspaceId: string,
    input: {
      invoiceId: string
      noteNumber: string
      deliveryDate: string
      carrierNotes?: string | undefined
      lines: Array<{ invoiceLineId: string; productId: string; quantityDelivered: number }>
    },
  ) {
    const { data: note, error: noteErr } = await this.db
      .from('delivery_notes')
      .insert({
        workspace_id: workspaceId,
        invoice_id: input.invoiceId,
        note_number: input.noteNumber,
        delivery_date: input.deliveryDate,
        carrier_notes: input.carrierNotes ?? null,
      })
      .select()
      .single()

    if (noteErr) throw noteErr

    const lines = input.lines.map((l) => ({
      workspace_id: workspaceId,
      delivery_note_id: note.id,
      invoice_line_id: l.invoiceLineId,
      product_id: l.productId,
      quantity_delivered: l.quantityDelivered,
    }))

    const { error: lineErr } = await this.db.from('delivery_note_lines').insert(lines)
    if (lineErr) throw lineErr

    return { ...note, lines }
  }
}
