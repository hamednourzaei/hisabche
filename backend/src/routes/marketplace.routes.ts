// ============================================
// backend/src/routes/marketplace.routes.ts
//
// Anyone in a workspace         GET /api/marketplace/apps, /api/marketplace/apps/:app
//                               POST /api/marketplace/apps/:app/report
// Owner/manager                 PUT|DELETE /api/marketplace/apps/:app/review
// (workspace.manage)            /api/developer/publisher, /api/developer/apps/:id/screenshots …,
//                               /api/developer/apps/:id/stats
// Platform admin                /api/admin/app-publishers …, /api/admin/app-reports …,
//                               /api/admin/app-reviews …, /api/admin/oauth-apps/:id/stats
//
// A review speaks for the business, so it needs the same capability as
// installing. A report is a warning anyone may raise.
//
// ⚠️ None of these is open to an API key (API_ROUTE_SCOPES).
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  APP_CATEGORIES,
  appReportSchema,
  appReviewSchema,
  appScreenshotSchema,
  publisherProfileSchema,
} from '@hisabche/validation'

import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { platformAdminGuard } from '../middleware/platform-admin.middleware'
import { marketplaceService, type MarketplaceService } from '../services/oauth/marketplace.service'
import { oauthFailure } from './oauth.routes'

const idParams = z.object({ id: z.string().uuid() })
const appParams = z.object({ app: z.string().min(1).max(100) })
const appIdParams = z.object({ app: z.string().uuid() })
const screenshotParams = z.object({ id: z.string().uuid(), screenshotId: z.string().uuid() })
const workspaceParams = z.object({ workspaceId: z.string().uuid() })
const listQuery = z.object({
  category: z.enum(APP_CATEGORIES).optional(),
  q: z.string().trim().max(100).optional(),
})
const statsQuery = z.object({ days: z.coerce.number().int().min(1).max(30).default(7) })
const reportsQuery = z.object({ status: z.enum(['open', 'resolved', 'dismissed']).default('open') })
const reviewsQuery = z.object({ hidden: z.enum(['true', 'false']).default('false') })
const note = z.string().trim().max(1000).optional()
const verificationBody = z.object({ verified: z.boolean() }).strict()
const resolutionBody = z.object({ status: z.enum(['resolved', 'dismissed']), note }).strict()
const visibilityBody = z
  .object({ hidden: z.boolean(), reason: z.string().trim().max(500).optional() })
  .strict()

