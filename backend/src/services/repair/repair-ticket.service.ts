// ============================================
// backend/src/services/repair/repair-ticket.service.ts
//
// The repair slip (retail-ops-01 + V59.1 repair-parts-01):
//   • the customer is a `customers` row, the technician an `employees` row;
//   • the device, when the shop knows it, is a `stock_serials` unit;
//   • «under warranty» is read from `warranties` (universal-core) — never ticked;
//   • spare parts reserve ATP via ReservationService (`repairPartReservationInput`)
//     and consume through `costing.recordIssue` gated by `canConsumePartsOnRepair`;
//   • final billing goes through `InvoiceService.create` with parts/labor split
//     (`splitRepairInvoiceRevenue`).
// ============================================

import { fractionDigits, type KnownCurrency } from '@hisabche/formatting'
import {
  canConsumePartsOnRepair,
  repairEstimateRefusal,
  repairMoveRefusal,
  repairPartReservationInput,
  splitRepairInvoiceRevenue,
  warrantyState,
  type RepairBillCreateInput,
  type RepairPartReserveInput,
  type RepairStatus,
  type RepairTicketCreateInput,
  type RepairTicketMoveInput,
} from '@hisabche/validation'
import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { businessDayOf } from '../../utils/local-day'
import { baseCurrencyOf } from '../base-currency'
import { costing } from '../inventory-costing'
import { InventoryReservationService } from '../inventory/reservation.service'
import type { TenancyContext } from '../tenancy.service'

const LEGACY_TICKET_COLUMNS =
  'id, number, customer_id, serial_id, device_label, problem, status, under_warranty, ' +
  'estimate_minor, currency, technician_employee_id, promised_on, invoice_id, ' +
  'created_at, updated_at, closed_at'

const TICKET_COLUMNS = `${LEGACY_TICKET_COLUMNS}, customer_approved`

interface TicketRow {
  id: string
  number: number
  customer_id: string
  serial_id: string | null
  device_label: string
  problem: string
  status: RepairStatus
  under_warranty: boolean
  customer_approved?: boolean | null
  estimate_minor: number | string | null
  currency: string | null
  technician_employee_id: string | null
  promised_on: string | null
  invoice_id: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
}

interface PartRow {
  id: string
  ticket_id: string
  warehouse_id: string
  product_id: string
  quantity: number | string
  unit_price_minor: number | string
  unit_cost_minor: number | string | null
  currency: string
  reservation_id: string | null
  status: 'reserved' | 'consumed' | 'released'
  consumed_at: string | null
  created_at: string
}

function mapTicket(row: TicketRow) {
  return {
    id: row.id,
    number: Number(row.number),
    customerId: row.customer_id,
    serialId: row.serial_id,
    deviceLabel: row.device_label,
    problem: row.problem,
    status: row.status,
    underWarranty: row.under_warranty,
    customerApproved: Boolean(row.customer_approved ?? false),
    estimateMinor: row.estimate_minor === null ? null : Number(row.estimate_minor),
    currency: row.currency,
    technicianEmployeeId: row.technician_employee_id,
    promisedOn: row.promised_on ? String(row.promised_on).slice(0, 10) : null,
    invoiceId: row.invoice_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
  }
}

function mapPart(row: PartRow) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    warehouseId: row.warehouse_id,
    productId: row.product_id,
    quantity: Number(row.quantity),
    unitPriceMinor: Number(row.unit_price_minor),
    unitCostMinor: row.unit_cost_minor === null ? null : Number(row.unit_cost_minor),
    currency: row.currency,
    reservationId: row.reservation_id,
    status: row.status,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
  }
}

