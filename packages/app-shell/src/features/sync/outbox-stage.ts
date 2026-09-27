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
//   committed  the server accepted it (shown for this session: a delivered
//              change leaves the outbox, so older ones exist only on the server)
// ============================================

import type { QueueEntry } from '@hisabche/app-bridge'

export type OutboxStage = 'queued' | 'sending' | 'retrying' | 'rejected'

/** The engine writes this before the server's message on a permanent refusal. */
export const REJECTED_PREFIX = 'REJECTED: '

export function stageOf(
  entry: Pick<QueueEntry, 'clientId' | 'status' | 'attempts' | 'lastError'>,
  inFlight: ReadonlySet<string>,
  maxAttempts: number,
): OutboxStage {
  if (inFlight.has(entry.clientId)) return 'sending'
  if (entry.lastError?.startsWith(REJECTED_PREFIX) || entry.attempts >= maxAttempts)
    return 'rejected'
  if (entry.status === 'failed' || entry.attempts > 0) return 'retrying'
  return 'queued'
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
