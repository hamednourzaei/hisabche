// ============================================
// backend/src/services/repair/repair-ticket.service.ts
//
// The repair slip (retail-ops-01; QA document §9, 10 Nov 2026).
//
// Part of the one core, not beside it:
//   • the customer is a `customers` row, the technician an `employees` row;
//   • the device, when the shop knows it, is a `stock_serials` unit;
//   • «under warranty» is read from `warranties` (universal-core) — the one
//     warranty record per sold unit — on the shop's local day, never ticked;
//   • the charge is an ordinary sale invoice the slip points to on delivery.
//     The slip itself moves no money and no stock.
// Every move goes through repair_ticket_move: status in the WHERE, event in
// the same transaction.
// ============================================

import {
  repairEstimateRefusal,
  repairMoveRefusal,
  warrantyState,
  type RepairStatus,
  type RepairTicketCreateInput,
  type RepairTicketMoveInput,
} from '@hisabche/validation'
import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { businessDayOf } from '../../utils/local-day'
import type { TenancyContext } from '../tenancy.service'

const TICKET_COLUMNS =
  'id, number, customer_id, serial_id, device_label, problem, status, under_warranty, ' +
  'estimate_minor, currency, technician_employee_id, promised_on, invoice_id, ' +
  'created_at, updated_at, closed_at'

interface TicketRow {
  id: string
  number: number
  customer_id: string
  serial_id: string | null
  device_label: string
  problem: string
  status: RepairStatus
  under_warranty: boolean
  estimate_minor: number | string | null
  currency: string | null
  technician_employee_id: string | null
  promised_on: string | null
  invoice_id: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
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

/** The table is not there yet: the screen says «run retail-ops-01», not «no slips». */
function isNotReady(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

export class RepairTicketService {
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

  async list(
    ctx: TenancyContext,
    filters: { status?: RepairStatus | 'open'; customerId?: string } = {},
  ) {
    let query = supabase
      .from('repair_tickets')
      .select(TICKET_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .limit(500)
    if (filters.status === 'open') query = query.not('status', 'in', '(delivered,cancelled)')
    else if (filters.status) query = query.eq('status', filters.status)
    if (filters.customerId) query = query.eq('customer_id', filters.customerId)
    const { data, error } = await query.returns<TicketRow[]>()
    if (isNotReady(error)) return { ready: false, tickets: [] }
    if (error) throw new DatabaseError('Failed to read the repair tickets', error)
    return { ready: true, tickets: (data ?? []).map(mapTicket) }
  }

  async get(ctx: TenancyContext, id: string) {
    const [ticket, events] = await Promise.all([
      supabase
        .from('repair_tickets')
        .select(TICKET_COLUMNS)
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', id)
        .returns<TicketRow[]>()
        .maybeSingle(),
      supabase
        .from('repair_ticket_events')
        .select('id, from_status, to_status, note, actor_id, created_at')
        .eq('workspace_id', ctx.workspaceId)
        .eq('ticket_id', id)
        .order('created_at', { ascending: true }),
    ])
    if (ticket.error) throw new DatabaseError('Failed to read the repair ticket', ticket.error)
    if (!ticket.data) throw new NotFoundError('Repair ticket')
    if (events.error) throw new DatabaseError('Failed to read the repair history', events.error)
    return {
      ...mapTicket(ticket.data as TicketRow),
      events: (events.data ?? []).map((e) => ({
        id: e.id as string,
        fromStatus: e.from_status as RepairStatus | null,
        toStatus: e.to_status as RepairStatus,
        note: e.note as string | null,
        actorId: e.actor_id as string,
        createdAt: e.created_at as string,
      })),
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
    // No warranties table yet = no warranty recorded, which is «unknown», not «under warranty».
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
      .select(TICKET_COLUMNS)
      .returns<TicketRow[]>()
      .single()
    if (isNotReady(error)) throw new ValidationError('REPAIR_NOT_READY')
    if (error || !data) throw new DatabaseError('Failed to open the repair ticket', error)
    return { ...mapTicket(data), warranty }
  }

  async move(ctx: TenancyContext, id: string, input: RepairTicketMoveInput) {
    const { data: current, error } = await supabase
      .from('repair_tickets')
      .select('id, status, customer_id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to read the repair ticket', error)
    if (!current) throw new NotFoundError('Repair ticket')

    const refusal = repairMoveRefusal(current.status as RepairStatus, input)
    if (refusal) throw new ValidationError(refusal)

    if (input.invoiceId) {
      // The charge is a SALE to THIS customer — anything else is not this repair's invoice.
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
}
