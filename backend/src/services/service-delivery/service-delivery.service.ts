// ============================================
// backend/src/services/service-delivery/service-delivery.service.ts
//
// M4 — SERVICE DELIVERY & ATTENDANCE CORE (Server Authority)
// Authoritative PostgreSQL service for service sessions, practitioner attendance,
// and package credit redemption.
// ============================================

import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateSessionDurationMinutes,
  verifyPractitionerAttendance,
  type AttendanceDay,
  type ServiceDeliverySession,
  type ServiceDeliverySettlementMethod,
  type ServiceDeliveryStatus,
} from '@hisabche/validation'
import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'

export interface CreateSessionInput {
  id?: string | undefined
  customerId: string
  serviceOfferingId: string
  practitionerId?: string | null | undefined
  branchId?: string | null | undefined
  sessionDate: string
  startTime: string
  endTime: string
  status?: ServiceDeliveryStatus | undefined
  settlementMethod?: ServiceDeliverySettlementMethod | undefined
  clientNotes?: string | null | undefined
  internalNotes?: string | null | undefined
}

export interface DeliverSessionInput {
  packageProductId?: string | undefined
  settlementMethod?: ServiceDeliverySettlementMethod | undefined
  quantity?: number | undefined
  /** The existing invoice that bills the session (settlement `invoice`). */
  invoiceId?: string | undefined
  /** Why the session is free (settlement `complementary`). */
  reason?: string | undefined
  /** The id the device gave the ledger fact, so both sides name the same entry. */
  consumptionEntryId?: string | undefined
  /** Optional: refuse when the session changed since the caller read it. */
  expectedUpdatedAt?: string | undefined
}

