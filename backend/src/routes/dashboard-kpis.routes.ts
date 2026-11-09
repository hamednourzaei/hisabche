// ============================================
// backend/src/routes/dashboard-kpis.routes.ts
//
//   GET /api/me/dashboard-kpis   { configured, kpis: DashboardKpiId[] }
//   PUT /api/me/dashboard-kpis   { kpis: DashboardKpiId[] }  (≤ 4, no repeats)
//
// The PERSON's own choice inside the workspace they are in: the row is keyed
// by request.userId AND request.tenancy.workspaceId — never an id from the
// body (BUG-101 rule). Every id is checked against the shared list.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { dashboardKpiChoiceSchema } from '@hisabche/validation'

import { sendFailure } from '../errors/http-failure'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { readDashboardKpis, saveDashboardKpis } from '../services/dashboard-kpis.service'

export async function dashboardKpisRoutes(fastify: FastifyInstance) {
  const guard = [authenticate, requireWorkspaceContext]

  fastify.get(
    '/api/me/dashboard-kpis',
    { preHandler: guard },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await readDashboardKpis(request.userId, request.tenancy.workspaceId))
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to read the dashboard KPIs')
      }
    },
  )

  fastify.put(
    '/api/me/dashboard-kpis',
    {
      preHandler: guard,
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
          keyGenerator: (request: FastifyRequest) => `dashkpi:${request.userId ?? request.ip}`,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = dashboardKpiChoiceSchema.parse(request.body)
        return reply.send(
          await saveDashboardKpis(request.userId, request.tenancy.workspaceId, body.kpis),
        )
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to save the dashboard KPIs')
      }
    },
  )
}
