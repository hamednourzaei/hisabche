// ============================================
// backend/src/routes/translate.routes.ts
//
// Capability #20 — translating the text of a financial document.
//
//   POST /api/ai/translate   { text, from, to }   any member of the workspace
//
//   200  { translation: { text, source, from, to, figuresSpotted }, quota }
//   400  AI_NOT_CONFIGURED            no provider has been set up
//   422  TRANSLATE_<reason>           the engine refused (see translate.domain)
//   429  AI_QUOTA_EXCEEDED            with the top-up contact
//   503  AI_PROVIDER_BUSY | AI_PROVIDER_ERROR
//
// The same gate as POST /api/ai/ask, and the same allowance.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { AiQuotaService } from '../services/ai/ai-quota.service'
import { AiSettingsService } from '../services/ai/ai-settings.service'
import { SUPPORTED_LOCALES, TRANSLATE_LIMITS } from '../services/ingest/translate.domain'
import { documentTranslateService } from '../services/ingest/translate.service'

const locale = z.enum(SUPPORTED_LOCALES as [string, ...string[]])
const bodySchema = z.object({
  // The engine has its own limit and its own refusal; this only stops a body
  // far beyond it from being read at all.
  text: z
    .string()
    .min(1)
    .max(TRANSLATE_LIMITS.maxCharacters * 2),
  from: locale,
  to: locale,
})

export async function translateRoutes(fastify: FastifyInstance) {
  const settings = new AiSettingsService()
  const quota = new AiQuotaService()

  fastify.post(
    '/api/ai/translate',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = bodySchema.parse(request.body)
        const result = await documentTranslateService.translate(request.tenancy, {
          text: body.text,
          from: body.from as 'fa' | 'af' | 'en',
          to: body.to as 'fa' | 'af' | 'en',
        })

        if (result.verdict.kind === 'refused') {
          const code = `TRANSLATE_${result.verdict.reason}`
          return reply.code(422).send({ error: code, code, message: code, quota: result.quota })
        }
        const { kind: _kind, ...translation } = result.verdict
        return reply.send({ translation, quota: result.quota })
      } catch (err) {
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
        if (err instanceof BaseError && err.statusCode < 500) {
          const code = /^[A-Z][A-Z_]{4,}/.exec(err.message)?.[0] ?? err.name
          return reply.code(err.statusCode).send({ error: code, code, message: code })
        }
        fastify.log.error(err)
        return reply
          .code(500)
          .send({ error: 'Internal Server Error', message: 'Failed to translate the document' })
      }
    },
  )
}