interface ServiceDeliveryDbRow {
  id: string
  workspace_id: string
  customer_id: string
  service_offering_id: string
  practitioner_id: string | null
  branch_id: string | null
  session_date: string
  start_time: string
  end_time: string
  duration_minutes: number
  status: string
  settlement_method: string
  package_credit_id: string | null
  invoice_id: string | null
  settlement_reason?: string | null
  cancellation_reason?: string | null
  client_notes: string | null
  internal_notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function mapDbRowToSession(row: ServiceDeliveryDbRow): ServiceDeliverySession {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    customerId: row.customer_id,
    serviceOfferingId: row.service_offering_id,
    practitionerId: row.practitioner_id,
    branchId: row.branch_id,
    sessionDate: row.session_date,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: Number(row.duration_minutes),
    status: row.status as ServiceDeliveryStatus,
    settlementMethod: row.settlement_method as ServiceDeliverySettlementMethod,
    packageCreditId: row.package_credit_id,
    invoiceId: row.invoice_id,
    settlementReason: row.settlement_reason ?? null,
    cancellationReason: row.cancellation_reason ?? null,
    clientNotes: row.client_notes,
    internalNotes: row.internal_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ServiceDeliveryService {
  private readonly db: SupabaseClient

  constructor(client: SupabaseClient = supabase) {
    this.db = client
  }

  async list(
    ctx: TenancyContext,
    filters?: {
      date?: string | undefined
      customerId?: string | undefined
      practitionerId?: string | undefined
      status?: string | undefined
    },
  ): Promise<ServiceDeliverySession[]> {
    if (!ctx.workspaceId) throw new ValidationError('WORKSPACE_REQUIRED')

    let query = this.db
      .from('service_delivery_sessions')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .order('session_date', { ascending: false })
      .order('start_time', { ascending: false })

    if (filters?.date) query = query.eq('session_date', filters.date)
    if (filters?.customerId) query = query.eq('customer_id', filters.customerId)
    if (filters?.practitionerId) query = query.eq('practitioner_id', filters.practitionerId)
    if (filters?.status) query = query.eq('status', filters.status)

    const { data, error } = await query
    if (error) {
      throw new DatabaseError('Failed to fetch service delivery sessions', error)
    }

    return (data ?? []).map(mapDbRowToSession)
  }

  async getById(ctx: TenancyContext, id: string): Promise<ServiceDeliverySession> {
    if (!ctx.workspaceId) throw new ValidationError('WORKSPACE_REQUIRED')
    if (!id) throw new ValidationError('SESSION_ID_REQUIRED')

    const { data, error } = await this.db
      .from('service_delivery_sessions')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch service delivery session', error)
    if (!data) throw new NotFoundError(`Service delivery session not found: ${id}`)

    return mapDbRowToSession(data)
  }

  async create(ctx: TenancyContext, input: CreateSessionInput): Promise<ServiceDeliverySession> {
    if (!ctx.workspaceId) throw new ValidationError('WORKSPACE_REQUIRED')
    if (!input.customerId) throw new ValidationError('CUSTOMER_ID_REQUIRED')
    if (!input.serviceOfferingId) throw new ValidationError('SERVICE_OFFERING_ID_REQUIRED')
    if (!input.sessionDate) throw new ValidationError('SESSION_DATE_REQUIRED')
    if (!input.startTime || !input.endTime) throw new ValidationError('SESSION_TIMES_REQUIRED')
    // A session is BORN scheduled. «delivered» is reached only by `deliver` (settlement + credit in one step).
    if (input.status && input.status !== 'scheduled') {
      throw new ValidationError('SESSION_MUST_START_SCHEDULED')
    }

    const durationMinutes = calculateSessionDurationMinutes(input.startTime, input.endTime)
    const newId = input.id || randomUUID()

    // The id is the idempotency key: the same request again is the same session, not a database error.
    const replay = await this.findForReplay(ctx, newId, input)
    if (replay) return replay

    const now = new Date().toISOString()
    const row: Record<string, unknown> = {
      id: newId,
      workspace_id: ctx.workspaceId,
      customer_id: input.customerId,
      service_offering_id: input.serviceOfferingId,
      practitioner_id: input.practitionerId ?? null,
      branch_id: input.branchId ?? null,
      session_date: input.sessionDate,
      start_time: input.startTime,
      end_time: input.endTime,
      duration_minutes: durationMinutes,
      status: 'scheduled',
      settlement_method: input.settlementMethod ?? 'package_credit',
      client_notes: input.clientNotes ?? null,
      internal_notes: input.internalNotes ?? null,
      created_at: now,
      updated_at: now,
    }

    const { data, error } = await this.db
      .from('service_delivery_sessions')
      .insert(row)
      .select('*')
      .single()

    if (error) {
      // A twin request committed first: answer with the session it made.
      if (error.code === '23505') {
        const winner = await this.findForReplay(ctx, newId, input)
        if (winner) return winner
      }
      throw new DatabaseError('Failed to create service delivery session', error)
    }

    return mapDbRowToSession(data)
  }

  private async findForReplay(
    ctx: TenancyContext,
    id: string,
    input: CreateSessionInput,
  ): Promise<ServiceDeliverySession | null> {
    const { data, error } = await this.db
      .from('service_delivery_sessions')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to read service delivery session', error)
    if (!data) return null
    const existing = mapDbRowToSession(data)
    if (
      existing.customerId !== input.customerId ||
      existing.serviceOfferingId !== input.serviceOfferingId ||
      existing.sessionDate !== input.sessionDate
    ) {
      throw new ConflictError('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH')
    }
    return existing
  }

  /**
   * Deliver a session. ONE database transaction (`service_delivery_deliver`, docs/service-delivery-02-atomic-migration.sql):
   * the session row is locked, the settlement is checked and written, the credit consume (if any) is written, the
   * session is marked delivered - or nothing happens. There is no fallback to another settlement, and no fallback when
   * the function is missing: a database without migration 02 REFUSES the delivery.
   */
  async deliver(
    ctx: TenancyContext,
    id: string,
    input: DeliverSessionInput = {},
  ): Promise<{
    session: ServiceDeliverySession
    consumptionEntry: unknown | null
  }> {
    const session = await this.getById(ctx, id)

    // Attendance is a CHECK on a fact kept elsewhere (the attendance table); this service never writes it.
    if (session.practitionerId && session.status !== 'delivered') {
      const { data: attRow } = await this.db
        .from('attendance')
        .select('*')
        .eq('workspace_id', ctx.workspaceId)
        .eq('employee_id', session.practitionerId)
        .eq('date', session.sessionDate)
        .maybeSingle()

      if (attRow) {
        const attRecord: AttendanceDay = {
          employeeId: attRow.employee_id,
          date: attRow.date,
          checkIn: attRow.check_in,
          checkOut: attRow.check_out,
          status: attRow.status,
          note: attRow.notes,
        }
        const attCheck = verifyPractitionerAttendance({
          practitionerId: session.practitionerId,
          sessionDate: session.sessionDate,
          attendanceRecord: attRecord,
        })
        if (!attCheck.allowed) {
          throw new ConflictError(attCheck.reason || 'PRACTITIONER_ATTENDANCE_FAILED')
        }
      }
    }

    const settlement = input.settlementMethod ?? session.settlementMethod
    const { data, error } = await this.db.rpc('service_delivery_deliver', {
      p_workspace_id: ctx.workspaceId,
      p_session_id: id,
      p_settlement: settlement,
      p_package_product_id: input.packageProductId ?? null,
      p_quantity: input.quantity ?? 1,
      p_invoice_id: input.invoiceId ?? null,
      p_reason: input.reason ?? null,
      p_entry_id: input.consumptionEntryId ?? null,
      p_expected_updated_at: input.expectedUpdatedAt ?? null,
    })
    if (error) throw this.failureOf(error, 'Failed to deliver service session')

    const result = (data ?? {}) as { package_credit_id?: string | null }
    const delivered = await this.getById(ctx, id)
    return {
      session: delivered,
      consumptionEntry: result.package_credit_id
        ? await this.ledgerRow(ctx, result.package_credit_id)
        : null,
    }
  }

  /**
   * Cancel a session; a reason is required and kept. ONE database transaction (`service_delivery_cancel`): a delivered package session is reversed by a
   * compensating entry that references the consume (the ledger is append-only); a delivered INVOICED session is refused -
   * undoing a billed service is a correction flow, not a status change.
   */
  async cancel(
    ctx: TenancyContext,
    id: string,
    options: {
      reversalEntryId?: string | null | undefined
      reason?: string | null | undefined
    } = {},
  ): Promise<{
    session: ServiceDeliverySession
    reversalEntry: unknown | null
  }> {
    await this.getById(ctx, id)

    const { data, error } = await this.db.rpc('service_delivery_cancel', {
      p_workspace_id: ctx.workspaceId,
      p_session_id: id,
      p_entry_id: options.reversalEntryId ?? null,
      p_reason: options.reason ?? null,
    })
    if (error) throw this.failureOf(error, 'Failed to cancel service session')

    const result = (data ?? {}) as { reversal_entry_id?: string | null }
    return {
      session: await this.getById(ctx, id),
      reversalEntry: result.reversal_entry_id
        ? await this.ledgerRow(ctx, result.reversal_entry_id)
        : null,
    }
  }

  private async ledgerRow(ctx: TenancyContext, entryId: string): Promise<unknown | null> {
    const { data } = await this.db
      .from('package_credit_ledger')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', entryId)
      .maybeSingle()
    return data ?? null
  }

  /** The database raises a code; the API answers with the status that code deserves. */
  private failureOf(error: { code?: string; message?: string }, fallback: string): Error {
    const message = error.message ?? ''
    if (error.code === 'PGRST202' || error.code === '42883') {
      return new DatabaseError(
        'SERVICE_DELIVERY_MIGRATION_REQUIRED: docs/service-delivery-02-atomic-migration.sql',
        error,
      )
    }
    const code = /\b([A-Z][A-Z0-9_]{5,})\b/.exec(message)?.[1] ?? ''
    if (code === 'SERVICE_DELIVERY_SESSION_NOT_FOUND') return new NotFoundError(code)
    if (
      code === 'INSUFFICIENT_PACKAGE_CREDIT' ||
      code === 'SESSION_CHANGED' ||
      code === 'SESSION_ALREADY_DELIVERED_DIFFERENTLY' ||
      code === 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH' ||
      code === 'DELIVERED_INVOICE_CORRECTION_REQUIRED' ||
      code === 'CREDIT_REFERENCE_MISSING' ||
      message.includes('INVALID_STATUS_TRANSITION')
    ) {
      return new ConflictError(message.includes('INVALID_STATUS_TRANSITION') ? message : code)
    }
    if (
      code.startsWith('SETTLEMENT_') ||
      code === 'CONSUMPTION_QUANTITY_MUST_BE_POSITIVE' ||
      code === 'CANCELLATION_REASON_REQUIRED'
    ) {
      return new ValidationError(code)
    }
    return new DatabaseError(fallback, error)
  }
}
