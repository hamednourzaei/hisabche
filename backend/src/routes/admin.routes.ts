// ============================================
// backend/src/routes/admin.routes.ts
// Admin API Foundation.
// Authorization enforced server-side via PlatformAdminGuard.
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { AdminService } from '../services/admin.service'
import { authenticate } from '../middleware/auth.middleware'
import { platformAdminGuard } from '../middleware/platform-admin.middleware'

export default async function adminRoutes(fastify: FastifyInstance) {
  const adminService = new AdminService()

  // ─── GET /api/admin/metrics ──────────────────────────────────
  fastify.get(
    '/api/admin/metrics',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await adminService.getMetrics())
      } catch (e) {
        fastify.log.error(e)
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  // ─── GET /api/admin/users ──────────────────────────────────
  fastify.get(
    '/api/admin/users',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { limit = 50, offset = 0 } = request.query as any
        return reply.send(await adminService.getUsers(Number(limit), Number(offset)))
      } catch (e) {
        fastify.log.error(e)
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )
}
