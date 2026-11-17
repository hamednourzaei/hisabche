// ============================================
// backend/src/routes/appointment.routes.ts
//
// Fastify Routes for Appointments (Buyers -> Outreach)
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { CrmAppointmentInputSchema } from '@hisabche/validation'
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
      const parsed = CrmAppointmentInputSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid appointment payload',
          code: 'VALIDATION_ERROR',
          details: parsed.error.issues,
        })
      }
      const body = parsed.data
      try {
        const appointment = await service.createAppointment(workspaceId, body)
        return reply.status(201).send({ data: appointment })
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string }
        if (
          error.code === 'APPOINTMENT_CONFLICT' ||
          error.message?.includes('APPOINTMENT_CONFLICT')
        ) {
          return reply
            .status(409)
            .send({ error: error.message || 'APPOINTMENT_CONFLICT', code: 'APPOINTMENT_CONFLICT' })
        }
        throw err
      }
    },
  )
}