export function buildMarketplaceRoutes(marketplace: MarketplaceService) {
  return async function marketplaceRoutes(fastify: FastifyInstance) {
    const member = [authenticate, requireWorkspaceContext]
    const manage = [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')]
    const admin = [authenticate, platformAdminGuard]

    const handle =
      (fn: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>) =>
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          return await fn(request, reply)
        } catch (err) {
          return oauthFailure(fastify, reply, err)
        }
      }

    // ─── browse ──────────────────────────────────────────────────────────────

    fastify.get(
      '/api/marketplace/apps',
      { preHandler: member },
      handle(async (request, reply) => {
        const q = listQuery.parse(request.query)
        return reply.send({ data: await marketplace.list(request.tenancy, q) })
      }),
    )

    fastify.get(
      '/api/marketplace/apps/:app',
      { preHandler: member },
      handle(async (request, reply) => {
        const { app } = appParams.parse(request.params)
        return reply.send(await marketplace.detail(request.tenancy, app))
      }),
    )

    fastify.put(
      '/api/marketplace/apps/:app/review',
      { preHandler: manage },
      handle(async (request, reply) => {
        const { app } = appIdParams.parse(request.params)
        return reply.send(
          await marketplace.saveReview(request.tenancy, app, appReviewSchema.parse(request.body)),
        )
      }),
    )

    fastify.delete(
      '/api/marketplace/apps/:app/review',
      { preHandler: manage },
      handle(async (request, reply) => {
        const { app } = appIdParams.parse(request.params)
        await marketplace.deleteReview(request.tenancy, app)
        return reply.code(204).send()
      }),
    )

    fastify.post(
      '/api/marketplace/apps/:app/report',
      { preHandler: member },
      handle(async (request, reply) => {
        const { app } = appIdParams.parse(request.params)
        const out = await marketplace.report(
          request.tenancy,
          app,
          appReportSchema.parse(request.body),
        )
        return reply.code(out.duplicate ? 200 : 201).send(out)
      }),
    )

    // ─── publisher ───────────────────────────────────────────────────────────

    fastify.get(
      '/api/developer/publisher',
      { preHandler: manage },
      handle(async (request, reply) =>
        reply.send({ profile: await marketplace.publisherProfile(request.tenancy) }),
      ),
    )

    fastify.put(
      '/api/developer/publisher',
      { preHandler: manage },
      handle(async (request, reply) =>
        reply.send(
          await marketplace.savePublisherProfile(
            request.tenancy,
            publisherProfileSchema.parse(request.body),
          ),
        ),
      ),
    )

    fastify.get(
      '/api/developer/apps/:id/screenshots',
      { preHandler: manage },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        return reply.send({ data: await marketplace.screenshots(request.tenancy, id) })
      }),
    )

    fastify.post(
      '/api/developer/apps/:id/screenshots',
      { preHandler: manage },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        return reply
          .code(201)
          .send(
            await marketplace.addScreenshot(
              request.tenancy,
              id,
              appScreenshotSchema.parse(request.body),
            ),
          )
      }),
    )

    fastify.delete(
      '/api/developer/apps/:id/screenshots/:screenshotId',
      { preHandler: manage },
      handle(async (request, reply) => {
        const { id, screenshotId } = screenshotParams.parse(request.params)
        await marketplace.removeScreenshot(request.tenancy, id, screenshotId)
        return reply.code(204).send()
      }),
    )

    fastify.get(
      '/api/developer/apps/:id/stats',
      { preHandler: manage },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        const { days } = statsQuery.parse(request.query)
        return reply.send(await marketplace.stats(request.tenancy, id, days))
      }),
    )

    // ─── platform ────────────────────────────────────────────────────────────

    fastify.get(
      '/api/admin/oauth-apps/:id/stats',
      { preHandler: admin },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        const { days } = statsQuery.parse(request.query)
        return reply.send(await marketplace.adminStats(id, days))
      }),
    )

    fastify.get(
      '/api/admin/app-publishers',
      { preHandler: admin },
      handle(async (_request, reply) => reply.send({ data: await marketplace.listPublishers() })),
    )

    fastify.post(
      '/api/admin/app-publishers/:workspaceId/verification',
      { preHandler: admin },
      handle(async (request, reply) => {
        const { workspaceId } = workspaceParams.parse(request.params)
        const { verified } = verificationBody.parse(request.body)
        return reply.send(await marketplace.setVerified(request.userId, workspaceId, verified))
      }),
    )

    fastify.get(
      '/api/admin/app-reports',
      { preHandler: admin },
      handle(async (request, reply) => {
        const { status } = reportsQuery.parse(request.query)
        return reply.send({ data: await marketplace.listReports(status) })
      }),
    )

    fastify.post(
      '/api/admin/app-reports/:id/resolution',
      { preHandler: admin },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        const b = resolutionBody.parse(request.body)
        return reply.send(
          await marketplace.resolveReport(request.userId, id, b.status, b.note ?? null),
        )
      }),
    )

    fastify.get(
      '/api/admin/app-reviews',
      { preHandler: admin },
      handle(async (request, reply) => {
        const { hidden } = reviewsQuery.parse(request.query)
        return reply.send({ data: await marketplace.listReviews(hidden === 'true') })
      }),
    )

    fastify.post(
      '/api/admin/app-reviews/:id/visibility',
      { preHandler: admin },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        const b = visibilityBody.parse(request.body)
        return reply.send(
          await marketplace.setReviewHidden(request.userId, id, b.hidden, b.reason ?? null),
        )
      }),
    )
  }
}

export const marketplaceRoutes = buildMarketplaceRoutes(marketplaceService)
