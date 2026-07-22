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

// ✅ Schema ساده برای mark-read (بدون UUID validation سخت‌گیرانه)
const markReadBodySchema = z.object({
  ids: z.array(z.string()).min(1, "ids must have at least one item"),
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
      // ✅ استفاده از Schema ساده
      schema: { body: toJsonSchema(markReadBodySchema) },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as { ids: string[] };
        
        console.log('📝 [mark-read] Received body:', JSON.stringify(body));
        
        // ✅ Validation با try-catch
        const { ids } = markReadBodySchema.parse(body);
        
        console.log('📝 [mark-read] Validated ids:', ids);
        
        await notificationService.markAsRead(ids);
        await clearCache('notifications:*');
        await clearCache('notifications-unread:*');
        return reply.send({ success: true, count: ids.length });
      } catch (err: any) {
        fastify.log.error('❌ [mark-read] Error:', err);
        
        // ✅ خطای Validation را با جزئیات برگردان
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ 
            error: 'Validation failed', 
            details: err.errors,
            received: request.body,
          });
        }
        
        return reply.code(500).send({ 
          error: err.message,
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        });
      }
    }
  );

  // ─── PATCH /api/v1/notifications/mark-all-read ───────────
  fastify.patch(
    "/api/v1/notifications/mark-all-read",
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        console.log('📝 [mark-all-read] UserId:', request.userId);
        
        await notificationService.markAllAsRead(request.userId);
        await clearCache('notifications:*');
        await clearCache('notifications-unread:*');
        return reply.send({ success: true });
      } catch (err: any) {
        fastify.log.error('❌ [mark-all-read] Error:', err);
        return reply.code(500).send({ 
          error: err.message,
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        });
      }
    }
  );
}