// ============================================
// backend/src/utils/client-request.ts
//
// Idempotent creation for writes an offline client replays.
//
// A queued write is sent with `Idempotency-Key: <clientId>` and resent, with the
// SAME key, until a response arrives. The row it creates carries that key in
// `client_request_id`, and a partial unique index on (workspace_id,
// client_request_id) makes a second row impossible. A replay therefore answers
// with the row that already exists — 200 plus `idempotent-replay: true` — and
// writes nothing.
//
// docs/invoice-idempotency-migration.sql, docs/offline-idempotency-migration.sql
// ============================================

import type { FastifyReply, FastifyRequest } from 'fastify'

const KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,128}$/

/** The request's key, or null. Anything that is not a sane key is ignored. */
export function readClientRequestId(request: FastifyRequest): string | null {
  const raw = request.headers['idempotency-key']
  return typeof raw === 'string' && KEY_PATTERN.test(raw) ? raw : null
}

/**
 * A keyed create cannot be honoured because the migration has not run. Answered
 * 503 — never 4xx, which offline runners treat as permanent — so the write stays
 * queued instead of being created without its key.
 */
export class IdempotencyUnavailableError extends Error {
  readonly code: string
  constructor(entity: string) {
    const code = `${entity.toUpperCase()}_IDEMPOTENCY_MIGRATION_REQUIRED`
    super(code)
    this.code = code
    this.name = 'IdempotencyUnavailableError'
  }
}

/** The column (or the keyed function) does not exist yet. */
export function isMissingIdempotencySupport(error: { code?: string } | null | undefined): boolean {
  return (
    error?.code === '42703' || // undefined column
    error?.code === 'PGRST204' || // column not in schema cache
    error?.code === '42883' || // undefined function
    error?.code === 'PGRST202' // function not in schema cache
  )
}

/** Marks a service result as the answer to an earlier, identical request. */
export type Replayable<T> = T & { idempotentReplay?: true }

export function asReplay<T extends object>(value: T): Replayable<T> {
  return Object.assign(value, { idempotentReplay: true as const })
}

/**
 * Send a create result: 201 for a new row, 200 + `idempotent-replay: true` for
 * a replay (the marker is stripped from the body).
 */
export function sendCreated(reply: FastifyReply, value: object) {
  const { idempotentReplay, ...body } = value as { idempotentReplay?: boolean }
  if (idempotentReplay) return reply.code(200).header('idempotent-replay', 'true').send(body)
  return reply.code(201).send(body)
}
