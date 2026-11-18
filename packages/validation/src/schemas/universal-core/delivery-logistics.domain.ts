// ============================================
// packages/validation/src/schemas/universal-core/delivery-logistics.domain.ts
//
// WP-19 — the delivery, dispatch and COD rules that BOTH sides run.
//
// ⚠️ WHY THIS IS ONE FILE AND NOT THREE.
//
// A parcel is closed on a phone in a street with no signal, and closed again on
// the server when the outbox reaches it. If the two disagreed about what a
// closed parcel looks like, the same delivery would be «delivered» in one ledger
// and «failed» in the other, and the COD figure would differ between the driver's
// hand and the cashier's drawer. So: same rules, same file, imported by the
// server (`TransportService`) and by the device (`local-engine/routes/deliveries`).
//
// Three facts this file refuses to let anybody invent:
//
// 1. A failed attempt is NOT a delivery. `status` becomes `failed`, it carries a
//    reason, and it carries no recipient, no proof and no money. «تحویل ناموفق نه
//    تکمیل‌شده و نه دریافت‌شده» — the row must never read `delivered` because
//    somebody typed a note on it.
// 2. A COD shortfall is a receivable, not a discount. `shortfallMinor` is what the
//    customer still owes; the payment that gets recorded is only what was
//    collected. Nothing here zeroes the difference.
// 3. A vehicle whose periodic service is overdue does not get a parcel. No record
//    of a service is NOT the same as «service is fine» — it is `unknown`, it is
//    allowed, and it is reported as unknown to the person dispatching.
// ============================================

import type { CodStage, DeliveryStatus } from './specialized-extensions.domain'

/** How the customer's acceptance was captured at the door. */
export type DeliveryPodMethod = 'signature' | 'photo' | 'code'

export const DELIVERY_POD_METHODS: readonly DeliveryPodMethod[] = ['signature', 'photo', 'code']

export function isDeliveryPodMethod(value: unknown): value is DeliveryPodMethod {
  return typeof value === 'string' && (DELIVERY_POD_METHODS as readonly string[]).includes(value)
}

/** What the row held before this attempt, as far as the rules care. */
export interface CourierDeliverySnapshot {
  readonly status: DeliveryStatus
  readonly codStage: CodStage
  /** What the delivery is expected to collect. Minor units; 0 means «COD نقدی ندارد». */
  readonly codAmountMinor: number
  /**
   * The code the customer was given when the parcel left the shop (SMS/print).
   * NULL when no code was issued — and a code cannot be verified against NULL.
   */
  readonly podCode?: string | null | undefined
}

/** What the driver collected at the door, before any rule was applied. */
export interface DeliveryPodCapture {
  readonly method: DeliveryPodMethod
  readonly recipientName: string
  /** The code the customer read out. Required — and verified — for `method: 'code'`. */
  readonly code?: string | null | undefined
  /** Storage reference of the photo. Required for `method: 'photo'`. */
  readonly photoRef?: string | null | undefined
  readonly notes?: string | null | undefined
  /** When the customer accepted it. Absent means «now». */
  readonly capturedAt?: string | null | undefined
}

export type DeliveryAttempt =
  | {
      readonly outcome: 'delivered'
      readonly pod: DeliveryPodCapture
      /** What the driver actually received. Absent means «the full COD amount». */
      readonly collectedMinor?: number | undefined
    }
  | {
      readonly outcome: 'failed'
      readonly failureReason: string
    }

export type DeliveryAttemptIssue =
  | 'DELIVERY_ALREADY_CLOSED'
  | 'POD_METHOD_REQUIRED'
  | 'POD_RECIPIENT_REQUIRED'
  | 'POD_CODE_REQUIRED'
  | 'POD_CODE_MISMATCH'
  | 'POD_PHOTO_REF_REQUIRED'
  | 'FAILURE_REASON_REQUIRED'
  | 'COD_AMOUNT_INVALID'
  | 'COD_COLLECTED_EXCEEDS_DUE'
  | 'COD_COLLECTED_WITHOUT_COD'

/** The exact row a closed delivery must have. Never partial. */
export interface DeliveryClose {
  readonly status: 'delivered' | 'failed'
  readonly codStage: CodStage
  readonly deliveredAt: string | null
  readonly pod: DeliveryPodCapture | null
  readonly collectedMinor: number
  /** What the customer still owes. 0 for a failed attempt: nothing was collected or forgiven. */
  readonly shortfallMinor: number
  readonly failureReason: string | null
}

export type DeliveryAttemptDecision =
  | { readonly ok: true; readonly close: DeliveryClose }
  | { readonly ok: false; readonly issues: readonly DeliveryAttemptIssue[] }

/** A parcel in one of these states cannot be closed again. */
const CLOSED_DELIVERY_STATUSES: readonly DeliveryStatus[] = ['delivered', 'returned']

const trim = (value: string | null | undefined): string =>
  typeof value === 'string' ? value.trim() : ''

/**
 * The one decision both sides make when a driver reports what happened at the door.
 *
 * `at` is the moment the attempt is closed (an ISO timestamp); the caller passes
 * the statement time on the server and the device clock offline.
 */
