// ============================================
// backend/src/routes/workflow.routes.ts
// Hisabche v1.1 — Workflow & Approval Engine
// 9 endpoints: CRUD workflows + instances + actions
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  workflowFiltersSchema,
  createWorkflowInstanceSchema,
  instanceFiltersSchema,
  createWorkflowActionSchema,
} from "@hisabche/validation";
import { WorkflowService } from "../services/workflow.service";
import { authenticate } from "../middleware/auth.middleware";
import { cacheMiddleware, clearCache } from "../middleware/cache.middleware";

// ✅ Same pattern as analytics.routes.ts — use `any` to avoid deep instantiation
const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: "jsonSchema7" });
  delete result.$schema;
  return result;
};

export async function workflowRoutes(fastify: FastifyInstance) {
  const workflowService = new WorkflowService();

  /* ═══════════════════════════════════════════════════════════════
     WORKFLOW TEMPLATES
     ═══════════════════════════════════════════════════════════════ */

  // ── POST /api/v1/workflows ──────────────────────────────────
  fastify.post(
    "/api/v1/workflows",
    {
      preHandler: [authenticate],
      schema: {
        body: toJsonSchema(createWorkflowSchema),
        response: { 201: toJsonSchema(z.object({ id: z.string().uuid() })) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createWorkflowSchema.parse(request.body);
        const workflow = await workflowService.createWorkflow(
          request.workspaceId,
          data
        );
        await clearCache('workflows:*');
        return reply.code(201).send(workflow);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply
            .code(400)
            .send({ error: "Validation failed", details: err.errors });
        }
        fastify.log.error(err);
        return reply.code(500).send({ error: "Failed to create workflow" });
      }
    }
  );

  // ── GET /api/v1/workflows ───────────────────────────────────
  fastify.get(
    "/api/v1/workflows",
    {
      preHandler: [authenticate, cacheMiddleware({ ttl: 120, keyPrefix: 'workflows' })],
      schema: {
        querystring: toJsonSchema(workflowFiltersSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const filters = workflowFiltersSchema.parse(request.query);
        const result = await workflowService.listWorkflows(
          request.workspaceId,
          filters
        );
        return reply.send(result);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply
            .code(400)
            .send({ error: "Validation failed", details: err.errors });
        }
        fastify.log.error(err);
        return reply.code(500).send({ error: "Failed to list workflows" });
      }
    }
  );

  // ── GET /api/v1/workflows/:id ───────────────────────────────
  fastify.get(
    "/api/v1/workflows/:id",
    {
      preHandler: [authenticate, cacheMiddleware({ ttl: 120, keyPrefix: 'workflow' })],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const workflow = await workflowService.getWorkflow(id);
        return reply.send(workflow);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: "Failed to fetch workflow" });
      }
    }
  );

  // ── PATCH /api/v1/workflows/:id ─────────────────────────────
  fastify.patch(
    "/api/v1/workflows/:id",
    {
      preHandler: [authenticate],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        body: toJsonSchema(updateWorkflowSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const data = updateWorkflowSchema.parse(request.body);
        const workflow = await workflowService.updateWorkflow(id, data);
        await clearCache(`workflow:${id}`);
        await clearCache('workflows:*');
        return reply.send(workflow);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply
            .code(400)
            .send({ error: "Validation failed", details: err.errors });
        }
        fastify.log.error(err);
        return reply.code(500).send({ error: "Failed to update workflow" });
      }
    }
  );

  // ── DELETE /api/v1/workflows/:id ────────────────────────────
  fastify.delete(
    "/api/v1/workflows/:id",
    {
      preHandler: [authenticate],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        response: { 200: toJsonSchema(z.object({ success: z.boolean() })) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        await workflowService.deleteWorkflow(id);
        await clearCache(`workflow:${id}`);
        await clearCache('workflows:*');
        return reply.send({ success: true });
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: "Failed to delete workflow" });
      }
    }
  );

  /* ═══════════════════════════════════════════════════════════════
     WORKFLOW INSTANCES
     ═══════════════════════════════════════════════════════════════ */

  // ── POST /api/v1/workflows/instances ────────────────────────
  fastify.post(
    "/api/v1/workflows/instances",
    {
      preHandler: [authenticate],
      schema: {
        body: toJsonSchema(createWorkflowInstanceSchema),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createWorkflowInstanceSchema.parse(request.body);
        const instance = await workflowService.startWorkflow(
          request.workspaceId,
          data
        );
        await clearCache('workflow-instances:*');
        return reply.code(201).send(instance);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply
            .code(400)
            .send({ error: "Validation failed", details: err.errors });
        }
        fastify.log.error(err);
        return reply.code(500).send({ error: "Failed to start workflow" });
      }
    }
  );

  // ── GET /api/v1/workflows/instances ─────────────────────────
  fastify.get(
    "/api/v1/workflows/instances",
    {
      preHandler: [authenticate, cacheMiddleware({ ttl: 60, keyPrefix: 'workflow-instances' })],
      schema: {
        querystring: toJsonSchema(instanceFiltersSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const filters = instanceFiltersSchema.parse(request.query);
        const result = await workflowService.listInstances(
          request.workspaceId,
          filters
        );
        return reply.send(result);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply
            .code(400)
            .send({ error: "Validation failed", details: err.errors });
        }
        fastify.log.error(err);
        return reply.code(500).send({ error: "Failed to list instances" });
      }
    }
  );

  // ── GET /api/v1/workflows/instances/:id ─────────────────────
  fastify.get(
    "/api/v1/workflows/instances/:id",
    {
      preHandler: [authenticate, cacheMiddleware({ ttl: 60, keyPrefix: 'workflow-instance' })],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const result = await workflowService.getInstance(id);
        return reply.send(result);
      } catch (err) {
        fastify.log.error(err);
        return reply
          .code(500)
          .send({ error: "Failed to fetch workflow instance" });
      }
    }
  );

  /* ═══════════════════════════════════════════════════════════════
     WORKFLOW ACTIONS (Approve / Reject)
     ═══════════════════════════════════════════════════════════════ */

  // ── POST /api/v1/workflows/instances/:id/action ─────────────
  fastify.post(
    "/api/v1/workflows/instances/:id/action",
    {
      preHandler: [authenticate],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        body: toJsonSchema(
          createWorkflowActionSchema.omit({ instance_id: true })
        ),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = createWorkflowActionSchema
          .omit({ instance_id: true })
          .parse(request.body);

        const result = await workflowService.performAction(
          request.userId,
          request.userRole,
          { ...body, instance_id: id }
        );

        await clearCache(`workflow-instance:${id}`);
        await clearCache('workflow-instances:*');
        return reply.send(result);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply
            .code(400)
            .send({ error: "Validation failed", details: err.errors });
        }
        fastify.log.error(err);
        return reply
          .code(500)
          .send({ error: "Failed to perform workflow action" });
      }
    }
  );
}