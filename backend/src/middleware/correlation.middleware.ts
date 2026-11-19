// ============================================
// backend/src/middleware/correlation.middleware.ts
//
// PART 6 / Phase J — OBSERVABILITY.
//
// Every request gets one stable correlation id. A caller-supplied id is
// accepted only when it is a short, safe token; otherwise a fresh one is made.
// The same value is echoed in the response header, so a client can quote it
// when reporting a failed operation. No customer data is put in the header.
// ============================================

import { randomUUID } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'

export const CORRELATION_HEADER = 'x-correlation-id'
const SAFE_ID = /^[A-Za-z0-9._:-]{1,128}$/

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string
  }
}

export async function correlateRequests(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const incoming = request.headers[CORRELATION_HEADER]
  const id = typeof incoming === 'string' && SAFE_ID.test(incoming) ? incoming : randomUUID()
  request.correlationId = id
  void reply.header(CORRELATION_HEADER, id)
}

export function correlationOf(request: FastifyRequest): string {
  return request.correlationId
}
