// ============================================
// backend/src/routes/attendance.routes.ts
//
// Capability #100 — the daily attendance sheet.
//
//   GET /api/attendance-sheet?date=YYYY-MM-DD   manager and up
//   PUT /api/attendance-sheet                   manager and up
//
// …and the shift definitions the sheet records a day by (#101):
//
//   GET   /api/shifts                 manager and up
//   POST  /api/shifts                 manager and up
//   PATCH /api/shifts/:id/active      manager and up   { isActive }
//
// Manager and up, read from `request.tenancy.role`: who came to work, and
// when, is a record about named people.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { MARKABLE_STATUSES, attendanceService } from '../services/payroll/attendance.service'
import { shiftService } from '../services/payroll/shift.service'
import { requireRole } from '../services/tenancy.service'

const MEMBER = [authenticate, requireWorkspaceContext]
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
/** `HH:MM`, the shop's own local time. */
const clock = z.string().regex(/^[0-9]{1,2}:[0-9]{2}$/)
const time = z
  .string()
  .regex(/^\d{1,2}:\d{2}$/)
  .nullable()
  .default(null)

const markBody = z.object({
  employeeId: z.string().uuid(),
  date: isoDay,
  status: z.enum(MARKABLE_STATUSES),
  checkIn: time,
  checkOut: time,
  note: z.string().trim().max(500).nullable().default(null),
})

function fail(fastify: FastifyInstance, reply: FastifyReply, err: unknown, fallback: string) {
  if (err instanceof z.ZodError) {
    return reply.code(400).send({
      error: 'Bad Request',
      message: err.errors[0]?.message ?? 'Validation failed',
      details: err.errors.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    })
  }
  if (err instanceof BaseError && (err.statusCode < 500 || err.statusCode === 503)) {
    return reply.code(err.statusCode).send({ error: err.name, message: err.message })
  }
  fastify.log.error(err)
  return reply.code(500).send({ error: 'Internal Server Error', message: fallback })
}

export async function attendanceRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/attendance-sheet',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { date } = z.object({ date: isoDay }).parse(request.query)
        return reply.send(await attendanceService.sheet(request.tenancy, date))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read the attendance sheet')
      }
    },
  )

  fastify.put(
    '/api/attendance-sheet',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        return reply.send(
          await attendanceService.mark(request.tenancy, markBody.parse(request.body)),
        )
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to record attendance')
      }
    },
  )

  // ─── Shifts (#101) ─────────────────────────────────────────

  fastify.get('/api/shifts', { preHandler: MEMBER }, async (request: FastifyRequest, reply) => {
    try {
      requireRole(request.tenancy, 'manager')
      return reply.send({ shifts: await shiftService.list(request.tenancy) })
    } catch (err) {
      return fail(fastify, reply, err, 'Failed to read shifts')
    }
  })

  fastify.post('/api/shifts', { preHandler: MEMBER }, async (request: FastifyRequest, reply) => {
    try {
      requireRole(request.tenancy, 'manager')
      const input = z
        .object({
          name: z.string().trim().min(1).max(60),
          startsAt: clock,
          endsAt: clock,
          breakMinutes: z.number().int().min(0).max(600).default(0),
        })
        .parse(request.body)
      return reply.code(201).send(await shiftService.create(request.tenancy, input))
    } catch (err) {
      return fail(fastify, reply, err, 'Failed to save the shift')
    }
  })

  fastify.patch(
    '/api/shifts/:id/active',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        const { isActive } = z.object({ isActive: z.boolean() }).parse(request.body)
        return reply.send(await shiftService.setActive(request.tenancy, id, isActive))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to update the shift')
      }
    },
  )
}
