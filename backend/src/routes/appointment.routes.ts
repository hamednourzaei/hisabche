// ============================================
// backend/src/routes/appointment.routes.ts
//
// Fastify Routes for Appointments (Buyers -> Outreach)
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { AppointmentService } from '../services/crm/appointment.service'

export async function appointmentRoutes(fastify: FastifyInstance) {
  const service = new AppointmentService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
  const write = [authenticate, requireWorkspaceContext, requireCapability('invoice.create')]

  fastify.get(
    '/api/appointments',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
      const appointments = await service.getAppointments(workspaceId)
      return reply.send({ data: appointments })
    },
  )

  fastify.post(
    '/api/appointments',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
      const body = request.body as {
        customerId: string
        staffEmployeeId: string
        serviceProductId: string
        startTime: string
        endTime: string
        notes?: string | undefined
      }
      const appointment = await service.createAppointment(workspaceId, body)
      return reply.status(201).send({ data: appointment })
    },
  )
}
