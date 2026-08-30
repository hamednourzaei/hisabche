// ============================================
// packages/validation/src/schemas/sync-protocol.schema.ts
//
// The wire contract between a local-first client and the authoritative server.
//
// Deliberately separate from `sync.schema.ts`, which describes the OLD
// queue/log tables. This file describes the PROTOCOL: what a push batch looks
// like, what a pull returns, and what every possible per-mutation outcome is.
//
// Two rules shape all of it:
//
//   1. The client proposes, the server disposes. A mutation carries what the
//      client believes (`expected_version`), never what the result should be.
//      Totals, versions, timestamps and ids of record all come back FROM the
//      server.
//
//   2. Every outcome is enumerated. A client that cannot tell "retry this" from
//      "this will never succeed" either spins forever or drops financial data,
//      so `retryable` is part of the contract rather than something inferred
//      from an HTTP status.
// ============================================

import { z } from 'zod'

import { uuidSchema } from './common.schema'

/* ═══════════════════════════════════════════════════════════════════════════
   Shared vocabulary
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Entities that participate in sync.
 *
 * `time_entry` is here and the rest of the Tier 2 sweep is NOT, deliberately.
 *
 * Offline write is not a feature to grant every module. It is correct exactly
 * where the work genuinely happens away from a signal, and wrong where the
 * record is configuration or a bulk server operation:
 *
 *   time_entry   YES. A worker on a site logs hours with no signal. This is
 *                the case offline-first exists for.
 *   budget       No. A spending limit is the owner's configuration. Two
 *                devices editing it offline produce two contradictory ceilings
 *                and no way to say which is meant.
 *   dimension    No. Same — configuration, not a day's work.
 *   bank
 *     statement  No. It is imported from a file. An offline import that syncs
 *                later doubles a bank account's apparent movements.
 *   exchange_rate No, not for WRITING. Rates are reference data, and the rate
 *                that matters is the one frozen onto the document — see
 *                `tax.snapshot.ts` for the same rule applied to tax.
 *   fixed_asset  No. Depreciation is derived by the server from a schedule;
 *                a device deriving its own would disagree with the books.
 *
 * A closed enum on purpose. The endpoint this replaced took a table name from
 * the request body and passed it to the database, so any authenticated client
 * could read or write ANY table. A client can now only name something on this
 * list, and each name maps to a handler that knows that entity's rules.
 */
export const syncEntitySchema = z.enum([
  'invoice',
  'customer',
  'product',
  'transaction',
  'time_entry',
])
export type SyncEntity = z.infer<typeof syncEntitySchema>

export const syncOperationSchema = z.enum(['create', 'update', 'delete'])
export type SyncOperation = z.infer<typeof syncOperationSchema>

/**
 * The cursor.
 *
 * A monotonic sequence value, not a timestamp: timestamps tie under load, move
 * backwards under clock skew, and cannot express "strictly after everything I
 * have" when two rows share a millisecond. 0 means "I have nothing".
 */
export const syncCursorSchema = z.coerce.number().int().nonnegative()

/* ═══════════════════════════════════════════════════════════════════════════
   Push
   ═══════════════════════════════════════════════════════════════════════════ */

export const syncMutationSchema = z.object({
  /**
   * Stable across every retry of the same logical mutation. Generated once by
   * the client when the mutation enters its outbox and never regenerated —
   * regenerating it on retry is exactly how a lost response becomes a second
   * invoice.
   */
  mutationId: uuidSchema,
  entityType: syncEntitySchema,
  /**
   * Client-generated for a create, so the local row has its final id before it
   * ever reaches the server and no id remapping is needed on acknowledgement.
   */
  entityId: uuidSchema,
  operation: syncOperationSchema,
  /**
   * What the client believed the row's version was. Absent for a create.
   * A mismatch is a conflict, not an overwrite.
   */
  expectedVersion: z.number().int().positive().optional(),
  /** Validated per entity by the handler, not here. */
  payload: z.record(z.unknown()),
})

export type SyncMutation = z.infer<typeof syncMutationSchema>

/**
 * A push batch.
 *
 * Bounded at 200. An unbounded batch is a request that can time out halfway
 * and a transaction that can hold locks for seconds; the client sends the next
 * batch when this one is acknowledged.
 */
export const MAX_PUSH_BATCH = 200

export const syncPushRequestSchema = z.object({
  deviceId: z.string().min(1).max(128),
  batchId: uuidSchema,
  mutations: z.array(syncMutationSchema).min(1).max(MAX_PUSH_BATCH),
})

export type SyncPushRequest = z.infer<typeof syncPushRequestSchema>

/**
 * Why a mutation did not apply.
 *
 * `retryable` is the field the outbox actually branches on. Everything that
 * can succeed later stays queued; everything that cannot is surfaced to the
 * user instead of being retried forever.
 */
