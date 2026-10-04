// ============================================
// backend/src/routes/snapshots.routes.ts
//
// Capabilities #42–#46 — markers of how many records the business held at a
// moment. Not a backup; nothing is restored from one.
//
//   GET  /api/snapshots               manager and up
//   POST /api/snapshots               manager and up   { label }
//   GET  /api/snapshots/:id/compare   manager and up
//
// Manager and up, from `request.tenancy.role`: the counts span the ledger.
// There is no PATCH and no DELETE — a marker stays as it was taken.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { snapshotService } from '../services/portability/snapshot.service'
import { requireRole } from '../services/tenancy.service'

const MEMBER = [authenticate, requireWorkspaceContext]

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

export async function snapshotRoutes(fastify: FastifyInstance) {
  fastify.get('/api/snapshots', { preHandler: MEMBER }, async (request: FastifyRequest, reply) => {
    try {
      requireRole(request.tenancy, 'manager')
      return reply.send({ snapshots: await snapshotService.list(request.tenancy) })
    } catch (err) {
      return fail(fastify, reply, err, 'Failed to read snapshots')
    }
  })

  fastify.post('/api/snapshots', { preHandler: MEMBER }, async (request: FastifyRequest, reply) => {
    try {
      requireRole(request.tenancy, 'manager')
      const { label } = z.object({ label: z.string().trim().min(1).max(80) }).parse(request.body)
      return reply.code(201).send(await snapshotService.take(request.tenancy, label))
    } catch (err) {
      return fail(fastify, reply, err, 'Failed to take the snapshot')
    }
  })

  fastify.get(
    '/api/snapshots/:id/compare',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        return reply.send(await snapshotService.compare(request.tenancy, id))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to compare the snapshot')
      }
    },
  )
}
