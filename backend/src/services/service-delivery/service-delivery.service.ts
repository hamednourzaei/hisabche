import { costing } from '../inventory-costing'
import { ledger } from '../accounting'
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
  planSessionStatusMove,
  sessionStatusMoveSources,
  verifyPractitionerAttendance,
  type AttendanceDay,
  type SessionStatusMove,
  type ServiceDeliverySession,
  type ServiceDeliverySessionParticipant,
  type ServiceDeliverySettlementMethod,
  type ServiceDeliveryStatus,
  type ServiceDeliverySubjectType,
} from '@hisabche/validation'
import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'
import { logBusinessEvent } from '../event-log.service'

export interface CreateSessionInput {
  id?: string | undefined
  /** The primary customer (customer sessions). */
  customerId?: string | null | undefined
  /** Everyone in a customer session; the primary is included/deduplicated. */
  customerIds?: readonly string[] | undefined
  /** The subject of an employee session. Never a customer id. */
  employeeId?: string | null | undefined
  subjectType?: ServiceDeliverySubjectType | undefined
  /** Free-text kind of session, trimmed, 1..120 chars. */
  sessionType?: string | null | undefined
  serviceOfferingId?: string | null | undefined
  practitionerId?: string | null | undefined
  branchId?: string | null | undefined
  /** salon-01: the chair/room the session occupies; two sessions never hold one at once. */
  resourceId?: string | null | undefined
  /** salon-01: the department (HR departments) the session belongs to. */
  departmentId?: string | null | undefined
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
  consumables?:
    | Array<{
        productId: string
        quantity: number
        warehouseId?: string | null | undefined
      }>
    | undefined
}

interface ServiceDeliveryDbRow {
  id: string
  workspace_id: string
  customer_id: string | null
  employee_id?: string | null
  subject_type?: string | null
  session_type?: string | null
  service_offering_id: string | null
  practitioner_id: string | null
  branch_id: string | null
  resource_id?: string | null
  department_id?: string | null
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
    employeeId: row.employee_id ?? null,
    subjectType: (row.subject_type as ServiceDeliverySubjectType | null) ?? 'customer',
    sessionType: row.session_type ?? null,
    serviceOfferingId: row.service_offering_id ?? null,
    practitionerId: row.practitioner_id,
    branchId: row.branch_id,
    resourceId: row.resource_id ?? null,
    departmentId: row.department_id ?? null,
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

interface ParticipantDbRow {
  id: string
  workspace_id: string
  session_id: string
  participant_type: string
  customer_id: string | null
  employee_id: string | null
  created_at: string
}

function mapDbRowToParticipant(row: ParticipantDbRow): ServiceDeliverySessionParticipant {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    sessionId: row.session_id,
    participantType: row.participant_type as ServiceDeliverySubjectType,
    customerId: row.customer_id,
    employeeId: row.employee_id,
    createdAt: row.created_at,
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
      employeeId?: string | undefined
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
    if (filters?.customerId) {
      // A customer «has» a session when they are the primary OR a participant:
      // a group booking must not disappear from the customer's own list.
      const { data: memberRows, error: mErr } = await this.db
        .from('service_delivery_session_participants')
        .select('session_id')
        .eq('workspace_id', ctx.workspaceId)
        .eq('customer_id', filters.customerId)
      if (mErr && mErr.code !== '42P01' && mErr.code !== 'PGRST205') {
        throw new DatabaseError('Failed to read session participants', mErr)
      }
      const memberIds = [...new Set((memberRows ?? []).map((r) => r.session_id as string))]
      query =
        memberIds.length > 0
          ? query.or(`customer_id.eq.${filters.customerId},id.in.(${memberIds.join(',')})`)
          : query.eq('customer_id', filters.customerId)
    }
    if (filters?.employeeId) query = query.eq('employee_id', filters.employeeId)
    if (filters?.practitionerId) query = query.eq('practitioner_id', filters.practitionerId)
    if (filters?.status) query = query.eq('status', filters.status)

    const { data, error } = await query
    if (error) {
      throw new DatabaseError('Failed to fetch service delivery sessions', error)
    }

    const sessions = (data ?? []).map(mapDbRowToSession)
    // One scoped read for the whole page, not one per session.
    if (sessions.length > 0) {
      const { data: participantRows, error: pErr } = await this.db
        .from('service_delivery_session_participants')
        .select('*')
        .eq('workspace_id', ctx.workspaceId)
        .in(
          'session_id',
          sessions.map((s) => s.id),
        )
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
      if (pErr && pErr.code !== '42P01' && pErr.code !== 'PGRST205') {
        throw new DatabaseError('Failed to read session participants', pErr)
      }
      const bySession = new Map<string, ServiceDeliverySessionParticipant[]>()
      for (const row of participantRows ?? []) {
        const participant = mapDbRowToParticipant(row)
        const list = bySession.get(participant.sessionId) ?? []
        list.push(participant)
        bySession.set(participant.sessionId, list)
      }
      return sessions.map((s) => ({ ...s, participants: bySession.get(s.id) ?? [] }))
    }
    return sessions
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

    const session = mapDbRowToSession(data)
    return { ...session, participants: await this.participantsOf(ctx, id) }
  }

