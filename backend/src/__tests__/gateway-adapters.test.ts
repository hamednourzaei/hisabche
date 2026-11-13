// ============================================
// backend/src/__tests__/gateway-adapters.test.ts
//
// V63 · P-2 — the adapters answer honestly.
//
//  1. a Stripe signature verifies only with the right secret, over the exact
//     raw body, inside the replay window;
//  2. a manual gateway is usable only when its destination is filled in;
//  3. PayPal never reports OK without a client (it says FAILED), and the local
//     provider stays an owner decision;
//  4. the provider→adapter mapping is exhaustive.
// ============================================

import { createHmac } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  GATEWAY_ADAPTERS_BY_KIND,
  STRIPE_TOLERANCE_SECONDS,
  adapterKindFor,
  manualConfigComplete,
  verifyStripeSignature,
} from '../services/payments-gateway'
import { GATEWAY_KINDS } from '../services/payments-gateway/gateway.port'

const SECRET = 'whsec_test_123'
const BODY = '{"id":"evt_1","type":"checkout.session.completed"}'
const NOW = 1_800_000_000

function sign(body: string, timestamp: number, secret = SECRET): string {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
  return `t=${timestamp},v1=${digest}`
}

describe('Stripe webhook signature', () => {
  it('accepts a signature made with the stored secret', () => {
    expect(
      verifyStripeSignature({
        rawBody: BODY,
        header: sign(BODY, NOW),
        secret: SECRET,
        nowSeconds: NOW,
      }),
    ).toBe(true)
  })

  it('refuses a different secret', () => {
    expect(
      verifyStripeSignature({
        rawBody: BODY,
        header: sign(BODY, NOW, 'whsec_other'),
        secret: SECRET,
        nowSeconds: NOW,
      }),
    ).toBe(false)
  })

  it('refuses a body that changed after signing', () => {
    expect(
      verifyStripeSignature({
        rawBody: `${BODY} `,
        header: sign(BODY, NOW),
        secret: SECRET,
        nowSeconds: NOW,
      }),
    ).toBe(false)
  })

  it('refuses a replayed event outside the tolerance', () => {
    expect(
      verifyStripeSignature({
        rawBody: BODY,
        header: sign(BODY, NOW),
        secret: SECRET,
        nowSeconds: NOW + STRIPE_TOLERANCE_SECONDS + 1,
      }),
    ).toBe(false)
  })

  it('refuses a missing or malformed header', () => {
    expect(
      verifyStripeSignature({ rawBody: BODY, header: undefined, secret: SECRET, nowSeconds: NOW }),
    ).toBe(false)
    expect(
      verifyStripeSignature({ rawBody: BODY, header: 'garbage', secret: SECRET, nowSeconds: NOW }),
    ).toBe(false)
  })
})

describe('manual gateway', () => {
  it('is configured by a payout destination', () => {
    expect(manualConfigComplete({ paypal_email: 'pay@hisabche.com' })).toBe(true)
    expect(manualConfigComplete({ bank_details: 'Azizi Bank, 1234' })).toBe(true)
  })

  it('is not configured by an empty value', () => {
    expect(manualConfigComplete({})).toBe(false)
    expect(manualConfigComplete({ paypal_email: '   ' })).toBe(false)
    expect(manualConfigComplete({ paypal_email: 42 })).toBe(false)
  })
})

describe('adapter honesty', () => {
  it('covers every kind', () => {
    for (const kind of GATEWAY_KINDS) {
      expect(GATEWAY_ADAPTERS_BY_KIND[kind]).toBeDefined()
      expect(GATEWAY_ADAPTERS_BY_KIND[kind].kind).toBe(kind)
    }
  })

  it('maps a provider to an adapter that can answer', () => {
    expect(adapterKindFor('STRIPE', 'LIVE')).toBe('stripe')
    expect(adapterKindFor('PAYPAL', 'TEST')).toBe('paypal_api')
    expect(adapterKindFor('PAYPAL', 'LIVE')).toBe('paypal_manual')
    expect(adapterKindFor('LOCAL', 'LIVE')).toBe('local_adapter')
  })

  it('never reports OK without a working client', async () => {
    const paypal = await GATEWAY_ADAPTERS_BY_KIND.paypal_api.testConnection({
      secretsPresent: true,
      publicConfig: {},
    })
    expect(paypal.state).toBe('FAILED')

    const local = await GATEWAY_ADAPTERS_BY_KIND.local_adapter.testConnection({
      secretsPresent: true,
      publicConfig: {},
    })
    expect(local.state).toBe('NOT_CONFIGURED')
    expect(local.detail).toContain('NEEDS_OWNER_DECISION')

    const stripe = await GATEWAY_ADAPTERS_BY_KIND.stripe.testConnection({
      secretsPresent: false,
      publicConfig: {},
    })
    expect(stripe.state).toBe('NOT_CONFIGURED')
  })

  it('refuses to verify a webhook it cannot read the secret for', () => {
    expect(
      GATEWAY_ADAPTERS_BY_KIND.stripe.verifyWebhook({
        rawBody: BODY,
        headers: {},
        context: { secretsPresent: true, publicConfig: {} },
      }),
    ).toBeNull()
    expect(
      GATEWAY_ADAPTERS_BY_KIND.paypal_manual.verifyWebhook({
        rawBody: BODY,
        headers: {},
        context: { secretsPresent: true, publicConfig: {} },
      }),
    ).toBeNull()
  })
})
