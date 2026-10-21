// The licence the admin copies is the licence the device accepts — and a key
// pair made by scripts/generate-offline-licence-keys.mjs (node:crypto) signs
// and verifies with the same functions the server and the app use.
import { generateKeyPairSync, randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  bytesToHex,
  encodeLicenseCode,
  parseLicenseCode,
  signOfflineLicense,
  verifyOfflineLicense,
  type OfflineLicensePayload,
} from '../index'

function keyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  return {
    secret: new Uint8Array(privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32)),
    publicHex: bytesToHex(
      new Uint8Array(publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)),
    ),
  }
}

function payload(deviceId: string): OfflineLicensePayload {
  const now = Date.now()
  return {
    license_id: randomUUID(),
    workspace_id: randomUUID(),
    account_id: randomUUID(),
    plan: 'OFFLINE',
    issued_at: new Date(now).toISOString(),
    expires_at: new Date(now + 365 * 86_400_000).toISOString(),
    device_id: deviceId,
    features: ['invoice.create'],
    version: 1,
    key_id: 'v1',
  }
}

describe('licence code', () => {
  it('round-trips and verifies for its own device', () => {
    const keys = keyPair()
    const device = randomUUID()
    const code = encodeLicenseCode(signOfflineLicense(payload(device), keys.secret, 'v1'))

    expect(code.startsWith('HSB1.')).toBe(true)
    // Pasted with line breaks and spaces, as a chat app delivers it.
    const parsed = parseLicenseCode(`  ${code.slice(0, 20)}\n${code.slice(20)}  `)
    expect(parsed).not.toBeNull()
    const result = verifyOfflineLicense({
      license: parsed!,
      publicKey: keys.publicHex,
      deviceId: device,
    })
    expect(result.verdict).toBe('VALID')
  })

  it('is refused on another device', () => {
    const keys = keyPair()
    const code = encodeLicenseCode(signOfflineLicense(payload(randomUUID()), keys.secret, 'v1'))
    const result = verifyOfflineLicense({
      license: parseLicenseCode(code)!,
      publicKey: keys.publicHex,
      deviceId: randomUUID(),
    })
    expect(result.verdict).toBe('WRONG_DEVICE')
  })

  it('is refused under another key pair', () => {
    const code = encodeLicenseCode(
      signOfflineLicense(payload(randomUUID()), keyPair().secret, 'v1'),
    )
    const result = verifyOfflineLicense({
      license: parseLicenseCode(code)!,
      publicKey: keyPair().publicHex,
    })
    expect(result.verdict).toBe('TAMPERED')
  })

  it('is not a code when it is not one', () => {
    expect(parseLicenseCode('hello')).toBeNull()
    expect(parseLicenseCode('HSB1.not-base64-json')).toBeNull()
  })
})
