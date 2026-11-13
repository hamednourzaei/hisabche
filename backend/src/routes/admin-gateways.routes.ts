// ============================================
// backend/src/routes/admin-gateways.routes.ts
//
// V63 · P-1/P-2/P-3 — the platform's payment gateways.
//
//   GET    /api/admin/gateways                    read  (never a secret)
//   POST   /api/admin/gateways/:id/enable         write (step-up, LIVE = approval)
//   POST   /api/admin/gateways/:id/disable        write (step-up, immediate)
//   PUT    /api/admin/gateways/:id/metadata       write (step-up)
//
// ⚠️ Enabling LIVE does not flip the switch. `PlatformGatewaysService.enable`
// files a `GATEWAY_ENABLE` maker-checker request and the approver's decision
// runs `applyApprovedGatewayEnable`. Disabling is immediate on purpose: the
// safe direction of a money switch must not wait for a second person.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { adminRoute } from '../middleware/admin-rbac.middleware'
import {
  GATEWAY_ENVIRONMENTS,
  GATEWAY_PROVIDERS,
  PlatformGatewaysService,
} from '../services/admin/platform-gateways.service'

const idParam = z.object({ id: z.string().uuid() })

const metadataBody = z.object({
  displayName: z.string().max(120),
  // Public configuration only; the service refuses secret-looking keys.
  publicConfig: z.record(z.unknown()),
})

function statusOf(err: unknown): number {
  if (err instanceof BaseError) return err.statusCode
  return 500
}

function payloadOf(err: unknown): { error: string; code: string } {
  if (err instanceof BaseError) return { error: err.message, code: 'ERROR' }
  return { error: 'Failed to handle the gateway request', code: 'ERROR' }
}

export default async function adminGatewaysRoutes(fastify: FastifyInstance): Promise<void> {
  const read = adminRoute('billing.gateways.read')
  const write = adminRoute('billing.gateways.write', { stepUp: true })

  fastify.get('/api/admin/gateways', { preHandler: read }, async (_request, reply) => {
    try {
      return reply.send({
        gateways: await PlatformGatewaysService.list(),
        providers: GATEWAY_PROVIDERS,
        environments: GATEWAY_ENVIRONMENTS,
      })
    } catch (err) {
      return reply.code(statusOf(err)).send(payloadOf(err))
    }
  })

  fastify.post(
    '/api/admin/gateways/:id/enable',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = idParam.parse(request.params)
        const result = await PlatformGatewaysService.enable({
          id,
          actorId: request.userId,
          actorEmail: request.user?.email ?? 'admin',
        })
        return reply.code(result.state === 'PENDING_APPROVAL' ? 202 : 200).send(result)
      } catch (err) {
        return reply.code(statusOf(err)).send(payloadOf(err))
      }
    },
  )

  fastify.post(
    '/api/admin/gateways/:id/test',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = idParam.parse(request.params)
        const result = await PlatformGatewaysService.testGateway({
          id,
          actorEmail: request.user?.email ?? 'admin',
        })
        return reply.send(result)
      } catch (err) {
        return reply.code(statusOf(err)).send(payloadOf(err))
      }
    },
  )

  fastify.post(
    '/api/admin/gateways/:id/disable',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = idParam.parse(request.params)
        const result = await PlatformGatewaysService.disable({
          id,
          actorEmail: request.user?.email ?? 'admin',
        })
        return reply.send(result)
      } catch (err) {
        return reply.code(statusOf(err)).send(payloadOf(err))
      }
    },
  )

  fastify.put(
    '/api/admin/gateways/:id/metadata',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = idParam.parse(request.params)
        const body = metadataBody.parse(request.body)
        const gateway = await PlatformGatewaysService.updateMetadata({
          id,
          displayName: body.displayName,
          publicConfig: body.publicConfig,
          actorEmail: request.user?.email ?? 'admin',
        })
        return reply.send({ gateway })
      } catch (err) {
        return reply.code(statusOf(err)).send(payloadOf(err))
      }
    },
  )
}