  async create(ctx: TenancyContext, input: CreateSessionInput): Promise<ServiceDeliverySession> {
    if (!ctx.workspaceId) throw new ValidationError('WORKSPACE_REQUIRED')
    if (!input.sessionDate) throw new ValidationError('SESSION_DATE_REQUIRED')
    if (!input.startTime || !input.endTime) throw new ValidationError('SESSION_TIMES_REQUIRED')
    // A session is BORN scheduled. «delivered» is reached only by `deliver` (settlement + credit in one step).
    if (input.status && input.status !== 'scheduled') {
      throw new ValidationError('SESSION_MUST_START_SCHEDULED')
    }

    // WHO the session is for — a real domain distinction, not a UI switch.
    const subjectType: ServiceDeliverySubjectType = input.subjectType ?? 'customer'
    let primaryCustomerId: string | null = null
    let extraCustomerIds: string[] = []
    if (subjectType === 'employee') {
      if (!input.employeeId) throw new ValidationError('EMPLOYEE_ID_REQUIRED')
      if (input.customerId || (input.customerIds && input.customerIds.length > 0)) {
        throw new ValidationError('EMPLOYEE_SESSION_HAS_CUSTOMER')
      }
    } else {
      const seen = new Set<string>()
      const ids: string[] = []
      for (const id of [input.customerId, ...(input.customerIds ?? [])]) {
        if (typeof id === 'string' && id && !seen.has(id)) {
          seen.add(id)
          ids.push(id)
        }
      }
      if (ids.length === 0) throw new ValidationError('CUSTOMER_ID_REQUIRED')
      if (input.employeeId) throw new ValidationError('CUSTOMER_SESSION_HAS_EMPLOYEE')
      primaryCustomerId = ids[0] ?? null
      extraCustomerIds = ids.slice(1)
    }

    // Free text, trimmed; a blank label is not a label. The exact words are kept.
    let sessionType: string | null = null
    if (input.sessionType != null) {
      const trimmed = input.sessionType.trim()
      if (trimmed.length === 0) throw new ValidationError('SESSION_TYPE_REQUIRED')
      if (trimmed.length > 120) throw new ValidationError('SESSION_TYPE_TOO_LONG')
      sessionType = trimmed
    }

    const serviceOfferingId =
      typeof input.serviceOfferingId === 'string' && input.serviceOfferingId.trim().length > 0
        ? input.serviceOfferingId.trim()
        : null

    if (!serviceOfferingId && !sessionType) {
      throw new ValidationError('SERVICE_OR_TITLE_REQUIRED')
    }

    const durationMinutes = calculateSessionDurationMinutes(input.startTime, input.endTime)
    const newId = input.id || randomUUID()

    // The id is the idempotency key: the same request again is the same session, not a database error.
    const replay = await this.findForReplay(ctx, newId, {
      customerId: primaryCustomerId,
      employeeId: subjectType === 'employee' ? (input.employeeId ?? null) : null,
      serviceOfferingId,
      sessionDate: input.sessionDate,
    })
    if (replay) {
      // A retried create completes any participant assignment the first attempt
      // did not finish — each insert is idempotent on (session, customer).
      await this.ensureAdditionalParticipants(ctx, newId, extraCustomerIds)
      return this.getById(ctx, newId)
    }

    const now = new Date().toISOString()
    const row: Record<string, unknown> = {
      id: newId,
      workspace_id: ctx.workspaceId,
      customer_id: primaryCustomerId,
      service_offering_id: serviceOfferingId,
      practitioner_id: input.practitionerId ?? null,
      branch_id: input.branchId ?? null,
      // salon-01: named only when set, so a session without them is written
      // the same way before the migration.
      ...(input.resourceId ? { resource_id: input.resourceId } : {}),
      ...(input.departmentId ? { department_id: input.departmentId } : {}),
      // service-delivery-05: named only when they differ from the historical
      // shape, so a customer session with no type writes the pre-05 way too.
      ...(subjectType === 'employee'
        ? { subject_type: 'employee', employee_id: input.employeeId }
        : {}),
      ...(sessionType ? { session_type: sessionType } : {}),
      session_date: input.sessionDate,
      start_time: input.startTime,
      end_time: input.endTime,
      duration_minutes: durationMinutes,
      status: 'scheduled',
      // A BOOKING IS NOT A SETTLEMENT. Until the deliver action names a method,
      // the row says `undecided`; defaulting to `package_credit` recorded a
      // settlement nobody chose and made an un-delivered session look paid.
      settlement_method: input.settlementMethod ?? 'undecided',
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
      // salon-01's guard: the chair/room is taken at that time.
      if ((error.message ?? '').includes('SERVICE_RESOURCE_BUSY')) {
        throw new ConflictError('SERVICE_RESOURCE_BUSY')
      }
      // service-delivery-05's trigger: the primary person is not of this workspace.
      if ((error.message ?? '').includes('PARTICIPANT_WORKSPACE_MISMATCH')) {
        throw new ValidationError('PARTICIPANT_WORKSPACE_MISMATCH')
      }
      // A twin request committed first: answer with the session it made.
      if (error.code === '23505') {
        const winner = await this.findForReplay(ctx, newId, {
          customerId: primaryCustomerId,
          employeeId: subjectType === 'employee' ? (input.employeeId ?? null) : null,
          serviceOfferingId,
          sessionDate: input.sessionDate,
        })
        if (winner) {
          await this.ensureAdditionalParticipants(ctx, newId, extraCustomerIds)
          return this.getById(ctx, newId)
        }
      }
      throw new DatabaseError('Failed to create service delivery session', error)
    }

    const created = mapDbRowToSession(data)
    // The primary participant row is written by the database trigger; the rest
    // are one idempotent insert each (a retry never assigns a person twice).
    await this.ensureAdditionalParticipants(ctx, newId, extraCustomerIds)
    // Only the FIRST write is an event: a replayed create returned above.
    this.logSession(
      ctx,
      created.id,
      'service_session_created',
      `Service session booked: ${created.sessionDate} ${created.startTime}`,
      {
        serviceOfferingId: created.serviceOfferingId,
        customerId: created.customerId ?? null,
        employeeId: created.employeeId ?? null,
        subjectType,
        sessionType,
        practitionerId: created.practitionerId ?? null,
        participantCount: 1 + extraCustomerIds.length,
      },
    )
    return this.getById(ctx, newId)
  }

