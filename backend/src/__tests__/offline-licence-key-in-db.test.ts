// The signing key comes from the database, made by the backend on first use —
// no environment variable (owner, 22 Oct 2026). A licence it signs verifies
// with the public key the app fetches from /api/public/offline/licence-key.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeLicenseCode, parseLicenseCode, verifyOfflineLicense } from '@hisabche/validation'

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

describe('licence signing key in the database', () => {
  beforeEach(() => {
    delete process.env.OFFLINE_LICENSE_PRIVATE_KEY
    rows.length = 0
    inserts.length = 0
  })

  it('makes the key once and reuses it', async () => {
    const first = await offlineLicenseService.getSigningKey()
    const second = await offlineLicenseService.getSigningKey()
    expect(first).not.toBeNull()
    expect(inserts).toHaveLength(1)
    expect(second?.keyId).toBe(first?.keyId)
    expect(inserts[0]?.private_key_hex).toMatch(/^[0-9a-f]{64}$/)
  })

  it('signs a device licence the stored public key verifies', async () => {
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
})
