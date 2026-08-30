// ============================================
// backend/src/routes/supplier.routes.ts
//
// Registered with prefix '/api/suppliers' in index.ts.
//
// A supplier is deactivated, never deleted: the purchase history references
// them, and a dangling supplier id on a purchase invoice is a hole in the
// audit trail. There is deliberately no DELETE route.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { SupplierService } from '../services/supplier'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { cacheMiddleware } from '../middleware/cache.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(40).optional(),
  email: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
})

const updateSchema = createSchema.partial().extend({ isActive: z.boolean().optional() })

export async function supplierRoutes(fastify: FastifyInstance) {
  const supplierService = new SupplierService()

  const fail = (reply: FastifyReply, err: unknown, fallback: string) => {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: err.errors })
    }
    if (err instanceof BaseError && err.statusCode < 500) {
      const code = /^[A-Z][A-Z_]{6,}/.exec(err.message)?.[0]
      return reply.code(err.statusCode).send({ error: err.message, code: code ?? err.name })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: fallback })
  }

  fastify.get(
    '/',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('customer.read'),
        cacheMiddleware({ scope: 'workspace', ttl: 120, keyPrefix: 'suppliers' }),
      ],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { search, isActive } = request.query as { search?: string; isActive?: string }
        return reply.send(
          await supplierService.list(request.tenancy, {
            ...(search ? { search } : {}),
            ...(isActive === undefined ? {} : { isActive: isActive === 'true' }),
          }),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to fetch suppliers')
      }
    },
  )

  fastify.get(
    '/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('customer.read')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send(await supplierService.get(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch supplier')
      }
    },
  )

  // ─── GET /:id/360 ──────────────────────────────────────
  // What we have bought, what is still owed, and how the balance got there.
  // The money figures need the financial capability; the master record alone
  // does not.
  fastify.get(
    '/:id/360',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
      ],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send(await supplierService.get360(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to build the supplier view')
      }
    },
  )

  fastify.post(
    '/',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('customer.write')],
      schema: { body: toJsonSchema(createSchema), response: { 201: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createSchema.parse(request.body)
        return reply.code(201).send(await supplierService.create(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to create supplier')
      }
    },
  )

  fastify.patch(
    '/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('customer.write')],
      schema: { body: toJsonSchema(updateSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = updateSchema.parse(request.body)
        return reply.send(await supplierService.update(request.tenancy, id, body))
      } catch (err) {
        return fail(reply, err, 'Failed to update supplier')
      }
    },
  )
}
