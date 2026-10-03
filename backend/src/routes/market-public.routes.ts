// ============================================
// backend/src/routes/market-public.routes.ts
//
// The goods marketplace, as the PUBLIC reads it. No login, by design — these
// feed the public SEO pages (/[lang]/market/…) and the sitemap.
//
//   GET /api/public/market/listings                         search / browse
//   GET /api/public/market/sellers/:seller                  one seller
//   GET /api/public/market/sellers/:seller/listings/:slug   one listing
//   GET /api/public/market/sitemap                          every public URL
//
// ⚠️ While the platform switch is off (the default) every one of the first
// three answers 404 MARKET_DISABLED — the marketplace does not exist yet —
// and the sitemap answers `enabled: false` with nothing in it.
//
// ⚠️ This file declares routes under /api/public/, which the global auth hook
// skips. Each is in the closed list in storefront-orders.test.ts; a route
// added here without being added there fails that test.
// ============================================

import { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'

import { sendFailure } from '../errors/http-failure'
import { marketService } from '../services/market/market.service'

const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(80)

const listQuery = z.object({
  seller: slug.optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
})

export async function marketPublicRoutes(fastify: FastifyInstance) {
  const fail = (reply: FastifyReply, err: unknown, fallback: string) =>
    sendFailure(reply, fastify.log, err, fallback)

  fastify.get('/api/public/market/listings', async (request, reply) => {
    try {
      const query = listQuery.parse(request.query)
      return reply.send(await marketService.listPublic(query))
    } catch (err) {
      return fail(reply, err, 'Failed to read the marketplace')
    }
  })

  fastify.get('/api/public/market/sellers/:seller', async (request, reply) => {
    try {
      const params = z.object({ seller: slug }).parse(request.params)
      return reply.send(await marketService.sellerPublic(params.seller))
    } catch (err) {
      return fail(reply, err, 'Failed to read the seller')
    }
  })

  fastify.get('/api/public/market/sellers/:seller/listings/:slug', async (request, reply) => {
    try {
      const params = z.object({ seller: slug, slug }).parse(request.params)
      return reply.send(await marketService.listingPublic(params.seller, params.slug))
    } catch (err) {
      return fail(reply, err, 'Failed to read the listing')
    }
  })

  fastify.get('/api/public/market/sitemap', async (_request, reply) => {
    try {
      return reply.send(await marketService.sitemap())
    } catch (err) {
      return fail(reply, err, 'Failed to read the marketplace sitemap')
    }
  })
}
