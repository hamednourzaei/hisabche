// ============================================
// packages/api/src/lib/entity-sync-state.ts
//
// «Is this row the server's, or is it still only on this device?»
//
// ---------------------------------------------------------------------------
// ⚠️ THE ANSWER LIVES ON THE HOST, AND ONLY THE HOST HAS IT.
//
// A device keeps its unsent changes in its own outbox (`packages/app-shell/
// src/features/sync/`), with the stages decided in `outbox-stage.ts`. The web
// build has no outbox at all: its writes go straight to the server, so every
// row it shows IS the server's row.
//
// `packages/ui` is shared by every host and cannot import a host's bridge, so
// the host registers a reader here — the same seam `offline-queue.ts` uses for
// device reads and `client.ts` for the token. No host registered means «this
// host has no outbox», which is a fact, not an error.
//
// ⚠️ FOUR STATES, NOT TWO. «pending» and «rejected» used to be one word on the
// sync page, and a shopkeeper could not tell «the internet dropped, it will go
// by itself» from «the server refused it, someone must look». A delivery that
// the server refused is still on the device in its local state — there is no
// automatic reconciliation — so a screen that shows the row must say so.
// ============================================

/**
 * Where one entity's last change stands.
 *
 * - `pending`    saved on this device, not confirmed by the server yet
 * - `confirmed`  the server's own row; nothing of this entity waits locally
 * - `rejected`   the server refused the change; it will not retry by itself
 * - `attention`  refused by a rule that needs a person's DECISION (the
 *                settlement could not be honoured), not a retry
 */
export type EntitySyncState = 'pending' | 'confirmed' | 'rejected' | 'attention'

export interface EntitySyncEntry {
  /** The sync entity name (`service_delivery_sessions`). */
  readonly entityType: string
  readonly entityId: string
  readonly state: EntitySyncState
  /** The server's refusal code, when it refused. Shown through a code-keyed message. */
  readonly code?: string | null | undefined
}

/**
 * Reads the current outbox state of one entity type.
 *
 * Asynchronous because the device queue is a database read; a host that cannot
 * answer registers nothing and the screen shows «unknown».
 */
export type EntitySyncReader = (entityType: string) => Promise<readonly EntitySyncEntry[]>

let reader: EntitySyncReader | null = null

export function registerEntitySyncReader(next: EntitySyncReader | null): void {
  reader = next
}

/** The registered reader, or null on a host with no outbox (the browser). */
export function getEntitySyncReader(): EntitySyncReader | null {
  return reader
}
