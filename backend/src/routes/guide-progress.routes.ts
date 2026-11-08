// ============================================
// backend/src/routes/guide-progress.routes.ts
//
//   GET  /api/me/guide-progress   { configured, steps: [{ stepId, routeId, seenAt }] }
//   POST /api/me/guide-progress   { steps: [{ stepId, routeId }] }  (append-only)
//
// ⚠️ `authenticate` only, and that is right here: both routes read and write
// the caller's OWN rows (BUG-101 rule) — no id from the body, no workspace.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { sendFailure } from '../errors/http-failure'
import { authenticate } from '../middleware/auth.middleware'
import { markGuideStepsSeen, readGuideProgress } from '../services/guide-progress.service'

const markBody = z
  .object({
    steps: z
      .array(
        z
          .object({
            stepId: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,119}$/),
            routeId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,59}$/),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()

export async function guideProgressRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/me/guide-progress',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await readGuideProgress(request.userId))
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to read guide progress')
      }
    },
  )

  fastify.post(
    '/api/me/guide-progress',
    {
      preHandler: [authenticate],
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
          keyGenerator: (request: FastifyRequest) => `guide:${request.userId ?? request.ip}`,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = markBody.parse(request.body)
        return reply.send(await markGuideStepsSeen(request.userId, body.steps))
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to save guide progress')
      }
    },
  )
}
