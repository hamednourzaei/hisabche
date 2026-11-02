// ============================================
// backend/src/routes/package-credits.routes.ts
//
// Fastify Routes for Package Credits and Entitlements (M3)
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { PackageCreditsService } from '../services/package-credits/package-credits.service'
import { PackageGrantsService } from '../services/package-credits/package-grants.service'
import { sendFailure } from '../errors/http-failure'
import { readClientRequestId, sendCreated } from '../utils/client-request'

export async function packageCreditsRoutes(fastify: FastifyInstance) {
  const service = new PackageCreditsService()
  const grants = new PackageGrantsService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
  const write = [authenticate, requireWorkspaceContext, requireCapability('invoice.create')]
  // Stopping (or letting go of) a customer's prepaid credit is a decision above a sale: manager by default, delegable.
  const suspend = [authenticate, requireWorkspaceContext, requireCapability('payment.cancel')]

  fastify.get(
    '/api/package-credits/balance',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = (request.query || {}) as { customerId?: string; packageProductId?: string }
        if (!query.customerId) {
          return reply.code(400).send({ error: 'customerId query parameter is required' })
        }
        const balance = await service.getBalance(
          request.tenancy,
          query.customerId,
          query.packageProductId,
        )
        return reply.send({ data: balance })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to fetch package credit balance')
      }
    },
  )

  // M5 / C: every GRANT of a customer with its term, activation, expiry, suspension and what is left.
  fastify.get(
    '/api/package-credits/grants',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = (request.query || {}) as { customerId?: string; packageProductId?: string }
        if (!query.customerId) {
          return reply.code(400).send({ error: 'customerId query parameter is required' })
        }
        const data = await grants.list(request.tenancy, query.customerId, query.packageProductId)
        return reply.send({ data })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to fetch package grants')
      }
    },
  )

  // Suspension of ONE GRANT: append-only events (a RESUME is a later row), never the whole customer.
  fastify.post(
    '/api/package-credits/grants/:grantId/suspension',
    { preHandler: suspend },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { grantId } = request.params as { grantId: string }
        const body = (request.body || {}) as {
          kind?: string
          effectiveOn?: string
          reason?: string
        }
        const result = await grants.recordSuspension(request.tenancy, grantId, {
          kind: body.kind as 'SUSPEND' | 'RESUME',
          effectiveOn: body.effectiveOn,
          reason: body.reason ?? '',
        })
        return sendCreated(reply, result)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to record the package suspension')
      }
    },
  )

  fastify.get(
    '/api/package-credits/ledger',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = (request.query || {}) as { customerId?: string; packageProductId?: string }
        if (!query.customerId) {
          return reply.code(400).send({ error: 'customerId query parameter is required' })
        }
        const ledger = await service.getLedger(
          request.tenancy,
          query.customerId,
          query.packageProductId,
        )
        return reply.send({ data: ledger })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to fetch package credit ledger')
      }
    },
  )

  fastify.post(
    '/api/package-credits/grant',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const clientRequestId = readClientRequestId(request)
        const body = (request.body || {}) as {
          customerId: string
          packageProductId: string
          quantity: number
          unit?: string | undefined
          sourceDocumentType?: string | undefined
          sourceDocumentId?: string | undefined
          sourceLineId?: string | undefined
          idempotencyKey?: string | undefined
          notes?: string | undefined
          expiresAt?: string | undefined
          effectiveDate?: string | undefined
        }

        const result = await service.grant(request.tenancy, {
          ...body,
          clientRequestId,
        })
        return sendCreated(reply, result)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to grant package credits')
      }
    },
  )

  fastify.post(
    '/api/package-credits/consume',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const clientRequestId = readClientRequestId(request)
        const body = (request.body || {}) as {
          customerId: string
          packageProductId: string
          quantity: number
          unit?: string | undefined
          idempotencyKey?: string | undefined
          notes?: string | undefined
          effectiveDate?: string | undefined
        }

        const result = await service.consume(request.tenancy, {
          ...body,
          clientRequestId,
        })
        return sendCreated(reply, result)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to consume package credits')
      }
    },
  )

  fastify.post(
    '/api/package-credits/reverse',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const clientRequestId = readClientRequestId(request)
        const body = (request.body || {}) as {
          referenceEntryId: string
          quantity?: number | undefined
          idempotencyKey?: string | undefined
          notes?: string | undefined
          effectiveDate?: string | undefined
        }

        const result = await service.reverse(request.tenancy, {
          ...body,
          clientRequestId,
        })
        return sendCreated(reply, result)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to reverse package credit entry')
      }
    },
  )

  fastify.post(
    '/api/package-credits/expire',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const clientRequestId = readClientRequestId(request)
        const body = (request.body || {}) as {
          customerId: string
          packageProductId: string
          idempotencyKey?: string | undefined
          notes?: string | undefined
          effectiveDate?: string | undefined
        }

        const result = await service.expire(request.tenancy, {
          ...body,
          clientRequestId,
        })
        return sendCreated(reply, result)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to expire package credits')
      }
    },
  )

  fastify.post(
    '/api/package-credits/adjust',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const clientRequestId = readClientRequestId(request)
        const body = (request.body || {}) as {
          customerId: string
          packageProductId: string
          quantityDelta: number
          unit?: string | undefined
          idempotencyKey?: string | undefined
          notes?: string | undefined
          effectiveDate?: string | undefined
        }

        const result = await service.adjust(request.tenancy, {
          ...body,
          clientRequestId,
        })
        return sendCreated(reply, result)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to adjust package credits')
      }
    },
  )
}
