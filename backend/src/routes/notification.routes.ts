import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { notificationFiltersSchema, markReadSchema } from "@hisabche/validation";
import { NotificationService } from "../services/notification.service";
import { authenticate } from "../middleware/auth.middleware";

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: "jsonSchema7" });
  delete result.$schema;
  return result;
};

export async function notificationRoutes(fastify: FastifyInstance) {
  const notificationService = new NotificationService();

  fastify.get("/api/v1/notifications", { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const filters = notificationFiltersSchema.parse(request.query);
        const result = await notificationService.list(request.userId, filters);
        return reply.send(result);
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ error: err.message });
      }
    });

  fastify.get("/api/v1/notifications/unread-count", { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const count = await notificationService.getUnreadCount(request.userId);
        return reply.send({ count });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ error: err.message });
      }
    });

  fastify.patch("/api/v1/notifications/mark-read", {
    preHandler: [authenticate],
    schema: { body: toJsonSchema(markReadSchema) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { ids } = request.body as { ids: string[] };
      await notificationService.markAsRead(ids);
      return reply.send({ success: true });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.code(500).send({ error: err.message });
    }
  });
}