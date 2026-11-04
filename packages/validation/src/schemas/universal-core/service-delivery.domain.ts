// ============================================
// packages/validation/src/schemas/universal-core/service-delivery.domain.ts
//
// M4 — SERVICE DELIVERY & ATTENDANCE CORE
// Universal Domain Model for Service Delivery Sessions, Practitioner Attendance,
// and Package Credit Redemption.
//
// Architectural Invariants:
// 1. One Domain Model: Identical session lifecycle and rules across Web, Windows, Android.
// 2. Three Truths Maintained:
//    - Service Delivery Truth: Delivery facts & practitioner attendance records.
//    - Package Credit Truth: Prepaid credits consumed or reversed via package credit ledger.
//    - Financial / Accounting Truth: Handled by existing invoice & accounting engines.
// 3. Settlement is CHOSEN, never inferred (no implicit debt, no implicit giveaway):
//    - package_credit -> needs a named package and enough credit, or the delivery is REFUSED.
//    - invoice        -> needs an invoice that already exists (made by the invoice engine); it is linked, not created here.
//    - complementary  -> ("free") needs a reason, kept on the session.
//    A delivery that cannot be settled as chosen is refused whole; it never turns into another settlement.
// 3b. The idempotency identity of a delivery / its reversal is the SESSION (one consume, one reversal per session).
// 4. Practitioner Attendance Validation:
//    - When attendance record is provided for practitioner on session date, verifies practitioner
//      is not marked absent/on leave.
// ============================================

import { z } from 'zod'
import {
  derivePackageBalance,
  filterEntriesForAccount,
  planPackageConsumption,
  planPackageReversal,
  type PackageCreditEntry,
} from './package-credit-ledger.domain'
import { minutesOf, type AttendanceDay } from '../attendance-rules'

export const SERVICE_DELIVERY_STATUSES = [
  'scheduled',
  'in_progress',
  'delivered',
  'cancelled',
  'no_show',
] as const

export type ServiceDeliveryStatus = (typeof SERVICE_DELIVERY_STATUSES)[number]
export const serviceDeliveryStatusSchema = z.enum(SERVICE_DELIVERY_STATUSES)

export const SERVICE_DELIVERY_SETTLEMENT_METHODS = [
  'package_credit',
  'invoice',
  'complementary',
] as const

export type ServiceDeliverySettlementMethod = (typeof SERVICE_DELIVERY_SETTLEMENT_METHODS)[number]
export const serviceDeliverySettlementMethodSchema = z.enum(SERVICE_DELIVERY_SETTLEMENT_METHODS)

export interface ServiceDeliverySession {
  readonly id: string
  readonly workspaceId: string
  readonly customerId: string
  readonly serviceOfferingId: string
  readonly practitionerId?: string | null | undefined
  readonly branchId?: string | null | undefined
  readonly sessionDate: string // YYYY-MM-DD
  readonly startTime: string // HH:mm
  readonly endTime: string // HH:mm
  readonly durationMinutes: number
  readonly status: ServiceDeliveryStatus
  readonly settlementMethod: ServiceDeliverySettlementMethod
  readonly packageCreditId?: string | null | undefined
  readonly invoiceId?: string | null | undefined
  /** Why a complementary ("free") session was given. Required for that settlement. */
  readonly settlementReason?: string | null | undefined
  /** Why the session was cancelled. Required to cancel. */
  readonly cancellationReason?: string | null | undefined
  readonly clientNotes?: string | null | undefined
  readonly internalNotes?: string | null | undefined
  readonly createdAt: string
  readonly updatedAt: string
  readonly [key: string]: unknown
}

export const serviceDeliverySessionSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  customerId: z.string().min(1),
  serviceOfferingId: z.string().min(1),
  practitionerId: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{1,2}:\d{2}$/),
  endTime: z.string().regex(/^\d{1,2}:\d{2}$/),
  durationMinutes: z.number().int().nonnegative(),
  status: serviceDeliveryStatusSchema,
  settlementMethod: serviceDeliverySettlementMethodSchema,
  packageCreditId: z.string().nullable().optional(),
  invoiceId: z.string().nullable().optional(),
  clientNotes: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const createServiceDeliverySessionSchema = z.object({
  id: z.string().optional(),
  workspaceId: z.string().min(1),
  customerId: z.string().min(1),
  serviceOfferingId: z.string().min(1),
  practitionerId: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{1,2}:\d{2}$/),
  endTime: z.string().regex(/^\d{1,2}:\d{2}$/),
  // A session is BORN scheduled. «delivered» is reached only through the deliver action (settlement + credit in one step);
  // a create that could say `delivered` would be a delivery with no settlement at all.
  status: z.literal('scheduled').default('scheduled'),
  settlementMethod: serviceDeliverySettlementMethodSchema.default('package_credit'),
  clientNotes: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
})

export type CreateServiceDeliverySessionInput = z.infer<typeof createServiceDeliverySessionSchema>

/**
 * Calculates session duration in minutes from start and end times ('HH:mm').
 * Supports overnight sessions when endsNextDay is true.
 */
