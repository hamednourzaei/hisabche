// ============================================
// packages/validation/src/schemas/offline-license.ts
// Offline Licence Payload, Signing & Verification (Ed25519)
// Pure JS via @noble/curves — operates identically in Node, Web, Electron & Hermes (Android)
// ============================================

import { z } from 'zod'
import { ed25519 } from '@noble/curves/ed25519.js'

export const offlineLicensePayloadSchema = z.object({
  license_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  account_id: z.string().uuid(),
  plan: z.string().min(1),
  issued_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  device_id: z.string().uuid(),
  features: z.array(z.string()),
  version: z.number().int().positive(),
  key_id: z.string().optional(),
})

export type OfflineLicensePayload = z.infer<typeof offlineLicensePayloadSchema>

export const signedOfflineLicenseSchema = z.object({
  payload: offlineLicensePayloadSchema,
  signature: z
    .string()
    .regex(/^[0-9a-f]{128}$/i, 'Signature must be a 64-byte hex string (128 hex chars)'),
  key_id: z.string().optional(),
})

export type SignedOfflineLicense = z.infer<typeof signedOfflineLicenseSchema>

export type DeviceSeat = 'computer' | 'mobile'
export const deviceSeatSchema = z.enum(['computer', 'mobile'])

export type LicenseStatus = 'active' | 'revoked' | 'banned'

export type Tier1EvidenceType =
  | 'unregistered_device_key'
  | 'invalid_signature'
  | 'seat_key_collision'
  | 'tampered_app_integrity'
  // Not cryptographic: an admin reviewed tier-2 signals and confirmed the abuse.
  | 'admin_confirmed_review'

export type Tier2SignalType =
  | 'two_business_identities'
  | 'parallel_invoice_sequences'
  | 'disparate_cities'
  // A device said it saw a tier-1 violation. A claim for a person to review, never a ban.
  | 'device_self_report'

export type LicenseVerdict =
  | 'VALID'
  | 'EXPIRED'
  | 'WRONG_WORKSPACE'
  | 'WRONG_DEVICE'
  | 'TAMPERED'
  | 'REVOKED'
  | 'CLOCK_ROLLED_BACK'
  | 'BANNED'

export interface VerifyLicenseOptions {
  license: SignedOfflineLicense
  publicKey: Uint8Array | string | Record<string, Uint8Array | string>
  workspaceId?: string | undefined
  deviceId?: string | undefined
  now?: string | Date | number | undefined
  highestSeenAt?: string | Date | number | null | undefined
  revokedLicenseIds?: Iterable<string> | undefined
  bannedLicenseIds?: Iterable<string> | undefined
  isBanned?: boolean | undefined
  clockSkewToleranceMs?: number | undefined
  hardwareKeyPresent?: boolean | undefined
}

export interface VerifyLicenseResult {
  verdict: LicenseVerdict
  valid: boolean
  reason?: string | undefined
  payload?: OfflineLicensePayload | undefined
}

/** Converts bytes to a lowercase hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!
    hex += (b < 16 ? '0' : '') + b.toString(16)
  }
  return hex
}

/** Parses a hex string into a Uint8Array. Throws on invalid input. */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/i, '')
  if (clean.length % 2 !== 0) {
    throw new Error('Hex string must have an even length')
  }
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    const byte = parseInt(clean.substring(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) {
      throw new Error(`Invalid hex character in '${clean}'`)
    }
    bytes[i] = byte
  }
  return bytes
}

/**
 * Deterministic JSON serialization:
 * - Keys sorted alphabetically at every object depth
 * - Skips undefined object properties
 * - Leaves numbers, booleans, strings and arrays in canonical form
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return '[' + value.map((item) => canonicalizeJson(item)).join(',') + ']'
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  const pairs: string[] = []
  for (const k of keys) {
    if (obj[k] !== undefined) {
      pairs.push(`${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`)
    }
  }
  return '{' + pairs.join(',') + '}'
}

/** Serializes an offline licence payload into its deterministic canonical representation. */
export function canonicalizeLicensePayload(payload: OfflineLicensePayload): string {
  return canonicalizeJson(payload)
}

