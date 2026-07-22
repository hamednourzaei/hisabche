// ============================================
// backend/src/routes/notification.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { markReadSchema } from "@hisabche/validation";
import { NotificationService } from "../services/notification.service";
import { authenticate } from "../middleware/auth.middleware";
import { cacheMiddleware, clearCache } from "../middleware/cache.middleware";

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: "jsonSchema7" });
  delete result.$schema;
  return result;
};

const querySchema = z.object({
  is_read: z.enum(["true", "false"]).optional().transform((v) => v === "true"),
  type: z.enum(["info", "success", "warning", "approval_required"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function notificationRoutes(fastify: FastifyInstance) {
  const notificationService = new NotificationService();

  // ─── GET /api/v1/notifications ──────────────────────────────
  fastify.get(
    "/api/v1/notifications",
    {
      preHandler: [authenticate, cacheMiddleware({ ttl: 30, keyPrefix: 'notifications' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const raw = request.query as Record<string, string>;
        const filters = querySchema.parse(raw);
        const result = await notificationService.list(request.userId, filters);
        return reply.send(result);
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // ─── GET /api/v1/notifications/unread-count ─────────────────
  fastify.get(
    "/api/v1/notifications/unread-count",
    {
      preHandler: [authenticate, cacheMiddleware({ ttl: 15, keyPrefix: 'notifications-unread' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const count = await notificationService.getUnreadCount(request.userId);
        return reply.send({ count });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // ─── PATCH /api/v1/notifications/mark-read ──────────────────
  fastify.patch(
    "/api/v1/notifications/mark-read",
    {
      preHandler: [authenticate],
      schema: { body: toJsonSchema(markReadSchema) },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { ids } = request.body as { ids: string[] };
        await notificationService.markAsRead(ids);
        await clearCache('notifications:*');
        await clearCache('notifications-unread:*');
        return reply.send({ success: true });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // ─── ✅ PATCH /api/v1/notifications/mark-all-read ───────────
  fastify.patch(
    "/api/v1/notifications/mark-all-read",
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await notificationService.markAllAsRead(request.userId);
        await clearCache('notifications:*');
        await clearCache('notifications-unread:*');
        return reply.send({ success: true });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ error: err.message });
      }
    }
  );
}