// ============================================
// backend/src/services/payments-gateway/local.adapter.ts
//
// The neutral local-provider interface. NO BRAND IS NAMED HERE.
//
// The same rule the attendance devices follow: an integration is not claimed
// until it has been tested with real credentials. The owner must say which
// Afghan provider to integrate (HesabPay or another); until then this adapter
// reports `NEEDS_OWNER_DECISION` and the console shows exactly that.
// ============================================

import type { GatewayPort } from './gateway.port'

export const localAdapter: GatewayPort = {
  kind: 'local_adapter',

  async testConnection() {
    return {
      state: 'NOT_CONFIGURED',
      detail: 'NEEDS_OWNER_DECISION: name the local gateway to integrate before it can be tested.',
    }
  },

  verifyWebhook() {
    return null
  },
}