/** Generates a fresh Ed25519 keypair for offline licence signing and verification. */
export function generateOfflineLicenseKeyPair(): {
  secretKeyHex: string
  publicKeyHex: string
  secretKey: Uint8Array
  publicKey: Uint8Array
} {
  const { secretKey, publicKey } = ed25519.keygen()
  return {
    secretKeyHex: bytesToHex(secretKey),
    publicKeyHex: bytesToHex(publicKey),
    secretKey,
    publicKey,
  }
}

/**
 * Signs an offline licence payload using Ed25519.
 * If keyId is provided, it is attached to the payload (and envelope) before signing,
 * ensuring the key_id is cryptographically protected against modification.
 */
export function signOfflineLicense(
  payload: OfflineLicensePayload,
  secretKey: Uint8Array | string,
  keyId?: string | undefined,
): SignedOfflineLicense {
  const secretKeyBytes = typeof secretKey === 'string' ? hexToBytes(secretKey) : secretKey
  const effectiveKeyId = keyId ?? payload.key_id
  const payloadToSign: OfflineLicensePayload = {
    ...payload,
    ...(effectiveKeyId ? { key_id: effectiveKeyId } : {}),
  }

  const canonicalString = canonicalizeLicensePayload(payloadToSign)
  const messageBytes = new TextEncoder().encode(canonicalString)
  const sigBytes = ed25519.sign(messageBytes, secretKeyBytes)
  const signatureHex = bytesToHex(sigBytes)

  return {
    payload: payloadToSign,
    signature: signatureHex,
    ...(effectiveKeyId ? { key_id: effectiveKeyId } : {}),
  }
}

function resolvePublicKeyBytes(
  keySpec: Uint8Array | string | Record<string, Uint8Array | string>,
  keyId?: string | undefined,
): Uint8Array | null {
  try {
    if (keySpec instanceof Uint8Array) {
      return keySpec.length === 32 ? keySpec : null
    }
    if (typeof keySpec === 'string') {
      const bytes = hexToBytes(keySpec)
      return bytes.length === 32 ? bytes : null
    }
    if (typeof keySpec === 'object' && keySpec !== null) {
      const id = keyId ?? 'default'
      const match = keySpec[id]
      if (!match) return null
      return resolvePublicKeyBytes(match)
    }
    return null
  } catch {
    return null
  }
}

/**
 * Verifies the cryptographic Ed25519 signature of a signed offline licence.
 * Returns true if valid, false if signature fails, key is not found, or payload is corrupt.
 */
export function verifyOfflineLicenseSignature(
  license: SignedOfflineLicense,
  publicKey: Uint8Array | string | Record<string, Uint8Array | string>,
): boolean {
  try {
    const keyId = license.key_id ?? license.payload.key_id
    const pubKeyBytes = resolvePublicKeyBytes(publicKey, keyId)
    if (!pubKeyBytes) return false

    const sigBytes = hexToBytes(license.signature)
    if (sigBytes.length !== 64) return false

    const canonicalString = canonicalizeLicensePayload(license.payload)
    const msgBytes = new TextEncoder().encode(canonicalString)

    return ed25519.verify(sigBytes, msgBytes, pubKeyBytes)
  } catch {
    return false
  }
}

/**
 * Pure verification function for offline licences across all platforms.
 *
 * Checks in order:
 * 1. Schema & Cryptographic signature (Tamper check)
 * 2. Revocation status
 * 3. System clock rollback (against highest seen timestamp)
 * 4. Licence expiration
 * 5. Workspace binding
 * 6. Device binding
 * (TPM/Hardware key is optional hardening per Contract §6 and does not lock out).
 */
