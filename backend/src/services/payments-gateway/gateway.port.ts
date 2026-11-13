// ============================================
// backend/src/services/payments-gateway/gateway.port.ts
//
// V63 · P-2 — the shape every provider must satisfy.
//
// ⚠️ WHAT THIS PORT DELIBERATELY DOES NOT DO
//
// It does not move checkout. The existing Stripe checkout (`services/billing`,
// `services/checkout`) works, is tested, and is wired into the ledger. Routing
// it through a new port in the same change would be a rewrite of the money path
// with no new provider behind it — exactly the kind of change this repository
// refuses. The port covers what the CONSOLE needs first: an honest «is this
// configured?» answer and a webhook signature check with a replay window.
//
// A provider that is not configured reports `NOT_CONFIGURED`. It never pretends
// a test passed, and it never invents a brand (the local Afghan provider is an
// owner decision).
// ============================================

export const GATEWAY_KINDS = [
  'stripe',
  'paypal_api',
  'paypal_manual',
  'bank_manual',
  'local_adapter',
] as const

export type GatewayKind = (typeof GATEWAY_KINDS)[number]

export type GatewayTestState = 'OK' | 'NOT_CONFIGURED' | 'FAILED'

export interface GatewayTestResult {
  state: GatewayTestState
  /** One sentence for the operator. Never contains a secret. */
  detail: string
}

export interface GatewayTestContext {
  /** `true` when every name this adapter needs is stored in Vault. */
  secretsPresent: boolean
  /** Non-secret configuration from the gateway row. */
  publicConfig: Record<string, unknown>
}

export interface GatewayPort {
  readonly kind: GatewayKind
  /**
   * Check the configuration WITHOUT charging anything.
   *
   * A provider whose API call needs credentials this deployment does not have
   * answers `NOT_CONFIGURED`; it must not answer `OK` on the strength of the
   * row existing.
   */
  testConnection(context: GatewayTestContext): Promise<GatewayTestResult>
  /**
   * Verify a webhook signature over the RAW body.
   *
   * `null` means «this adapter cannot verify anything yet» — the caller then
   * refuses the event instead of trusting it.
   */
  verifyWebhook(input: {
    rawBody: string
    headers: Record<string, string | undefined>
    context: GatewayTestContext
  }): boolean | null
}

/** Shared helper: the configuration sentence every adapter starts from. */
export function missingSecretsResult(names: readonly string[]): GatewayTestResult {
  return {
    state: 'NOT_CONFIGURED',
    detail:
      names.length === 0
        ? 'This provider needs no secret, but its configuration is incomplete'
        : `${names.length} required secret(s) are not stored in Vault`,
  }
}
