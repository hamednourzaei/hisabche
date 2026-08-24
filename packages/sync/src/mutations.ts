// ============================================
// packages/sync/src/mutations.ts
//
// How a local-first write is made.
//
// This is the only sanctioned way to change a synced entity on a client. It
// does two things in one durable transaction — apply the change locally, and
// record the intent in the outbox — and then returns immediately. The UI never
// waits for the network.
//
// WHAT THE CLIENT IS AND IS NOT ALLOWED TO DECIDE
//
// The payload here is an INTENT, not a result. A client may say "this invoice
// has these lines and I believe it totals X"; the server recalculates and its
// answer wins. `localMoney` exists purely so the UI has something to draw
// before the round-trip, and it is overwritten by the server's row on the next
// pull. Nothing downstream ever treats a client-supplied total as authority.
// ============================================

import type { SyncEntity, SyncOperation } from '@hisabche/validation'

import { newId } from './engine'
import type { LocalEntity, OutboxRecord, StorageAdapter } from './types'

export interface MutateOptions {
  storage: StorageAdapter
  workspaceId: string
  entityType: SyncEntity
  entityId?: string
  operation: SyncOperation
  payload: Record<string, unknown>
  /**
   * The version the client believes the server holds.
   *
   * Required for an update of anything already synced. Omitting it disables
   * conflict detection for that write, so it is only ever right for a create.
   */
  expectedVersion?: number
  now?: () => number
}

export interface MutateResult {
  mutationId: string
  entityId: string
}

/**
 * Apply a change locally and queue it for the server.
 *
 * Returns as soon as the local transaction commits. The caller should then
 * poke the engine (`engine.schedule()`), but correctness does not depend on
 * that call happening — startup, reconnect and the periodic interval all find
 * the record regardless.
 */
export async function mutateLocal(options: MutateOptions): Promise<MutateResult> {
  const {
    storage,
    workspaceId,
    entityType,
    operation,
    payload,
    expectedVersion,
    now = () => Date.now(),
  } = options

  // Generated here, once. Every retry of this mutation reuses it — that single
  // fact is what makes a lost response harmless instead of a second invoice.
  const mutationId = newId()
  const entityId = options.entityId ?? newId()

  const existing = await storage.getEntity(workspaceId, entityType, entityId)

  const record: OutboxRecord = {
    mutationId,
    workspaceId,
    entityType,
    entityId,
    operation,
    payload,
    ...(expectedVersion !== undefined ? { expectedVersion } : {}),
    status: 'pending',
    attemptCount: 0,
    createdAt: now(),
  }

  if (operation === 'delete') {
    // The row goes immediately — the user asked for it gone and the UI must
    // reflect that — but the outbox keeps the instruction until the server
    // agrees.
    await storage.enqueue(
      {
        id: entityId,
        workspaceId,
        entityType,
        data: existing?.data ?? {},
        version: existing?.version ?? 0,
        pending: true,
        updatedAt: now(),
      },
      record,
    )
    await storage.deleteEntity(workspaceId, entityType, entityId)
    return { mutationId, entityId }
  }

  const entity: LocalEntity = {
    id: entityId,
    workspaceId,
    entityType,
    // Merged over whatever is there, so a partial update does not blank the
    // fields it did not mention.
    data: { ...(existing?.data ?? {}), ...payload, id: entityId },
    version: existing?.version ?? 0,
    // Marks the row as not-yet-confirmed. The pull path reads this to avoid
    // clobbering an unpushed local edit with an older server row.
    pending: true,
    updatedAt: now(),
  }

  await storage.enqueue(entity, record)

  return { mutationId, entityId }
}

/**
 * Abandon a mutation the server refused, restoring the server's row.
 *
 * The only sanctioned way to remove a `failed` or `conflict` record. It is
 * explicit because discarding a financial mutation is a decision a person
 * makes, not something a retry loop does quietly.
 */
export async function discardMutation(
  storage: StorageAdapter,
  workspaceId: string,
  mutationId: string,
): Promise<void> {
  const outbox = await storage.listOutbox(workspaceId)
  const record = outbox.find((r) => r.mutationId === mutationId)
  if (!record) return

  await storage.removeOutbox(mutationId)

  // If nothing else about this row is queued, it is no longer pending; the
  // next pull will bring whatever the server actually holds.
  const stillQueued = outbox.some(
    (r) => r.mutationId !== mutationId && r.entityId === record.entityId,
  )

  if (!stillQueued) {
    const entity = await storage.getEntity(workspaceId, record.entityType, record.entityId)
    if (entity) await storage.putEntity({ ...entity, pending: false })
  }
}

/**
 * Re-queue a conflicted mutation against the server's current version.
 *
 * Used after a human has looked at both sides. The mutation_id is REPLACED
 * here on purpose: this is a new decision about what should happen, not a
 * retry of the old one, and reusing the id would make the server replay the
 * conflict it already recorded.
 */
export async function retryWithServerVersion(
  storage: StorageAdapter,
  workspaceId: string,
  mutationId: string,
  payload: Record<string, unknown>,
  now: () => number = () => Date.now(),
): Promise<MutateResult | null> {
  const outbox = await storage.listOutbox(workspaceId)
  const record = outbox.find((r) => r.mutationId === mutationId)
  if (!record) return null

  const entity = await storage.getEntity(workspaceId, record.entityType, record.entityId)
  if (!entity) return null

  await storage.removeOutbox(mutationId)

  return mutateLocal({
    storage,
    workspaceId,
    entityType: record.entityType,
    entityId: record.entityId,
    operation: record.operation,
    payload,
    expectedVersion: entity.version,
    now,
  })
}
