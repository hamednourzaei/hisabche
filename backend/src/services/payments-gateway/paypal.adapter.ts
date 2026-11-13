// ============================================
// backend/src/services/payments-gateway/paypal.adapter.ts
//
// ⚠️ HONEST STATE: the console knows what PayPal needs, can tell whether the
// credentials are stored, and refuses to claim the integration works.
//
// The Orders v2 client is not implemented in this change. Writing one without
// credentials would mean shipping code nobody has run against PayPal's sandbox,
// so `testConnection` answers `FAILED` with that sentence when the credentials
// are present, and `NOT_CONFIGURED` when they are not.
//
// Webhook verification needs PayPal's `verify-webhook-signature` endpoint (it is
// an API call, not an HMAC), so it returns `null` until that client exists.
// ============================================

import type { GatewayPort, GatewayTestContext, GatewayTestResult } from './gateway.port'
import { missingSecretsResult } from './gateway.port'

const SECRET_NAMES = ['paypal.client_id', 'paypal.client_secret', 'paypal.webhook_id'] as const

export const paypalAdapter: GatewayPort = {
  kind: 'paypal_api',

  async testConnection(context: GatewayTestContext): Promise<GatewayTestResult> {
    if (!context.secretsPresent) return missingSecretsResult(SECRET_NAMES)
    return {
      state: 'FAILED',
      detail:
        'The credentials are stored, but the PayPal Orders client is not implemented in this build. Nothing will charge through PayPal yet.',
    }
  },

  verifyWebhook() {
    return null
  },
}
