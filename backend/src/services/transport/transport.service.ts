// ============================================
// backend/src/services/transport/transport.service.ts
//
// Transport Service (Options 22-24, Option 16 / Freight, Courier COD, Delivery Notes)
// Lands in: Sales -> Orders -> Delivery View
// Money moves only through invoices, PaymentsService, and till; POD is an append-only event.
// Enforces workspace_id tenancy boundary on every query.
// ============================================

import { FRACTION_DIGITS } from '@hisabche/formatting'
import {
  decideDeliveryAttempt,
  dispatchIssues,
  progressCodStage,
  vehicleServiceState,
  type CodStage,
  type CourierDeliverySnapshot,
  type DeliveryPodCapture,
  type DeliveryPodMethod,
  type DeliveryStatus,
} from '@hisabche/validation'
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
      .select('id, tracking_number, cod_amount_minor, cod_collected_minor, cod_stage, status')
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

    // WP-19: the cashier settles WHAT THE DRIVER HANDED IN, not the amount that
    // was due. A COD shortfall stays on the invoice as an unpaid balance — that
    // is the receivable — and is never zeroed by settling the rest.
    const codDue = Number(delivery.cod_amount_minor ?? 0)
    const collectedAtDoor =
      delivery.cod_collected_minor === null || delivery.cod_collected_minor === undefined
        ? codDue
        : Number(delivery.cod_collected_minor)
    const settleMinor = input.amountMinor ?? collectedAtDoor
    if (!Number.isInteger(settleMinor) || settleMinor <= 0) {
      throw new ValidationError('COD_AMOUNT_REQUIRED')
    }
    if (settleMinor > codDue) {
      throw new ValidationError('COD_COLLECTED_EXCEEDS_DUE')
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
      .update({
        cod_stage: 'with_cashier',
        cod_collected_minor: settleMinor,
        cod_shortfall_minor: codDue - settleMinor,
        cod_settled_at: new Date().toISOString(),
        // `status` is NOT touched here. A parcel is «delivered» when somebody
        // recorded a proof of delivery, and only then (WP-19).
      })
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

  /**
   * Proof of delivery on a customer-facing delivery note (WP-19).
   *
   * The note now carries the proof as columns instead of leaving it in the event
   * log: a signature, a photo reference or the code the customer read out, plus
   * who took the parcel and when. The rule is the same one the courier path runs
   * (`decideDeliveryAttempt`), so a note cannot be «signed» by nobody.
   */
  async recordDeliveryPod(
    ctx: TenancyContext,
    noteId: string,
    input: {
      method: DeliveryPodMethod
      recipientName: string
      code?: string | undefined
      photoRef?: string | undefined
      deliveredAt?: string | undefined
      notes?: string | undefined
    },
  ) {
    const { data: note, error } = await this.db
      .from('delivery_notes')
      .select('id, note_number, invoice_id, pod_code, pod_recorded_at')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', noteId)
      .maybeSingle()

    if (error) throw error
    if (!note) throw new NotFoundError('Delivery note')

    const snapshot: CourierDeliverySnapshot = {
      // A note with a proof already recorded is closed: the same rule that
      // refuses to close a parcel twice refuses to sign a note twice.
      status: note.pod_recorded_at ? 'delivered' : 'assigned',
      codStage: 'to_collect',
      codAmountMinor: 0,
      podCode: (note.pod_code as string | null) ?? null,
    }

    const decision = decideDeliveryAttempt(
      snapshot,
      {
        outcome: 'delivered',
        pod: {
          method: input.method,
          recipientName: input.recipientName,
          code: input.code ?? null,
          photoRef: input.photoRef ?? null,
          notes: input.notes ?? null,
          capturedAt: input.deliveredAt ?? null,
        },
        collectedMinor: 0,
      },
      new Date().toISOString(),
    )

    if (!decision.ok) throw new ValidationError(decision.issues[0]!)

    const recordedAt = decision.close.deliveredAt ?? new Date().toISOString()
    const { data: updated, error: updErr } = await this.db
      .from('delivery_notes')
      .update({
        pod_method: decision.close.pod?.method ?? null,
        pod_recipient_name: decision.close.pod?.recipientName ?? null,
        pod_photo_ref: decision.close.pod?.photoRef ?? null,
        pod_recorded_at: recordedAt,
        pod_actor_user_id: ctx.userId,
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', noteId)
      .select()
      .single()

    if (updErr) throw updErr

    await logBusinessEvent({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: 'delivery_note',
      entityId: noteId,
      action: 'delivery_pod_recorded',
      title: `Proof of delivery recorded for ${note.note_number}`,
      metadata: {
        method: decision.close.pod?.method,
        recipientName: decision.close.pod?.recipientName,
        recordedAt,
        actorUserId: ctx.userId,
        ...(decision.close.pod?.photoRef ? { photoRef: decision.close.pod.photoRef } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
      },
      notify: false,
    })

    return {
      deliveryNoteId: noteId,
      noteNumber: note.note_number,
      recipientName: decision.close.pod?.recipientName,
      method: decision.close.pod?.method,
      photoRef: decision.close.pod?.photoRef ?? null,
      recordedAt,
      actorUserId: ctx.userId,
      ...(input.notes ? { notes: input.notes } : {}),
      deliveryNote: updated,
    }
  }

  // ─── Fleet & Dispatch (WP-19) ───────────────────────────────

  /**
   * The fleet register, with what each vehicle may take on `onDate`.
   *
   * `service_state` is `unknown` for a vehicle nobody has serviced: «no record»
   * is reported as such and is never shown as «fine».
   */
  async getDeliveryFleet(workspaceId: string, onDate: string) {
    const [vehicles, assigned] = await Promise.all([
      this.db.from('delivery_vehicles').select('*').eq('workspace_id', workspaceId).order('name'),
      this.db
        .from('courier_deliveries')
        .select('vehicle_id')
        .eq('workspace_id', workspaceId)
        .eq('planned_on', onDate)
        .in('status', ['assigned', 'picked_up']),
    ])

    if (vehicles.error) throw vehicles.error
    if (assigned.error) throw assigned.error

    const assignedByVehicle = new Map<string, number>()
    for (const row of assigned.data ?? []) {
      const vehicleId = row.vehicle_id as string | null
      if (!vehicleId) continue
      assignedByVehicle.set(vehicleId, (assignedByVehicle.get(vehicleId) ?? 0) + 1)
    }

    return (vehicles.data ?? []).map((vehicle) => ({
      ...vehicle,
      service_state: vehicleServiceState(
        (vehicle.next_service_due_on as string | null) ?? null,
        onDate,
      ),
      assigned_on_date: assignedByVehicle.get(vehicle.id as string) ?? 0,
    }))
  }

  async createDeliveryVehicle(
    ctx: TenancyContext,
    input: {
      name: string
      plateNumber?: string | undefined
      assetId?: string | undefined
      capacityParcels?: number | undefined
      nextServiceDueOn?: string | undefined
      odometerKm?: number | undefined
      notes?: string | undefined
    },
  ) {
    const { data, error } = await this.db
      .from('delivery_vehicles')
      .insert({
        workspace_id: ctx.workspaceId,
        name: input.name,
        plate_number: input.plateNumber ?? null,
        asset_id: input.assetId ?? null,
        // Absent capacity stays NULL: «not declared», which the dispatcher is
        // told, rather than 0 or a made-up number.
        capacity_parcels: input.capacityParcels ?? null,
        next_service_due_on: input.nextServiceDueOn ?? null,
        odometer_km: input.odometerKm ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single()

    if (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictError('VEHICLE_PLATE_TAKEN')
      }
      throw error
    }

    return data
  }

  /**
   * A periodic service happened. The vehicle's next due date moves; the history
   * of services stays in the business event log.
   */
  async recordVehicleService(
    ctx: TenancyContext,
    vehicleId: string,
    input: {
      serviceOn: string
      nextServiceDueOn?: string | undefined
      odometerKm?: number | undefined
      notes?: string | undefined
    },
  ) {
    const { data: vehicle, error } = await this.db
      .from('delivery_vehicles')
      .select('id, name, next_service_due_on, odometer_km')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', vehicleId)
      .maybeSingle()

    if (error) throw error
    if (!vehicle) throw new NotFoundError('Delivery vehicle')

    if (input.nextServiceDueOn && input.nextServiceDueOn < input.serviceOn) {
      // A service that is already overdue the day it was done is a typo, not a
      // plan: refuse it instead of dispatching on a date nobody meant.
      throw new ValidationError('SERVICE_DUE_BEFORE_SERVICE')
    }
    if (
      input.odometerKm !== undefined &&
      typeof vehicle.odometer_km === 'number' &&
      input.odometerKm < vehicle.odometer_km
    ) {
      // An odometer does not run backwards.
      throw new ValidationError('ODOMETER_BACKWARDS')
    }

    const { data: updated, error: updErr } = await this.db
      .from('delivery_vehicles')
      .update({
        last_service_on: input.serviceOn,
        ...(input.nextServiceDueOn ? { next_service_due_on: input.nextServiceDueOn } : {}),
        ...(input.odometerKm !== undefined ? { odometer_km: input.odometerKm } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', vehicleId)
      .select()
      .single()

    if (updErr) throw updErr

    await logBusinessEvent({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: 'delivery_vehicle',
      entityId: vehicleId,
      action: 'delivery_vehicle_serviced',
      title: `Service recorded for ${vehicle.name}`,
      metadata: {
        serviceOn: input.serviceOn,
        nextServiceDueOn: input.nextServiceDueOn ?? null,
        odometerKm: input.odometerKm ?? null,
        notes: input.notes ?? null,
      },
      notify: false,
    })

    return updated
  }

  /**
   * Put a parcel on a vehicle for a day.
   *
   * Refused when the vehicle is out of service, overloaded for that day, or
   * retired — the reasons are the shared `dispatchIssues`, so the phone refuses
   * exactly what the server refuses.
   */
  async assignCourierDelivery(
    ctx: TenancyContext,
    deliveryId: string,
    input: {
      vehicleId?: string | undefined
      driverEmployeeId?: string | undefined
      plannedOn: string
    },
  ) {
    const { data: delivery, error } = await this.db
      .from('courier_deliveries')
      .select('id, tracking_number, status')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', deliveryId)
      .maybeSingle()

    if (error) throw error
    if (!delivery) throw new NotFoundError('Courier delivery')

    const status = delivery.status as DeliveryStatus
    if (status === 'delivered' || status === 'returned') {
      throw new ConflictError('DELIVERY_ALREADY_CLOSED')
    }

    if (input.vehicleId) {
      const { data: vehicle, error: vehErr } = await this.db
        .from('delivery_vehicles')
        .select('id, active, capacity_parcels, next_service_due_on')
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', input.vehicleId)
        .maybeSingle()

      if (vehErr) throw vehErr
      if (!vehicle) throw new NotFoundError('Delivery vehicle')

      const { data: others, error: countErr } = await this.db
        .from('courier_deliveries')
        .select('id')
        .eq('workspace_id', ctx.workspaceId)
        .eq('vehicle_id', input.vehicleId)
        .eq('planned_on', input.plannedOn)
        .in('status', ['assigned', 'picked_up'])
        .neq('id', deliveryId)

      if (countErr) throw countErr

      const issues = dispatchIssues({
        vehicle: {
          active: vehicle.active === true,
          capacityParcels:
            vehicle.capacity_parcels === null || vehicle.capacity_parcels === undefined
              ? null
              : Number(vehicle.capacity_parcels),
          nextServiceDueOn: (vehicle.next_service_due_on as string | null) ?? null,
        },
        assignedOnDate: others?.length ?? 0,
        asOf: input.plannedOn,
      })

      if (issues.length > 0) throw new ValidationError(issues[0]!)
    }

    const { data: updated, error: updErr } = await this.db
      .from('courier_deliveries')
      .update({
        vehicle_id: input.vehicleId ?? null,
        driver_employee_id: input.driverEmployeeId ?? null,
        planned_on: input.plannedOn,
        // A parcel that is already on the road stays on the road; assigning it
        // again only changes who carries it.
        status: status === 'picked_up' ? 'picked_up' : 'assigned',
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', deliveryId)
      .select()
      .single()

    if (updErr) throw updErr
    return updated
  }

  /**
   * Close an attempt at the door: either the customer took the parcel (with a
   * proof), or the attempt failed (with a reason and nothing else).
   *
   * `clientRequestId` makes this exactly-once: the device's outbox retries the
   * same close until the server answers, and the second call returns the first
   * row instead of writing another attempt.
   */
  async closeCourierDelivery(
    ctx: TenancyContext,
    deliveryId: string,
    input:
      | {
          outcome: 'delivered'
          pod: DeliveryPodCapture
          collectedMinor?: number | undefined
          clientRequestId?: string | null | undefined
        }
      | {
          outcome: 'failed'
          failureReason: string
          clientRequestId?: string | null | undefined
        },
  ) {
    const requestKey = input.clientRequestId ?? `close-${deliveryId}`

    const { data: already, error: alreadyErr } = await this.db
      .from('courier_deliveries')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('client_request_id', requestKey)
      .maybeSingle()

    if (alreadyErr) throw alreadyErr
    if (already) return already

    const { data: delivery, error } = await this.db
      .from('courier_deliveries')
      .select(
        'id, tracking_number, status, cod_stage, cod_amount_minor, cod_collected_minor, pod_code, attempt_count, vehicle_id, planned_on',
      )
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', deliveryId)
      .maybeSingle()

    if (error) throw error
    if (!delivery) throw new NotFoundError('Courier delivery')

    const snapshot: CourierDeliverySnapshot = {
      status: delivery.status as DeliveryStatus,
      codStage: delivery.cod_stage as CodStage,
      codAmountMinor: Number(delivery.cod_amount_minor ?? 0),
      podCode: (delivery.pod_code as string | null) ?? null,
    }

    const now = new Date().toISOString()
    const decision =
      input.outcome === 'delivered'
        ? decideDeliveryAttempt(
            snapshot,
            {
              outcome: 'delivered',
              pod: input.pod,
              collectedMinor: input.collectedMinor,
            },
            now,
          )
        : decideDeliveryAttempt(
            snapshot,
            { outcome: 'failed', failureReason: input.failureReason },
            now,
          )

    if (!decision.ok) throw new ValidationError(decision.issues[0]!)

    const close = decision.close
    const { data: updated, error: updErr } = await this.db
      .from('courier_deliveries')
      .update({
        status: close.status,
        cod_stage: close.codStage,
        delivery_timestamp: close.deliveredAt,
        pod_method: close.pod?.method ?? null,
        pod_recipient_name: close.pod?.recipientName ?? null,
        pod_photo_ref: close.pod?.photoRef ?? null,
        pod_recorded_at: close.pod ? now : null,
        pod_actor_user_id: close.pod ? ctx.userId : null,
        failure_reason: close.failureReason,
        cod_collected_minor: close.status === 'delivered' ? close.collectedMinor : null,
        cod_shortfall_minor: close.shortfallMinor,
        attempt_count: Number(delivery.attempt_count ?? 0) + 1,
        last_attempt_at: now,
        client_request_id: requestKey,
      })
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
      action: close.status === 'delivered' ? 'courier_delivered' : 'courier_attempt_failed',
      title:
        close.status === 'delivered'
          ? `Delivered ${delivery.tracking_number}`
          : `Attempt failed for ${delivery.tracking_number}`,
      metadata: {
        collectedMinor: close.collectedMinor,
        shortfallMinor: close.shortfallMinor,
        podMethod: close.pod?.method ?? null,
        failureReason: close.failureReason,
      },
      notify: false,
    })

    return updated
  }
}
