// ============================================
// Audit F-01 (8 Nov 2026): the licence key is trusted from the BUILD, never
// learned. A key planted in the device store, or offered by a server on first
// fetch, must not open the offline edition.
// ============================================

import {
  encodeLicenseCode,
  generateOfflineLicenseKeyPair,
  signOfflineLicense,
} from '@hisabche/validation'

const DEVICE = '0b6c7a43-6a3e-4f39-9a52-7a2f1f9a2c11'
const store = new Map<string, string>()

jest.mock('@/shared/lib/bridge', () => ({
  bridge: () => ({
    secure: {
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, value: string) => {
        store.set(key, value)
      },
      delete: async (key: string) => {
        store.delete(key)
      },
    },
    db: { query: async () => ({ rows: [] }) },
  }),
}))

jest.mock('@/shared/lib/api', () => ({
  API_BASE_URL: 'https://api.test/api',
  OFFLINE_LICENSE_PUBLIC_KEY: '',
}))

import { activateLicence } from '../offline-license'
import { TRUSTED_LICENCE_KEYS, trustedLicenceKey } from '../../../shared/lib/licence-keys'

function licenceSignedBy(secretKeyHex: string, keyId: string) {
  const now = Date.now()
  return encodeLicenseCode(
    signOfflineLicense(
      {
        license_id: '6f1d7c0e-2b8a-4f3e-9d6c-1a2b3c4d5e6f',
        workspace_id: '7a1d7c0e-2b8a-4f3e-9d6c-1a2b3c4d5e6f',
        account_id: '8b1d7c0e-2b8a-4f3e-9d6c-1a2b3c4d5e6f',
        plan: 'offline',
        issued_at: new Date(now - 60_000).toISOString(),
        expires_at: new Date(now + 86_400_000).toISOString(),
        device_id: DEVICE,
        features: [],
        version: 1,
      },
      secretKeyHex,
      keyId,
    ),
  )
}

describe('offline licence trusts only keys shipped with the build', () => {
  beforeEach(() => {
    store.clear()
    store.set('hisabche.licence.device-id', DEVICE)
  })

  it('ships the production key id', () => {
    expect(TRUSTED_LICENCE_KEYS.map((k) => k.keyId)).toContain('k-2026-10-22-d3445e54')
    for (const k of TRUSTED_LICENCE_KEYS) expect(k.publicKey).toMatch(/^[0-9a-f]{64}$/)
  })

  it('refuses a licence signed by a key the build does not know, without any network call', async () => {
    const fetchSpy = jest.fn()
    ;(globalThis as { fetch?: unknown }).fetch = fetchSpy
    const attacker = generateOfflineLicenseKeyPair()
    // A planted key in the store — the old trust-on-first-use slot — changes nothing.
    store.set(
      'hisabche.licence.public-key',
      JSON.stringify({ keyId: 'k-attacker', publicKey: attacker.publicKeyHex }),
    )

    const result = await activateLicence(licenceSignedBy(attacker.secretKeyHex, 'k-attacker'))

    expect(result).toEqual({ ok: false, reason: 'NOT_CONFIGURED' })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(store.has('hisabche.licence.code')).toBe(false)
  })

  // ⚠️ No «forged signature under the trusted key id» case here: this Jest
  // environment mocks ed25519 with `verify: () => true` (apps/desktop/jest.setup.js).
  // Signature checking is proven under Vitest in
  // packages/validation/src/__tests__/offline-license-code.test.ts.

  it('a build key is trusted as part of the build', () => {
    const pair = generateOfflineLicenseKeyPair()
    expect(trustedLicenceKey('anything', pair.publicKeyHex)).toBe(pair.publicKeyHex)
    expect(trustedLicenceKey('unknown', '')).toBeNull()
    expect(trustedLicenceKey(undefined, undefined)).toBeNull()
  })
})
