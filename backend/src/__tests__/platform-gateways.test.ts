// ============================================
// backend/src/__tests__/platform-gateways.test.ts
//
// V63 · P-1 — the rules that must hold without a database:
//
//  1. every adapter declares the Vault names it needs, and only real names;
//  2. a secret-looking key in the public metadata is refused with a sentence
//     that points at the right screen;
//  3. the local provider is a decision, not a missing key;
//  4. the gateway route file is registered behind the admin chain, and the
//     billing decision path is the ONLY place a LIVE enable is applied.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  GATEWAY_ADAPTERS,
  GATEWAY_ENVIRONMENTS,
  GATEWAY_PROVIDERS,
  assertPublicConfig,
} from '../services/admin/platform-gateways.service'
import { PLATFORM_SECRETS } from '../services/secrets/secret-store'
import { ValidationError } from '../errors/validation.error'

const knownSecrets = new Set<string>(Object.values(PLATFORM_SECRETS))

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

describe('gateway adapters', () => {
  it('declares only secret names the platform actually stores', () => {
    for (const provider of GATEWAY_PROVIDERS) {
      for (const name of GATEWAY_ADAPTERS[provider].secretNames) {
        expect(knownSecrets.has(name), `${provider} declares unknown secret ${name}`).toBe(true)
      }
    }
  })

  it('requires a webhook secret wherever a webhook is signed', () => {
    expect(GATEWAY_ADAPTERS.STRIPE.secretNames).toContain('stripe.webhook_secret')
    expect(GATEWAY_ADAPTERS.PAYPAL.secretNames).toContain('paypal.webhook_id')
  })

  it('marks the local provider as an owner decision', () => {
    expect(GATEWAY_ADAPTERS.LOCAL.note).toBe('NEEDS_OWNER_DECISION')
    expect(GATEWAY_ADAPTERS.LOCAL.secretNames).toHaveLength(0)
  })

  it('covers both modes for every provider', () => {
    expect(GATEWAY_ENVIRONMENTS).toEqual(['TEST', 'LIVE'])
  })
})

describe('public gateway metadata', () => {
  it('accepts ordinary configuration', () => {
    expect(() =>
      assertPublicConfig({ merchant_id: 'm-1', currency: 'AFN', publishable_key: 'pk_test_x' }),
    ).not.toThrow()
  })

  // 12 Nov 2026 (V63 audit): the refusal is a CODE the screen translates (it used
  // to name a «Security → Secrets» tab that did not exist); the form shows the
  // keys section itself.
  it('refuses a secret-looking key with its code', () => {
    for (const key of ['secret_key', 'api_key', 'client_secret', 'token', 'Password']) {
      expect(() => assertPublicConfig({ [key]: 'value' })).toThrow(ValidationError)
      expect(() => assertPublicConfig({ [key]: 'value' })).toThrow('GATEWAY_CONFIG_KEY_IS_SECRET')
    }
  })
})

describe('gateway wiring', () => {
  const root = join(__dirname, '..', '..')

  it('registers the gateway routes with the admin chain', () => {
    const source = stripComments(
      readFileSync(join(root, 'src', 'routes', 'admin-gateways.routes.ts'), 'utf8'),
    )
    expect(source).toContain("adminRoute('billing.gateways.read')")
    expect(source).toContain("adminRoute('billing.gateways.write', { stepUp: true })")
    expect(source).not.toContain('platformAdminGuard)')
  })

  it('applies a LIVE enable only from the approval decision', () => {
    const billing = stripComments(
      readFileSync(join(root, 'src', 'services', 'admin', 'admin-billing.service.ts'), 'utf8'),
    )
    expect(billing).toContain('applyApprovedGatewayEnable')
    expect(billing).toMatch(/action_type === 'GATEWAY_ENABLE'/)

    const service = stripComments(
      readFileSync(join(root, 'src', 'services', 'admin', 'platform-gateways.service.ts'), 'utf8'),
    )
    // The only direct «enable» outside the approval path is the TEST branch.
    const enableSites = service.match(/setEnabled\(row\.id, true/g) ?? []
    expect(enableSites).toHaveLength(1)
  })

  it('never stores a credential in the gateway table', () => {
    const migration = readFileSync(
      join(root, '..', 'docs', 'admin-payment-gateways-01-migration.sql'),
      'utf8',
    )
    const table = migration.slice(
      migration.indexOf('CREATE TABLE IF NOT EXISTS public.platform_payment_gateways'),
      migration.indexOf('CREATE INDEX IF NOT EXISTS idx_platform_payment_gateways_provider'),
    )
    // Strip comments and SQL string literals before checking for accidental credential column names
    const tableDefinition = table.replace(/--.*$/gm, '').replace(/'[^']*'/g, "''")
    expect(tableDefinition).not.toMatch(/\bapi_key\b|\bsecret TEXT\b/i)
    expect(table).toContain('secret_names')
  })
})