export function decideDeliveryAttempt(
  delivery: CourierDeliverySnapshot,
  attempt: DeliveryAttempt,
  at: string = new Date().toISOString(),
): DeliveryAttemptDecision {
  if (CLOSED_DELIVERY_STATUSES.includes(delivery.status)) {
    return { ok: false, issues: ['DELIVERY_ALREADY_CLOSED'] }
  }

  if (attempt.outcome === 'failed') {
    const reason = trim(attempt.failureReason)
    if (reason.length === 0) return { ok: false, issues: ['FAILURE_REASON_REQUIRED'] }

    return {
      ok: true,
      close: {
        status: 'failed',
        // The COD stage does not move: nothing was collected, so the money is
        // still «to_collect» exactly as it was before the attempt.
        codStage: delivery.codStage,
        deliveredAt: null,
        pod: null,
        collectedMinor: 0,
        shortfallMinor: 0,
        failureReason: reason,
      },
    }
  }

  const issues: DeliveryAttemptIssue[] = []
  const { pod } = attempt

  if (!isDeliveryPodMethod(pod.method)) issues.push('POD_METHOD_REQUIRED')
  if (trim(pod.recipientName).length === 0) issues.push('POD_RECIPIENT_REQUIRED')

  if (pod.method === 'photo' && trim(pod.photoRef).length === 0) {
    issues.push('POD_PHOTO_REF_REQUIRED')
  }

  if (pod.method === 'code') {
    const issued = trim(delivery.podCode)
    const given = trim(pod.code)
    // No code was ever issued: there is nothing to match, so this method cannot
    // be used. Guessing «any code passes» would be a signature that signs itself.
    if (issued.length === 0 || given.length === 0) issues.push('POD_CODE_REQUIRED')
    else if (issued !== given) issues.push('POD_CODE_MISMATCH')
  }

  const collectedMinor = attempt.collectedMinor ?? delivery.codAmountMinor
  if (!Number.isInteger(collectedMinor) || collectedMinor < 0) {
    issues.push('COD_AMOUNT_INVALID')
  } else if (delivery.codAmountMinor === 0 && collectedMinor > 0) {
    // Checked before «exceeds»: «cash handed over on a delivery that had nothing
    // to collect» is the useful sentence, not «249.99 over the amount due».
    issues.push('COD_COLLECTED_WITHOUT_COD')
  } else if (collectedMinor > delivery.codAmountMinor) {
    issues.push('COD_COLLECTED_EXCEEDS_DUE')
  }

  if (issues.length > 0) return { ok: false, issues }

  const deliveredAt = trim(pod.capturedAt) || at
  const shortfallMinor = delivery.codAmountMinor - collectedMinor

  return {
    ok: true,
    close: {
      status: 'delivered',
      // The driver holds the cash from this moment; settling it into the till is
      // a separate, later movement (and the shortfall stays a receivable until
      // the customer pays it).
      codStage: delivery.codAmountMinor > 0 ? 'with_driver' : delivery.codStage,
      deliveredAt,
      pod: {
        method: pod.method,
        recipientName: trim(pod.recipientName),
        ...(trim(pod.code) ? { code: trim(pod.code) } : {}),
        ...(trim(pod.photoRef) ? { photoRef: trim(pod.photoRef) } : {}),
        ...(trim(pod.notes) ? { notes: trim(pod.notes) } : {}),
      },
      collectedMinor,
      shortfallMinor,
      failureReason: null,
    },
  }
}

// ─── Dispatch: which vehicle may take a parcel ───────────────────────────

export type VehicleServiceState = 'ok' | 'due_soon' | 'overdue' | 'unknown'

/** Whole days from `from` to `to`, both `YYYY-MM-DD`, read as UTC dates. */
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86_400_000)
}

/**
 * Where a vehicle stands with its periodic service.
 *
 * `unknown` is a real answer: a vehicle nobody has ever serviced has no due date,
 * and «no date» must not read as «fine». The dispatcher is allowed to send it and
 * is told that nothing is known about its service.
 */
export function vehicleServiceState(
  nextServiceDueOn: string | null | undefined,
  asOf: string,
  dueSoonDays = 7,
): VehicleServiceState {
  const due = trim(nextServiceDueOn)
  if (due.length === 0) return 'unknown'

  const remaining = daysBetween(asOf, due)
  if (remaining < 0) return 'overdue'
  if (remaining <= dueSoonDays) return 'due_soon'
  return 'ok'
}

export interface DispatchVehicleSnapshot {
  readonly active: boolean
  /** Parcels the vehicle can take in one day. NULL = never declared, not «unlimited». */
  readonly capacityParcels?: number | null | undefined
  readonly nextServiceDueOn?: string | null | undefined
}

export type DispatchIssue = 'VEHICLE_INACTIVE' | 'VEHICLE_SERVICE_OVERDUE' | 'VEHICLE_AT_CAPACITY'

export interface DispatchCheckInput {
  readonly vehicle: DispatchVehicleSnapshot
  /** Deliveries already assigned to this vehicle on the same day (excluding the one being assigned). */
  readonly assignedOnDate: number
  readonly asOf: string
}

/**
 * Why this vehicle must not take the parcel. Empty means «it may».
 *
 * A vehicle with no declared capacity is allowed: capacity is a fact somebody
 * wrote down, and its absence is not proof that the van is full.
 */
export function dispatchIssues(input: DispatchCheckInput): readonly DispatchIssue[] {
  const issues: DispatchIssue[] = []
  const { vehicle } = input

  if (!vehicle.active) issues.push('VEHICLE_INACTIVE')
  if (vehicleServiceState(vehicle.nextServiceDueOn, input.asOf) === 'overdue') {
    issues.push('VEHICLE_SERVICE_OVERDUE')
  }

  const capacity = vehicle.capacityParcels
  if (typeof capacity === 'number' && Number.isFinite(capacity)) {
    if (input.assignedOnDate + 1 > capacity) issues.push('VEHICLE_AT_CAPACITY')
  }

  return issues
}
