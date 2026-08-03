// backend/src/routes/activity.routes.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { ActivityService } from "../services/activity.service";
import { authenticate } from "../middleware/auth.middleware";
import { cacheMiddleware, clearCache } from "../middleware/cache.middleware";

const activityService = new ActivityService();

const activityFiltersSchema = z.object({
  type: z.string().optional(),
  unread: z.coerce.boolean().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  page: z.coerce.number().min(1).optional(),
});

export async function activityRoutes(fastify: FastifyInstance) {
  // ─── GET /api/v1/activities ──────────────────────────────────────────────
  fastify.get(
    "/api/v1/activities",
    {
      preHandler: [authenticate, cacheMiddleware({ ttl: 30, keyPrefix: 'activities' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = activityFiltersSchema.parse(request.query);
        const userId = (request as any).userId;

        const result = await activityService.getActivities(userId, {
          type: query.type,
          unread: query.unread,
          search: query.search,
          limit: query.limit,
          cursor: query.cursor,
          page: query.page,
        });

        return reply.send(result);
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // ─── GET /api/v1/activities/unread-count ──────────────────────────────
  fastify.get(
    "/api/v1/activities/unread-count",
    {
      preHandler: [authenticate, cacheMiddleware({ ttl: 15, keyPrefix: 'activities-unread' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).userId;
        const count = await activityService.getUnreadCount(userId);
        return reply.send({ count });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // ─── PATCH /api/v1/activities/mark-read ─────────────────────────────────
  fastify.patch(
    "/api/v1/activities/mark-read",
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { ids } = request.body as { ids: string[] };
        const userId = (request as any).userId;

        await activityService.markAsRead(userId, ids);
        await clearCache(`activities:${userId}:*`);
        await clearCache(`activities-unread:${userId}`);

        return reply.send({ success: true });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // ─── PATCH /api/v1/activities/mark-all-read ────────────────────────────
  fastify.patch(
    "/api/v1/activities/mark-all-read",
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).userId;

        await activityService.markAllAsRead(userId);
        await clearCache(`activities:${userId}:*`);
        await clearCache(`activities-unread:${userId}`);

        return reply.send({ success: true });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // ─── DELETE /api/v1/activities/:id ─────────────────────────────────────
  fastify.delete(
    "/api/v1/activities/:id",
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const userId = (request as any).userId;

        await activityService.deleteActivity(userId, id);
        await clearCache(`activities:${userId}:*`);

        return reply.code(204).send();
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // ─── OPTIONS /api/v1/activities ─────────────────────────────────────────
  fastify.options("/api/v1/activities", async (request, reply) => {
    return reply.code(204).headers({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }).send();
  });
}