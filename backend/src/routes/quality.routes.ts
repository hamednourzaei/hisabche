// ============================================
// backend/src/routes/quality.routes.ts
//
// V60 Slice 11 — Quality Event Log & Warranty Claims Routes
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { qualityEventCreateSchema, warrantyClaimCreateSchema } from '@hisabche/validation'
import { sendFailure } from '../errors/http-failure'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { qualityService } from '../services/quality/quality.service'
import { readClientRequestId } from '../utils/client-request'

const toJsonSchema = (schema: z.ZodTypeAny) => {
  const result = zodToJsonSchema(schema as unknown as Parameters<typeof zodToJsonSchema>[0], {
    target: 'jsonSchema7',
  })
  delete (result as Record<string, unknown>).$schema
  return result
}

export async function qualityRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/quality-events',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        querystring: toJsonSchema(
          z.object({
            sourceType: z.string().optional(),
            sourceId: z.string().uuid().optional(),
          }),
        ),
        response: { 200: toJsonSchema(z.array(z.any())) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const q = (request.query ?? {}) as { sourceType?: string; sourceId?: string }
        const rows = await qualityService.listQualityEvents(request.tenancy, q)
        return reply.send(rows)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to fetch quality events')
      }
    },
  )

  fastify.post(
    '/api/quality-events',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('inventory.configure')],
      schema: {
        body: toJsonSchema(qualityEventCreateSchema),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = qualityEventCreateSchema.parse(request.body)
        const result = await qualityService.recordQualityEvent(request.tenancy, body, {
          idempotencyKey: readClientRequestId(request),
        })
        return reply.code(201).send(result)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to record quality event')
      }
    },
  )

  fastify.get(
    '/api/warranty-claims',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('invoice.read')],
      schema: {
        response: { 200: toJsonSchema(z.array(z.any())) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const rows = await qualityService.listWarrantyClaims(request.tenancy)
        return reply.send(rows)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to fetch warranty claims')
      }
    },
  )

  fastify.post(
    '/api/warranty-claims',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('invoice.create')],
      schema: {
        body: toJsonSchema(warrantyClaimCreateSchema),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = warrantyClaimCreateSchema.parse(request.body)
        const claim = await qualityService.submitWarrantyClaim(request.tenancy, body)
        return reply.code(201).send(claim)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to submit warranty claim')
      }
    },
  )
}
