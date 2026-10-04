// ============================================
// backend/src/routes/campaigns.routes.ts
//
// Customer campaigns (#112) and NPS (#106).
//
// The business's side — manager and up, read from `request.tenancy.role`
// (writing to customers in the business's name is not a seller's decision):
//
//   GET  /api/campaigns
//   POST /api/campaigns
//   GET  /api/campaigns/:id            delivery state and the NPS score
//   GET  /api/campaigns/:id/preview    who would be written to; writes nothing
//   POST /api/campaigns/:id/launch
//   POST /api/campaigns/:id/cancel
//
// The customer's side — PUBLIC by design (they have no account); the
// unguessable token in the link is the credential, and it opens one
// recipient's own page only:
//
//   GET  /api/public/feedback/:token
//   POST /api/public/feedback/:token/answer        { score, comment? }
//   POST /api/public/feedback/:token/unsubscribe
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { campaignService } from '../services/campaigns/campaign.service'
import { requireRole } from '../services/tenancy.service'

const MEMBER = [authenticate, requireWorkspaceContext]
const idParams = z.object({ id: z.string().uuid() })
const tokenParams = z.object({ token: z.string().uuid() })

const campaignBody = z
  .object({
    name: z.string().trim().min(1).max(80),
    kind: z.enum(['message', 'nps']),
    subject: z.string().trim().min(1).max(150),
    body: z.string().trim().min(1).max(4000),
    language: z.enum(['fa', 'af', 'en']),
    segment: z.enum(['all', 'overdue', 'recent_buyers', 'inactive']),
    segmentDays: z.number().int().min(1).max(730).nullable().default(null),
  })
  .superRefine((value, ctx) => {
    const needsDays = value.segment === 'recent_buyers' || value.segment === 'inactive'
    if (needsDays !== (value.segmentDays !== null)) {
      ctx.addIssue({ code: 'custom', path: ['segmentDays'], message: 'CAMPAIGN_SEGMENT_DAYS' })
    }
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

export async function campaignRoutes(fastify: FastifyInstance) {
  fastify.get('/api/campaigns', { preHandler: MEMBER }, async (request: FastifyRequest, reply) => {
    try {
      requireRole(request.tenancy, 'manager')
      return reply.send({
        campaigns: await campaignService.list(request.tenancy),
        channel: campaignService.channelStatus(),
      })
    } catch (err) {
      return fail(fastify, reply, err, 'Failed to read campaigns')
    }
  })

  fastify.post('/api/campaigns', { preHandler: MEMBER }, async (request: FastifyRequest, reply) => {
    try {
      requireRole(request.tenancy, 'manager')
      return reply
        .code(201)
        .send(await campaignService.create(request.tenancy, campaignBody.parse(request.body)))
    } catch (err) {
      return fail(fastify, reply, err, 'Failed to save the campaign')
    }
  })

  fastify.get(
    '/api/campaigns/:id',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { id } = idParams.parse(request.params)
        return reply.send(await campaignService.detail(request.tenancy, id))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read the campaign')
      }
    },
  )

  fastify.get(
    '/api/campaigns/:id/preview',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { id } = idParams.parse(request.params)
        return reply.send(await campaignService.preview(request.tenancy, id))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to preview the audience')
      }
    },
  )

  fastify.post(
    '/api/campaigns/:id/launch',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { id } = idParams.parse(request.params)
        return reply.send(await campaignService.launch(request.tenancy, id))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to launch the campaign')
      }
    },
  )

  fastify.post(
    '/api/campaigns/:id/cancel',
    { preHandler: MEMBER },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { id } = idParams.parse(request.params)
        return reply.send(await campaignService.cancel(request.tenancy, id))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to cancel the campaign')
      }
    },
  )

  // ─── Public: the recipient's own page ──────────────────────────────────────

  fastify.get('/api/public/feedback/:token', async (request: FastifyRequest, reply) => {
    try {
      const { token } = tokenParams.parse(request.params)
      return reply.send(await campaignService.feedbackView(token))
    } catch (err) {
      return fail(fastify, reply, err, 'Failed to open the link')
    }
  })

  fastify.post('/api/public/feedback/:token/answer', async (request: FastifyRequest, reply) => {
    try {
      const { token } = tokenParams.parse(request.params)
      const input = z
        .object({
          score: z.number().int().min(0).max(10),
          comment: z.string().max(1000).nullable().default(null),
        })
        .parse(request.body)
      return reply.send(await campaignService.answer(token, input))
    } catch (err) {
      return fail(fastify, reply, err, 'Failed to record the answer')
    }
  })

  fastify.post(
    '/api/public/feedback/:token/unsubscribe',
    async (request: FastifyRequest, reply) => {
      try {
        const { token } = tokenParams.parse(request.params)
        return reply.send(await campaignService.unsubscribe(token))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to record the opt-out')
      }
    },
  )
}
