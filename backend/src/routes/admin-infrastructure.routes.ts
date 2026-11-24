// ============================================
// backend/src/routes/admin-infrastructure.routes.ts
//
// Admin Infrastructure & Nginx Control Plane Routes.
//
//   GET /api/admin/infrastructure/settings
//   PUT /api/admin/infrastructure/settings (step-up)
//
// Manages Nginx reverse proxy routing, edge rate limiting,
// cache bypass header toggle, and emergency maintenance mode.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  type UpdateInfrastructureSettingsInput,
  updateInfrastructureSettingsSchema,
} from '@hisabche/validation'

import { adminRoute } from '../middleware/admin-rbac.middleware'
import { adminInfrastructureService } from '../services/admin/admin-infrastructure.service'

export default async function adminInfrastructureRoutes(fastify: FastifyInstance) {
  const read = adminRoute('operations.infrastructure.read')
  const write = adminRoute('operations.infrastructure.write', { stepUp: true })

  fastify.get(
    '/api/admin/infrastructure/settings',
    { preHandler: read },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const settings = adminInfrastructureService.getSettings()
      return reply.status(200).send(settings)
    },
  )

  fastify.put(
    '/api/admin/infrastructure/settings',
    { preHandler: write },
    async (
      request: FastifyRequest<{ Body: UpdateInfrastructureSettingsInput }>,
      reply: FastifyReply,
    ) => {
      const parseResult = updateInfrastructureSettingsSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'INVALID_INPUT',
          message: 'Invalid infrastructure settings payload',
          details: parseResult.error.flatten(),
        })
      }

      const adminEmail = request.user?.email ?? 'admin@hisabche.com'
      const updated = await adminInfrastructureService.updateSettings(parseResult.data, adminEmail)
      return reply.status(200).send(updated)
    },
  )
}
