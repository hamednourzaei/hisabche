// ============================================
// backend/src/services/payments-gateway/index.ts
//
// The adapter registry. One place maps a stored provider row to the adapter
// that knows how to test it, so the route never needs a switch of its own.
// ============================================

import type { GatewayKind, GatewayPort } from './gateway.port'
import { stripeAdapter } from './stripe.adapter'
import { paypalAdapter } from './paypal.adapter'
import { bankManualAdapter, manualAdapter } from './manual.adapter'
import { localAdapter } from './local.adapter'

export * from './gateway.port'
export { verifyStripeSignature, STRIPE_TOLERANCE_SECONDS } from './stripe.adapter'
export { manualConfigComplete, MANUAL_CONFIG_KEYS } from './manual.adapter'

export const GATEWAY_ADAPTERS_BY_KIND: Record<GatewayKind, GatewayPort> = {
  stripe: stripeAdapter,
  paypal_api: paypalAdapter,
  paypal_manual: manualAdapter,
  bank_manual: bankManualAdapter,
  local_adapter: localAdapter,
}

/**
 * The database stores a provider (`STRIPE` | `PAYPAL` | `LOCAL`) and a mode;
 * the adapter is chosen by what the row is FOR. PayPal has two flows (API and
 * manual), so the mode is not enough — the caller passes the kind when it knows
 * it, and Stripe is the default for a provider we take money through by API.
 */
export function adapterKindFor(provider: string, environment: string): GatewayKind {
  if (provider === 'STRIPE') return 'stripe'
  if (provider === 'PAYPAL') return environment === 'TEST' ? 'paypal_api' : 'paypal_manual'
  return 'local_adapter'
}

export function gatewayAdapterFor(provider: string, environment: string): GatewayPort {
  return GATEWAY_ADAPTERS_BY_KIND[adapterKindFor(provider, environment)]
}
