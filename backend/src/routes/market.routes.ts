// ============================================
// backend/src/routes/market.routes.ts
//
// The goods marketplace, behind a login (docs/goods-marketplace-01-migration.sql).
// The public reads live in market-public.routes.ts.
//
//   /api/market/…        one business as a SELLER: its profile and listings.
//                        workspace.manage — what a business shows the public
//                        under its name is the owner's decision.
//   /api/admin/market/…  the platform: the on/off switch, suspending a seller
//                        or a listing, and marking a seller verified.
//
// ⚠️ A seller's body never carries `status`, `verified` or a suspension: those
// are not in the schemas below, so they cannot be sent (and the service does
// not write them from this path).
// ⚠️ Not in the API-key allowlist.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { currencyCodeSchema } from '@hisabche/validation'

import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { platformAdminGuard } from '../middleware/platform-admin.middleware'
import { sendFailure } from '../errors/http-failure'
import { marketService } from '../services/market/market.service'

const manage = [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')]
const admin = [authenticate, platformAdminGuard]

const slug = (max: number) =>
  z
    .string()
    .trim()
    .min(3)
    .max(max)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)

const profileBody = z.object({
  slug: slug(60),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(''),
  city: z.string().trim().max(80).default(''),
  country: z
    .string()
    .trim()
    .regex(/^([A-Z]{2})?$/)
    .default(''),
  contact: z.string().trim().max(200).default(''),
})

const listingBody = z.object({
  productId: z.string().uuid(),
  slug: slug(80),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).default(''),
  // The seller states the price; integer minor units of a currency we format.
  priceMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  currency: currencyCodeSchema,
  availability: z.enum(['in_stock', 'out_of_stock']).default('in_stock'),
  quantity: z.number().int().min(0).nullable().default(null),
  isHidden: z.boolean().default(false),
  status: z.enum(['draft', 'active', 'paused']).default('draft'),
  seoTitle: z.string().trim().max(70).default(''),
  seoDescription: z.string().trim().max(160).default(''),
})

const enabledBody = z.object({ enabled: z.boolean() })
const sellerStatusBody = z
  .object({
    status: z.enum(['active', 'suspended']),
    reason: z.string().trim().max(500).optional(),
  })
  // A suspension the seller reads must say why.
  .refine((b) => b.status === 'active' || Boolean(b.reason), 'MARKET_REASON_REQUIRED')
const verifiedBody = z.object({ verified: z.boolean() })
const suspendBody = z
  .object({ suspended: z.boolean(), reason: z.string().trim().max(500).optional() })
  .refine((b) => !b.suspended || Boolean(b.reason), 'MARKET_REASON_REQUIRED')

const id = (request: FastifyRequest) => (request.params as { id: string }).id

export async function marketRoutes(fastify: FastifyInstance) {
  const fail = (reply: FastifyReply, err: unknown, fallback: string) =>
    sendFailure(reply, fastify.log, err, fallback)

  // ─── The seller ─────────────────────────────────────────────────────────

  fastify.get('/api/market/seller', { preHandler: manage }, async (request, reply) => {
    try {
      return reply.send(await marketService.sellerOverview(request.tenancy))
    } catch (err) {
      return fail(reply, err, 'Failed to read the seller profile')
    }
  })

  fastify.put('/api/market/seller', { preHandler: manage }, async (request, reply) => {
    try {
      const body = profileBody.parse(request.body)
      return reply.send(await marketService.saveProfile(request.tenancy, body))
    } catch (err) {
      return fail(reply, err, 'Failed to save the seller profile')
    }
  })

  fastify.post('/api/market/listings', { preHandler: manage }, async (request, reply) => {
    try {
      const body = listingBody.parse(request.body)
      return reply.code(201).send(await marketService.createListing(request.tenancy, body))
    } catch (err) {
      return fail(reply, err, 'Failed to create the listing')
    }
  })

  fastify.put('/api/market/listings/:id', { preHandler: manage }, async (request, reply) => {
    try {
      const body = listingBody.parse(request.body)
      return reply.send(await marketService.updateListing(request.tenancy, id(request), body))
    } catch (err) {
      return fail(reply, err, 'Failed to save the listing')
    }
  })

  fastify.delete('/api/market/listings/:id', { preHandler: manage }, async (request, reply) => {
    try {
      await marketService.deleteListing(request.tenancy, id(request))
      return reply.code(204).send()
    } catch (err) {
      return fail(reply, err, 'Failed to delete the listing')
    }
  })

  // ─── Platform admin ─────────────────────────────────────────────────────

  fastify.get('/api/admin/market', { preHandler: admin }, async (_request, reply) => {
    try {
      return reply.send({ enabled: await marketService.isEnabled() })
    } catch (err) {
      return fail(reply, err, 'Failed to read the marketplace switch')
    }
  })

  fastify.put('/api/admin/market/enabled', { preHandler: admin }, async (request, reply) => {
    try {
      const body = enabledBody.parse(request.body)
      return reply.send({ enabled: await marketService.setEnabled(request.userId, body.enabled) })
    } catch (err) {
      return fail(reply, err, 'Failed to change the marketplace switch')
    }
  })

  fastify.get('/api/admin/market/sellers', { preHandler: admin }, async (request, reply) => {
    const q = z
      .string()
      .trim()
      .max(100)
      .catch('')
      .parse((request.query as { q?: string }).q ?? '')
    try {
      return reply.send({ sellers: await marketService.adminSellers(q) })
    } catch (err) {
      return fail(reply, err, 'Failed to read the sellers')
    }
  })

  fastify.post(
    '/api/admin/market/sellers/:id/status',
    { preHandler: admin },
    async (request, reply) => {
      try {
        const body = sellerStatusBody.parse(request.body)
        return reply.send(
          await marketService.setSellerStatus(id(request), body.status, body.reason ?? null),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to change the seller status')
      }
    },
  )

  fastify.post(
    '/api/admin/market/sellers/:id/verified',
    { preHandler: admin },
    async (request, reply) => {
      try {
        const body = verifiedBody.parse(request.body)
        return reply.send(
          await marketService.setSellerVerified(request.userId, id(request), body.verified),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to change the seller verification')
      }
    },
  )

  fastify.get('/api/admin/market/listings', { preHandler: admin }, async (request, reply) => {
    const workspaceId = z
      .string()
      .uuid()
      .optional()
      .catch(undefined)
      .parse((request.query as { workspaceId?: string }).workspaceId)
    try {
      return reply.send({ listings: await marketService.adminListings(workspaceId) })
    } catch (err) {
      return fail(reply, err, 'Failed to read the listings')
    }
  })

  fastify.post(
    '/api/admin/market/listings/:id/suspended',
    { preHandler: admin },
    async (request, reply) => {
      try {
        const body = suspendBody.parse(request.body)
        return reply.send(
          await marketService.setListingSuspended(id(request), body.suspended, body.reason ?? null),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to change the listing suspension')
      }
    },
  )
}
