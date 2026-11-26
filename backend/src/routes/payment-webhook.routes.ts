// ============================================
// backend/src/routes/payment-webhook.routes.ts
//
// V58 · P0-4 & V100 · P0-4.1 — Provider Webhook Surface (Isolated Raw-Body Plugin)
//
// Registered endpoints:
//   - POST /api/webhooks/stripe                (Platform Stripe subscription billing)
//   - POST /api/payments/gateway/webhook/:provider  (Customer payment gateway callbacks)
//
// Security contract:
//   1. Registered in `publicPaths` (no user JWT / no browser session / never trusts x-workspace-id).
//   2. Scoped `application/json` parser preserves exact raw bytes (`parseAs: 'string'`).
//   3. Verifies `t=<unix-seconds>,v1=<hex-hmac>` HMAC-SHA256 signature against RAW bytes
//      and bounded replay window (`verifyWebhookSignature`, timingSafeEqual).
//   4. Derives workspace ownership authoritatively from the `payments` row in Postgres.
//   5. Executes `apply_payment_gateway_event(...)` atomically in a Postgres transaction
//      with idempotent replay deduplication on `(gateway_name, event_id)` and `(external_ref, to_state)`.
// ============================================

import { createHash } from 'node:crypto'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { currencyScale } from '../utils/money-units'
import { supabase } from '../db'
import { ConflictError, DatabaseError, NotFoundError } from '../errors/database.error'
import WebhookService from '../services/webhook.service'
import { getSecret } from '../services/secrets/secret-store'
import {
  DEFAULT_TOLERANCE_SECONDS,
  verifyWebhookSignature,
} from '../services/payments/webhook-signature.domain'

/** Stripe event envelope — only what mapping needs. */
interface StripeEnvelope {
  id?: unknown
  type?: unknown
  data?: { object?: unknown }
}

const providerGatewayWebhookSchema = z
  .object({
    eventId: z.string().trim().min(1).max(160),
    eventType: z.string().trim().min(1).max(80).default('payment.state_changed'),
    paymentId: z.string().uuid(),
    workspaceId: z.string().uuid().optional(),
    processorState: z.enum(['queued_offline', 'pending_capture', 'captured', 'declined', 'voided']),
    externalRef: z.string().trim().min(1).max(120),
    feeMinor: z.number().int().min(0).default(0),
    amountMinor: z.number().int().min(0),
    currency: z
      .string()
      .trim()
      .min(3)
      .max(8)
      .transform((c) => c.toUpperCase()),
    reason: z.string().trim().max(300).optional(),
  })
  .strict()

async function resolveProviderWebhookSecret(provider: string): Promise<string | null> {
  const key = provider.trim().toLowerCase()
  const vaultSecret = await getSecret(`payment_gateway.${key}.webhook_secret`)
  if (vaultSecret) return vaultSecret
  const envSpecific = process.env[`PAYMENT_WEBHOOK_SECRET_${key.toUpperCase()}`]
  if (envSpecific && envSpecific.trim() !== '') return envSpecific.trim()
  const envDefault = process.env.PAYMENT_WEBHOOK_SECRET
  return envDefault && envDefault.trim() !== '' ? envDefault.trim() : null
}

async function recordWebhookTelemetryFailure(params: {
  provider: string
  rawBody: string
  status: 'rejected_signature' | 'failed'
  provenance: 'webhook_rejected_signature' | 'failed_processing'
  errorCode: string
  signatureVerified: boolean
}): Promise<void> {
  try {
    let parsed: Record<string, unknown> | null = null
    try {
      parsed = JSON.parse(params.rawBody) as Record<string, unknown>
    } catch {
      parsed = null
    }
    const paymentId = typeof parsed?.paymentId === 'string' ? parsed.paymentId : null
    if (!paymentId || !/^[0-9a-f-]{36}$/i.test(paymentId)) return

    const { data: payRow } = await supabase
      .from('payments')
      .select('id, workspace_id, currency')
      .eq('id', paymentId)
      .maybeSingle()
    if (!payRow) return

    const wsId = String((payRow as { workspace_id: string }).workspace_id)
    const payCur = String((payRow as { currency?: string }).currency ?? '')
    const candidateState =
      typeof parsed?.processorState === 'string' &&
      ['queued_offline', 'pending_capture', 'captured', 'declined', 'voided'].includes(
        parsed.processorState,
      )
        ? parsed.processorState
        : 'pending_capture'

    await supabase.from('payment_gateway_events').insert({
      workspace_id: wsId,
      payment_id: paymentId,
      from_state: null,
      to_state: candidateState,
      gateway_name: params.provider,
      external_ref:
        typeof parsed?.externalRef === 'string' ? parsed.externalRef.slice(0, 120) : null,
      fee_minor: 0,
      signature_verified: params.signatureVerified,
      reason: params.errorCode,
      actor_id: null,
      event_id: null,
      event_type:
        typeof parsed?.eventType === 'string' ? parsed.eventType.slice(0, 80) : 'webhook.rejected',
      amount_minor:
        typeof parsed?.amountMinor === 'number' && Number.isInteger(parsed.amountMinor)
          ? parsed.amountMinor
          : null,
      currency: payCur || null,
      payload_sha256: createHash('sha256').update(params.rawBody, 'utf8').digest('hex'),
      processing_status: params.status,
      provenance: params.provenance,
      last_error: params.errorCode.slice(0, 240),
    })
  } catch {
    // Non-blocking telemetry must never mask the 401/409 security response.
  }
}

