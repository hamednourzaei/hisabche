// ============================================
// backend/src/errors/http-failure.ts
//
// One way to turn a caught error into a response, for routes that used to
// answer every failure with a bare 500 «Failed to …».
//
// ---------------------------------------------------------------------------
// WHY
//
// `/api/branches`, `/api/branches/tree`, `/api/permissions/matrix` and
// `POST /api/employees` were reported failing with 500 and NOTHING in the
// response said why. The server log had it; the person looking at the browser
// did not, and a guess about "a missing migration" was all anyone could offer.
//
// Two defects hid behind that:
//   1. A known domain refusal (NotFoundError «Branch», a ValidationError) was
//      turned into 500 by routes that only special-cased ZodError.
//   2. A database failure carried its Postgres/PostgREST code (42703 undefined
//      column, 42P01 undefined table, 23505 duplicate, PGRST200 embed …) only
//      into the log.
//
// Now: BaseError < 500 keeps its status and code; a DatabaseError answers 500
// with `dbCode` — the code only, never the message, so no column or table
// names reach the client — plus the operational `code` when the service put
// one at the front of its message (e.g. EMPLOYEE_BRANCH_NOT_MIGRATED).
// ============================================

import type { FastifyBaseLogger, FastifyReply } from 'fastify'
import { z } from 'zod'

import { BaseError } from './base.error'
import { DatabaseError } from './database.error'

const OPERATIONAL_CODE = /^[A-Z][A-Z_]{6,}/

export function databaseCodeOf(err: unknown): string | undefined {
  if (!(err instanceof DatabaseError)) return undefined
  const original = err.originalError as { code?: unknown } | undefined
  return typeof original?.code === 'string' && /^[A-Z0-9]{3,10}$/.test(original.code)
    ? original.code
    : undefined
}

export function sendFailure(
  reply: FastifyReply,
  log: FastifyBaseLogger,
  err: unknown,
  fallback: string,
) {
  if (err instanceof z.ZodError) {
    return reply.code(400).send({ error: 'Validation failed', details: err.errors })
  }
  if (err instanceof BaseError && err.statusCode < 500) {
    const code = OPERATIONAL_CODE.exec(err.message)?.[0]
    return reply.code(err.statusCode).send({ error: err.message, code: code ?? err.name })
  }

  log.error(err)

  const dbCode = databaseCodeOf(err)
  const operational = err instanceof Error ? OPERATIONAL_CODE.exec(err.message)?.[0] : undefined

  return reply.code(500).send({
    error: fallback,
    ...(operational ? { code: operational } : {}),
    ...(dbCode ? { dbCode } : {}),
  })
}
