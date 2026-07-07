// ============================================
// Arcjet Middleware — Anti-bot & Rate Limiting
// ============================================

import arcjet, { shield, detectBot, tokenBucket } from '@arcjet/node'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

// ============================================
// Arcjet Client
// =======================================

const aj = arcjet({
  key: process.env.ARCJET_KEY || 'aj_test_key',
  rules: [
    shield({
      mode: 'LIVE',
    }),
    detectBot({
      mode: 'LIVE',
      allow: [
        'CATEGORY:SEARCH_ENGINE',
        'CATEGORY:MONITOR',
      ],
    }),
    tokenBucket({
      mode: 'LIVE',
      refillRate: 10,
      interval: 1,
      capacity: 100,
    }),
  ],
})

// ============================================
// Arcjet Plugin for Fastify
// ============================================

export async function arcjetPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip health checks
    if (request.url === '/api/health') {
      return
    }

    try {
      const decision = await aj.protect(request, {
        requested: 1,
      })

      // Check if request is denied
      if (decision.isDenied()) {
        if (decision.reason.isRateLimit()) {
          reply.status(429).send({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            statusCode: 429,
          })
          return
        }

        if (decision.reason.isBot()) {
          reply.status(403).send({
            error: 'Forbidden',
            message: 'Bot activity detected.',
            statusCode: 403,
          })
          return
        }

        reply.status(403).send({
          error: 'Forbidden',
          message: 'Access denied.',
          statusCode: 403,
        })
        return
      }
    } catch (err) {
      fastify.log.error(err instanceof Error ? err.message : 'Arcjet error')
      // Don't block the request if Arcjet fails
      return
    }
  })
}

export default aj