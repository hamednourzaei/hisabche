// ============================================
// backend/src/routes/storefront.routes.ts
//
// The PUBLIC storefront API, called from customers' own websites with a
// publishable key (docs/developer-platform-03-commerce-migration.sql):
//
//   GET  /api/public/v1/catalog              active, priced products
//   GET  /api/public/v1/products/:id         one of them
//   POST /api/public/v1/orders               a PENDING order (Idempotency-Key required)
//   GET  /api/public/v1/orders/:token        the customer's own status page
//
// ⚠️ No `authenticate` here, deliberately: the caller is a browser on a shop's
// website. What the key opens is the whole of the list above — nothing reads
// cost, customers, invoices or the ledger, and nothing writes anything but a
// pending order whose prices the database sets.
//
// CORS for these paths is answered per request (index.ts, storefrontCors):
// any origin may ask, and the key's own origin list decides.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { PUBLISHABLE_KEY_HEADER, orderCreateSchema } from '@hisabche/validation'

import { originAllowed } from '../services/developer/developer.domain'
import { NotConfiguredError } from '../services/developer/developer.repository'
import {
  developerService,
  type DeveloperService,
  type PublishablePrincipal,
} from '../services/developer/developer.service'
import { OrderError } from '../services/orders/orders.domain'
import { ordersService, toPublicOrder, type OrdersService } from '../services/orders/orders.service'
import { readClientRequestId } from '../utils/client-request'

declare module 'fastify' {
  interface FastifyRequest {
    /** Present only on /api/public/v1 routes, after the key was checked. */
    storefront?: PublishablePrincipal | undefined
  }
}

export const STOREFRONT_PREFIX = '/api/public/v1'

/**
 * Is this URL under /api/public/ — the storefront and the token-addressed
 * views (invoice, portal, task)? CORS is answered differently there
 * (index.ts): any origin, never credentials.
 */
export function isPublicApiPath(url: string): boolean {
  const path = url.split('?')[0] ?? ''
  return path.startsWith('/api/public/')
}

const catalogQuery = z.object({
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
})
const idParams = z.object({ id: z.string().uuid() })
const tokenParams = z.object({ token: z.string().regex(/^[0-9a-f]{64}$/) })

export function buildStorefrontRoutes(
  keys: Pick<DeveloperService, 'authenticatePublishable'>,
  orders: OrdersService,
) {
  return async function storefrontRoutes(fastify: FastifyInstance) {
    const fail = (reply: FastifyReply, err: unknown) => {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      if (err instanceof OrderError)
        return reply.code(err.statusCode).send({ error: err.code, code: err.code })
      if (err instanceof NotConfiguredError) {
        return reply
          .code(503)
          .send({ error: 'STOREFRONT_NOT_CONFIGURED', code: 'STOREFRONT_NOT_CONFIGURED' })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Internal Server Error' })
    }

    /** The key, then the origin. Nothing else is read before both pass. */
    async function requireStorefront(request: FastifyRequest, reply: FastifyReply) {
      const raw = request.headers[PUBLISHABLE_KEY_HEADER.toLowerCase()]
      const token = typeof raw === 'string' ? raw.trim() : ''
      let principal: PublishablePrincipal | null
      try {
        principal = await keys.authenticatePublishable(token)
      } catch (err) {
        return fail(reply, err)
      }
      if (!principal) {
        return reply
          .code(401)
          .send({ error: 'PUBLISHABLE_KEY_INVALID', code: 'PUBLISHABLE_KEY_INVALID' })
      }
      const origin = typeof request.headers.origin === 'string' ? request.headers.origin : undefined
      if (!originAllowed(principal.allowedOrigins, origin)) {
        return reply.code(403).send({ error: 'ORIGIN_NOT_ALLOWED', code: 'ORIGIN_NOT_ALLOWED' })
      }
      request.storefront = principal
    }

    const handle =
      (
        fn: (
          request: FastifyRequest & { storefront: PublishablePrincipal },
          reply: FastifyReply,
        ) => Promise<unknown>,
      ) =>
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          return await fn(request as FastifyRequest & { storefront: PublishablePrincipal }, reply)
        } catch (err) {
          return fail(reply, err)
        }
      }

    fastify.get(
      `${STOREFRONT_PREFIX}/catalog`,
      { preHandler: requireStorefront },
      handle(async (request, reply) => {
        const query = catalogQuery.parse(request.query)
        return reply.send(await orders.catalog(request.storefront.workspaceId, query))
      }),
    )

    fastify.get(
      `${STOREFRONT_PREFIX}/products/:id`,
      { preHandler: requireStorefront },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        const product = await orders.catalogProduct(request.storefront.workspaceId, id)
        if (!product)
          return reply.code(404).send({ error: 'PRODUCT_NOT_FOUND', code: 'PRODUCT_NOT_FOUND' })
        return reply.send(product)
      }),
    )

    fastify.post(
      `${STOREFRONT_PREFIX}/orders`,
      {
        preHandler: requireStorefront,
        // Per IP, on top of the global limit: placing orders is the one write.
        config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      },
      handle(async (request, reply) => {
        const idempotencyKey = readClientRequestId(request)
        if (!idempotencyKey) {
          return reply
            .code(400)
            .send({ error: 'IDEMPOTENCY_KEY_REQUIRED', code: 'IDEMPOTENCY_KEY_REQUIRED' })
        }
        const body = orderCreateSchema.parse(request.body)
        const { order, replay } = await orders.placeFromWebsite(
          request.storefront,
          idempotencyKey,
          body,
        )
        return reply.code(replay ? 200 : 201).send({
          ...toPublicOrder(order),
          // The customer's own link to this order's status.
          token: order.public_token,
          replay,
        })
      }),
    )

    fastify.get(
      `${STOREFRONT_PREFIX}/orders/:token`,
      { preHandler: requireStorefront },
      handle(async (request, reply) => {
        const { token } = tokenParams.parse(request.params)
        const view = await orders.publicStatus(token, request.storefront.workspaceId)
        if (!view)
          return reply.code(404).send({ error: 'ORDER_NOT_FOUND', code: 'ORDER_NOT_FOUND' })
        return reply.send(view)
      }),
    )
  }
}

export const storefrontRoutes = buildStorefrontRoutes(developerService, ordersService)
