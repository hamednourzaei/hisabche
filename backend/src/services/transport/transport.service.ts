// ============================================
// backend/src/services/transport/transport.service.ts
//
// Transport Service (Options 22-24, Option 16 / Freight, Courier COD, Delivery Notes)
// Lands in: Sales -> Orders -> Delivery View
// Money moves only through invoices, PaymentsService, and till; POD is an append-only event.
// Enforces workspace_id tenancy boundary on every query.
// ============================================

import { FRACTION_DIGITS } from '@hisabche/formatting'
import { progressCodStage, type CodStage } from '@hisabche/validation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../db'
import { ConflictError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { baseCurrencyOf } from '../base-currency'
import { logBusinessEvent } from '../event-log.service'
import { PaymentsService } from '../payments'
import type { TenancyContext } from '../tenancy.service'

const digitsOf = (currency: string): number =>
  (FRACTION_DIGITS as Record<string, number>)[currency] ?? 2

export class TransportService {
  constructor(
    private readonly db: SupabaseClient = supabase,
    private readonly payments: PaymentsService = new PaymentsService(),
  ) {}

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
      .maybeSingle()

    if (fetchErr) throw fetchErr
    if (!existing) throw new NotFoundError('Courier delivery')

    const nextStage = progressCodStage(existing.cod_stage as CodStage)

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

  /** Settles a courier COD delivery through PaymentsService against the linked sales invoice. */
  async settleCourierCod(
    ctx: TenancyContext,
    deliveryId: string,
    input: {
      invoiceId: string
      method?: 'cash' | 'bank' | undefined
      amountMinor?: number | undefined
      notes?: string | undefined
      clientRequestId?: string | null | undefined
    },
  ) {
    const { data: delivery, error: fetchErr } = await this.db
      .from('courier_deliveries')
      .select('id, tracking_number, cod_amount_minor, cod_stage')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', deliveryId)
      .maybeSingle()

    if (fetchErr) throw fetchErr
    if (!delivery) throw new NotFoundError('Courier delivery')
    if (delivery.cod_stage === 'banked') {
      throw new ConflictError('COD_ALREADY_SETTLED')
    }

    const { data: invoice, error: invErr } = await this.db
      .from('invoices')
      .select('id, customer_id, currency')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', input.invoiceId)
      .maybeSingle()

    if (invErr) throw invErr
    if (!invoice) throw new NotFoundError('Invoice')

    const settleMinor = input.amountMinor ?? Number(delivery.cod_amount_minor ?? 0)
    if (!Number.isInteger(settleMinor) || settleMinor <= 0) {
      throw new ValidationError('COD_AMOUNT_REQUIRED')
    }
    const currency = (invoice.currency as string | null) ?? (await baseCurrencyOf(ctx.workspaceId))
    const amountMajor = settleMinor / 10 ** digitsOf(currency)

    const payment = await this.payments.recordPayment(
      ctx,
      {
        direction: 'in',
        partyType: 'customer',
        partyId: (invoice.customer_id as string | null) ?? null,
        amount: amountMajor,
        currency,
        method: input.method ?? 'cash',
        reference: `COD:${delivery.tracking_number}`,
        notes: input.notes ?? `COD settlement for delivery ${delivery.tracking_number}`,
        allocations: [{ invoiceId: invoice.id as string, amount: amountMajor }],
        autoAllocate: false,
      },
      { clientRequestId: input.clientRequestId ?? `cod-settle-${deliveryId}` },
    )

    const { data: updated, error: updErr } = await this.db
      .from('courier_deliveries')
      .update({ cod_stage: 'with_cashier', status: 'delivered' })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', deliveryId)
      .select()
      .single()

    if (updErr) throw updErr

    await logBusinessEvent({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: 'courier_delivery',
      entityId: deliveryId,
      action: 'courier_cod_settled',
      title: `COD settled for ${delivery.tracking_number}`,
      metadata: { invoiceId: input.invoiceId, settleMinor, currency },
      notify: false,
    })

    return { delivery: updated, payment }
  }

  // ─── Delivery Notes & POD ───────────────────────────────────
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

  /** Append-only proof-of-delivery event recorded with acting user and timestamp. */
  async recordDeliveryPod(
    ctx: TenancyContext,
    noteId: string,
    input: { recipientName: string; deliveredAt?: string | undefined; notes?: string | undefined },
  ) {
    const { data: note, error } = await this.db
      .from('delivery_notes')
      .select('id, note_number, invoice_id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', noteId)
      .maybeSingle()

    if (error) throw error
    if (!note) throw new NotFoundError('Delivery note')

    const recordedAt = input.deliveredAt ?? new Date().toISOString()
    await logBusinessEvent({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: 'delivery_note',
      entityId: noteId,
      action: 'delivery_pod_recorded',
      title: `Proof of delivery recorded for ${note.note_number}`,
      metadata: {
        recipientName: input.recipientName,
        recordedAt,
        actorUserId: ctx.userId,
        ...(input.notes ? { notes: input.notes } : {}),
      },
      notify: false,
    })

    return {
      deliveryNoteId: noteId,
      noteNumber: note.note_number,
      recipientName: input.recipientName,
      recordedAt,
      actorUserId: ctx.userId,
      ...(input.notes ? { notes: input.notes } : {}),
    }
  }
}
