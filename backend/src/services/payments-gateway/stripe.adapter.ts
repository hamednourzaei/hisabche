// ============================================
// backend/src/services/payments-gateway/stripe.adapter.ts
//
// The Stripe adapter for the console. The checkout itself stays where it is
// (`services/checkout`, `services/billing`); this file answers «configured?»
// and verifies a webhook signature over the raw body.
// ============================================

import { createHmac, timingSafeEqual } from 'node:crypto'

import type { GatewayPort, GatewayTestContext, GatewayTestResult } from './gateway.port'
import { missingSecretsResult } from './gateway.port'

const SECRET_NAMES = ['stripe.secret_key', 'stripe.webhook_secret'] as const

/**
 * Stripe's scheme: `t=<unix>,v1=<hex hmac of "t.body">`. The default tolerance
 * is five minutes; a replay outside it is refused.
 */
export const STRIPE_TOLERANCE_SECONDS = 300

export function verifyStripeSignature(input: {
  rawBody: string
  header: string | undefined
  secret: string
  nowSeconds?: number
}): boolean {
  const header = input.header
  if (!header) return false

  const parts = header.split(',').map((part) => part.trim())
  const timestampPart = parts.find((part) => part.startsWith('t='))
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3))
  if (!timestampPart || signatures.length === 0) return false

  const timestamp = Number(timestampPart.slice(2))
  if (!Number.isInteger(timestamp) || timestamp <= 0) return false

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestamp) > STRIPE_TOLERANCE_SECONDS) return false

  const expected = createHmac('sha256', input.secret)
    .update(`${timestamp}.${input.rawBody}`)
    .digest()
  const expectedHex = expected.toString('hex')

  return signatures.some((candidate) => {
    if (candidate.length !== expectedHex.length) return false
    try {
      return timingSafeEqual(Buffer.from(candidate, 'hex'), expected)
    } catch {
      return false
    }
  })
}

export const stripeAdapter: GatewayPort = {
  kind: 'stripe',

  async testConnection(context: GatewayTestContext): Promise<GatewayTestResult> {
    if (!context.secretsPresent) return missingSecretsResult(SECRET_NAMES)
    return {
      state: 'OK',
      detail:
        'The secret key and webhook signing secret are stored. The console does not charge a card to test them.',
    }
  },

  verifyWebhook() {
    // ⚠️ The adapter is not given the signing secret (the port carries no
    // secret read), so it cannot verify from here. `null` = «refuse the event».
    // The existing Stripe webhook route verifies with the stored secret; the
    // tested primitive above is what a future adapter uses once the port is
    // allowed to read Vault.
    return null
  },
}
