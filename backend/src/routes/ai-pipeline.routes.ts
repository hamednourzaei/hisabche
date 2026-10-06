// ============================================
// backend/src/routes/ai-pipeline.routes.ts
//
// The AI action pipeline (`ai_pipeline_v2`) — asking the assistant to DO
// something, behind a per-business switch that is off until an owner turns it on.
//
//   GET  /api/ai/pipeline/settings          any member (so the screen knows)
//   PUT  /api/ai/pipeline/settings          owner
//   POST /api/ai/pipeline/runs              start a run from a request in words
//   GET  /api/ai/pipeline/runs              one's own, plus what awaits a decision
//   GET  /api/ai/pipeline/runs/:id
//   POST /api/ai/pipeline/runs/:id/answers  the requester fills what was missing
//   POST /api/ai/pipeline/runs/:id/approve  runs the proposal AS THE APPROVER
//   POST /api/ai/pipeline/runs/:id/reject
//
// ⚠️ A SESSION, NEVER AN API KEY. These routes are not in `API_ROUTE_SCOPES`,
// so an integration credential cannot reach them: an outside assistant goes
// through /mcp, where a person approves inside Hisabche.
//
// ⚠️ THIS FILE WRITES NO BUSINESS DATA. The service acts through `runner`,
// which sends a request through the server's own router with the caller's own
// session and workspace — so the invoice, payment and customer routes do the
// authorizing, validating, booking and auditing they do for a person.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { AiBusyError } from '../services/ai/ai-chat.service'
import { AiQuotaService } from '../services/ai/ai-quota.service'
import { AiSettingsService } from '../services/ai/ai-settings.service'
import {
  PipelineService,
  isPipelineRefusal,
  type RouteRunner,
} from '../services/ai/pipeline/pipeline.service'
import { runRoute } from '../services/mcp/own-route'

const startSchema = z.object({
  // Capped: the request is sent to a provider that bills by the token.
  request: z.string().trim().min(1).max(2000),
  /** Stop at the proposal. A dry run can never be approved afterwards. */
  dryRun: z.boolean().default(false),
})

const answersSchema = z.object({
  answers: z.record(z.union([z.string().max(500), z.number().finite(), z.boolean()])),
})

const settingsSchema = z.object({
  enabled: z.boolean(),
  autoApproveNonFinancial: z.boolean(),
})

const idParams = z.object({ id: z.string().uuid() })

export async function aiPipelineRoutes(fastify: FastifyInstance) {
  const pipeline = new PipelineService()
  const aiSettings = new AiSettingsService()
  const quota = new AiQuotaService()

  const MEMBER = [authenticate, requireWorkspaceContext]

  /** Requests through the server's own router, as the person making THIS request. */
  const runnerFor =
    (request: FastifyRequest): RouteRunner =>
    (call) =>
      runRoute(fastify, call, request.headers.authorization ?? '', request.tenancy.workspaceId)

  const fail = async (
    request: FastifyRequest,
    reply: FastifyReply,
    err: unknown,
    fallback: string,
  ) => {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({
        error: 'Bad Request',
        code: 'VALIDATION_ERROR',
        message: err.errors[0]?.message ?? 'Validation failed',
      })
    }
    if (err instanceof AiBusyError) {
      return reply.code(503).send({ error: 'AI_PROVIDER_BUSY', code: 'AI_PROVIDER_BUSY' })
    }
    if (err instanceof BaseError && err.message.startsWith('AI_QUOTA_EXCEEDED')) {
      // Out of allowance is answered with what the person needs next.
      const status = await aiSettings.getStatus()
      return reply.code(429).send({
        error: 'AI_QUOTA_EXCEEDED',
        code: 'AI_QUOTA_EXCEEDED',
        topupContact: status?.topupContact ?? '',
        quota: await quota.status(request.tenancy),
      })
    }
    if (isPipelineRefusal(err)) {
      const code = /^[A-Z][A-Z_]{4,}/.exec(err.message)?.[0]
      return reply.code(err.statusCode).send({ error: err.name, code: code ?? err.name })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: 'Internal Server Error', message: fallback })
  }

  fastify.get(
    '/api/ai/pipeline/settings',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await pipeline.readSettings(request.tenancy))
      } catch (err) {
        return fail(request, reply, err, 'Failed to read the AI pipeline settings')
      }
    },
  )

  fastify.put(
    '/api/ai/pipeline/settings',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = settingsSchema.parse(request.body)
        return reply.send(await pipeline.saveSettings(request.tenancy, body))
      } catch (err) {
        return fail(request, reply, err, 'Failed to save the AI pipeline settings')
      }
    },
  )

  fastify.post(
    '/api/ai/pipeline/runs',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = startSchema.parse(request.body)
        return reply
          .code(201)
          .send({ run: await pipeline.start(request.tenancy, runnerFor(request), body) })
      } catch (err) {
        return fail(request, reply, err, 'Failed to start the AI run')
      }
    },
  )

  fastify.get(
    '/api/ai/pipeline/runs',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send({ runs: await pipeline.list(request.tenancy) })
      } catch (err) {
        return fail(request, reply, err, 'Failed to read the AI runs')
      }
    },
  )

  fastify.get(
    '/api/ai/pipeline/runs/:id',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = idParams.parse(request.params)
        return reply.send({ run: await pipeline.get(request.tenancy, id) })
      } catch (err) {
        return fail(request, reply, err, 'Failed to read the AI run')
      }
    },
  )

  fastify.post(
    '/api/ai/pipeline/runs/:id/answers',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = idParams.parse(request.params)
        const { answers } = answersSchema.parse(request.body)
        return reply.send({
          run: await pipeline.answer(request.tenancy, runnerFor(request), id, answers),
        })
      } catch (err) {
        return fail(request, reply, err, 'Failed to continue the AI run')
      }
    },
  )

  fastify.post(
    '/api/ai/pipeline/runs/:id/approve',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = idParams.parse(request.params)
        // The runner carries the APPROVER's session: the write is theirs.
        return reply.send({
          run: await pipeline.approve(request.tenancy, runnerFor(request), id),
        })
      } catch (err) {
        return fail(request, reply, err, 'Failed to approve the AI run')
      }
    },
  )

  fastify.post(
    '/api/ai/pipeline/runs/:id/reject',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = idParams.parse(request.params)
        return reply.send({ run: await pipeline.reject(request.tenancy, id) })
      } catch (err) {
        return fail(request, reply, err, 'Failed to reject the AI run')
      }
    },
  )
}
