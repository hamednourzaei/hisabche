// ============================================
// backend/src/routes/custom-reports.routes.ts
//
// Capability #145 — the report builder.
//
//   GET   /api/custom-reports/catalog      what may be asked for
//   GET   /api/custom-reports              the saved reports
//   POST  /api/custom-reports              { name, groupBy, measures }
//   GET   /api/custom-reports/:id/run      run it against live data
//   PATCH /api/custom-reports/:id/retire
//
// All behind `report.operational.read`: a report shows what is owed and
// collected, which is what that capability already lets a person see.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { reportService } from '../services/reporting/report.service'

const REPORTS = [
  authenticate,
  requireWorkspaceContext,
  requireCapability('report.operational.read'),
]
const idParams = z.object({ id: z.string().uuid() })
const body = z.object({
  name: z.string().trim().min(1).max(80),
  groupBy: z.array(z.string().min(1).max(40)).max(3).default([]),
  measures: z.array(z.string().min(1).max(40)).min(1).max(5),
})

function fail(fastify: FastifyInstance, reply: FastifyReply, err: unknown, fallback: string) {
  if (err instanceof z.ZodError) {
    return reply.code(400).send({
      error: 'Bad Request',
      message: err.errors[0]?.message ?? 'Validation failed',
      details: err.errors.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    })
  }
  if (err instanceof BaseError && (err.statusCode < 500 || err.statusCode === 503)) {
    return reply.code(err.statusCode).send({ error: err.name, message: err.message })
  }
  fastify.log.error(err)
  return reply.code(500).send({ error: 'Internal Server Error', message: fallback })
}

export async function customReportRoutes(fastify: FastifyInstance) {
  fastify.get('/api/custom-reports/catalog', { preHandler: REPORTS }, async (_request, reply) => {
    return reply.send(reportService.catalog())
  })

  fastify.get(
    '/api/custom-reports',
    { preHandler: REPORTS },
    async (request: FastifyRequest, reply) => {
      try {
        return reply.send({ reports: await reportService.list(request.tenancy) })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read saved reports')
      }
    },
  )

  fastify.post(
    '/api/custom-reports',
    { preHandler: REPORTS },
    async (request: FastifyRequest, reply) => {
      try {
        return reply
          .code(201)
          .send(await reportService.save(request.tenancy, body.parse(request.body)))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to save the report')
      }
    },
  )

  fastify.get(
    '/api/custom-reports/:id/run',
    { preHandler: REPORTS },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        return reply.send(await reportService.run(request.tenancy, id))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to run the report')
      }
    },
  )

  fastify.patch(
    '/api/custom-reports/:id/retire',
    { preHandler: REPORTS },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        await reportService.retire(request.tenancy, id)
        return reply.send({ ok: true })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to retire the report')
      }
    },
  )
}
