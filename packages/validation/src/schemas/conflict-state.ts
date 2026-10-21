// ============================================
// packages/validation/src/schemas/conflict-state.ts
//
// ONE reading of a sync conflict's state (D5).
//
// `sync_conflicts` stores `status` (open | resolved | superseded) and
// `resolution` (keep_server | keep_client | merge | auto_merge). Those are the
// storage words; nobody should see them. A seller, a manager and the API all
// need the same answer to «what happened to this sale?», so the answer is
// computed here and nowhere else — the server calls it, the screen calls it.
// ============================================

export type ConflictState = 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'RESOLVED' | 'SUPERSEDED'

/**
 * The state a person reads.
 *
 * ACCEPTED means the device's version was kept, REJECTED means the server's
 * version stands. A resolution this build does not know is still a resolution:
 * it reads RESOLVED, never «pending», never invented into accepted/rejected.
 */
export function conflictState(
  status: string | null | undefined,
  resolution: string | null | undefined,
): ConflictState {
  if (status === 'superseded') return 'SUPERSEDED'
  // 'open' is the only other state the table allows, and a conflict is
  // decided by a person: it waits.
  if (status !== 'resolved') return 'PENDING_REVIEW'
  if (resolution === 'keep_client') return 'ACCEPTED'
  if (resolution === 'keep_server') return 'REJECTED'
  return 'RESOLVED'
}
