// ============================================
// How a route answers a failure.
//
// ⚠️ ONE ANSWER, NOT ONE PER FILE.
//
// `payments.routes.ts` and `transaction.routes.ts` had each written this out:
// a Zod error becomes 400 with `details`, a domain refusal keeps its own
// status and leading CODE, anything else is logged and becomes a plain 500.
// Two copies is how two endpoints answer the same refusal differently — one
// with a code the client can translate, one with «Error» — and the client
// then has to guess which shape it is holding (راهنمای سشن، خطای رد شده).
// ============================================

import type { FastifyBaseLogger, FastifyReply } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'

/**
 * @param fallback what a 500 says. It is shown to a person, so it names the
 *   action that failed rather than the layer that threw.
 */
export function failRoute(
  reply: FastifyReply,
  error: unknown,
  fallback: string,
  log?: FastifyBaseLogger,
): FastifyReply {
  if (error instanceof z.ZodError) {
    // `details` carries the field path, which is what lets the client put the
    // message under the input that caused it instead of above the form.
    return reply.code(400).send({ error: 'Validation failed', details: error.errors })
  }

  if (error instanceof BaseError && error.statusCode < 500) {
    // The domain refuses with a code — PAYMENT_OVER_ALLOCATED,
    // SOD_VIOLATION — that the client translates into the user's language.
    const code = /^[A-Z][A-Z_]{6,}/.exec(error.message)?.[0]
    return reply.code(error.statusCode).send({ error: error.message, code: code ?? error.name })
  }

  // ⚠️ A 500 is LOGGED. An unexpected failure that leaves no trace is one
  // nobody can investigate after the person reporting it has moved on.
  log?.error(error)
  return reply.code(500).send({ error: fallback })
}
