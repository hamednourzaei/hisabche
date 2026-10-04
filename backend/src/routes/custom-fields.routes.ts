// ============================================
// backend/src/routes/custom-fields.routes.ts
//
// Capabilities #141–#143 — a business's own fields on a customer, supplier or
// product.
//
//   GET   /api/custom-fields/:entity                    any member
//   POST  /api/custom-fields/:entity                    manager and up
//   PATCH /api/custom-fields/definitions/:id/active     manager and up
//   GET   /api/custom-fields/:entity/:entityId/values   any member
//   PUT   /api/custom-fields/:entity/:entityId/values   any member
//
// Deciding WHICH fields exist shapes everyone's forms, so it is a manager's
// decision; filling them in is part of working with the record.
//
// `:entity` is a closed list. There is no route that reaches an invoice, a
// payment or the ledger.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import {
  CUSTOM_FIELD_ENTITIES,
  CUSTOM_FIELD_TYPES,
  customFieldsService,
  type CustomFieldEntity,
} from '../services/extensions/custom-fields.service'
import { requireRole } from '../services/tenancy.service'

const MEMBER = [authenticate, requireWorkspaceContext]
const entity = z.enum(
  Object.keys(CUSTOM_FIELD_ENTITIES) as [CustomFieldEntity, ...CustomFieldEntity[]],
)
const entityParams = z.object({ entity })
const recordParams = z.object({ entity, entityId: z.string().uuid() })

const definitionBody = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  label: z.string().trim().min(1).max(60),
  type: z.enum(CUSTOM_FIELD_TYPES),
  choices: z.array(z.string().trim().min(1).max(60)).max(50).nullable().default(null),
  formula: z.string().max(300).nullable().default(null),
  required: z.boolean().default(false),
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

export async function customFieldRoutes(fastify: FastifyInstance) {
  // Registered before `/:entity` so «definitions» is never read as an entity.
  fastify.patch(
    '/api/custom-fields/definitions/:id/active',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        const { isActive } = z.object({ isActive: z.boolean() }).parse(request.body)
        return reply.send(await customFieldsService.setActive(request.tenancy, id, isActive))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to update the custom field')
      }
    },
  )

  fastify.get(
    '/api/custom-fields/:entity',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply) => {
      try {
        const params = entityParams.parse(request.params)
        const { all } = z.object({ all: z.enum(['0', '1']).optional() }).parse(request.query)
        return reply.send({
          fields: await customFieldsService.definitions(
            request.tenancy,
            params.entity,
            all === '1',
          ),
        })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read custom fields')
      }
    },
  )

  fastify.post(
    '/api/custom-fields/:entity',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const params = entityParams.parse(request.params)
        const input = definitionBody.parse(request.body)
        return reply
          .code(201)
          .send(
            await customFieldsService.define(request.tenancy, { entity: params.entity, ...input }),
          )
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to save the custom field')
      }
    },
  )

  fastify.get(
    '/api/custom-fields/:entity/:entityId/values',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply) => {
      try {
        const params = recordParams.parse(request.params)
        return reply.send(
          await customFieldsService.read(request.tenancy, params.entity, params.entityId),
        )
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read custom field values')
      }
    },
  )

  fastify.put(
    '/api/custom-fields/:entity/:entityId/values',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply) => {
      try {
        const params = recordParams.parse(request.params)
        const { values } = z.object({ values: z.record(z.unknown()) }).parse(request.body)
        return reply.send(
          await customFieldsService.write(request.tenancy, params.entity, params.entityId, values),
        )
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to save custom field values')
      }
    },
  )
}