export function calculateSessionDurationMinutes(
  startTime: string,
  endTime: string,
  endsNextDay = false,
): number {
  const start = minutesOf(startTime)
  const end = minutesOf(endTime)

  if (start === null || end === null) {
    throw new Error('INVALID_SESSION_TIME_FORMAT')
  }

  if (endsNextDay) {
    return 1440 - start + end
  }

  if (end < start) {
    throw new Error('SESSION_END_BEFORE_START')
  }

  return end - start
}

/**
 * Validates allowed lifecycle status transitions.
 */
export function isValidSessionStatusTransition(
  from: ServiceDeliveryStatus,
  to: ServiceDeliveryStatus,
): boolean {
  if (from === to) return true

  switch (from) {
    case 'scheduled':
      return to === 'in_progress' || to === 'delivered' || to === 'cancelled'
    case 'in_progress':
      return to === 'delivered' || to === 'no_show' || to === 'cancelled'
    case 'delivered':
      // Delivered is terminal except for explicit administrative cancellation
      return to === 'cancelled'
    case 'cancelled':
    case 'no_show':
      return false
    default:
      return false
  }
}

export interface VerifyPractitionerAttendanceParams {
  readonly practitionerId?: string | null | undefined
  readonly sessionDate: string
  readonly attendanceRecord?: AttendanceDay | null | undefined
}

export interface AttendanceVerificationResult {
  readonly allowed: boolean
  readonly reason?: string | undefined
}

/**
 * Verifies practitioner attendance on the session date.
 * If attendance record is provided and employee was absent or on leave, returns not allowed.
 */
export function verifyPractitionerAttendance(
  params: VerifyPractitionerAttendanceParams,
): AttendanceVerificationResult {
  const { practitionerId, sessionDate, attendanceRecord } = params
  if (!practitionerId || !attendanceRecord) {
    return { allowed: true }
  }

  if (attendanceRecord.employeeId !== practitionerId) {
    return { allowed: false, reason: 'ATTENDANCE_RECORD_EMPLOYEE_MISMATCH' }
  }

  if (attendanceRecord.date !== sessionDate) {
    return { allowed: false, reason: 'ATTENDANCE_RECORD_DATE_MISMATCH' }
  }

  if (attendanceRecord.status === 'absent') {
    return { allowed: false, reason: 'PRACTITIONER_ABSENT_ON_SESSION_DATE' }
  }

  if (attendanceRecord.status === 'leave') {
    return { allowed: false, reason: 'PRACTITIONER_ON_LEAVE_ON_SESSION_DATE' }
  }

  return { allowed: true }
}

/** One consume per session: the key is derived from the session, so no request id can make a second one. */
export function deliveryConsumeKey(sessionId: string): string {
  return `delivery_${sessionId}`
}

/** One reversal per session, for the same reason. */
export function deliveryReversalKey(sessionId: string): string {
  return `delivery_cancel_${sessionId}`
}

export interface ConsumableMaterialItem {
  readonly productId: string
  readonly quantity: number
  readonly warehouseId?: string | null | undefined
}

export interface PlanServiceDeliveryParams {
  readonly session: ServiceDeliverySession
  readonly creditEntries?: readonly PackageCreditEntry[] | undefined
  readonly packageProductId?: string | null | undefined
  readonly requestedSettlementMethod?: ServiceDeliverySettlementMethod | undefined
  readonly quantity?: number | undefined
  readonly attendanceRecord?: AttendanceDay | null | undefined
  /** The existing invoice that bills this session. Required for `invoice`. */
  readonly invoiceId?: string | null | undefined
  /** Why the session is free. Required for `complementary`. */
  readonly reason?: string | null | undefined
  /** Accepted for callers that still pass it; the identity of a delivery is the session (`deliveryConsumeKey`). */
  readonly idempotencyKey?: string | null | undefined
  /** Materials/consumables used during service delivery (deducted via CostingService FIFO/AVCO). */
  readonly consumables?: readonly ConsumableMaterialItem[] | undefined
}

export interface PlanServiceDeliveryResult {
  readonly session: ServiceDeliverySession
  readonly consumptionEntry: PackageCreditEntry | null
}

/**
 * Plans a delivery and its settlement. Pure: it decides, the caller writes (in ONE transaction).
 *
 * Refuses - never substitutes - when the chosen settlement cannot be honoured:
 * `SETTLEMENT_PACKAGE_REQUIRED`, `INSUFFICIENT_PACKAGE_CREDIT`, `SETTLEMENT_INVOICE_REQUIRED`,
 * `SETTLEMENT_REASON_REQUIRED`, `INVALID_STATUS_TRANSITION:x->delivered`, the attendance refusals.
 * A session that is already delivered is a replay: nothing new is planned.
 */
