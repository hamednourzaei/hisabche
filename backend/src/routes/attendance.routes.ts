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
// …and who is PLANNED for which shift on a day, beside what was recorded:
//
//   GET  /api/shift-assignments?date=YYYY-MM-DD      manager and up
//   POST /api/shift-assignments                      manager and up   { employeeId, shiftId, fromDate, days }
//   POST /api/shift-assignments/:id/cancel           manager and up
//
// A plan is not attendance: nothing here records a day or changes pay, and an
// assignment is cancelled, never deleted.
//
// Manager and up, read from `request.tenancy.role`: who came to work, and
// when, is a record about named people.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import {
  assignShiftBodySchema,
  attendanceIsoDay,
  attendanceMarkBodySchema,
  createShiftBodySchema,
  setShiftActiveBodySchema,
} from '@hisabche/validation'
import { attendanceService } from '../services/payroll/attendance.service'
import { shiftAssignmentService } from '../services/payroll/shift-assignment.service'
import { shiftService } from '../services/payroll/shift.service'
import { requireRole } from '../services/tenancy.service'

const MEMBER = [authenticate, requireWorkspaceContext]
const isoDay = attendanceIsoDay

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
          await attendanceService.mark(
            request.tenancy,
            attendanceMarkBodySchema.parse(request.body),
          ),
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
      const input = createShiftBodySchema.parse(request.body)
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
        const { isActive } = setShiftActiveBodySchema.parse(request.body)
        return reply.send(await shiftService.setActive(request.tenancy, id, isActive))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to update the shift')
      }
    },
  )

  // ─── Shift assignments (#101, the plan) ────────────────────

  fastify.get(
    '/api/shift-assignments',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { date } = z.object({ date: isoDay }).parse(request.query)
        return reply.send(await shiftAssignmentService.day(request.tenancy, date))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read the shift plan')
      }
    },
  )

  fastify.post(
    '/api/shift-assignments',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const input = assignShiftBodySchema.parse(request.body)
        return reply.code(201).send(await shiftAssignmentService.assign(request.tenancy, input))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to save the shift plan')
      }
    },
  )

  fastify.post(
    '/api/shift-assignments/:id/cancel',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        return reply.send(await shiftAssignmentService.cancel(request.tenancy, id))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to cancel the assignment')
      }
    },
  )
}
