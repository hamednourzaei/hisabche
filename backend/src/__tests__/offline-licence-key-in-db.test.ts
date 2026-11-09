// Where the licence signing key comes from: ONLY offline_license_signing_keys
// (owner decision, 9 Nov 2026: «در دیتابیس بماند»). No environment path.
// Outside production a key is made on first use; in production never — the
// shipped apps trust only the keys in their code.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  encodeLicenseCode,
  generateOfflineLicenseKeyPair,
  parseLicenseCode,
  verifyOfflineLicense,
} from '@hisabche/validation'

const rows: Array<Record<string, unknown>> = []
const inserts: Array<Record<string, unknown>> = []

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'offline_license_signing_keys') {
        return {
          select: () => ({
            is: () => ({
              maybeSingle: async () => ({
                data: rows.find((r) => r.retired_at == null) ?? null,
                error: null,
              }),
            }),
          }),
          insert: async (row: Record<string, unknown>) => {
            inserts.push(row)
            rows.push({ ...row, retired_at: null })
            return { error: null }
          },
        }
      }
      return {
        insert: async () => ({ error: null }),
        upsert: async () => ({ error: null }),
      }
    },
  },
}))

const { offlineLicenseService } = await import('../services/offline-license.service')

const ORIGINAL_ENV = process.env.NODE_ENV

describe('licence signing key', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test'
    rows.length = 0
    inserts.length = 0
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_ENV
    vi.restoreAllMocks()
  })

  it('outside production: makes the key once and reuses it', async () => {
    const first = await offlineLicenseService.getSigningKey()
    const second = await offlineLicenseService.getSigningKey()
    expect(first).not.toBeNull()
    expect(inserts).toHaveLength(1)
    expect(second?.keyId).toBe(first?.keyId)
  })

  it('signs a device licence the public key verifies', async () => {
    const deviceId = 'f052c5b5-b5a8-4af0-987c-0eae72077585'
    const signed = await offlineLicenseService.issueDeviceLicense({ deviceId, periodDays: 365 })
    const key = await offlineLicenseService.getSigningKey()
    const result = verifyOfflineLicense({
      license: parseLicenseCode(encodeLicenseCode(signed))!,
      publicKey: key!.publicKey,
      deviceId,
    })
    expect(result.verdict).toBe('VALID')
    expect(signed.payload.key_id).toBe(key!.keyId)
  })

  it('an environment variable is NOT a key source', async () => {
    const pair = generateOfflineLicenseKeyPair()
    process.env.OFFLINE_LICENSE_PRIVATE_KEY = pair.secretKeyHex
    try {
      const key = await offlineLicenseService.getSigningKey()
      expect(key?.publicKey).not.toBe(pair.publicKeyHex)
      expect(inserts).toHaveLength(1)
    } finally {
      delete process.env.OFFLINE_LICENSE_PRIVATE_KEY
    }
  })

  it('in production: never generates a new key', async () => {
    process.env.NODE_ENV = 'production'
    await expect(offlineLicenseService.getSigningKey()).resolves.toBeNull()
    expect(inserts).toHaveLength(0)
  })

  it('in production: uses the existing table key', async () => {
    process.env.NODE_ENV = 'production'
    const pair = generateOfflineLicenseKeyPair()
    rows.push({
      key_id: 'k-old',
      private_key_hex: pair.secretKeyHex,
      public_key_hex: pair.publicKeyHex,
      retired_at: null,
    })
    const key = await offlineLicenseService.getSigningKey()
    expect(key?.keyId).toBe('k-old')
    expect(inserts).toHaveLength(0)
  })

  it('a row without its private half is an error, never replaced by a new key', async () => {
    rows.push({
      key_id: 'k-broken',
      private_key_hex: null,
      public_key_hex: 'b'.repeat(64),
      retired_at: null,
    })
    await expect(offlineLicenseService.getSigningKey()).rejects.toThrow(/no private half/)
    expect(inserts).toHaveLength(0)
  })
})
