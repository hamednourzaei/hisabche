// ============================================
// backend/src/routes/developer.routes.ts
//
// The developer screen's API: API keys and outbound webhooks for the current
// workspace. Owners and admins only (`workspace.manage`) — a key or an
// endpoint is a door into the books, and opening one is a management act.
//
// ⚠️ None of these routes is in API_ROUTE_SCOPES: an API key cannot mint,
// list or revoke keys, or point webhooks anywhere. Only a signed-in person can.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  apiKeyCreateSchema,
  webhookEndpointCreateSchema,
  webhookEndpointUpdateSchema,
  WEBHOOK_EVENT_RESOURCE,
  API_KEY_SCOPES,
  publishableKeyCreateSchema,
} from '@hisabche/validation'

import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import {
  DeveloperError,
  developerService,
  type DeveloperService,
} from '../services/developer/developer.service'
import { NotConfiguredError } from '../services/developer/developer.repository'

const idParams = z.object({ id: z.string().uuid() })
const usageQuery = z.object({ days: z.coerce.number().int().min(1).max(90).default(7) })
const replayBody = z.object({ since: z.coerce.date() }).strict()

export function buildDeveloperRoutes(service: DeveloperService) {
  return async function developerRoutes(fastify: FastifyInstance) {
    const guard = [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')]

    const fail = (reply: FastifyReply, err: unknown) => {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      if (err instanceof DeveloperError) {
        return reply
          .code(err.statusCode)
          .send({ error: err.code, code: err.code, ...(err.detail ?? {}) })
      }
      if (err instanceof NotConfiguredError) {
        // The migration has not run. Said plainly, so the screen can say it too.
        return reply.code(503).send({ error: err.message, code: err.message })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Internal Server Error' })
    }

    const handle =
      (fn: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>) =>
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          return await fn(request, reply)
        } catch (err) {
          return fail(reply, err)
        }
      }

    // ─── catalogue ───────────────────────────────────────────────────────────

    fastify.get(
      '/api/developer/catalog',
      { preHandler: guard },
      handle(async (_request, reply) =>
        reply.send({
          scopes: API_KEY_SCOPES,
          events: service
            .eventCatalogue()
            .map((type) => ({ type, ...WEBHOOK_EVENT_RESOURCE[type] })),
        }),
      ),
    )

    // ─── keys ────────────────────────────────────────────────────────────────

    fastify.get(
      '/api/developer/keys',
      { preHandler: guard },
      handle(async (request, reply) =>
        reply.send({ data: await service.listKeys(request.tenancy) }),
      ),
    )

    fastify.post(
      '/api/developer/keys',
      { preHandler: guard },
      handle(async (request, reply) => {
        const input = apiKeyCreateSchema.parse(request.body)
        const created = await service.createKey(request.tenancy, input)
        return reply.code(201).send(created)
      }),
    )

    fastify.delete(
      '/api/developer/keys/:id',
      { preHandler: guard },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        await service.revokeKey(request.tenancy, id)
        return reply.code(204).send()
      }),
    )

    fastify.get(
      '/api/developer/keys/:id/usage',
      { preHandler: guard },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        const { days } = usageQuery.parse(request.query)
        return reply.send(await service.keyUsage(request.tenancy, id, days))
      }),
    )

    // ─── publishable keys (storefront) ────────────────────────────────────────

    fastify.get(
      '/api/developer/storefront-keys',
      { preHandler: guard },
      handle(async (request, reply) =>
        reply.send({ data: await service.listPublishableKeys(request.tenancy) }),
      ),
    )

    fastify.post(
      '/api/developer/storefront-keys',
      { preHandler: guard },
      handle(async (request, reply) => {
        const input = publishableKeyCreateSchema.parse(request.body)
        return reply.code(201).send(await service.createPublishableKey(request.tenancy, input))
      }),
    )

    // ─── webhooks ────────────────────────────────────────────────────────────

    fastify.get(
      '/api/developer/webhooks',
      { preHandler: guard },
      handle(async (request, reply) =>
        reply.send({ data: await service.listEndpoints(request.tenancy) }),
      ),
    )

    fastify.post(
      '/api/developer/webhooks',
      { preHandler: guard },
      handle(async (request, reply) => {
        const input = webhookEndpointCreateSchema.parse(request.body)
        return reply.code(201).send(await service.createEndpoint(request.tenancy, input))
      }),
    )

    fastify.patch(
      '/api/developer/webhooks/:id',
      { preHandler: guard },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        const input = webhookEndpointUpdateSchema.parse(request.body)
        return reply.send(await service.updateEndpoint(request.tenancy, id, input))
      }),
    )

    fastify.delete(
      '/api/developer/webhooks/:id',
      { preHandler: guard },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        await service.deleteEndpoint(request.tenancy, id)
        return reply.code(204).send()
      }),
    )

    fastify.post(
      '/api/developer/webhooks/:id/rotate-secret',
      { preHandler: guard },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        return reply.send(await service.rotateSecret(request.tenancy, id))
      }),
    )

    fastify.post(
      '/api/developer/webhooks/:id/test',
      { preHandler: guard },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        return reply.send(await service.sendTest(request.tenancy, id))
      }),
    )

    fastify.post(
      '/api/developer/webhooks/:id/replay',
      { preHandler: guard },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        const { since } = replayBody.parse(request.body)
        return reply.send(await service.replayEndpoint(request.tenancy, id, since))
      }),
    )

    fastify.get(
      '/api/developer/webhooks/:id/deliveries',
      { preHandler: guard },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        return reply.send({ data: await service.listDeliveries(request.tenancy, id) })
      }),
    )

    fastify.post(
      '/api/developer/deliveries/:id/retry',
      { preHandler: guard },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        return reply.send(await service.retryDelivery(request.tenancy, id))
      }),
    )
  }
}

export const developerRoutes = buildDeveloperRoutes(developerService)
