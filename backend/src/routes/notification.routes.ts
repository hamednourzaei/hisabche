// ============================================
// backend/src/routes/notification.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { NotificationService } from '../services/notification.service'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'
import type { NotificationScope } from '../services/notification.service'
import { toJsonSchema } from '../utils/json-schema'

const querySchema = z.object({
  is_read: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  type: z.enum(['info', 'success', 'warning', 'approval_required']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

// ✅ Schema ساده برای mark-read (بدون UUID validation سخت‌گیرانه)
const markReadBodySchema = z.object({
  ids: z.array(z.string()).min(1, 'ids must have at least one item'),
})

/**
 * One person inside the workspace requireWorkspaceContext resolved (audit F-04).
 * `request.tenancy` is the only source: never `request.userId` alone.
 */
function scopeOf(request: FastifyRequest): NotificationScope {
  return { userId: request.tenancy.userId, workspaceId: request.tenancy.workspaceId }
}

export async function notificationRoutes(fastify: FastifyInstance) {
  const notificationService = new NotificationService()

  // ─── GET /api/v1/notifications ──────────────────────────────
  fastify.get(
    '/api/v1/notifications',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'member', ttl: 30, keyPrefix: 'notifications' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const raw = request.query as Record<string, string>
        const filters = querySchema.parse(raw)
        const result = await notificationService.list(scopeOf(request), filters)
        return reply.send(result)
      } catch (err: any) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to read notifications' })
      }
    },
  )

  // ─── GET /api/v1/notifications/unread-count ─────────────────
  fastify.get(
    '/api/v1/notifications/unread-count',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'member', ttl: 15, keyPrefix: 'notifications-unread' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const count = await notificationService.getUnreadCount(scopeOf(request))
        return reply.send({ count })
      } catch (err: any) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to read notifications' })
      }
    },
  )

  // ─── PATCH /api/v1/notifications/mark-read ──────────────────
  fastify.patch(
    '/api/v1/notifications/mark-read',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      // ✅ استفاده از Schema ساده
      schema: { body: toJsonSchema(markReadBodySchema) },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as { ids: string[] }

        // ✅ Validation با try-catch
        const { ids } = markReadBodySchema.parse(body)

        const updated = await notificationService.markAsRead(scopeOf(request), ids)
        await clearCache(`notifications:${request.userId}:*`)
        await clearCache(`notifications-unread:${request.userId}:*`)
        return reply.send({ success: true, count: updated.length })
      } catch (err: any) {
        fastify.log.error('❌ [mark-read] Error:', err)

        // ✅ خطای Validation را با جزئیات برگردان
        if (err instanceof z.ZodError) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: err.errors,
            received: request.body,
          })
        }

        return reply.code(500).send({ error: 'Failed to update notifications' })
      }
    },
  )

  // ─── PATCH /api/v1/notifications/mark-all-read ───────────
  fastify.patch(
    '/api/v1/notifications/mark-all-read',
    {
      preHandler: [authenticate, requireWorkspaceContext],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await notificationService.markAllAsRead(scopeOf(request))
        await clearCache(`notifications:${request.userId}:*`)
        await clearCache(`notifications-unread:${request.userId}:*`)
        return reply.send({ success: true })
      } catch (err: any) {
        fastify.log.error('❌ [mark-all-read] Error:', err)
        return reply.code(500).send({ error: 'Failed to update notifications' })
      }
    },
  )

  // V61 B.2.16 — Channel-agnostic messaging outbox (email | sms)
  fastify.post(
    '/api/notifications/outbox',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('customer.write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { z } = await import('zod')
        const body = z
          .object({
            channel: z.enum(['email', 'sms']),
            customerId: z.string().uuid().optional(),
            recipient: z.string().min(3),
            templateKey: z.string().min(1),
            templateParams: z.record(z.unknown()).optional(),
            idempotencyKey: z.string().min(1),
          })
          .parse(request.body)
        const { messagingOutboxService } =
          await import('../services/messaging/messaging-outbox.service')
        return reply.code(202).send({
          data: await messagingOutboxService.enqueue(request.tenancy, body),
        })
      } catch (err: any) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to enqueue message' })
      }
    },
  )
}
