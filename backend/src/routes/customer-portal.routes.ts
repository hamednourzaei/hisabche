// ============================================
// backend/src/routes/customer-portal.routes.ts
//
//   POST   /api/customers/:id/portal-links     make a link (customer.write)
//   GET    /api/customers/:id/portal-links     the customer's links (customer.read)
//   DELETE /api/customer-portal-links/:id      revoke (customer.write)
//   GET    /api/public/portal/:token           the customer's own account — PUBLIC
//
// The public route has no `authenticate` on purpose: the token is the
// credential, and the service re-verifies the link's maker on every visit.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { NotConfiguredError } from '../services/developer/developer.repository'
import {
  PortalError,
  customerPortalService,
  type CustomerPortalService,
} from '../services/customer-portal/customer-portal.service'

const idParams = z.object({ id: z.string().uuid() })
const tokenParams = z.object({ token: z.string().regex(/^[0-9a-f]{64}$/) })
const createBody = z
  .object({ expiresInDays: z.number().int().min(1).max(3650).optional() })
  .strict()

export function buildCustomerPortalRoutes(portal: CustomerPortalService) {
  return async function customerPortalRoutes(fastify: FastifyInstance) {
    const read = [authenticate, requireWorkspaceContext, requireCapability('customer.read')]
    const write = [authenticate, requireWorkspaceContext, requireCapability('customer.write')]

    const fail = (reply: FastifyReply, err: unknown) => {
      if (err instanceof z.ZodError)
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      if (err instanceof PortalError)
        return reply.code(err.statusCode).send({ error: err.code, code: err.code })
      if (err instanceof NotConfiguredError) {
        return reply
          .code(503)
          .send({ error: 'PORTAL_NOT_CONFIGURED', code: 'PORTAL_NOT_CONFIGURED' })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Internal Server Error' })
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

    fastify.post(
      '/api/customers/:id/portal-links',
      { preHandler: write },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        const { expiresInDays } = createBody.parse(request.body ?? {})
        return reply
          .code(201)
          .send(await portal.createLink(request.tenancy, id, expiresInDays ?? null))
      }),
    )

    fastify.get(
      '/api/customers/:id/portal-links',
      { preHandler: read },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        return reply.send({ data: await portal.listLinks(request.tenancy, id) })
      }),
    )

    fastify.delete(
      '/api/customer-portal-links/:id',
      { preHandler: write },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        await portal.revokeLink(request.tenancy, id)
        return reply.code(204).send()
      }),
    )

    fastify.get(
      '/api/public/portal/:token',
      { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
      handle(async (request, reply) => {
        const { token } = tokenParams.parse(request.params)
        const view = await portal.view(token)
        // Unknown, revoked, expired and orphaned links look the same from
        // outside: which one it was is none of the holder's business.
        if (!view)
          return reply.code(404).send({ error: 'PORTAL_NOT_FOUND', code: 'PORTAL_NOT_FOUND' })
        return reply.send(view)
      }),
    )
  }
}

export const customerPortalRoutes = buildCustomerPortalRoutes(customerPortalService)