  /** One idempotent insert per extra customer; a duplicate assignment is the answer, not an error. */
  private async ensureAdditionalParticipants(
    ctx: TenancyContext,
    sessionId: string,
    customerIds: readonly string[],
  ): Promise<void> {
    for (const customerId of customerIds) {
      const { error } = await this.db.from('service_delivery_session_participants').insert({
        workspace_id: ctx.workspaceId,
        session_id: sessionId,
        participant_type: 'customer',
        customer_id: customerId,
        created_by: ctx.userId ?? null,
      })
      if (!error || error.code === '23505') continue
      throw this.failureOf(error, 'Failed to add session participant')
    }
  }

  private async findForReplay(
    ctx: TenancyContext,
    id: string,
    identity: {
      customerId: string | null
      employeeId: string | null
      serviceOfferingId: string | null
      sessionDate: string
    },
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
      (existing.customerId ?? null) !== identity.customerId ||
      (existing.employeeId ?? null) !== identity.employeeId ||
      (existing.serviceOfferingId ?? null) !== identity.serviceOfferingId ||
      existing.sessionDate !== identity.sessionDate
    ) {
      throw new ConflictError('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH')
    }
    return existing
  }

  /** Everyone in one session, primary included. Empty when the table is not there yet (pre-05). */
  private async participantsOf(
    ctx: TenancyContext,
    sessionId: string,
  ): Promise<ServiceDeliverySessionParticipant[]> {
    const { data, error } = await this.db
      .from('service_delivery_session_participants')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
    if (error && (error.code === '42P01' || error.code === 'PGRST205')) return []
    if (error) throw new DatabaseError('Failed to read session participants', error)
    return (data ?? []).map(mapDbRowToParticipant)
  }

  /**
   * Add one person to a session. The person must be of the session's subject
   * type and workspace (the database trigger is the authority); a person who is
   * already in the session is a replay, not a second assignment.
   */
  async addParticipant(
    ctx: TenancyContext,
    sessionId: string,
    input: { customerId?: string | undefined; employeeId?: string | undefined },
  ): Promise<{ participant: ServiceDeliverySessionParticipant; replayed: boolean }> {
    const session = await this.getById(ctx, sessionId)
    const subject = session.subjectType ?? 'customer'
    const personId = subject === 'customer' ? input.customerId : input.employeeId
    if (!personId) {
      throw new ValidationError(
        subject === 'customer' ? 'CUSTOMER_ID_REQUIRED' : 'EMPLOYEE_ID_REQUIRED',
      )
    }
    const existing = (session.participants ?? []).find((p) =>
      subject === 'customer' ? p.customerId === personId : p.employeeId === personId,
    )
    if (existing) return { participant: existing, replayed: true }

    const { data, error } = await this.db
      .from('service_delivery_session_participants')
      .insert({
        workspace_id: ctx.workspaceId,
        session_id: sessionId,
        participant_type: subject,
        ...(subject === 'customer' ? { customer_id: personId } : { employee_id: personId }),
        created_by: ctx.userId ?? null,
      })
      .select('*')
      .single()
    if (error) {
      if (error.code === '23505') {
        const now = await this.participantsOf(ctx, sessionId)
        const winner = now.find((p) =>
          subject === 'customer' ? p.customerId === personId : p.employeeId === personId,
        )
        if (winner) return { participant: winner, replayed: true }
      }
      throw this.failureOf(error, 'Failed to add session participant')
    }
    const participant = mapDbRowToParticipant(data)
    this.logSession(
      ctx,
      sessionId,
      'service_session_participant_added',
      'Session participant added',
      {
        participantId: participant.id,
        participantType: subject,
      },
    )
    return { participant, replayed: false }
  }

  /**
   * Remove one person. The database promotes the oldest remaining participant
   * when the primary leaves, and refuses to remove the last one. Financial and
   * historical rows are never touched.
   */
  async removeParticipant(
    ctx: TenancyContext,
    sessionId: string,
    participantId: string,
  ): Promise<{ session: ServiceDeliverySession }> {
    await this.getById(ctx, sessionId)
    const { data, error } = await this.db
      .from('service_delivery_session_participants')
      .delete()
      .eq('workspace_id', ctx.workspaceId)
      .eq('session_id', sessionId)
      .eq('id', participantId)
      .select('id')
    if (error) throw this.failureOf(error, 'Failed to remove session participant')
    if (!data || data.length === 0)
      throw new NotFoundError(`Session participant not found: ${participantId}`)
    this.logSession(
      ctx,
      sessionId,
      'service_session_participant_removed',
      'Session participant removed',
      {
        participantId,
      },
    )
    return { session: await this.getById(ctx, sessionId) }
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
    // A session created without a chosen method must not be delivered by
    // falling back to something: the person has to say how it is settled.
    if (settlement === 'undecided') throw new ValidationError('SETTLEMENT_METHOD_REQUIRED')
    // A package is a CUSTOMER account; an employee session has none to spend.
    if ((session.subjectType ?? 'customer') === 'employee' && settlement === 'package_credit') {
      throw new ValidationError('SETTLEMENT_CUSTOMER_REQUIRED')
    }
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
    // The screen's list when it sent one; otherwise the service's recipe
    // (salon-01 service_catalog). An explicit empty list means «none used».
    const materials =
      input.consumables ??
      (session.serviceOfferingId ? await this.recipeOf(ctx, session.serviceOfferingId) : [])
    if (materials.length > 0) {
      await this.consumeMaterials(ctx, session, materials)
    }

    const delivered = await this.getById(ctx, id)
    // A replay of a delivery writes nothing new, so it is not a second event.
    if (session.status !== 'delivered') {
      this.logSession(
        ctx,
        id,
        'service_session_delivered',
        `Service session delivered: ${delivered.settlementMethod}`,
        {
          settlementMethod: delivered.settlementMethod,
          invoiceId: delivered.invoiceId ?? null,
          packageCreditId: result.package_credit_id ?? null,
        },
      )
    }
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
    const before = await this.getById(ctx, id)

    const { data, error } = await this.db.rpc('service_delivery_cancel', {
      p_workspace_id: ctx.workspaceId,
      p_session_id: id,
      p_entry_id: options.reversalEntryId ?? null,
      p_reason: options.reason ?? null,
    })
    if (error) throw this.failureOf(error, 'Failed to cancel service session')

    const result = (data ?? {}) as { reversal_entry_id?: string | null }
    const cancelled = await this.getById(ctx, id)
    // A retry that finds an already-cancelled session repeats the answer; it
    // does not write a second event for one cancellation.
    if (before.status !== 'cancelled' && cancelled.status === 'cancelled') {
      this.logSession(ctx, id, 'service_session_cancelled', 'Service session cancelled', {
        reason: options.reason?.trim() ?? null,
        reversalEntryId: result.reversal_entry_id ?? null,
      })
    }
    return {
      session: cancelled,
      reversalEntry: result.reversal_entry_id
        ? await this.ledgerRow(ctx, result.reversal_entry_id)
        : null,
    }
  }

  /**
   * The activity/audit row for a session mutation.
   *
   * Fire-and-forget: the session is already stored, and a logging failure must
   * never turn a written session into an HTTP error. `notify: false` — the
   * person who just acted does not need a bell for their own action.
   */
  private logSession(
    ctx: TenancyContext,
    id: string,
    action: string,
    title: string,
    metadata: Record<string, unknown>,
  ): void {
    if (!ctx.userId) return
    logBusinessEvent({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: 'service_delivery_session',
      entityId: id,
      action,
      title,
      metadata,
      notify: false,
    }).catch((err) => console.error('[ServiceDeliveryService] logBusinessEvent failed:', err))
  }

  /**
   * «حاضر شد» (in_progress) or «نیامد» (no_show) — moves that carry no money.
   *
   * ⚠️ ONE ROW, ONE STATEMENT: the statuses the move may start from are in the
   * WHERE, so two devices tapping at once cannot both win, and a session that
   * was delivered in the meantime is not dragged back. When nothing matched,
   * the row is read again: already in `to` is a replay (a retried outbox entry);
   * anything else is the domain's refusal.
   */
  async moveStatus(
    ctx: TenancyContext,
    id: string,
    to: string,
  ): Promise<{ session: ServiceDeliverySession; replayed: boolean }> {
    const current = await this.getById(ctx, id)
    let planned: ReturnType<typeof planSessionStatusMove>
    try {
      planned = planSessionStatusMove({ session: current, to })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.startsWith('INVALID_STATUS_TRANSITION')) throw new ConflictError(message)
      throw new ValidationError(message)
    }
    if (planned.replayed) return planned

    const target = planned.session.status as SessionStatusMove
    const { data, error } = await this.db
      .from('service_delivery_sessions')
      .update({ status: target, updated_at: planned.session.updatedAt })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .is('deleted_at', null)
      .in('status', [...sessionStatusMoveSources(target)])
      .select('*')
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to change service session status', error)
    if (data) {
      if (ctx.userId) {
        void logBusinessEvent({
          userId: ctx.userId,
          workspaceId: ctx.workspaceId,
          entityType: 'service_delivery_session',
          entityId: id,
          action: 'service_session_status_moved',
          title: `Service session status changed: ${current.status} -> ${target}`,
          metadata: { from: current.status, to: target },
          notify: false,
        })
      }
      return { session: mapDbRowToSession(data), replayed: false }
    }

    const now = await this.getById(ctx, id)
    if (now.status === target) return { session: now, replayed: true }
    throw new ConflictError(`INVALID_STATUS_TRANSITION:${now.status}->${target}`)
  }

  /**
   * The materials a delivered session used (V54 5.4): stock out, its cost, and
   * ONE ledger entry — Dr cost of goods/services, Cr inventory — at the
   * session's date.
   *
   * ⚠️ ONCE PER LINE, ONCE PER SESSION, SAFE TO RETRY. supabase-js has no
   * transaction, so each step is idempotent instead and a retry completes what
   * a failure interrupted, never doubles it:
   *   · the cost issue is keyed by (session, product) — the database answers
   *     `already_consumed` with the cost it recorded the first time;
   *   · the stock movement is written ONLY for an issue that was new;
   *   · the ledger entry is keyed by the session (`postDocument` books a
   *     source once) and carries the summed cost of every line.
   * A replayed delivery used to deduct every material again.
   *
   * A chart of accounts without `cogs`/`inventory` is created on demand
   * (`ensureAccountsForRoles`); if it still cannot be expressed the stock and
   * cost stand and the skipped entry is logged — the same rule as opening
   * stock — rather than failing a service that was already delivered.
   */
  private async consumeMaterials(
    ctx: TenancyContext,
    session: ServiceDeliverySession,
    items: NonNullable<DeliverSessionInput['consumables']>,
  ): Promise<void> {
    let totalCost = 0
    for (const item of items) {
      const qty = Number(item.quantity)
      if (!item.productId || !(qty > 0)) continue
      const issue = await costing.recordIssue(ctx, {
        productId: item.productId,
        warehouseId: item.warehouseId ?? null,
        quantity: qty,
        entryDate: session.sessionDate,
        consumerType: 'adjustment',
        consumerId: session.id,
        consumerLine: item.productId,
      })
      totalCost += Number(issue.totalCost) || 0
      if (issue.status === 'already_consumed') continue

      const { error: smErr } = await this.db.from('stock_movements').insert({
        product_id: item.productId,
        type: 'adjustment',
        quantity: -qty,
        reference_type: 'service_session',
        reference_id: session.id,
        workspace_id: ctx.workspaceId,
        user_id: ctx.userId,
        notes: 'Material consumed during service session ' + session.id,
        ...(item.warehouseId ? { from_warehouse_id: item.warehouseId } : {}),
      })
      if (smErr) throw new DatabaseError('Failed to record stock movement for consumable', smErr)
    }

    const amount = Math.round(totalCost * 100) / 100
    if (!(amount > 0)) return
    const { accounts } = await ledger.ensureAccountsForRoles(ctx, ['cogs', 'inventory'])
    if (!accounts.cogs || !accounts.inventory) {
      console.error(
        `[ServiceDelivery] materials of session ${session.id} not booked: no cogs/inventory account`,
      )
      return
    }
    const outcome = await ledger.postDocument(ctx, {
      sourceType: 'stock_adjustment',
      sourceId: session.id,
      date: session.sessionDate,
      description: 'مواد مصرفی جلسه‌ی خدمت',
      reference: session.id,
      lines: [
        { accountId: accounts.cogs, debit: amount, credit: 0 },
        { accountId: accounts.inventory, debit: 0, credit: amount },
      ],
    })
    if (outcome.status === 'skipped') {
      console.error(
        `[ServiceDelivery] materials of session ${session.id} not booked: ${outcome.missing.join(', ')}`,
      )
    }
  }

  /**
   * The materials one delivery of a service uses, from its catalog row, each
   * from the warehouse the catalog names. None when the service has no
   * recipe or salon-01 has not been run.
   */
  private async recipeOf(
    ctx: TenancyContext,
    serviceProductId: string,
  ): Promise<NonNullable<DeliverSessionInput['consumables']>> {
    const { data, error } = await this.db
      .from('service_catalog')
      .select('consumables, warehouse_id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('product_id', serviceProductId)
      .maybeSingle()
    if (error && (error.code === '42P01' || error.code === 'PGRST205')) return []
    if (error) throw new DatabaseError('Failed to read the service recipe', error)
    if (!data) return []
    const list = Array.isArray(data.consumables) ? (data.consumables as unknown[]) : []
    return list.flatMap((entry) => {
      const item = entry as { productId?: unknown; quantity?: unknown }
      const quantity = Number(item.quantity)
      return typeof item.productId === 'string' && quantity > 0
        ? [
            {
              productId: item.productId,
              quantity,
              warehouseId: (data.warehouse_id as string | null) ?? null,
            },
          ]
        : []
    })
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
      code === 'INSUFFICIENT_ELIGIBLE_PACKAGE_CREDIT' ||
      code === 'PACKAGE_INVOICE_NOT_BOOKED' ||
      code === 'DEFERRED_REVENUE_ACCOUNT_MISSING' ||
      code === 'SALES_ACCOUNT_MISSING' ||
      code === 'PACKAGE_RELEASE_ENTRY_MISSING' ||
      code === 'ACCOUNTING_PERIOD_LOCKED' ||
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
      code === 'CANCELLATION_REASON_REQUIRED' ||
      code === 'PARTICIPANT_WORKSPACE_MISMATCH' ||
      code === 'PARTICIPANT_TYPE_MISMATCH' ||
      code === 'PARTICIPANT_PERSON_NOT_FOUND' ||
      code === 'PARTICIPANT_SESSION_NOT_FOUND'
    ) {
      return new ValidationError(code)
    }
    if (code === 'SESSION_PRIMARY_PARTICIPANT_REQUIRED') {
      return new ConflictError(code)
    }
    return new DatabaseError(fallback, error)
  }
}
