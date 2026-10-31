// ============================================
// Who owns a queued change.
//
// A queued row is somebody's work. The device's outbox is not a private
// drawer: the next account to sign in on this machine would send it under
// their own token, and the change would land in another business's books.
//
// ⚠️ THE OWNER IS NEVER GUESSED. A row written before the owner columns
// existed has no owner and stays "owner unknown" until a person says whose
// it is.
// ============================================

import { WORKSPACE_HEADER } from '@hisabche/api'
import type { QueueEntry } from '@hisabche/app-bridge'
import { useAuthStore as useSharedAuthStore, useWorkspaceStore } from '@hisabche/store'

import { bridge } from '@/shared/lib/bridge'

export interface OutboxOwner {
  /** The account that made the change. Null: nobody is signed in. */
  userId: string | null
  /** The business the change belongs to. Null: no workspace is active. */
  workspaceId: string | null
}

/**
 * The account and the business of this moment.
 *
 * The signed-in user is read from the SHARED store, which every shell keeps
 * in step with the session. The shell's own auth store is not imported here:
 * it wires the API client when it loads, and the sync engine must not drag
 * that wiring in with it.
 */
export function currentOutboxOwner(): OutboxOwner {
  return {
    userId: useSharedAuthStore.getState().user?.id ?? null,
    workspaceId: useWorkspaceStore.getState().workspaceId ?? null,
  }
}

/**
 * Only the account that made the change may send it, or a verified member of the same
 * active workspace when draining shared workspace records (P0-B / Scenario 14B).
 *
 * ⚠️ A ROW WITH NO OWNER IS NEVER SENT. The sync centre shows the number of
 * such rows and offers an explicit action; sending it is a decision a person
 * makes, not something the drain does behind their back.
 *
 * ⚠️ A ROW OF ANOTHER WORKSPACE IS NOT THIS PERSON'S TO SEND. It belongs to
 * that business's books and goes only when that business is active.
 */
export function isOwnedBy(
  entry: QueueEntry,
  userId: string | null,
  activeWorkspaceId?: string | null,
): boolean {
  if (!userId) return false
  if (entry.userId === userId) return true
  // In a shared workspace on this device, changes belonging to the active workspace
  // can be sent by an active member of that workspace (Rule 1: workspace_id is the security boundary).
  // This eliminates deadlocks where User B's invoice depends on User A's customer.
  if (activeWorkspaceId && entry.workspaceId === activeWorkspaceId) {
    return true
  }
  return false
}

/**
 * The headers a queued change travels with.
 *
 * ⚠️ THE ROW'S OWN WORKSPACE, NEVER THE ACTIVE ONE. A change made in another
 * business must go to that business's books, even while another business is
 * open on this device.
 */
export function headersForEntry(entry: QueueEntry): Record<string, string> {
  const headers: Record<string, string> = { 'Idempotency-Key': entry.clientId }
  if (entry.workspaceId) headers[WORKSPACE_HEADER] = entry.workspaceId
  return headers
}

/**
 * Give the rows that have no owner to this account.
 *
 * ⚠️ THE EXPLICIT ACTION. Until a person says these changes are theirs they
 * are nobody's to send: the drain skips them and the sync centre shows their
 * number. This is the one place that decides.
 *
 * The same clientId is kept, so the server still sees one change with one
 * identity — a claimed row is not a second row.
 */
export async function claimOwnerlessEntries(
  entries: QueueEntry[],
  owner: OutboxOwner,
): Promise<number> {
  const device = bridge()
  if (!device) return 0

  let claimed = 0
  for (const entry of entries) {
    if (entry.userId) continue
    await device.db.enqueue({
      entity: entry.entity,
      operation: entry.operation,
      clientId: entry.clientId,
      payload: entry.payload,
      userId: owner.userId,
      workspaceId: owner.workspaceId,
    })
    claimed += 1
  }
  return claimed
}
