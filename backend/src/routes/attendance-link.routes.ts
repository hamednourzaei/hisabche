// ============================================
// backend/src/routes/attendance-link.routes.ts
//
// Manager and up (the role the attendance sheet itself requires):
//   GET    /api/attendance-links?employeeId=          the employee's link, or null
//   POST   /api/attendance-links                      make one (revokes the live one)
//   DELETE /api/attendance-links/:id                  revoke
//   GET    /api/attendance-submissions?date=          what employees sent, undecided
//   POST   /api/attendance-submissions/:id/decision   approve | reject
//
// The employee — PUBLIC, the token is the credential:
//   GET    /api/public/attendance/:token              their own days
//   POST   /api/public/attendance/:token              send one day
//
// The public routes have no `authenticate` on purpose; the service re-verifies
// the link's maker on every visit. Unknown, revoked and expired links answer
// the same 404.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { NotFoundError } from '../errors/database.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import {
  MAX_DAYS_BACK,
  attendanceLinkService,
  type AttendanceLinkService,
} from '../services/payroll/attendance-link.service'
import { requireRole } from '../services/tenancy.service'

const MEMBER = [authenticate, requireWorkspaceContext]
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const idParams = z.object({ id: z.string().uuid() })
const tokenParams = z.object({ token: z.string().regex(/^[0-9a-f]{64}$/) })

const createBody = z
  .object({
    employeeId: z.string().uuid(),
    expiresOn: isoDay.nullable().default(null),
    daysBack: z.number().int().min(0).max(MAX_DAYS_BACK).default(0),
    autoApply: z.boolean().default(false),
    timeZone: z.string().min(1).max(64),
  })
  .strict()

const decisionBody = z
  .object({
    decision: z.enum(['approve', 'reject']),
    note: z.string().trim().max(500).nullable().default(null),
  })
  .strict()

// Loose on purpose where the service has a named refusal for it: «the date is
// in the future» is a sentence the employee can act on, «invalid body» is not.
const submitBody = z
  .object({
    date: z.string().max(10),
    status: z.string().max(20),
    checkIn: z.string().max(8).nullable().default(null),
    checkOut: z.string().max(8).nullable().default(null),
    note: z.string().max(2000).nullable().default(null),
    clientRequestId: z.string().uuid(),
  })
  .strict()

const NOT_FOUND = { error: 'ATTENDANCE_LINK_NOT_FOUND', code: 'ATTENDANCE_LINK_NOT_FOUND' }

export function buildAttendanceLinkRoutes(links: AttendanceLinkService) {
  return async function attendanceLinkRoutes(fastify: FastifyInstance) {
    const fail = (reply: FastifyReply, err: unknown) => {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Bad Request',
          code: 'ATTENDANCE_REQUEST_INVALID',
          message: err.errors[0]?.message ?? 'Validation failed',
          details: err.errors.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        })
      }
      if (err instanceof NotFoundError) {
        return reply.code(404).send({ error: 'ATTENDANCE_NOT_FOUND', code: 'ATTENDANCE_NOT_FOUND' })
      }
      if (err instanceof BaseError && (err.statusCode < 500 || err.statusCode === 503)) {
        return reply
          .code(err.statusCode)
          .send({ error: err.message, code: err.message, message: err.message })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Internal Server Error', code: 'ATTENDANCE_FAILED' })
    }
    const handle =
      (fn: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>) =>
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          return await fn(request, reply)
        } catch (err) {
          return fail(reply, err)
        }
      }

    // ─── managers ───────────────────────────────────────────────────────────

    fastify.get(
      '/api/attendance-links',
      { preHandler: MEMBER },
      handle(async (request, reply) => {
        requireRole(request.tenancy, 'manager')
        const { employeeId } = z.object({ employeeId: z.string().uuid() }).parse(request.query)
        return reply.send({ link: await links.current(request.tenancy, employeeId) })
      }),
    )

    fastify.post(
      '/api/attendance-links',
      { preHandler: MEMBER },
      handle(async (request, reply) => {
        requireRole(request.tenancy, 'manager')
        return reply
          .code(201)
          .send(await links.create(request.tenancy, createBody.parse(request.body)))
      }),
    )

    fastify.delete(
      '/api/attendance-links/:id',
      { preHandler: MEMBER },
      handle(async (request, reply) => {
        requireRole(request.tenancy, 'manager')
        const { id } = idParams.parse(request.params)
        await links.revoke(request.tenancy, id)
        return reply.code(204).send()
      }),
    )

    fastify.get(
      '/api/attendance-submissions',
      { preHandler: MEMBER },
      handle(async (request, reply) => {
        requireRole(request.tenancy, 'manager')
        const { date } = z.object({ date: isoDay }).parse(request.query)
        return reply.send(await links.forDay(request.tenancy, date))
      }),
    )

    fastify.post(
      '/api/attendance-submissions/:id/decision',
      { preHandler: MEMBER },
      handle(async (request, reply) => {
        requireRole(request.tenancy, 'manager')
        const { id } = idParams.parse(request.params)
        const { decision, note } = decisionBody.parse(request.body)
        return reply.send(await links.decide(request.tenancy, id, decision, note))
      }),
    )

    // ─── the employee ───────────────────────────────────────────────────────

    fastify.get(
      '/api/public/attendance/:token',
      { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
      handle(async (request, reply) => {
        const parsed = tokenParams.safeParse(request.params)
        const view = parsed.success ? await links.view(parsed.data.token) : null
        if (!view) return reply.code(404).send(NOT_FOUND)
        // Somebody's working hours: never from a cache between them and us.
        reply.header('Cache-Control', 'no-store')
        return reply.send(view)
      }),
    )

    fastify.post(
      '/api/public/attendance/:token',
      { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
      handle(async (request, reply) => {
        const parsed = tokenParams.safeParse(request.params)
        if (!parsed.success) return reply.code(404).send(NOT_FOUND)
        const result = await links.submit(parsed.data.token, submitBody.parse(request.body))
        if (!result) return reply.code(404).send(NOT_FOUND)
        return reply.code(result.replayed ? 200 : 201).send(result)
      }),
    )
  }
}

export const attendanceLinkRoutes = buildAttendanceLinkRoutes(attendanceLinkService)
