// ============================================
// Where one queued change is, stage by stage (27 Sep 2026).
//
// The sync page showed «pending» and «failed» — two words for five different
// situations. A shopkeeper who sees «failed» cannot tell «the internet dropped,
// it will go by itself» from «the server refused it, someone must look»:
//
//   queued     saved on this device, not tried yet
//   sending    on its way right now
//   retrying   tried and not delivered (network, server busy) — it goes again
//              by itself
//   rejected   the server REFUSED it (a 4xx that is not 408/429), or it ran
//              out of attempts — a person must look; nothing retries it alone
//   credit_validation  the server refused an invoice for the customer's CREDIT LIMIT (V53 OD-3). Not a
//              dead end and not a failure: the sale is kept whole on this device and waits for a person
//              who holds `credit.override` to approve it with a reason (PENDING_CREDIT_VALIDATION).
//   committed  the server accepted it (shown for this session: a delivered
//              change leaves the outbox, so older ones exist only on the server)
// ============================================

import type { QueueEntry } from '@hisabche/app-bridge'

export type OutboxStage = 'queued' | 'sending' | 'retrying' | 'rejected' | 'credit_validation'

/** The engine writes this before the server's message on a permanent refusal. */
export const REJECTED_PREFIX = 'REJECTED: '

export function stageOf(
  entry: Pick<QueueEntry, 'clientId' | 'status' | 'attempts' | 'lastError'>,
  inFlight: ReadonlySet<string>,
  maxAttempts: number,
): OutboxStage {
  if (inFlight.has(entry.clientId)) return 'sending'
  if (creditRefusalOf(entry.lastError)) return 'credit_validation'
  if (entry.lastError?.startsWith(REJECTED_PREFIX) || entry.attempts >= maxAttempts)
    return 'rejected'
  if (entry.status === 'failed' || entry.attempts > 0) return 'retrying'
  return 'queued'
}

export interface CreditRefusal {
  code: 'CREDIT_LIMIT_EXCEEDED' | 'CASH_ONLY_CUSTOMER'
  /** Amount over the limit, in the books currency, when the server said it. */
  overBy: string | null
}

/**
 * A refusal of an invoice CREATE for the credit limit — read only from a stored REFUSAL (the server's own
 * words), never calculated on the device: the device does not know the customer's limit or what they owe.
 */
export function creditRefusalOf(lastError: string | null | undefined): CreditRefusal | null {
  if (!lastError?.startsWith(REJECTED_PREFIX)) return null
  const code = lastError.includes('CASH_ONLY_CUSTOMER')
    ? 'CASH_ONLY_CUSTOMER'
    : lastError.includes('CREDIT_LIMIT_EXCEEDED')
      ? 'CREDIT_LIMIT_EXCEEDED'
      : null
  if (!code) return null
  return { code, overBy: /over by ([0-9.]+)/.exec(lastError)?.[1] ?? null }
}

/** Shortest reason the server accepts for passing the limit (invoice.service.ts). */
export const CREDIT_OVERRIDE_MIN_REASON = 3

/**
 * The queued sale, unchanged, with the approver's reason added. Null without a usable reason — nothing is
 * re-sent on a guess. WHO may pass the limit is the server's decision (`credit.override`), not this function's.
 */
export function withCreditOverride(
  payload: Record<string, unknown>,
  reason: string,
): Record<string, unknown> | null {
  const trimmed = reason.trim()
  if (trimmed.length < CREDIT_OVERRIDE_MIN_REASON) return null
  return { ...payload, creditOverride: { reason: trimmed } }
}

/** The server's reason, without the engine's marker. */
export function reasonOf(lastError: string | null | undefined): string | null {
  if (!lastError) return null
  return lastError.startsWith(REJECTED_PREFIX) ? lastError.slice(REJECTED_PREFIX.length) : lastError
}

export interface CommittedEntry {
  clientId: string
  entity: string
  operation: string
  committedAt: string
}
