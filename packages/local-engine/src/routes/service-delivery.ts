// ============================================
// packages/local-engine/src/routes/service-delivery.ts
//
// M4 — SERVICE DELIVERY & ATTENDANCE CORE
// Local Engine handlers for Service Delivery Sessions & Practitioner Attendance
// ============================================

import {
  calculateSessionDurationMinutes,
  createServiceDeliverySessionSchema,
  planServiceDelivery,
  planServiceDeliveryCancellation,
  type AttendanceDay,
  type PackageCreditEntry,
  type PackageCreditEntryType,
  type ServiceDeliverySession,
  type ServiceDeliverySettlementMethod,
  type ServiceDeliveryStatus,
} from '@hisabche/validation'
import { buildEnqueue } from '@hisabche/app-bridge'
import { requireCapability } from '../auth'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface ServiceDeliverySessionRow {
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
  settlement_reason: string | null
  cancellation_reason: string | null
  client_notes: string | null
  internal_notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface PackageCreditLedgerRow {
  id: string
  workspace_id: string
  customer_id: string
  package_product_id: string
  entry_type: string
  quantity: number
  unit: string | null
  source_document_type: string | null
  source_document_id: string | null
  source_line_id: string | null
  reference_entry_id: string | null
  idempotency_key: string | null
  notes: string | null
  expires_at: string | null
  effective_date: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface AttendanceRow {
  id: string
  workspace_id: string
  employee_id: string
  date: string
  check_in: string | null
  check_out: string | null
  status: string
  notes: string | null
  ends_next_day?: number | boolean | null
}

function rowToSession(row: ServiceDeliverySessionRow): ServiceDeliverySession {
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
    settlementReason: row.settlement_reason,
    cancellationReason: row.cancellation_reason,
    clientNotes: row.client_notes,
    internalNotes: row.internal_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToEntry(row: PackageCreditLedgerRow): PackageCreditEntry {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    customerId: row.customer_id,
    packageProductId: row.package_product_id,
    entryType: row.entry_type as PackageCreditEntryType,
    quantity: Number(row.quantity),
    unit: row.unit,
    sourceDocumentType: row.source_document_type || undefined,
    sourceDocumentId: row.source_document_id,
    sourceLineId: row.source_line_id,
    referenceEntryId: row.reference_entry_id,
    idempotencyKey: row.idempotency_key,
    notes: row.notes,
    expiresAt: row.expires_at,
    effectiveDate: row.effective_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function registerServiceDeliveryRoutes(router: Router): void {
  // ─── 1. GET /service-delivery/sessions ─────────────────────────
  router.get('/service-delivery/sessions', (c: RouteHandlerContext) => {
    const date = c.query.date || c.query.sessionDate
    const customerId = c.query.customerId
    const practitionerId = c.query.practitionerId
    const status = c.query.status

    let sql = `SELECT * FROM service_delivery_sessions WHERE workspace_id = ? AND deleted_at IS NULL`
    const params: unknown[] = [c.ctx.workspaceId]

    if (date) {
      sql += ` AND session_date = ?`
      params.push(String(date))
    }
    if (customerId) {
      sql += ` AND customer_id = ?`
      params.push(String(customerId))
    }
    if (practitionerId) {
      sql += ` AND practitioner_id = ?`
      params.push(String(practitionerId))
    }
    if (status) {
      sql += ` AND status = ?`
      params.push(String(status))
    }

    sql += ` ORDER BY session_date DESC, start_time DESC`

    const rows = c.db.all<ServiceDeliverySessionRow>(sql, params)
    return { data: rows.map(rowToSession) }
  })

  // ─── 2. POST /service-delivery/sessions ────────────────────────
  router.post('/service-delivery/sessions', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')

    const parsed = createServiceDeliverySessionSchema.safeParse(c.body)
    if (!parsed.success) {
      throw new ValidationError(`INVALID_SERVICE_DELIVERY_PAYLOAD: ${parsed.error.message}`)
    }

    const input = parsed.data
    const durationMinutes = calculateSessionDurationMinutes(input.startTime, input.endTime)
    // A UUID, because the server's column is one: an id like `ses_123` would never sync.
    const id = input.id || randomUuid()

    return c.db.transaction(() => {
      // The id is the idempotency key: the same request again is the same session.
      const existing = c.db.get<ServiceDeliverySessionRow>(
        `SELECT * FROM service_delivery_sessions WHERE id = ? AND workspace_id = ?`,
        [id, c.ctx.workspaceId],
      )
      if (existing) {
        if (
          existing.customer_id !== input.customerId ||
          existing.service_offering_id !== input.serviceOfferingId ||
          existing.session_date !== input.sessionDate
        ) {
          throw new ConflictError('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH')
        }
        return { __status: 200, __data: rowToSession(existing) }
      }

      const now = new Date().toISOString()
      c.db.run(
        `INSERT INTO service_delivery_sessions (
          id, workspace_id, customer_id, service_offering_id, practitioner_id, branch_id,
          session_date, start_time, end_time, duration_minutes, status, settlement_method,
          client_notes, internal_notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          c.ctx.workspaceId,
          input.customerId,
          input.serviceOfferingId,
          input.practitionerId || null,
          input.branchId || null,
          input.sessionDate,
          input.startTime,
          input.endTime,
          durationMinutes,
          'scheduled',
          input.settlementMethod,
          input.clientNotes || null,
          input.internalNotes || null,
          now,
          now,
        ],
      )

      const sessionRow = c.db.get<ServiceDeliverySessionRow>(
        `SELECT * FROM service_delivery_sessions WHERE id = ? AND workspace_id = ?`,
        [id, c.ctx.workspaceId],
      )
      if (!sessionRow) throw new Error('FAILED_TO_CREATE_SERVICE_DELIVERY_SESSION')
      const session = rowToSession(sessionRow)

      if (c.headers?.['x-hisabche-queue'] === '1') {
        // The shape the SERVER reads (camelCase) - the raw row was snake_case and the server refused it as empty.
        enqueueSessionCommand(c, id, 'create', { ...session })
      }

      return { __status: 201, __data: session }
    })
  })

  // ─── 3. POST /service-delivery/sessions/:id/deliver ─────────────
  router.post('/service-delivery/sessions/:id/deliver', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')

    const sessionId = c.params.id
    if (!sessionId) throw new ValidationError('SESSION_ID_REQUIRED')

    const body = (c.body || {}) as {
      packageProductId?: string
      settlementMethod?: ServiceDeliverySettlementMethod
      quantity?: number
      invoiceId?: string
      reason?: string
      expectedUpdatedAt?: string
    }

    // ONE transaction: the session, the credit entry and the command either all exist or none does.
    return c.db.transaction(() => {
      const sessionRow = c.db.get<ServiceDeliverySessionRow>(
        `SELECT * FROM service_delivery_sessions WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
        [sessionId, c.ctx.workspaceId],
      )
      if (!sessionRow) throw new NotFoundError('Service delivery session', sessionId)

      if (body.expectedUpdatedAt && sessionRow.updated_at !== body.expectedUpdatedAt) {
        throw new ConflictError('SESSION_CHANGED')
      }

      // An invoice is an existing document of THIS customer in THIS workspace (made by the invoice engine).
      if (body.invoiceId && sessionRow.status !== 'delivered') {
        const invoice = c.db.get<{ customer_id: string | null }>(
          `SELECT customer_id FROM invoice WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
          [body.invoiceId, c.ctx.workspaceId],
        )
        if (!invoice || invoice.customer_id !== sessionRow.customer_id) {
          throw new ValidationError('SETTLEMENT_INVOICE_INVALID')
        }
      }

      const creditRows = c.db.all<PackageCreditLedgerRow>(
        `SELECT * FROM package_credit_ledger WHERE workspace_id = ? AND customer_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
        [c.ctx.workspaceId, sessionRow.customer_id],
      )

      let attendanceRecord: AttendanceDay | null = null
      if (sessionRow.practitioner_id) {
        const attRow = c.db.get<AttendanceRow>(
          `SELECT * FROM attendance WHERE workspace_id = ? AND employee_id = ? AND date = ? LIMIT 1`,
          [c.ctx.workspaceId, sessionRow.practitioner_id, sessionRow.session_date],
        )
        if (attRow) {
          attendanceRecord = {
            employeeId: attRow.employee_id,
            date: attRow.date,
            checkIn: attRow.check_in,
            checkOut: attRow.check_out,
            status: attRow.status as AttendanceDay['status'],
            note: attRow.notes,
            endsNextDay: Boolean(attRow.ends_next_day),
          }
        }
      }

      const session = rowToSession(sessionRow)
      let plan: ReturnType<typeof planServiceDelivery>
      try {
        plan = planServiceDelivery({
          session,
          creditEntries: creditRows.map(rowToEntry),
          packageProductId: body.packageProductId,
          requestedSettlementMethod: body.settlementMethod,
          quantity: body.quantity ?? 1,
          attendanceRecord,
          invoiceId: body.invoiceId,
          reason: body.reason,
        })
      } catch (err) {
        throw domainFailure(err)
      }

      // A replay of a delivery that already happened: the answer, and nothing new.
      if (sessionRow.status === 'delivered') {
        return { __status: 200, __data: { session: plan.session, consumptionEntry: null } }
      }

      const changed = c.db.run(
        `UPDATE service_delivery_sessions
            SET status = 'delivered', settlement_method = ?, package_credit_id = ?, invoice_id = ?,
                settlement_reason = ?, updated_at = ?
          WHERE id = ? AND workspace_id = ? AND status = ? AND updated_at = ?`,
        [
          plan.session.settlementMethod,
          plan.session.packageCreditId || null,
          plan.session.invoiceId || null,
          plan.session.settlementReason || null,
          plan.session.updatedAt,
          sessionId,
          c.ctx.workspaceId,
          sessionRow.status,
          sessionRow.updated_at,
        ],
      )
      if (changed.changes !== 1) throw new ConflictError('SESSION_CHANGED')

      const entry = plan.consumptionEntry
      if (entry) {
        // The ledger refuses a second consume for this session (unique index): that failure rolls the whole thing back.
        insertLedgerEntry(c, entry, sessionId)
      }

      if (c.headers?.['x-hisabche-queue'] === '1') {
        // ONE command: the server consumes inside its own transaction, with the SAME entry id, so both sides name the
        // same ledger fact. (A second `package_credit_ledger` command would race this one.)
        enqueueSessionCommand(c, `${sessionId}-deliver`, 'update', {
          ...plan.session,
          status: 'delivered',
          packageProductId: body.packageProductId ?? null,
          quantity: body.quantity ?? 1,
          consumptionEntryId: entry?.id ?? null,
          reason: body.reason ?? null,
        })
      }

      return { __status: 200, __data: { session: plan.session, consumptionEntry: entry } }
    })
  })

  // ─── 4. POST /service-delivery/sessions/:id/cancel ──────────────
  router.post('/service-delivery/sessions/:id/cancel', (c: RouteHandlerContext) => {
    // The server's route asks for invoice.create (a seller cancels a session); the device asks for the same, not more.
    requireCapability(c.ctx, 'invoice.create')

    const sessionId = c.params.id
    if (!sessionId) throw new ValidationError('SESSION_ID_REQUIRED')

    const body = (c.body || {}) as { reason?: string }

    return c.db.transaction(() => {
      const sessionRow = c.db.get<ServiceDeliverySessionRow>(
        `SELECT * FROM service_delivery_sessions WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
        [sessionId, c.ctx.workspaceId],
      )
      if (!sessionRow) throw new NotFoundError('Service delivery session', sessionId)

      const creditRows =
        sessionRow.settlement_method === 'package_credit' && sessionRow.package_credit_id
          ? c.db.all<PackageCreditLedgerRow>(
              `SELECT * FROM package_credit_ledger WHERE workspace_id = ? AND customer_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
              [c.ctx.workspaceId, sessionRow.customer_id],
            )
          : []

      let plan: ReturnType<typeof planServiceDeliveryCancellation>
      try {
        plan = planServiceDeliveryCancellation({
          session: rowToSession(sessionRow),
          creditEntries: creditRows.map(rowToEntry),
          reason: body.reason,
        })
      } catch (err) {
        throw domainFailure(err)
      }

      // A replay of a cancel that already happened: the answer, and nothing new.
      if (sessionRow.status === 'cancelled') {
        return { session: plan.session, reversalEntry: null }
      }

      const changed = c.db.run(
        `UPDATE service_delivery_sessions SET status = 'cancelled', cancellation_reason = ?, updated_at = ?
          WHERE id = ? AND workspace_id = ? AND status = ? AND updated_at = ?`,
        [
          plan.session.cancellationReason || null,
          plan.session.updatedAt,
          sessionId,
          c.ctx.workspaceId,
          sessionRow.status,
          sessionRow.updated_at,
        ],
      )
      if (changed.changes !== 1) throw new ConflictError('SESSION_CHANGED')

      if (plan.reversalEntry) insertLedgerEntry(c, plan.reversalEntry, sessionId)

      if (c.headers?.['x-hisabche-queue'] === '1') {
        enqueueSessionCommand(c, `${sessionId}-cancel`, 'update', {
          ...plan.session,
          status: 'cancelled',
          reason: plan.session.cancellationReason ?? null,
          reversalEntryId: plan.reversalEntry?.id ?? null,
        })
      }

      return { session: plan.session, reversalEntry: plan.reversalEntry }
    })
  })
}

// ─── helpers ──────────────────────────────────────────────────────

function randomUuid(): string {
  return crypto.randomUUID()
}

/** The domain throws codes; the route turns them into the status the server would answer. */
function domainFailure(err: unknown): ValidationError | ConflictError {
  const message = err instanceof Error ? err.message : String(err)
  const conflict =
    message.startsWith('INVALID_STATUS_TRANSITION') ||
    message === 'INSUFFICIENT_PACKAGE_CREDIT' ||
    message === 'DELIVERED_INVOICE_CORRECTION_REQUIRED' ||
    message === 'CREDIT_REFERENCE_MISSING'
  return conflict ? new ConflictError(message) : new ValidationError(message)
}

function enqueueSessionCommand(
  c: RouteHandlerContext,
  clientId: string,
  operation: 'create' | 'update',
  payload: Record<string, unknown>,
): void {
  const enqueue = buildEnqueue({
    entity: 'service_delivery_sessions',
    operation,
    clientId,
    payload,
    userId: c.ctx.userId ?? null,
    workspaceId: c.ctx.workspaceId,
  })
  c.db.run(enqueue.sql, enqueue.params)
}

function insertLedgerEntry(
  c: RouteHandlerContext,
  entry: PackageCreditEntry,
  sessionId: string,
): void {
  c.db.run(
    `INSERT INTO package_credit_ledger (
       id, workspace_id, customer_id, package_product_id, entry_type, quantity, unit,
       source_document_type, source_document_id, reference_entry_id, idempotency_key, notes, effective_date,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      c.ctx.workspaceId,
      entry.customerId,
      entry.packageProductId,
      entry.entryType,
      entry.quantity,
      entry.unit || null,
      'service_delivery',
      sessionId,
      entry.referenceEntryId || null,
      entry.idempotencyKey || null,
      entry.notes || null,
      entry.effectiveDate,
      entry.createdAt,
      entry.createdAt,
    ],
  )
}
