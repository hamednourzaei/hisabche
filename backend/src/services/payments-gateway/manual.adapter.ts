// ============================================
// backend/src/services/payments-gateway/manual.adapter.ts
//
// A manual gateway has no API: the customer is told where to send the money
// (a PayPal address, a bank account) and an admin confirms the transfer. The
// confirmation credits the subscription through the EXISTING billing ledger —
// never a second ledger.
//
// There is nothing to test with a network call; the configuration is the test.
// ============================================

import type { GatewayPort, GatewayTestContext, GatewayTestResult } from './gateway.port'

/** The public fields a manual gateway must carry to be usable. */
export const MANUAL_CONFIG_KEYS = ['paypal_email', 'bank_details'] as const

export function manualConfigComplete(publicConfig: Record<string, unknown>): boolean {
  return MANUAL_CONFIG_KEYS.some((key) => {
    const value = publicConfig[key]
    return typeof value === 'string' && value.trim().length > 3
  })
}

export const manualAdapter: GatewayPort = {
  kind: 'paypal_manual',

  async testConnection(context: GatewayTestContext): Promise<GatewayTestResult> {
    if (!manualConfigComplete(context.publicConfig)) {
      return {
        state: 'NOT_CONFIGURED',
        detail: 'Add the PayPal address or the bank details a customer should pay into.',
      }
    }
    return {
      state: 'OK',
      detail: 'The payment destination is filled in. A confirmation is still recorded by an admin.',
    }
  },

  verifyWebhook() {
    // A manual transfer has no webhook. `null` is the honest answer.
    return null
  },
}

/** The bank variant is the same flow with a different label. */
export const bankManualAdapter: GatewayPort = {
  ...manualAdapter,
  kind: 'bank_manual',
}
