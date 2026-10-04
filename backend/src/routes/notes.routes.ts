// ============================================
// backend/src/routes/notes.routes.ts
//
// Capability #103 — notes on a customer, supplier, product or employee.
//
//   GET  /api/notes?entityType=&entityId=
//   POST /api/notes   { entityType, entityId, body }
//
// Any member of the workspace, except notes on an EMPLOYEE, which are for
// managers and up (read from `request.tenancy.role`): what is written about a
// colleague is not for every colleague.
//
// No PATCH and no DELETE: a note stays as it was written.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { NOTE_ENTITY_TABLES, notesService, type NoteEntityType } from '../services/notes.service'
import { requireRole, type TenancyContext } from '../services/tenancy.service'

const MEMBER = [authenticate, requireWorkspaceContext]
const entityType = z.enum(Object.keys(NOTE_ENTITY_TABLES) as [NoteEntityType, ...NoteEntityType[]])
const target = z.object({ entityType, entityId: z.string().uuid() })

function guard(ctx: TenancyContext, type: NoteEntityType) {
  if (type === 'employee') requireRole(ctx, 'manager')
}

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

export async function notesRoutes(fastify: FastifyInstance) {
  fastify.get('/api/notes', { preHandler: MEMBER }, async (request: FastifyRequest, reply) => {
    try {
      const query = target.parse(request.query)
      guard(request.tenancy, query.entityType)
      return reply.send({
        notes: await notesService.list(request.tenancy, query.entityType, query.entityId),
      })
    } catch (err) {
      return fail(fastify, reply, err, 'Failed to read notes')
    }
  })

  fastify.post('/api/notes', { preHandler: MEMBER }, async (request: FastifyRequest, reply) => {
    try {
      const input = target.extend({ body: z.string().max(4000) }).parse(request.body)
      guard(request.tenancy, input.entityType)
      return reply.code(201).send(await notesService.add(request.tenancy, input))
    } catch (err) {
      return fail(fastify, reply, err, 'Failed to save the note')
    }
  })
}
