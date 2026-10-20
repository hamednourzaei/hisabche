import { describe, expect, it } from 'vitest'
import {
  bytesToHex,
  canonicalizeJson,
  canonicalizeLicensePayload,
  generateOfflineLicenseKeyPair,
  hexToBytes,
  signOfflineLicense,
  verifyOfflineLicense,
  verifyOfflineLicenseSignature,
  type OfflineLicensePayload,
} from '../schemas/offline-license'

describe('Offline Licence Cryptographic Verification (Ed25519)', () => {
  const keyPair = generateOfflineLicenseKeyPair()
  const workspaceId = '11111111-1111-1111-1111-111111111111'
  const accountId = '22222222-2222-2222-2222-222222222222'
  const deviceId = '33333333-3333-3333-3333-333333333333'
  const licenseId = '44444444-4444-4444-4444-444444444444'

  const basePayload: OfflineLicensePayload = {
    license_id: licenseId,
    workspace_id: workspaceId,
    account_id: accountId,
    plan: 'OFFLINE',
    issued_at: '2026-10-20T00:00:00.000Z',
    expires_at: '2027-10-20T00:00:00.000Z',
    device_id: deviceId,
    features: ['invoice.create', 'reports.view', 'export.all'],
    version: 1,
    key_id: 'v1',
  }

  it('valid licence verifies successfully', () => {
    const canonical = canonicalizeLicensePayload(basePayload)
    expect(canonical).toContain('"license_id":"44444444-4444-4444-4444-444444444444"')

    const signed = signOfflineLicense(basePayload, keyPair.secretKey, 'v1')
    expect(verifyOfflineLicenseSignature(signed, keyPair.publicKey)).toBe(true)

    const result = verifyOfflineLicense({
      license: signed,
      publicKey: keyPair.publicKey,
      workspaceId,
      deviceId,
      now: '2026-11-01T12:00:00.000Z',
    })

    expect(result.valid).toBe(true)
    expect(result.verdict).toBe('VALID')
    expect(result.payload?.license_id).toBe(licenseId)
  })

  it('expired licence returns EXPIRED verdict', () => {
    const signed = signOfflineLicense(basePayload, keyPair.secretKey, 'v1')
    const result = verifyOfflineLicense({
      license: signed,
      publicKey: keyPair.publicKey,
      workspaceId,
      deviceId,
      now: '2027-10-25T00:00:00.000Z', // past 2027-10-20
    })

    expect(result.valid).toBe(false)
    expect(result.verdict).toBe('EXPIRED')
  })

  it('wrong workspace returns WRONG_WORKSPACE verdict', () => {
    const signed = signOfflineLicense(basePayload, keyPair.secretKey, 'v1')
    const result = verifyOfflineLicense({
      license: signed,
      publicKey: keyPair.publicKey,
      workspaceId: '99999999-9999-9999-9999-999999999999',
      deviceId,
      now: '2026-11-01T12:00:00.000Z',
    })

    expect(result.valid).toBe(false)
    expect(result.verdict).toBe('WRONG_WORKSPACE')
  })

  it('wrong device returns WRONG_DEVICE verdict', () => {
    const signed = signOfflineLicense(basePayload, keyPair.secretKey, 'v1')
    const result = verifyOfflineLicense({
      license: signed,
      publicKey: keyPair.publicKey,
      workspaceId,
      deviceId: '88888888-8888-8888-8888-888888888888',
      now: '2026-11-01T12:00:00.000Z',
    })

    expect(result.valid).toBe(false)
    expect(result.verdict).toBe('WRONG_DEVICE')
  })

  it('tampered byte in payload returns TAMPERED verdict', () => {
    const signed = signOfflineLicense(basePayload, keyPair.secretKey, 'v1')
    // Modify one field in payload after signing
    const tampered = {
      ...signed,
      payload: {
        ...signed.payload,
        expires_at: '2030-10-20T00:00:00.000Z', // illegally extended
      },
    }

    const result = verifyOfflineLicense({
      license: tampered,
      publicKey: keyPair.publicKey,
      workspaceId,
      deviceId,
      now: '2026-11-01T12:00:00.000Z',
    })

    expect(result.valid).toBe(false)
    expect(result.verdict).toBe('TAMPERED')
  })

  it('tampered byte in signature returns TAMPERED verdict', () => {
    const signed = signOfflineLicense(basePayload, keyPair.secretKey, 'v1')
    // Flip one hex character in the 128-char signature
    const corruptedSig =
      signed.signature.slice(0, 10) +
      (signed.signature[10] === 'a' ? 'b' : 'a') +
      signed.signature.slice(11)

    const tampered = {
      ...signed,
      signature: corruptedSig,
    }

    const result = verifyOfflineLicense({
      license: tampered,
      publicKey: keyPair.publicKey,
      workspaceId,
      deviceId,
      now: '2026-11-01T12:00:00.000Z',
    })

    expect(result.valid).toBe(false)
    expect(result.verdict).toBe('TAMPERED')
  })

  it('clock moved backwards returns CLOCK_ROLLED_BACK verdict', () => {
    const signed = signOfflineLicense(basePayload, keyPair.secretKey, 'v1')
    // Device meta records having seen 2026-12-01, but current clock says 2026-11-01
    const result = verifyOfflineLicense({
      license: signed,
      publicKey: keyPair.publicKey,
      workspaceId,
      deviceId,
      now: '2026-11-01T12:00:00.000Z',
      highestSeenAt: '2026-12-01T12:00:00.000Z', // 30 days in future
    })

    expect(result.valid).toBe(false)
    expect(result.verdict).toBe('CLOCK_ROLLED_BACK')
  })

  it('clock moved back past expiry cannot extend licence (effective time governs)', () => {
    const signed = signOfflineLicense(basePayload, keyPair.secretKey, 'v1')
    // Highest seen was 2027-11-01 (licence expired on 2027-10-20).
    // Cheater moves device clock back to 2026-11-01.
    const result = verifyOfflineLicense({
      license: signed,
      publicKey: keyPair.publicKey,
      workspaceId,
      deviceId,
      now: '2026-11-01T12:00:00.000Z',
      highestSeenAt: '2027-11-01T00:00:00.000Z',
    })

    // Rolled back clock is detected immediately
    expect(result.valid).toBe(false)
    expect(result.verdict).toBe('CLOCK_ROLLED_BACK')
  })

  it('missing hardware key / TPM still activates and verifies (Contract §6)', () => {
    const signed = signOfflineLicense(basePayload, keyPair.secretKey, 'v1')
    const result = verifyOfflineLicense({
      license: signed,
      publicKey: keyPair.publicKey,
      workspaceId,
      deviceId,
      now: '2026-11-01T12:00:00.000Z',
      hardwareKeyPresent: false, // TPM not present or disabled
    })

    expect(result.valid).toBe(true)
    expect(result.verdict).toBe('VALID')
  })

  it('revoked licence returns REVOKED verdict', () => {
    const signed = signOfflineLicense(basePayload, keyPair.secretKey, 'v1')
    const result = verifyOfflineLicense({
      license: signed,
      publicKey: keyPair.publicKey,
      workspaceId,
      deviceId,
      now: '2026-11-01T12:00:00.000Z',
      revokedLicenseIds: [licenseId, 'other-revoked-uuid'],
    })

    expect(result.valid).toBe(false)
    expect(result.verdict).toBe('REVOKED')
  })

  it('supports key rotation with key map', () => {
    const oldKey = generateOfflineLicenseKeyPair()
    const newKey = generateOfflineLicenseKeyPair()
    const keyMap = {
      v1: oldKey.publicKeyHex,
      v2: newKey.publicKeyHex,
    }

    const signedV1 = signOfflineLicense(basePayload, oldKey.secretKey, 'v1')
    const signedV2 = signOfflineLicense(basePayload, newKey.secretKey, 'v2')

    // Both verify against the key map
    expect(
      verifyOfflineLicense({
        license: signedV1,
        publicKey: keyMap,
        workspaceId,
        deviceId,
        now: '2026-11-01T12:00:00.000Z',
      }).valid,
    ).toBe(true)

    expect(
      verifyOfflineLicense({
        license: signedV2,
        publicKey: keyMap,
        workspaceId,
        deviceId,
        now: '2026-11-01T12:00:00.000Z',
      }).valid,
    ).toBe(true)

    // Tampering key_id to an unknown key fails
    const tamperedKey = {
      ...signedV1,
      key_id: 'unknown-key',
    }
    expect(
      verifyOfflineLicense({
        license: tamperedKey,
        publicKey: keyMap,
        workspaceId,
        deviceId,
      }).verdict,
    ).toBe('TAMPERED')
  })

  it('canonicalizeJson produces deterministic sorting regardless of property order', () => {
    const objA = { z: 1, a: 2, m: [3, { b: 4, a: 5 }] }
    const objB = { m: [3, { a: 5, b: 4 }], a: 2, z: 1 }

    expect(canonicalizeJson(objA)).toBe(canonicalizeJson(objB))
  })

  it('hex helpers roundtrip correctly', () => {
    const raw = new Uint8Array([0, 15, 16, 255, 128])
    const hex = bytesToHex(raw)
    expect(hex).toBe('000f10ff80')
    expect(hexToBytes(hex)).toEqual(raw)
  })

  it('banned licence returns BANNED verdict', () => {
    const signed = signOfflineLicense(basePayload, keyPair.secretKey, 'v1')
    const result = verifyOfflineLicense({
      license: signed,
      publicKey: keyPair.publicKey,
      workspaceId,
      deviceId,
      now: '2026-11-01T12:00:00.000Z',
      isBanned: true,
    })

    expect(result.valid).toBe(false)
    expect(result.verdict).toBe('BANNED')
    expect(result.reason).toContain('permanently banned')
  })

  it('seats are modeled as computer | mobile, not OS', async () => {
    const { deviceSeatSchema } = await import('../schemas/offline-license')
    expect(deviceSeatSchema.safeParse('computer').success).toBe(true)
    expect(deviceSeatSchema.safeParse('mobile').success).toBe(true)
    expect(deviceSeatSchema.safeParse('windows').success).toBe(false)
    expect(deviceSeatSchema.safeParse('android').success).toBe(false)
    expect(deviceSeatSchema.safeParse('ios').success).toBe(false)
    expect(deviceSeatSchema.safeParse('macos').success).toBe(false)
  })

  it('banned offline state preserves read/export/print while locking operational writes', async () => {
    const { resolveEntitlement } = await import('../schemas/entitlement-resolver')

    // Always-allowed features (backup, print, reports) remain AVAILABLE
    const exportVerdict = resolveEntitlement(
      { state: 'OFFLINE_BANNED', plan: 'OFFLINE', edition: 'local' },
      'data.backup',
    )
    expect(exportVerdict).toEqual({ kind: 'AVAILABLE' })

    const printVerdict = resolveEntitlement(
      { state: 'OFFLINE_BANNED', plan: 'OFFLINE', edition: 'local' },
      'invoice.print',
    )
    expect(printVerdict).toEqual({ kind: 'AVAILABLE' })

    // Operational write features (invoice.create) are NOT_ENTITLED
    const writeVerdict = resolveEntitlement(
      { state: 'OFFLINE_BANNED', plan: 'OFFLINE', edition: 'local' },
      'invoice.create',
    )
    expect(writeVerdict).toEqual({ kind: 'NOT_ENTITLED' })
  })
})