export const syncErrorCodeSchema = z.enum([
  /** Payload failed entity validation. Will never succeed unchanged. */
  'validation_failed',
  /** expectedVersion did not match. The client must re-read and re-apply. */
  'version_conflict',
  /** The row is a finalized financial document. Correct it with a new one. */
  'immutable',
  /** Someone else holds the editing lease. */
  'locked',
  /** Caller may not touch this workspace or row. */
  'forbidden',
  /** Referenced row is gone. */
  'not_found',
  /** Transient: the server failed in a way that may not repeat. */
  'server_error',
])

export type SyncErrorCode = z.infer<typeof syncErrorCodeSchema>

/** Which failures are worth trying again. Single source of truth. */
export const RETRYABLE_ERRORS: ReadonlySet<SyncErrorCode> = new Set<SyncErrorCode>([
  'server_error',
  'locked',
])

export function isRetryable(code: SyncErrorCode): boolean {
  return RETRYABLE_ERRORS.has(code)
}

export const syncMutationResultSchema = z.object({
  mutationId: uuidSchema,
  status: z.enum(['applied', 'rejected']),
  /** The cursor this mutation produced, so a client can wait for its own echo. */
  syncVersion: z.number().int().nonnegative().optional(),
  /** The row's authoritative version after the write. */
  entityVersion: z.number().int().positive().optional(),
  /**
   * True when this result was replayed from the idempotency ledger rather than
   * executed. Purely informational — the client treats it exactly like a fresh
   * success, which is the entire point.
   */
  duplicate: z.boolean().default(false),
  errorCode: syncErrorCodeSchema.optional(),
  errorMessage: z.string().optional(),
  retryable: z.boolean().default(false),
  /** On a version_conflict: the server's current row, so the client can merge. */
  serverState: z.record(z.unknown()).optional(),
})

export type SyncMutationResult = z.infer<typeof syncMutationResultSchema>

export const syncPushResponseSchema = z.object({
  batchId: uuidSchema,
  /**
   * One entry per submitted mutation, in the order submitted.
   *
   * A batch never fails as a whole. Partial failure is normal — one stale
   * invoice must not block the other 199 mutations behind it.
   */
  results: z.array(syncMutationResultSchema),
  /** Where the workspace's log stands now, so the client can pull the rest. */
  currentCursor: z.number().int().nonnegative(),
})

export type SyncPushResponse = z.infer<typeof syncPushResponseSchema>

/* ═══════════════════════════════════════════════════════════════════════════
   Pull
   ═══════════════════════════════════════════════════════════════════════════ */

export const MAX_PULL_PAGE = 500

export const syncPullRequestSchema = z.object({
  cursor: syncCursorSchema.default(0),
  limit: z.coerce.number().int().positive().max(MAX_PULL_PAGE).default(MAX_PULL_PAGE),
  /** Lets the caller skip the echoes of its own writes. */
  deviceId: z.string().min(1).max(128).optional(),
})

export type SyncPullRequest = z.infer<typeof syncPullRequestSchema>

export const syncChangeSchema = z.object({
  syncVersion: z.number().int().positive(),
  entityType: syncEntitySchema,
  entityId: uuidSchema,
  operation: syncOperationSchema,
  entityVersion: z.number().int().nonnegative(),
  /** Absent for a delete — there is nothing left to send. */
  data: z.record(z.unknown()).nullable(),
})

export type SyncChange = z.infer<typeof syncChangeSchema>

export const syncPullResponseSchema = z.object({
  changes: z.array(syncChangeSchema),
  /**
   * Where to resume. The client advances to this ONLY after every change in
   * `changes` is committed locally — advancing first turns a crash into
   * permanently missed data.
   */
  nextCursor: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  /**
   * The caller's cursor is older than the oldest surviving log row, so the
   * changes it missed no longer exist. Replaying would silently skip them, so
   * the client must re-hydrate from a snapshot instead.
   */
  mustRehydrate: z.boolean().default(false),
})

export type SyncPullResponse = z.infer<typeof syncPullResponseSchema>

/* ═══════════════════════════════════════════════════════════════════════════
   Draft editing lease
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * How long a lease survives without a heartbeat.
 *
 * Short enough that a crashed client frees the invoice while the other user is
 * still interested; long enough to survive a tunnel or a locked phone.
 */
export const LEASE_TTL_SECONDS = 120

export const syncLeaseRequestSchema = z.object({
  entityType: syncEntitySchema,
  entityId: uuidSchema,
  deviceId: z.string().min(1).max(128),
})

export type SyncLeaseRequest = z.infer<typeof syncLeaseRequestSchema>

export const syncLeaseResponseSchema = z.object({
  granted: z.boolean(),
  expiresAt: z.string().datetime().optional(),
  /** Present when denied, so the UI can name who is editing. */
  heldByUserId: uuidSchema.optional(),
  heldByName: z.string().optional(),
})

export type SyncLeaseResponse = z.infer<typeof syncLeaseResponseSchema>