export function planServiceDelivery(params: PlanServiceDeliveryParams): PlanServiceDeliveryResult {
  const {
    session,
    creditEntries = [],
    packageProductId,
    requestedSettlementMethod,
    quantity = 1,
    attendanceRecord,
    invoiceId,
    reason,
  } = params

  if (session.status === 'delivered') {
    return { session, consumptionEntry: null }
  }

  if (!isValidSessionStatusTransition(session.status, 'delivered')) {
    throw new Error(`INVALID_STATUS_TRANSITION:${session.status}->delivered`)
  }

  if (session.practitionerId && attendanceRecord) {
    const attendanceCheck = verifyPractitionerAttendance({
      practitionerId: session.practitionerId,
      sessionDate: session.sessionDate,
      attendanceRecord,
    })
    if (!attendanceCheck.allowed) {
      throw new Error(attendanceCheck.reason || 'PRACTITIONER_ATTENDANCE_FAILED')
    }
  }

  const method = requestedSettlementMethod ?? session.settlementMethod
  const now = new Date().toISOString()

  if (method === 'complementary') {
    const why = reason?.trim()
    if (!why) throw new Error('SETTLEMENT_REASON_REQUIRED')
    return {
      session: {
        ...session,
        status: 'delivered',
        settlementMethod: 'complementary',
        settlementReason: why,
        packageCreditId: null,
        updatedAt: now,
      },
      consumptionEntry: null,
    }
  }

  if (method === 'invoice') {
    if (!invoiceId) throw new Error('SETTLEMENT_INVOICE_REQUIRED')
    return {
      session: {
        ...session,
        status: 'delivered',
        settlementMethod: 'invoice',
        invoiceId,
        packageCreditId: null,
        updatedAt: now,
      },
      consumptionEntry: null,
    }
  }

  // package_credit
  if (!packageProductId) throw new Error('SETTLEMENT_PACKAGE_REQUIRED')
  const balance = derivePackageBalance(
    filterEntriesForAccount(creditEntries, session.customerId, packageProductId),
  )
  if (balance < quantity) throw new Error('INSUFFICIENT_PACKAGE_CREDIT')

  const consumption = planPackageConsumption({
    entries: creditEntries,
    workspaceId: session.workspaceId,
    customerId: session.customerId,
    packageProductId,
    quantity,
    sourceDocumentType: 'service_delivery',
    sourceDocumentId: session.id,
    idempotencyKey: deliveryConsumeKey(session.id),
    notes: `Delivered service session ${session.id}`,
    effectiveDate: session.sessionDate,
  })

  return {
    session: {
      ...session,
      status: 'delivered',
      settlementMethod: 'package_credit',
      packageCreditId: consumption.entry.id,
      updatedAt: now,
    },
    consumptionEntry: consumption.entry,
  }
}

export interface PlanServiceCancellationParams {
  readonly session: ServiceDeliverySession
  readonly creditEntries?: readonly PackageCreditEntry[] | undefined
  /** Why the session is cancelled. Required, except for a replay of a cancellation that already happened. */
  readonly reason?: string | null | undefined
  readonly idempotencyKey?: string | null | undefined
}

export interface PlanServiceCancellationResult {
  readonly session: ServiceDeliverySession
  readonly reversalEntry: PackageCreditEntry | null
}

/**
 * Plans the cancellation of a session.
 *
 *  - already cancelled: a replay, nothing planned (and no reason asked for)
 *  - a move the table forbids (e.g. no_show -> cancelled): refused
 *  - no reason: refused (`CANCELLATION_REASON_REQUIRED`) - a cancellation without a stated why cannot be audited
 *  - delivered by package credit: a compensating REVERSAL that references the consumed entry (the ledger is never
 *    edited); a package session whose consumed entry is unknown is REFUSED (`CREDIT_REFERENCE_MISSING`) - it must not be
 *    cancelled without giving the credit back
 *  - delivered and invoiced: refused (`DELIVERED_INVOICE_CORRECTION_REQUIRED`): undoing a billed service is a correction
 *    flow with its own policy, not a status change
 *  - delivered and free: nothing financial to undo
 */
export function planServiceDeliveryCancellation(
  params: PlanServiceCancellationParams,
): PlanServiceCancellationResult {
  const { session, creditEntries = [], reason } = params

  if (session.status === 'cancelled') {
    return { session, reversalEntry: null }
  }

  if (!isValidSessionStatusTransition(session.status, 'cancelled')) {
    throw new Error(`INVALID_STATUS_TRANSITION:${session.status}->cancelled`)
  }

  const why = reason?.trim()
  if (!why) throw new Error('CANCELLATION_REASON_REQUIRED')

  let reversalEntry: PackageCreditEntry | null = null

  if (session.status === 'delivered') {
    if (session.settlementMethod === 'invoice') {
      throw new Error('DELIVERED_INVOICE_CORRECTION_REQUIRED')
    }
    if (session.settlementMethod === 'package_credit') {
      if (!session.packageCreditId) throw new Error('CREDIT_REFERENCE_MISSING')
      reversalEntry = planPackageReversal({
        entries: creditEntries,
        referenceEntryId: session.packageCreditId,
        idempotencyKey: deliveryReversalKey(session.id),
        notes: `Reversal for cancelled service session ${session.id}`,
      }).entry
    }
  }

  return {
    session: {
      ...session,
      status: 'cancelled',
      cancellationReason: why,
      updatedAt: new Date().toISOString(),
    },
    reversalEntry,
  }
}
