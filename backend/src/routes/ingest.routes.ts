// ============================================
// backend/src/routes/ingest.routes.ts
//
// Capabilities #16 #30 #48 #49 — reading a photographed receipt or bill.
//
//   POST /api/ingest/read      invoice.create   { contentType, data }   data = base64 picture
//   POST /api/ingest/confirm   invoice.create   the draft as the person corrected it
//
//   read     200 { draft, warnings, confirmable, currency, quota }
//            422 INGEST_<reason>      refused or unreadable — never an empty draft
//            429 AI_QUOTA_EXCEEDED
//   confirm  201 { invoiceId }        one purchase invoice, through the invoice core
//
// `read` writes nothing. Only `confirm` reaches the books, and only with the
// figures a person sent after looking at them.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { AiQuotaService } from '../services/ai/ai-quota.service'
import { AiSettingsService } from '../services/ai/ai-settings.service'
import { documentIngestService } from '../services/ingest/ingest.service'
import { invalidateMoneyCaches } from '../utils/money-cache'

const WRITE = [authenticate, requireWorkspaceContext, requireCapability('invoice.create')]

const readBody = z.object({
  contentType: z.string().trim().min(3).max(60),
  // The service has the real size limit and its own refusal.
  data: z.string().min(1),
})

export async function ingestRoutes(fastify: FastifyInstance) {
  const settings = new AiSettingsService()
  const quota = new AiQuotaService()

  async function fail(
    request: FastifyRequest,
    reply: FastifyReply,
    err: unknown,
    fallback: string,
  ) {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: err.errors[0]?.message ?? 'Validation failed',
        details: err.errors.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      })
    }
    if (err instanceof BaseError && err.message.startsWith('AI_QUOTA_EXCEEDED')) {
      const status = await settings.getStatus()
      return reply.code(429).send({
        error: 'AI_QUOTA_EXCEEDED',
        code: 'AI_QUOTA_EXCEEDED',
        message: 'AI_QUOTA_EXCEEDED',
        topupContact: status?.topupContact ?? '',
        quota: await quota.status(request.tenancy),
      })
    }
    if (err instanceof BaseError && err.message.startsWith('AI_PROVIDER_')) {
      // The provider's own body is logged where the call is made, never sent.
      const code = /^AI_PROVIDER_[A-Z]+/.exec(err.message)?.[0] ?? 'AI_PROVIDER_ERROR'
      return reply.code(503).send({ error: code, code, message: code })
    }
    if (err instanceof BaseError && (err.statusCode < 500 || err.statusCode === 503)) {
      return reply.code(err.statusCode).send({ error: err.name, message: err.message })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: 'Internal Server Error', message: fallback })
  }

  fastify.post(
    '/api/ingest/read',
    { preHandler: WRITE },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = readBody.parse(request.body)
        const result = await documentIngestService.read(request.tenancy, {
          contentType: body.contentType,
          base64: body.data,
        })

        if (result.verdict.kind !== 'draft') {
          const code =
            result.verdict.kind === 'refused'
              ? `INGEST_${result.verdict.reason}`
              : 'INGEST_UNREADABLE'
          return reply.code(422).send({ error: code, code, message: code, quota: result.quota })
        }
        return reply.send({
          draft: result.verdict.document,
          warnings: result.verdict.warnings,
          confirmable: result.confirmable,
          currency: result.currency,
          quota: result.quota,
        })
      } catch (err) {
        return fail(request, reply, err, 'Failed to read the document')
      }
    },
  )

  fastify.post(
    '/api/ingest/confirm',
    { preHandler: WRITE },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const created = await documentIngestService.confirm(request.tenancy, request.body)
        await invalidateMoneyCaches(request.tenancy.workspaceId)
        return reply.code(201).send(created)
      } catch (err) {
        return fail(request, reply, err, 'Failed to record the document')
      }
    },
  )
}