export async function paymentWebhookRoutes(fastify: FastifyInstance) {
  // Raw-body parser, this plugin only (never re-serialize JSON before HMAC check).
  fastify.addContentTypeParser<string>(
    'application/json',
    { parseAs: 'string' },
    (_request, body, done) => done(null, body),
  )

  fastify.post(
    '/api/webhooks/stripe',
    // No authenticate: the signature IS the authentication.
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

      return reply.code(200).send({ received: true, handled: result.success })
    },
  )

  // V100 P0 (4.1): Provider-neutral raw-body signed payment gateway callback
  fastify.post(
    '/api/payments/gateway/webhook/:provider',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { provider } = z
        .object({ provider: z.string().trim().min(2).max(40) })
        .parse(request.params)
      const normalizedProvider = provider.toLowerCase()

      const secret = await resolveProviderWebhookSecret(normalizedProvider)
      if (!secret) {
        return reply.code(503).send({
          status: 'BLOCKED_EXTERNAL_CREDENTIAL',
          code: 'GATEWAY_WEBHOOK_NOT_CONFIGURED',
          provider: normalizedProvider,
          error: 'No customer payment gateway webhook secret configured on server',
        })
      }

      const rawBody = typeof request.body === 'string' ? request.body : ''
      if (!rawBody) {
        return reply
          .code(400)
          .send({ error: 'INVALID_WEBHOOK_PAYLOAD', code: 'INVALID_WEBHOOK_PAYLOAD' })
      }

      const sigHeader =
        request.headers['x-hisabche-signature'] ?? request.headers['stripe-signature']
      const outcome = verifyWebhookSignature(
        rawBody,
        sigHeader,
        secret,
        new Date(),
        DEFAULT_TOLERANCE_SECONDS,
      )
      if (!outcome.ok) {
        const code =
          outcome.reason === 'missing_header'
            ? 'GATEWAY_SIGNATURE_REQUIRED'
            : outcome.reason === 'timestamp_out_of_tolerance'
              ? 'GATEWAY_TIMESTAMP_EXPIRED'
              : 'GATEWAY_SIGNATURE_INVALID'
        await recordWebhookTelemetryFailure({
          provider: normalizedProvider,
          rawBody,
          status: 'rejected_signature',
          provenance: 'webhook_rejected_signature',
          errorCode: code,
          signatureVerified: false,
        })
        return reply.code(401).send({ error: code, code, reason: outcome.reason })
      }

      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(rawBody)
      } catch {
        return reply
          .code(400)
          .send({ error: 'INVALID_WEBHOOK_PAYLOAD', code: 'INVALID_WEBHOOK_PAYLOAD' })
      }

      const bodyResult = providerGatewayWebhookSchema.safeParse(parsedJson)
      if (!bodyResult.success) {
        return reply.code(400).send({
          error: 'INVALID_WEBHOOK_PAYLOAD',
          code: 'INVALID_WEBHOOK_PAYLOAD',
          message: bodyResult.error.errors[0]?.message ?? 'Invalid webhook payload',
        })
      }
      const body = bodyResult.data

      // Derive workspace ownership authoritatively from payments row; never trust caller tenant headers.
      const { data: payment, error: pErr } = await supabase
        .from('payments')
        .select('id, workspace_id, method, currency, amount')
        .eq('id', body.paymentId)
        .maybeSingle()
      if (pErr) {
        throw new DatabaseError('Failed to verify payment for webhook', pErr)
      }
      if (!payment) {
        throw new NotFoundError('Payment')
      }

      const authWorkspaceId = String((payment as { workspace_id: string }).workspace_id)
      if (body.workspaceId && body.workspaceId !== authWorkspaceId) {
        return reply.code(403).send({
          error: 'CROSS_TENANT_PAYMENT_REFUSED',
          code: 'CROSS_TENANT_PAYMENT_REFUSED',
        })
      }

      const payloadSha256 = createHash('sha256').update(rawBody, 'utf8').digest('hex')
      const scale = currencyScale(String((payment as { currency: string }).currency))

      const rpcRes = await supabase.rpc('apply_payment_gateway_event', {
        p_payment_id: body.paymentId,
        p_gateway_name: normalizedProvider,
        p_event_id: body.eventId,
        p_event_type: body.eventType,
        p_to_state: body.processorState,
        p_external_ref: body.externalRef,
        p_fee_minor: body.feeMinor,
        p_amount_minor: body.amountMinor,
        p_currency: body.currency,
        p_scale: scale,
        p_payload_sha256: payloadSha256,
        p_reason: body.reason ?? `Signed ${normalizedProvider} webhook`,
        p_actor_id: null,
      })

      if (rpcRes.error) {
        const msg = String(rpcRes.error.message ?? '')
        await recordWebhookTelemetryFailure({
          provider: normalizedProvider,
          rawBody,
          status: 'failed',
          provenance: 'failed_processing',
          errorCode: msg || 'GATEWAY_WEBHOOK_RPC_ERROR',
          signatureVerified: true,
        })
        if (msg.includes('PAYMENT_NOT_FOUND')) throw new NotFoundError('Payment')
        if (msg.includes('GATEWAY_CURRENCY_MISMATCH')) {
          throw new ConflictError('GATEWAY_CURRENCY_MISMATCH')
        }
        if (msg.includes('GATEWAY_AMOUNT_MISMATCH')) {
          throw new ConflictError('GATEWAY_AMOUNT_MISMATCH')
        }
        if (msg.includes('GATEWAY_EVENT_PAYLOAD_CONFLICT')) {
          throw new ConflictError('GATEWAY_EVENT_PAYLOAD_CONFLICT')
        }
        if (msg.includes('PROCESSOR_STATE_TRANSITION_NOT_ALLOWED')) {
          throw new ConflictError('PROCESSOR_STATE_TRANSITION_NOT_ALLOWED')
        }
        throw new DatabaseError('Atomic gateway webhook transaction failed', rpcRes.error)
      }

      const rpcData = (rpcRes.data ?? {}) as {
        workspaceId?: string
        paymentId?: string
        processorState?: string
        externalRef?: string
        eventId?: string
        currency?: string
        signatureVerified?: boolean
        replay?: boolean
      }

      // Downstream activity & reconciliation notification (failure tracked explicitly, never silent)
      let downstreamWarning: string | null = null
      if (!rpcData.replay) {
        const { error: actErr } = await supabase.from('activities').insert({
          workspace_id: authWorkspaceId,
          user_id: null,
          entity_type: 'payment',
          entity_id: body.paymentId,
          action: `gateway.${body.processorState}`,
          title: `Gateway ${normalizedProvider}: ${body.processorState} (${body.externalRef})`,
        })
        if (actErr) {
          downstreamWarning = actErr.message ?? 'DOWNSTREAM_ACTIVITY_FAILED'
          request.log.warn(
            { paymentId: body.paymentId, err: actErr },
            'Downstream webhook activity failed',
          )
        }
      }

      return reply.send({
        data: {
          workspaceId: rpcData.workspaceId ?? authWorkspaceId,
          paymentId: rpcData.paymentId ?? body.paymentId,
          processorState: rpcData.processorState ?? body.processorState,
          externalRef: rpcData.externalRef ?? body.externalRef,
          eventId: rpcData.eventId ?? body.eventId,
          currency: rpcData.currency ?? body.currency,
          signatureVerified: true,
          replay: Boolean(rpcData.replay),
          ...(downstreamWarning ? { downstreamWarning } : {}),
        },
      })
    },
  )
}
