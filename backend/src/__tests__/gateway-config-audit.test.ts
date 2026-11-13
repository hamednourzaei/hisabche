// ============================================
// V63 audit (12 Nov 2026) — a gateway can actually be configured.
//
// · Public settings refuse anything secret-LIKE, not only five exact names
//   (`stripe_secret_key` used to pass into a column every reader sees).
// · Live PayPal is the MANUAL flow (customers pay into the PayPal address);
//   it needs that address, not the three API secrets it never uses — before
//   the audit it counted them, so the flow the owner asked for could never be
//   enabled.
// ============================================
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase } from './helpers/fake-supabase'

const holder: { db: FakeDatabase } = { db: new FakeDatabase() }

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => holder.db.from(table),
    rpc: async (name: string, args: Record<string, unknown>) => holder.db.callRpc(name, args),
  },
}))

const { PlatformGatewaysService, assertPublicConfig } =
  await import('../services/admin/platform-gateways.service')
const { resetSecretStoreForTesting } = await import('../services/secrets/secret-store')

const row = (overrides: Record<string, unknown>) => ({
  id: '11111111-1111-4111-8111-111111111111',
  provider: 'PAYPAL',
  environment: 'LIVE',
  is_enabled: false,
  display_name: 'PayPal',
  public_config: {},
  secret_names: ['paypal.client_id', 'paypal.client_secret', 'paypal.webhook_id'],
  updated_by: null,
  updated_at: '2026-11-12T00:00:00.000Z',
  ...overrides,
})

beforeEach(async () => {
  holder.db = new FakeDatabase()
  await resetSecretStoreForTesting()
})

describe('public settings never carry a secret', () => {
  it.each(['stripe_secret_key', 'paypal_client_secret', 'access_token', 'Private_Key', 'apiKey'])(
    'refuses %s',
    (key) => {
      expect(() => assertPublicConfig({ [key]: 'x' })).toThrow('GATEWAY_CONFIG_KEY_IS_SECRET')
    },
  )

  it('accepts the PayPal address and a publishable key, and checks the address', () => {
    expect(() =>
      assertPublicConfig({ paypal_email: 'pay@example.com', publishable_key: 'pk_live_1' }),
    ).not.toThrow()
    expect(() => assertPublicConfig({ paypal_email: 'not-an-email' })).toThrow(
      'GATEWAY_PAYPAL_EMAIL_INVALID',
    )
    expect(() => assertPublicConfig({ bank_details: { nested: true } })).toThrow(
      'GATEWAY_CONFIG_VALUE_INVALID',
    )
  })
})

describe('live PayPal is configured by its address, not by API keys', () => {
  it('without the address it is incomplete — and asks for no secret', async () => {
    holder.db.seed('platform_payment_gateways', [row({})])
    const [item] = await PlatformGatewaysService.list()
    expect(item).toMatchObject({ secretNames: [], missingSecrets: 1, note: 'INCOMPLETE' })
  })

  it('with the address it can be enabled, with no API key stored', async () => {
    holder.db.seed('platform_payment_gateways', [
      row({ public_config: { paypal_email: 'pay@example.com' } }),
    ])
    const [item] = await PlatformGatewaysService.list()
    expect(item).toMatchObject({ secretNames: [], missingSecrets: 0 })
  })

  it('test-mode PayPal is the API flow and still needs its keys', async () => {
    holder.db.seed('platform_payment_gateways', [row({ environment: 'TEST' })])
    const [item] = await PlatformGatewaysService.list()
    expect(item!.secretNames).toHaveLength(3)
    expect(item!.missingSecrets).toBe(3)
  })
})