export function verifyOfflineLicense(options: VerifyLicenseOptions): VerifyLicenseResult {
  const { license, publicKey } = options

  // 1. Check structural validity and cryptographic signature
  const parsed = signedOfflineLicenseSchema.safeParse(license)
  if (!parsed.success) {
    return {
      verdict: 'TAMPERED',
      valid: false,
      reason: `Malformed licence structure: ${parsed.error.issues[0]?.message ?? 'invalid schema'}`,
    }
  }

  const signatureOk = verifyOfflineLicenseSignature(license, publicKey)
  if (!signatureOk) {
    return {
      verdict: 'TAMPERED',
      valid: false,
      reason: 'Cryptographic signature mismatch or tampered payload',
    }
  }

  const { payload } = license

  // 2. Revocation check
  if (options.revokedLicenseIds) {
    const revokedSet =
      options.revokedLicenseIds instanceof Set
        ? options.revokedLicenseIds
        : new Set(options.revokedLicenseIds)
    if (revokedSet.has(payload.license_id)) {
      return {
        verdict: 'REVOKED',
        valid: false,
        reason: 'Licence has been revoked by workspace administrator',
        payload,
      }
    }
  }

  // 2b. Ban check (Tier 1 cryptographic policy violation ban)
  if (options.isBanned === true) {
    return {
      verdict: 'BANNED',
      valid: false,
      reason:
        'Licence is permanently banned due to cryptographic policy violation. Read, print, backup and export remain available.',
      payload,
    }
  }

  if (options.bannedLicenseIds) {
    const bannedSet =
      options.bannedLicenseIds instanceof Set
        ? options.bannedLicenseIds
        : new Set(options.bannedLicenseIds)
    if (bannedSet.has(payload.license_id)) {
      return {
        verdict: 'BANNED',
        valid: false,
        reason:
          'Licence is permanently banned due to cryptographic policy violation. Read, print, backup and export remain available.',
        payload,
      }
    }
  }

  // 3. System clock rollback check
  const toleranceMs = options.clockSkewToleranceMs ?? 60_000 // 1 minute tolerance
  const nowMs = new Date(options.now ?? Date.now()).getTime()
  if (Number.isNaN(nowMs)) {
    return {
      verdict: 'TAMPERED',
      valid: false,
      reason: 'Invalid clock timestamp provided',
      payload,
    }
  }

  if (options.highestSeenAt != null) {
    const highestSeenMs = new Date(options.highestSeenAt).getTime()
    if (!Number.isNaN(highestSeenMs) && highestSeenMs > 0) {
      if (nowMs < highestSeenMs - toleranceMs) {
        return {
          verdict: 'CLOCK_ROLLED_BACK',
          valid: false,
          reason: 'System clock has been moved backwards relative to highest recorded time',
          payload,
        }
      }
    }
  }

  // 4. Expiration check (using highestSeen if available to prevent clock cheating)
  const effectiveNowMs =
    options.highestSeenAt != null
      ? Math.max(nowMs, new Date(options.highestSeenAt).getTime() || 0)
      : nowMs

  const expiresAtMs = new Date(payload.expires_at).getTime()
  if (Number.isNaN(expiresAtMs) || effectiveNowMs >= expiresAtMs) {
    return {
      verdict: 'EXPIRED',
      valid: false,
      reason: 'Licence period has expired',
      payload,
    }
  }

  // 5. Workspace binding check
  if (options.workspaceId && payload.workspace_id !== options.workspaceId) {
    return {
      verdict: 'WRONG_WORKSPACE',
      valid: false,
      reason: `Licence belongs to workspace ${payload.workspace_id}, not current workspace ${options.workspaceId}`,
      payload,
    }
  }

  // 6. Device binding check
  if (options.deviceId && payload.device_id && payload.device_id !== options.deviceId) {
    return {
      verdict: 'WRONG_DEVICE',
      valid: false,
      reason: `Licence is activated for device ${payload.device_id}, not current device ${options.deviceId}`,
      payload,
    }
  }

  // Hardware key presence is optional per contract §6 (TPM / Android Keystore is optional hardening)
  // If hardwareKeyPresent === false, it still verifies and activates!

  return {
    verdict: 'VALID',
    valid: true,
    payload,
  }
}