function isNotReady(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

function isMissingColumn(error: { code?: string } | null): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

export class RepairTicketService {
  private readonly reservations = new InventoryReservationService()

  private async exists(table: 'customers' | 'employees' | 'invoices', ws: string, id: string) {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .eq('workspace_id', ws)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new DatabaseError(`Failed to read ${table}`, error)
    return Boolean(data)
  }

  private async readTicketRow(ctx: TenancyContext, id: string): Promise<TicketRow> {
    let { data, error } = await supabase
      .from('repair_tickets')
      .select(TICKET_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .returns<TicketRow[]>()
      .maybeSingle()
    if (isMissingColumn(error)) {
      ;({ data, error } = await supabase
        .from('repair_tickets')
        .select(LEGACY_TICKET_COLUMNS)
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', id)
        .returns<TicketRow[]>()
        .maybeSingle())
    }
    if (error) throw new DatabaseError('Failed to read the repair ticket', error)
    if (!data) throw new NotFoundError('Repair ticket')
    return data as TicketRow
  }

  async list(
    ctx: TenancyContext,
    filters: { status?: RepairStatus | 'open'; customerId?: string } = {},
  ) {
    const buildQuery = (columns: string) => {
      let query = supabase
        .from('repair_tickets')
        .select(columns)
        .eq('workspace_id', ctx.workspaceId)
        .order('created_at', { ascending: false })
        .limit(500)
      if (filters.status === 'open') query = query.not('status', 'in', '(delivered,cancelled)')
      else if (filters.status) query = query.eq('status', filters.status)
      if (filters.customerId) query = query.eq('customer_id', filters.customerId)
      return query.returns<TicketRow[]>()
    }
    let { data, error } = await buildQuery(TICKET_COLUMNS)
    if (isMissingColumn(error)) {
      ;({ data, error } = await buildQuery(LEGACY_TICKET_COLUMNS))
    }
    if (isNotReady(error)) return { ready: false, tickets: [] }
    if (error) throw new DatabaseError('Failed to read the repair tickets', error)
    return { ready: true, tickets: (data ?? []).map(mapTicket) }
  }

  async get(ctx: TenancyContext, id: string) {
    const ticket = await this.readTicketRow(ctx, id)
    const [events, partsRes] = await Promise.all([
      supabase
        .from('repair_ticket_events')
        .select('id, from_status, to_status, note, actor_id, created_at')
        .eq('workspace_id', ctx.workspaceId)
        .eq('ticket_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('repair_ticket_parts')
        .select(
          'id, ticket_id, warehouse_id, product_id, quantity, unit_price_minor, unit_cost_minor, currency, reservation_id, status, consumed_at, created_at',
        )
        .eq('workspace_id', ctx.workspaceId)
        .eq('ticket_id', id)
        .order('created_at', { ascending: true }),
    ])
    if (events.error) throw new DatabaseError('Failed to read the repair history', events.error)
    if (partsRes.error && !isNotReady(partsRes.error)) {
      throw new DatabaseError('Failed to read the repair parts', partsRes.error)
    }
    return {
      ...mapTicket(ticket),
      events: (events.data ?? []).map((e) => ({
        id: e.id as string,
        fromStatus: e.from_status as RepairStatus | null,
        toStatus: e.to_status as RepairStatus,
        note: e.note as string | null,
        actorId: e.actor_id as string,
        createdAt: e.created_at as string,
      })),
      parts: (partsRes.data ?? []).map((p) => mapPart(p as PartRow)),
    }
  }

  /** Whether the unit's warranty (warranties.end_date) covers today, the shop's day. */
  private async warrantyOf(ctx: TenancyContext, serialId: string) {
    const { data: unit, error } = await supabase
      .from('stock_serials')
      .select('id, product_id, serial_number')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', serialId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to read the unit', error)
    if (!unit) throw new ValidationError('REPAIR_SERIAL_NOT_FOUND')
    const { data: warranty, error: wError } = await supabase
      .from('warranties')
      .select('end_date')
      .eq('workspace_id', ctx.workspaceId)
      .eq('product_id', unit.product_id as string)
      .eq('serial_number', unit.serial_number as string)
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (wError && !isNotReady(wError))
      throw new DatabaseError('Failed to read the warranty', wError)
    const day = businessDayOf(new Date(), ctx.timeZone)
    return warrantyState((warranty?.end_date as string | undefined) ?? null, day)
  }

  async create(ctx: TenancyContext, input: RepairTicketCreateInput) {
    const estimate = repairEstimateRefusal(input)
    if (estimate) throw new ValidationError(estimate)
    if (!(await this.exists('customers', ctx.workspaceId, input.customerId))) {
      throw new ValidationError('REPAIR_CUSTOMER_NOT_FOUND')
    }
    if (
      input.technicianEmployeeId &&
      !(await this.exists('employees', ctx.workspaceId, input.technicianEmployeeId))
    ) {
      throw new ValidationError('REPAIR_TECHNICIAN_NOT_FOUND')
    }
    const warranty = input.serialId ? await this.warrantyOf(ctx, input.serialId) : 'unknown'

    const { data, error } = await supabase
      .from('repair_tickets')
      .insert({
        workspace_id: ctx.workspaceId,
        customer_id: input.customerId,
        serial_id: input.serialId ?? null,
        device_label: input.deviceLabel,
        problem: input.problem,
        under_warranty: warranty === 'active',
        estimate_minor: input.estimateMinor ?? null,
        currency: input.currency ? input.currency.toUpperCase() : null,
        technician_employee_id: input.technicianEmployeeId ?? null,
        promised_on: input.promisedOn ?? null,
        created_by: ctx.userId,
      })
      .select(LEGACY_TICKET_COLUMNS)
      .returns<TicketRow[]>()
      .single()
    if (isNotReady(error)) throw new ValidationError('REPAIR_NOT_READY')
    if (error || !data) throw new DatabaseError('Failed to open the repair ticket', error)
    return { ...mapTicket(data), warranty }
  }

  async move(ctx: TenancyContext, id: string, input: RepairTicketMoveInput) {
    const current = await this.readTicketRow(ctx, id)

    const refusal = repairMoveRefusal(current.status as RepairStatus, input)
    if (refusal) throw new ValidationError(refusal)

    if (input.invoiceId) {
      const { data: invoice, error: iError } = await supabase
        .from('invoices')
        .select('id, type, customer_id')
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', input.invoiceId)
        .maybeSingle()
      if (iError) throw new DatabaseError('Failed to read the invoice', iError)
      if (!invoice) throw new ValidationError('REPAIR_INVOICE_NOT_FOUND')
      if (invoice.type !== 'sale' || invoice.customer_id !== current.customer_id) {
        throw new ValidationError('REPAIR_INVOICE_NOT_THIS_CUSTOMER')
      }
    }

    const { data: moved, error: moveError } = await supabase.rpc('repair_ticket_move', {
      p_workspace_id: ctx.workspaceId,
      p_ticket_id: id,
      p_from: current.status,
      p_to: input.status,
      p_note: input.note ?? null,
      p_invoice_id: input.invoiceId ?? null,
      p_actor: ctx.userId,
    })
    if (moveError) throw new DatabaseError('Failed to move the repair ticket', moveError)
    if (moved !== true) throw new ConflictError('REPAIR_TICKET_CHANGED')
    return this.get(ctx, id)
  }

  async approve(ctx: TenancyContext, id: string) {
    const ticket = await this.readTicketRow(ctx, id)
    if (ticket.status === 'delivered' || ticket.status === 'cancelled') {
      throw new ValidationError('REPAIR_TICKET_CLOSED')
    }
    const nowIso = new Date().toISOString()
    const { error } = await supabase
      .from('repair_tickets')
      .update({
        customer_approved: true,
        customer_approved_at: nowIso,
        customer_approved_by: ctx.userId,
        updated_at: nowIso,
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
    if (isMissingColumn(error)) throw new ValidationError('REPAIR_PARTS_NOT_READY')
    if (error) throw new DatabaseError('Failed to approve repair ticket', error)
    return this.get(ctx, id)
  }

  /**
   * Add a spare part line on a repair ticket and immediately reserve ATP stock
   * using the canonical `repairPartReservationInput` + `ReservationService`.
   */
  async addPart(ctx: TenancyContext, ticketId: string, input: RepairPartReserveInput) {
    const ticket = await this.readTicketRow(ctx, ticketId)
    if (ticket.status === 'delivered' || ticket.status === 'cancelled') {
      throw new ValidationError('REPAIR_TICKET_CLOSED')
    }

    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('id, name, sell_price')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', input.productId)
      .maybeSingle()
    if (prodErr) throw new DatabaseError('Failed to read spare part product', prodErr)
    if (!product) throw new ValidationError('REPAIR_PART_PRODUCT_NOT_FOUND')

    const currency = (
      input.currency ??
      ticket.currency ??
      (await baseCurrencyOf(ctx.workspaceId))
    ).toUpperCase()
    const digits = fractionDigits(currency as KnownCurrency) ?? 2
    const unitPriceMinor =
      input.unitPriceMinor ?? Math.round((Number(product.sell_price) || 0) * 10 ** digits)

    if (input.customerApproved && !ticket.customer_approved) {
      await supabase
        .from('repair_tickets')
        .update({
          customer_approved: true,
          customer_approved_at: new Date().toISOString(),
          customer_approved_by: ctx.userId,
        })
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', ticketId)
    }

    const key =
      input.idempotencyKey ??
      `repair-part-${ticketId}-${input.productId}-${input.warehouseId}-${Date.now()}`
    const reserveReq = repairPartReservationInput({
      ticketId,
      warehouseId: input.warehouseId,
      productId: input.productId,
      quantity: input.quantity,
      idempotencyKey: key,
    })
    const reservation = await this.reservations.reserve(ctx, reserveReq)

    const { data: partRow, error: insertErr } = await supabase
      .from('repair_ticket_parts')
      .insert({
        workspace_id: ctx.workspaceId,
        ticket_id: ticketId,
        warehouse_id: input.warehouseId,
        product_id: input.productId,
        quantity: input.quantity,
        unit_price_minor: unitPriceMinor,
        currency,
        reservation_id: reservation.reservationId,
        status: 'reserved',
      })
      .select('*')
      .single()
    if (isNotReady(insertErr)) throw new ValidationError('REPAIR_PARTS_NOT_READY')
    if (insertErr || !partRow) {
      await this.reservations.release(ctx, { reservationId: reservation.reservationId })
      throw new DatabaseError('Failed to save repair part line', insertErr)
    }
    return mapPart(partRow as PartRow)
  }

  /**
   * Consume a reserved repair part at real use, gated by `canConsumePartsOnRepair`,
   * settling the ATP reservation and recording inventory issue through `costing.recordIssue`.
   */
  async consumePart(ctx: TenancyContext, ticketId: string, partId: string) {
    const ticket = await this.readTicketRow(ctx, ticketId)
    const gate = canConsumePartsOnRepair({
      status: ticket.status,
      customerApproved: Boolean(ticket.customer_approved),
    })
    if (!gate.allowed) throw new ValidationError(gate.reason ?? 'REPAIR_APPROVAL_REQUIRED')

    const { data: partRaw, error: partErr } = await supabase
      .from('repair_ticket_parts')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('ticket_id', ticketId)
      .eq('id', partId)
      .maybeSingle()
    if (isNotReady(partErr)) throw new ValidationError('REPAIR_PARTS_NOT_READY')
    if (partErr) throw new DatabaseError('Failed to read repair part line', partErr)
    if (!partRaw) throw new NotFoundError('Repair part')
    const part = partRaw as PartRow
    if (part.status === 'consumed') return mapPart(part)
    if (part.status !== 'reserved') throw new ValidationError('REPAIR_PART_NOT_RESERVED')

    const entryDate = businessDayOf(new Date(), ctx.timeZone)
    if (part.reservation_id) {
      await this.reservations.settle(ctx, {
        reservationId: part.reservation_id,
        quantity: Number(part.quantity),
      })
    }

    const issue = await costing.recordIssue(ctx, {
      productId: part.product_id,
      warehouseId: part.warehouse_id,
      quantity: Number(part.quantity),
      entryDate,
      consumerType: 'adjustment',
      consumerId: ticketId,
      consumerLine: part.id,
    })

    if (issue.status !== 'already_consumed') {
      const { error: smErr } = await supabase.from('stock_movements').insert({
        product_id: part.product_id,
        warehouse_id: part.warehouse_id,
        type: 'adjustment',
        quantity: -Number(part.quantity),
        reference_type: 'repair_ticket',
        reference_id: ticketId,
        workspace_id: ctx.workspaceId,
        user_id: ctx.userId,
        notes: `Repair #${ticket.number} part consumed`,
      })
      if (smErr) throw new DatabaseError('Failed to record repair part stock movement', smErr)
    }

    const digits = fractionDigits(part.currency as KnownCurrency) ?? 2
    const unitCostMinor =
      Number(part.quantity) > 0
        ? Math.round((Number(issue.totalCost) / Number(part.quantity)) * 10 ** digits)
        : 0

    const nowIso = new Date().toISOString()
    const { data: updated, error: updErr } = await supabase
      .from('repair_ticket_parts')
      .update({
        status: 'consumed',
        unit_cost_minor: unitCostMinor,
        consumed_at: nowIso,
        consumed_by: ctx.userId,
        updated_at: nowIso,
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', part.id)
      .eq('status', 'reserved')
      .select('*')
      .single()
    if (updErr || !updated) throw new DatabaseError('Failed to mark repair part consumed', updErr)
    return mapPart(updated as PartRow)
  }

  async releasePart(ctx: TenancyContext, ticketId: string, partId: string) {
    await this.readTicketRow(ctx, ticketId)
    const { data: partRaw, error: partErr } = await supabase
      .from('repair_ticket_parts')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('ticket_id', ticketId)
      .eq('id', partId)
      .maybeSingle()
    if (isNotReady(partErr)) throw new ValidationError('REPAIR_PARTS_NOT_READY')
    if (partErr) throw new DatabaseError('Failed to read repair part line', partErr)
    if (!partRaw) throw new NotFoundError('Repair part')
    const part = partRaw as PartRow
    if (part.status === 'released') return mapPart(part)
    if (part.status !== 'reserved') throw new ValidationError('REPAIR_PART_NOT_RESERVED')

    if (part.reservation_id) {
      await this.reservations.release(ctx, {
        reservationId: part.reservation_id,
        quantity: Number(part.quantity),
      })
    }

    const { data: updated, error: updErr } = await supabase
      .from('repair_ticket_parts')
      .update({ status: 'released', updated_at: new Date().toISOString() })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', part.id)
      .eq('status', 'reserved')
      .select('*')
      .single()
    if (updErr || !updated) throw new DatabaseError('Failed to release repair part', updErr)
    return mapPart(updated as PartRow)
  }

  /**
   * Create the final repair bill through InvoiceService.create with parts/labor
   * revenue breakdown computed via `splitRepairInvoiceRevenue`.
   */
  async createFinalBill(
    ctx: TenancyContext,
    ticketId: string,
    input: RepairBillCreateInput,
    clientRequestId?: string | null,
  ) {
    const ticket = await this.readTicketRow(ctx, ticketId)
    if (ticket.status === 'cancelled') throw new ValidationError('REPAIR_TICKET_CLOSED')
    if (ticket.invoice_id) throw new ConflictError('REPAIR_ALREADY_BILLED')

    const { data: consumedRaw, error: partsErr } = await supabase
      .from('repair_ticket_parts')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('ticket_id', ticketId)
      .eq('status', 'consumed')
    if (partsErr && !isNotReady(partsErr)) {
      throw new DatabaseError('Failed to read consumed repair parts', partsErr)
    }
    const consumed = (consumedRaw ?? []) as PartRow[]

    const currency = (
      ticket.currency ??
      consumed[0]?.currency ??
      (await baseCurrencyOf(ctx.workspaceId))
    ).toUpperCase()
    const digits = fractionDigits(currency as KnownCurrency) ?? 2
    const scale = 10 ** digits

    const partIds = [...new Set(consumed.map((p) => p.product_id))]
    const productNames = new Map<string, string>()
    if (partIds.length > 0) {
      const { data: prodRows } = await supabase
        .from('products')
        .select('id, name')
        .eq('workspace_id', ctx.workspaceId)
        .in('id', partIds)
      for (const row of prodRows ?? []) {
        productNames.set(String(row.id), String(row.name))
      }
    }

    const splitInputs: Array<{
      offeringType: 'goods' | 'service' | 'package'
      lineTotalMinor: number
    }> = []
    const invoiceItems: Array<{
      productId?: string | undefined
      productName: string
      quantity: number
      unit: 'piece'
      unitPrice: number
      discount: number
      notes?: string | undefined
    }> = []

    for (const part of consumed) {
      const qty = Number(part.quantity)
      const unitMinor = Number(part.unit_price_minor)
      if (unitMinor <= 0 || qty <= 0) continue
      const lineTotalMinor = Math.round(unitMinor * qty)
      splitInputs.push({ offeringType: 'goods', lineTotalMinor })
      invoiceItems.push({
        // Spare part stock was already issued through costing.recordIssue at consumePart(),
        // so omit productId here to avoid double-deducting warehouse_stock during billing.
        productName: productNames.get(part.product_id) ?? 'Spare Part',
        quantity: qty,
        unit: 'piece',
        unitPrice: unitMinor / scale,
        discount: 0,
        notes: `repair_part:${part.id}`,
      })
    }

    const defaultLaborMinor = !ticket.under_warranty ? Number(ticket.estimate_minor ?? 0) : 0
    const laborFeeMinor = input.laborFeeMinor ?? defaultLaborMinor
    if (laborFeeMinor > 0) {
      splitInputs.push({ offeringType: 'service', lineTotalMinor: laborFeeMinor })
      invoiceItems.push({
        ...(input.laborProductId ? { productId: input.laborProductId } : {}),
        productName: `Repair Labor #${ticket.number}`,
        quantity: 1,
        unit: 'piece',
        unitPrice: laborFeeMinor / scale,
        discount: 0,
        notes: `repair_labor:${ticket.id}`,
      })
    }

    if (invoiceItems.length === 0) {
      throw new ValidationError('REPAIR_BILL_NO_CHARGEABLE_LINES')
    }

    const revenueSplit = splitRepairInvoiceRevenue(splitInputs)
    const { InvoiceService } = await import('../invoice.service')
    const invoiceService = new InvoiceService()
    const entryDate = businessDayOf(new Date(), ctx.timeZone)
    const invoice = await invoiceService.create(ctx, {
      type: 'sale',
      date: entryDate,
      warehouseId: input.warehouseId ?? consumed[0]?.warehouse_id,
      customerId: ticket.customer_id,
      currency,
      paymentMethod: input.paymentMethod ?? 'cash',
      paidAmount: input.paidAmount ?? 0,
      idempotencyKey: clientRequestId ?? `repair-bill-${ticket.id}`,
      notes: `Repair #${ticket.number}: ${ticket.device_label}`,
      items: invoiceItems,
    } as Parameters<InstanceType<typeof InvoiceService>['create']>[1])

    let updatedTicket = await this.get(ctx, ticketId)
    if (input.markDelivered !== false && ticket.status === 'ready') {
      updatedTicket = await this.move(ctx, ticketId, {
        status: 'delivered',
        invoiceId: invoice.id,
        note: `Billed via invoice ${invoice.id}`,
      })
    }

    return {
      invoice,
      revenueSplit,
      ticket: updatedTicket,
    }
  }
}
