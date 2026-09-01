// backend/src/routes/activity.routes.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { ActivityService } from '../services/activity.service'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'

const activityService = new ActivityService()

const activityFiltersSchema = z.object({
  type: z.string().optional(),
  unread: z.coerce.boolean().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  page: z.coerce.number().min(1).optional(),
})

export async function activityRoutes(fastify: FastifyInstance) {
  // ─── GET /api/v1/activities ──────────────────────────────────────────────
  fastify.get(
    '/api/v1/activities',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'user', ttl: 30, keyPrefix: 'activities' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = activityFiltersSchema.parse(request.query)
        const result = await activityService.getActivities(request.tenancy, {
          type: query.type,
          unread: query.unread,
          search: query.search,
          limit: query.limit,
          cursor: query.cursor,
          page: query.page,
        })

        return reply.send(result)
      } catch (err: any) {
        fastify.log.error(err)
        return reply.code(500).send({ error: err.message })
      }
    },
  )

  // ─── GET /api/v1/activities/unread-count ──────────────────────────────
  fastify.get(
    '/api/v1/activities/unread-count',
    {
      preHandler: [
        authenticate,
        cacheMiddleware({ scope: 'user', ttl: 15, keyPrefix: 'activities-unread' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).userId
        const count = await activityService.getUnreadCount(userId)
        return reply.send({ count })
      } catch (err: any) {
        fastify.log.error(err)
        return reply.code(500).send({ error: err.message })
      }
    },
  )

  // ─── PATCH /api/v1/activities/mark-read ─────────────────────────────────
  fastify.patch(
    '/api/v1/activities/mark-read',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { ids } = request.body as { ids: string[] }
        const userId = (request as any).userId

        await activityService.markAsRead(userId, ids)
        await clearCache(`activities:${userId}:*`)
        await clearCache(`activities-unread:${userId}`)

        return reply.send({ success: true })
      } catch (err: any) {
        fastify.log.error(err)
        return reply.code(500).send({ error: err.message })
      }
    },
  )

  // ─── PATCH /api/v1/activities/mark-all-read ────────────────────────────
  fastify.patch(
    '/api/v1/activities/mark-all-read',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).userId

        await activityService.markAllAsRead(userId)
        await clearCache(`activities:${userId}:*`)
        await clearCache(`activities-unread:${userId}`)

        return reply.send({ success: true })
      } catch (err: any) {
        fastify.log.error(err)
        return reply.code(500).send({ error: err.message })
      }
    },
  )

  // ─── DELETE /api/v1/activities/:id ─────────────────────────────────────
  fastify.delete(
    '/api/v1/activities/:id',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const userId = (request as any).userId

        await activityService.deleteActivity(userId, id)
        await clearCache(`activities:${userId}:*`)

        return reply.code(204).send()
      } catch (err: any) {
        fastify.log.error(err)
        return reply.code(500).send({ error: err.message })
      }
    },
  )

  // ─── OPTIONS /api/v1/activities ─────────────────────────────────────────
  fastify.options('/api/v1/activities', async (request, reply) => {
    return reply
      .code(204)
      .headers({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      })
      .send()
  })

  // ═══════════════════════════════════════════════ ENTITY 360
  //
  // Four hooks called these addresses and nobody was there: `activity.ts`,
  // `entity.ts`, `useEntityActivities.ts` and `useEntitySummary.ts`. Every one
  // returned 404 and the screen quietly showed nothing.
  //
  // Both shapes are served — `/v1/entities/...` and `/api/v1/entities/...` —
  // because the hooks genuinely call both and `apiClient` prefixes one of them.
  // Serving both is honest; rewriting four hooks to agree is a separate change
  // with its own risk.

  const entityParams = z.object({
    entityType: z.enum(['invoice', 'customer', 'product', 'payment']),
    entityId: z.string().uuid(),
  })

  const summaryHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { entityType, entityId } = entityParams.parse(request.params)

      const summary = await activityService.getEntitySummary(
        entityType,
        entityId,
        request.tenancy.workspaceId,
      )

      // A summary the workspace does not own comes back null, and null is a
      // 404 — not an empty object. An empty object would render as a customer
      // with no name rather than as "no such customer here".
      if (!summary) return reply.code(404).send({ error: 'NOT_FOUND' })

      return reply.send(summary)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.code(400).send({ error: err.message })
    }
  }

  const entityActivitiesHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { entityType, entityId } = entityParams.parse(request.params)
      const query = activityFiltersSchema.parse(request.query)

      // ⚠️ NOT `getActivities`. That one filters by `actor_id` — a personal
      // feed. An entity's history is a workspace fact: a manager opening an
      // invoice a seller raised must see the seller's actions on it, not an
      // empty timeline.
      const result = await activityService.getEntityActivities(
        request.tenancy,
        entityType,
        entityId,
        { limit: query.limit, cursor: query.cursor },
      )

      return reply.send(result)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.code(400).send({ error: err.message })
    }
  }

  const entityGuards = [authenticate, requireWorkspaceContext]

  // ⚠️ Written out one by one rather than generated in a loop.
  //
  // `client-route-contract.test.ts` proves a hook's address is served by
  // READING THIS FILE. It cannot evaluate a `for` loop over template literals,
  // so eight routes registered that way are, as far as the guard is concerned,
  // eight routes that do not exist — and the first version of this block was
  // exactly that. A route a guard can see beats a loop it cannot.
  //
  // Both spellings are served because the hooks genuinely call both:
  // `apiClient` prefixes `/api`, and two of these hooks were written against
  // the unprefixed form. Rewriting four hooks to agree is a separate change
  // with its own risk.

  fastify.get(
    '/api/v1/entities/:entityType/:entityId/summary',
    { preHandler: entityGuards },
    summaryHandler,
  )
  fastify.get(
    '/v1/entities/:entityType/:entityId/summary',
    { preHandler: entityGuards },
    summaryHandler,
  )

  fastify.get(
    '/api/v1/entities/:entityType/:entityId/activities',
    { preHandler: entityGuards },
    entityActivitiesHandler,
  )
  fastify.get(
    '/v1/entities/:entityType/:entityId/activities',
    { preHandler: entityGuards },
    entityActivitiesHandler,
  )

  // The activity feed's own spelling of the same two questions.
  fastify.get(
    '/api/v1/activities/entity/:entityType/:entityId',
    { preHandler: entityGuards },
    entityActivitiesHandler,
  )
  fastify.get(
    '/v1/activities/entity/:entityType/:entityId',
    { preHandler: entityGuards },
    entityActivitiesHandler,
  )

  fastify.get(
    '/api/v1/activities/entity/:entityType/:entityId/summary',
    { preHandler: entityGuards },
    summaryHandler,
  )
  fastify.get(
    '/v1/activities/entity/:entityType/:entityId/summary',
    { preHandler: entityGuards },
    summaryHandler,
  )
}
