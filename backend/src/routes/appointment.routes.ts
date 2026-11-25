// ============================================
// backend/src/routes/appointment.routes.ts
//
// Fastify Routes for Appointments (Buyers -> Outreach)
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { CrmAppointmentInputSchema, allocateCapacityOrWaitlist } from '@hisabche/validation'
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

  // G68 / G69: Capacity & waitlist allocation on the shared appointment core
  fastify.post(
    '/api/appointments/waitlist/allocate',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = z
        .object({
          capacity: z.number().int().min(0),
          confirmedIds: z.array(z.string().min(1)),
          waitlistIds: z.array(z.string().min(1)).default([]),
          applicantId: z.string().min(1),
        })
        .strict()
        .safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid capacity allocation payload',
          code: 'VALIDATION_ERROR',
          details: parsed.error.issues,
        })
      }
      const result = allocateCapacityOrWaitlist(
        parsed.data.capacity,
        parsed.data.confirmedIds,
        parsed.data.waitlistIds,
        parsed.data.applicantId,
      )
      return reply.send({ data: result })
    },
  )

  // X14: Booking no-show fee & refundable deposit evaluation
  fastify.post(
    '/api/appointments/no-show-fee',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = z
        .object({
          depositMinor: z.number().int().min(0),
          noShowFeeMinor: z.number().int().min(0),
          hoursBeforeAppointment: z.number().min(0),
          freeCancelWindowHours: z.number().min(0).default(24),
        })
        .strict()
        .safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid no-show fee payload',
          code: 'VALIDATION_ERROR',
          details: parsed.error.issues,
        })
      }
      const withinFreeWindow =
        parsed.data.hoursBeforeAppointment >= parsed.data.freeCancelWindowHours
      const forfeitedMinor = withinFreeWindow
        ? 0
        : Math.min(parsed.data.depositMinor, parsed.data.noShowFeeMinor)
      const refundableMinor = parsed.data.depositMinor - forfeitedMinor
      return reply.send({
        data: {
          withinFreeWindow,
          forfeitedMinor,
          refundableMinor,
        },
      })
    },
  )
}
