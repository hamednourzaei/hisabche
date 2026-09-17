// ============================================
// backend/src/routes/customer-profile.routes.ts
//
// Customer 360 phase 3 — credit limit, payment terms, linked supplier and
// documents. Every handler goes through the Customer Profile Core.
// Not cached: a limit that was just changed must show at once.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { CustomerProfileService } from '../services/customer-profile'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { invalidateMoneyCaches } from '../utils/money-cache'

const customerParams = z.object({ id: z.string().uuid() })
const documentParams = customerParams.extend({ documentId: z.string().uuid() })

const termsSchema = z
  .object({
    creditLimit: z.number().nonnegative().max(1e12).nullable().optional(),
    paymentTermsDays: z.number().int().min(0).max(3650).nullable().optional(),
    supplierId: z.string().uuid().nullable().optional(),
  })
  .strict()

const documentSchema = z
  .object({
    fileName: z.string().min(1).max(255),
    mimeType: z.string().min(1).max(100),
    // 5 MB of bytes is ~6.7 MB of base64; the domain checks the real size.
    contentBase64: z.string().min(1).max(7_000_000),
  })
  .strict()

export async function customerProfileRoutes(fastify: FastifyInstance) {
  const service = new CustomerProfileService()

  const fail = (reply: FastifyReply, err: unknown, fallback: string) => {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: err.errors })
    }
    if (err instanceof BaseError && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: err.message, code: err.message })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: fallback })
  }

  const read = [authenticate, requireWorkspaceContext, requireCapability('customer.read')]
  const write = [authenticate, requireWorkspaceContext, requireCapability('customer.write')]

  fastify.get(
    '/api/customers/:id/profile',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = customerParams.parse(request.params)
        return reply.send(await service.getProfile(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch customer profile')
      }
    },
  )

  fastify.get(
    '/api/customers/:id/accounting',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = customerParams.parse(request.params)
        return reply.send(await service.getAccounting(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch customer accounting')
      }
    },
  )

  fastify.get(
    '/api/customers/:id/insights',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = customerParams.parse(request.params)
        return reply.send(await service.getInsights(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to build customer insights')
      }
    },
  )

  fastify.patch(
    '/api/customers/:id/terms',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = customerParams.parse(request.params)
        const body = termsSchema.parse(request.body)
        const profile = await service.updateTerms(request.tenancy, id, body)
        await invalidateMoneyCaches(request.tenancy.workspaceId)
        return reply.send(profile)
      } catch (err) {
        return fail(reply, err, 'Failed to update customer terms')
      }
    },
  )

  fastify.get(
    '/api/customers/:id/documents',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = customerParams.parse(request.params)
        const documents = await service.listDocuments(request.tenancy, id)
        return reply.send({ available: documents !== null, documents: documents ?? [] })
      } catch (err) {
        return fail(reply, err, 'Failed to fetch customer documents')
      }
    },
  )

  fastify.post(
    '/api/customers/:id/documents',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = customerParams.parse(request.params)
        const body = documentSchema.parse(request.body)
        return reply.code(201).send(await service.addDocument(request.tenancy, id, body))
      } catch (err) {
        return fail(reply, err, 'Failed to upload customer document')
      }
    },
  )

  fastify.get(
    '/api/customers/:id/documents/:documentId/url',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id, documentId } = documentParams.parse(request.params)
        return reply.send(await service.documentUrl(request.tenancy, id, documentId))
      } catch (err) {
        return fail(reply, err, 'Failed to open customer document')
      }
    },
  )

  fastify.delete(
    '/api/customers/:id/documents/:documentId',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id, documentId } = documentParams.parse(request.params)
        await service.removeDocument(request.tenancy, id, documentId)
        return reply.code(204).send()
      } catch (err) {
        return fail(reply, err, 'Failed to remove customer document')
      }
    },
  )
}
