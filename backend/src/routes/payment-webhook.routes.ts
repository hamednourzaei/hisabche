// ============================================
// backend/src/routes/payment-webhook.routes.ts
//
// V58 · P0-4 — the provider webhook's HTTP surface.
//
// POST /api/webhooks/stripe — the ONLY route that turns a provider event
// into a subscription change, and it refuses to touch anything until the
// signature over the RAW body verifies (webhook-signature.domain.ts).
//
// ⚠️ This plugin registers its OWN `application/json` content-type parser
// that keeps the raw string. Fastify parsers are scoped to the plugin, so
// the rest of the API keeps its normal JSON parser untouched. Re-serialized
// JSON would be a DIFFERENT byte stream than the one the provider signed —
// signature verification over it is theatre, not security.
//
// CONFIGURATION. Without STRIPE_WEBHOOK_SECRET in the environment the route
// answers 503 `webhook_not_configured` — an explicit configuration error,
// never a fake success. Live payment verification remains
// BLOCKED_EXTERNAL_CREDENTIAL until the owner sets the secret and a real
// event is observed.
//
// Replay, duplicate and out-of-order events are handled below this route by
// WebhookService.processWebhook (claim per event id + release on failure),
// which this file calls and nothing else.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import WebhookService from '../services/webhook.service'
import { verifyWebhookSignature } from '../services/payments/webhook-signature.domain'

/** Stripe event envelope — only what mapping needs. */
interface StripeEnvelope {
  id?: unknown
  type?: unknown
  data?: { object?: unknown }
}

export async function paymentWebhookRoutes(fastify: FastifyInstance) {
  // Raw-body parser, this plugin only (see header note).
  fastify.addContentTypeParser<string>(
    'application/json',
    { parseAs: 'string' },
    (_request, body, done) => done(null, body),
  )

  fastify.post(
    '/api/webhooks/stripe',
    // No authenticate: the signature IS the authentication. A bearer token
    // from a payment provider is not a person with a session.
    async (request: FastifyRequest, reply: FastifyReply) => {
      const secret = process.env.STRIPE_WEBHOOK_SECRET
      if (!secret) {
        request.log.warn('Stripe webhook received but STRIPE_WEBHOOK_SECRET is not configured')
        return reply.code(503).send({
          error: 'webhook_not_configured',
          message: 'Webhook secret is not configured on the server.',
        })
      }

      const rawBody = typeof request.body === 'string' ? request.body : ''
      if (!rawBody) {
        return reply.code(400).send({ error: 'invalid_payload' })
      }

      const outcome = verifyWebhookSignature(rawBody, request.headers['stripe-signature'], secret)
      if (!outcome.ok) {
        request.log.warn({ reason: outcome.reason }, 'Stripe webhook signature refused')
        return reply.code(400).send({ error: 'invalid_signature', reason: outcome.reason })
      }

      let envelope: StripeEnvelope
      try {
        envelope = JSON.parse(rawBody) as StripeEnvelope
      } catch {
        return reply.code(400).send({ error: 'invalid_payload' })
      }
      if (typeof envelope.id !== 'string' || typeof envelope.type !== 'string') {
        return reply.code(400).send({ error: 'invalid_payload' })
      }

      const webhookService = new WebhookService()
      const result = await webhookService.processWebhook({
        id: envelope.id,
        type: envelope.type,
        data: (envelope.data?.object as Record<string, unknown> | undefined) ?? {},
        timestamp: outcome.timestamp,
      })

      // 200 even when the event resolved to nothing ownable: the signature
      // was valid, so retrying changes nothing. Stripe retries 5xx, and a
      // permanently unresolvable event would otherwise retry forever.
      return reply.code(200).send({ received: true, handled: result.success })
    },
  )

  // V61 B.2.12 — Provider-neutral customer payment gateway webhook (BLOCKED_EXTERNAL_CREDENTIAL until configured)
  fastify.post(
    '/api/payments/gateway/webhook/:provider',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { provider } = request.params as { provider: string }
      return reply.code(503).send({
        status: 'BLOCKED_EXTERNAL_CREDENTIAL',
        provider,
        error: 'No customer payment gateway provider credentials configured',
      })
    },
  )
}
