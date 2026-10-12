// ============================================
// backend/src/routes/attendance-device.routes.ts
//
// Manager and up (the role the attendance sheet itself requires):
//   GET    /api/attendance-devices                    the registry, with health
//   POST   /api/attendance-devices                    register → { device, key } (key ONCE)
//   POST   /api/attendance-devices/:id/key            a new key; the old one stops
//   DELETE /api/attendance-devices/:id                stop listening to it
//   GET    /api/attendance-devices/:id/unmatched      numbers nobody has mapped
//   GET    /api/attendance-devices/:id/identities     who is who on it
//   PUT    /api/attendance-devices/:id/identities     map / unmap one number
//   GET    /api/attendance-devices/held               readings kept back, beside the record
//   POST   /api/attendance-devices/held/accept        the day becomes what the terminal saw
//
// The device — PUBLIC, the key is the credential:
//   POST   /api/public/attendance-devices/events      X-Device-Key: hsd_…
//
// No `authenticate` on the public route on purpose: a terminal has no session.
// An unknown, malformed or revoked key answers the same 401. The wire format
// is described at the top of services/attendance-devices/device-event.domain.ts.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { NotFoundError } from '../errors/database.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import {
  attendanceDeviceService,
  type AttendanceDeviceService,
} from '../services/attendance-devices/attendance-device.service'
import { DEVICE_FORMATS } from '../services/attendance-devices/device-adapters'
import { requireRole } from '../services/tenancy.service'

const MEMBER = [authenticate, requireWorkspaceContext]
const idParams = z.object({ id: z.string().uuid() })

const deviceBody = z
  .object({
    name: z.string().min(1).max(200),
    vendor: z.string().max(60).nullable().default(null),
    model: z.string().max(60).nullable().default(null),
    branchId: z.string().uuid().nullable().default(null),
    timeZone: z.string().min(1).max(64).nullable().default(null),
    capabilities: z.array(z.string().max(20)).max(9).default([]),
  })
  .strict()

const identityBody = z
  .object({
    externalUserId: z.string().min(1).max(64),
    employeeId: z.string().uuid().nullable(),
    everyDevice: z.boolean().default(false),
  })
  .strict()

// Deliberately loose inside `events`: each one is read by the adapter, which
// names WHICH event is wrong and why. Zod would say «invalid body».
const eventsBody = z
  .object({
    format: z.string().max(40).optional(),
    cursor: z.string().max(500).nullable().optional(),
    events: z.array(z.unknown()),
  })
  .strict()

const NO_SUCH_KEY = { error: 'DEVICE_KEY_INVALID', code: 'DEVICE_KEY_INVALID' }

export function buildAttendanceDeviceRoutes(devices: AttendanceDeviceService) {
  return async function attendanceDeviceRoutes(fastify: FastifyInstance) {
    const fail = (reply: FastifyReply, err: unknown) => {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Bad Request',
          code: 'DEVICE_REQUEST_INVALID',
          message: err.errors[0]?.message ?? 'Validation failed',
          details: err.errors.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        })
      }
      if (err instanceof NotFoundError) {
        return reply
          .code(404)
          .send({ error: 'ATTENDANCE_DEVICE_NOT_FOUND', code: 'ATTENDANCE_DEVICE_NOT_FOUND' })
      }
      if (err instanceof BaseError && (err.statusCode < 500 || err.statusCode === 503)) {
        // «DEVICE_EVENT_USER_MISSING:37» — the code, and which event of the batch.
        const [code, index] = err.message.split(':')
        return reply.code(err.statusCode).send({
          error: code,
          code,
          message: err.message,
          ...(index !== undefined && /^\d+$/.test(index) ? { eventIndex: Number(index) } : {}),
        })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Internal Server Error', code: 'DEVICE_FAILED' })
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

    fastify.get(
      '/api/attendance-devices',
      { preHandler: MEMBER },
      handle(async (request, reply) => {
        requireRole(request.tenancy, 'manager')
        return reply.send({
          ...(await devices.list(request.tenancy)),
          // What a sender may put in `format`. Only what has been proven.
          formats: DEVICE_FORMATS,
        })
      }),
    )

    fastify.post(
      '/api/attendance-devices',
      { preHandler: MEMBER },
      handle(async (request, reply) => {
        requireRole(request.tenancy, 'manager')
        const created = await devices.create(request.tenancy, deviceBody.parse(request.body))
        // The key travels in this one response and is never stored or logged.
        reply.header('Cache-Control', 'no-store')
        return reply.code(201).send(created)
      }),
    )

    fastify.post(
      '/api/attendance-devices/:id/key',
      { preHandler: MEMBER },
      handle(async (request, reply) => {
        requireRole(request.tenancy, 'manager')
        const { id } = idParams.parse(request.params)
        reply.header('Cache-Control', 'no-store')
        return reply.send(await devices.rotateKey(request.tenancy, id))
      }),
    )

    fastify.delete(
      '/api/attendance-devices/:id',
      { preHandler: MEMBER },
      handle(async (request, reply) => {
        requireRole(request.tenancy, 'manager')
        const { id } = idParams.parse(request.params)
        await devices.revoke(request.tenancy, id)
        return reply.code(204).send()
      }),
    )

    fastify.get(
      '/api/attendance-devices/held',
      { preHandler: MEMBER },
      handle(async (request, reply) => {
        requireRole(request.tenancy, 'manager')
        return reply.send({ days: await devices.held(request.tenancy) })
      }),
    )

    fastify.post(
      '/api/attendance-devices/held/accept',
      { preHandler: MEMBER },
      handle(async (request, reply) => {
        requireRole(request.tenancy, 'manager')
        const body = z
          .object({
            employeeId: z.string().uuid(),
            day: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
          })
          .strict()
          .parse(request.body)
        return reply.send(await devices.acceptHeld(request.tenancy, body))
      }),
    )

    fastify.get(
      '/api/attendance-devices/:id/unmatched',
      { preHandler: MEMBER },
      handle(async (request, reply) => {
        requireRole(request.tenancy, 'manager')
        const { id } = idParams.parse(request.params)
        return reply.send({ users: await devices.unmatched(request.tenancy, id) })
      }),
    )

    fastify.get(
      '/api/attendance-devices/:id/identities',
      { preHandler: MEMBER },
      handle(async (request, reply) => {
        requireRole(request.tenancy, 'manager')
        const { id } = idParams.parse(request.params)
        return reply.send({ identities: await devices.identities(request.tenancy, id) })
      }),
    )

    fastify.put(
      '/api/attendance-devices/:id/identities',
      { preHandler: MEMBER },
      handle(async (request, reply) => {
        requireRole(request.tenancy, 'manager')
        const { id } = idParams.parse(request.params)
        return reply.send(
          await devices.mapIdentity(request.tenancy, id, identityBody.parse(request.body)),
        )
      }),
    )

    // ─── the device ─────────────────────────────────────────────────────────

    fastify.post(
      '/api/public/attendance-devices/events',
      {
        // A terminal catching up after a week offline sends many batches.
        config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
        // 500 events of at most 2 kB each, and no more.
        bodyLimit: 1_200_000,
      },
      handle(async (request, reply) => {
        const header = request.headers['x-device-key']
        const key = Array.isArray(header) ? header[0] : header
        const body = eventsBody.parse(request.body)
        const result = await devices.ingest(key, body)
        if (!result) return reply.code(401).send(NO_SUCH_KEY)
        return reply.send(result)
      }),
    )
  }
}

export const attendanceDeviceRoutes = buildAttendanceDeviceRoutes(attendanceDeviceService)
