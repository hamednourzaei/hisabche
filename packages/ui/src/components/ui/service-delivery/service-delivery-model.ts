// ============================================
// packages/ui/src/components/ui/service-delivery/service-delivery-model.ts
//
// The facts a service-delivery screen derives from the server's rows — and
// nothing it does not.
//
// ⚠️ NO SETTLEMENT IS INFERRED HERE. The settlement shown is the one the
// session carries (`settlementMethod`), which the SERVER set at delivery. This
// file never picks one, never switches one, and never turns an unknown into a
// default: a session whose settlement the server did not send has none.
//
// ⚠️ THE DURATION IS THE DOMAIN'S. `endTimeFor` places the end clock from a
// duration, and the dialog then asks `calculateSessionDurationMinutes` (the
// shared domain rule) whether that is a legal session — the screen does not
// keep a second rule for what a valid session is.
// ============================================

import type { EntitySyncState, ServiceDeliverySessionItem } from '@hisabche/api'

export const SERVICE_SESSION_STATUSES = [
  'scheduled',
  'checked_in',
  'in_progress',
  'delivered',
  'cancelled',
  'no_show',
] as const

/** The settlements the delivery dialog offers. «free» is `complementary` in the domain. */
export const SETTLEMENT_METHODS = ['package_credit', 'invoice', 'complementary'] as const
export type SettlementMethod = (typeof SETTLEMENT_METHODS)[number]

/** A session plus the names the list needs — resolved by the container, never guessed. */
export interface ServiceSessionRow extends ServiceDeliverySessionItem {
  /** null = the name could not be read; the cell says «unknown», never an empty line. */
  customerName: string | null
  serviceName: string | null
  practitionerName: string | null
  branchName: string | null
  /** null = this host has no outbox to ask (the browser). */
  sync: EntitySyncState | null
  syncCode: string | null
}

export interface ServiceSessionSummary {
  scheduled: number
  delivered: number
  cancelled: number
  awaitingSync: number
  rejected: number
}

/**
 * Place a clock time `minutes` after `startTime`, on a 24-hour dial.
 *
 * Returns null when either input is unusable, so the caller shows a message
 * instead of storing `NaN:NaN`.
 */
export function endTimeFor(startTime: string, durationMinutes: number): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(startTime)
  if (!match) return null
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return null

  const start = Number(match[1]) * 60 + Number(match[2])
  if (!Number.isFinite(start) || start >= 1440) return null

  const end = start + Math.trunc(durationMinutes)
  if (end >= 1440) return null
  const hours = Math.floor(end / 60)
  const minutes = end % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/**
 * The sync state of one session, from the host's outbox answer.
 *
 * A host with no outbox returns null: «نامعلوم», never a promise. On a host
 * that CAN answer, a session the queue does not name is the server's row —
 * `confirmed`. Several queued commands may name one session (create, then
 * deliver); the WORST state wins, so a refused delivery is never hidden behind
 * an older pending create.
 */
export function syncStateOf(
  entries: readonly {
    entityId: string
    state: EntitySyncState
    code?: string | null | undefined
  }[],
  sessionId: string,
  available: boolean,
): { state: EntitySyncState | null; code: string | null } {
  if (!available) return { state: null, code: null }

  const mine = entries.filter((candidate) => candidate.entityId === sessionId)
  if (mine.length === 0) return { state: 'confirmed', code: null }

  const priority: Record<EntitySyncState, number> = {
    confirmed: 0,
    pending: 1,
    rejected: 2,
    attention: 3,
  }
  const worst = mine.reduce((chosen, candidate) =>
    priority[candidate.state] > priority[chosen.state] ? candidate : chosen,
  )
  return { state: worst.state, code: worst.code ?? null }
}

/**
 * Counts over the rows the screen holds.
 *
 * The list endpoint answers every session of the workspace (no page), so these
 * are counts of the whole list — and when a period/status filter narrows the
 * table, the caller passes the UNFILTERED rows, so a count is never «the first
 * page of a bigger list».
 */
export function summarizeSessions(rows: readonly ServiceSessionRow[]): ServiceSessionSummary {
  const summary: ServiceSessionSummary = {
    scheduled: 0,
    delivered: 0,
    cancelled: 0,
    awaitingSync: 0,
    rejected: 0,
  }

  for (const row of rows) {
    if (row.status === 'scheduled' || row.status === 'checked_in' || row.status === 'in_progress')
      summary.scheduled += 1
    if (row.status === 'delivered') summary.delivered += 1
    if (row.status === 'cancelled') summary.cancelled += 1
    if (row.sync === 'pending') summary.awaitingSync += 1
    if (row.sync === 'rejected' || row.sync === 'attention') summary.rejected += 1
  }

  return summary
}

/** Not `scheduled` / `checked_in` / `in_progress` — the delivery dialog has nothing to offer. */
export function deliveryBlocked(status: string): boolean {
  return status !== 'scheduled' && status !== 'checked_in' && status !== 'in_progress'
}

/**
 * Statuses the server lets reach `cancelled` (`isValidSessionStatusTransition`).
 *
 * `no_show` is NOT one of them: it is already the answer to «the customer did
 * not come», and the API refuses `no_show → cancelled`. A cancel button there
 * would be a promise the server breaks.
 */
export function cancellable(status: string): boolean {
  return (
    status === 'scheduled' ||
    status === 'checked_in' ||
    status === 'in_progress' ||
    status === 'delivered'
  )
}

/** A cancellation without a stated why cannot be audited: the server refuses it, so the form does not offer it. */
export function cancellationReasonMissing(reason: string): boolean {
  return reason.trim().length === 0
}

/**
 * What cancelling does to the money — derived from the session the screen
 * already has, so the person is told before confirming.
 *
 * - `package_reversal`  a NEW reversal entry gives the credit back (the ledger is append-only)
 * - `free`              nothing financial happened
 * - `nothing`           not delivered: nothing was settled
 * - `invoice_blocked`   a billed service is corrected, not cancelled
 * - `credit_missing`    the consumed entry is unknown; the server refuses to cancel
 */
export type CancellationEffect =
  'package_reversal' | 'free' | 'nothing' | 'invoice_blocked' | 'credit_missing'

export function cancellationEffect(session: {
  status: string
  settlementMethod: string
  packageCreditId?: string | null | undefined
}): CancellationEffect {
  if (session.status !== 'delivered') return 'nothing'

  if (session.settlementMethod === 'invoice') return 'invoice_blocked'
  if (session.settlementMethod === 'complementary') return 'free'
  if (session.settlementMethod === 'package_credit') {
    return session.packageCreditId ? 'package_reversal' : 'credit_missing'
  }

  // A settlement this build does not know: nothing is claimed about the money.
  return 'nothing'
}
