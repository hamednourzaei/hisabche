/**
 * RFC 8785 deterministic canonical JSON serializer and TUF-style signed envelope
 * verifier with expiry, clock-skew tolerance, and monotonic sequence protection.
 */

import type { Clock, SecureStore, Verifier } from './ports'

function canonicalizeValue(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('CANONICAL_JSON_NON_FINITE_NUMBER')
    }
    return Object.is(value, -0) ? '0' : JSON.stringify(value)
  }
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? 'null' : canonicalizeValue(item))).join(',')}]`
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record)
      .filter((k) => record[k] !== undefined)
      .sort()
    const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalizeValue(record[k])}`)
    return `{${pairs.join(',')}}`
  }
  throw new Error(`CANONICAL_JSON_UNSUPPORTED_TYPE:${typeof value}`)
}

export function canonicalJsonStringify(value: unknown): string {
  return canonicalizeValue(value)
}

export function canonicalJsonBytes(value: unknown): Uint8Array {
  const str = canonicalJsonStringify(value)
  return new TextEncoder().encode(str)
}

export type TufRole = 'root' | 'targets' | 'snapshot' | 'timestamp'

export interface SignatureMetadata {
  role: TufRole
  keyId: string
  algorithm: 'ed25519'
  sigBase64: string
  sequence: number
  signedAt: string
  expiresAt: string
}

export type EnvelopeVerifyResult =
  | { ok: true; sequence: number; clockSkewWarning: boolean }
  | {
      ok: false
      code:
        | 'KEY_NOT_FOUND_OR_REVOKED'
        | 'SIGNATURE_INVALID'
        | 'METADATA_EXPIRED'
        | 'METADATA_NOT_YET_VALID'
        | 'SEQUENCE_REPLAY_OR_DOWNGRADE'
        | 'INVALID_TIMESTAMP'
    }

export const DEFAULT_CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000

export async function verifySignedPayload(input: {
  layer: string
  payloadWithoutSignature: Record<string, unknown>
  signature: SignatureMetadata
  secureStore: SecureStore
  verifier: Verifier
  clock: Clock
  serverTimeMs?: number | undefined
  clockSkewToleranceMs?: number | undefined
}): Promise<EnvelopeVerifyResult> {
  const keys = await input.secureStore.getTrustedKeys()
  const key = keys.find((k) => k.keyId === input.signature.keyId && !k.revoked)
  if (!key) {
    return { ok: false, code: 'KEY_NOT_FOUND_OR_REVOKED' }
  }

  const canonical = canonicalJsonBytes({
    ...input.payloadWithoutSignature,
    signatureMeta: {
      role: input.signature.role,
      keyId: input.signature.keyId,
      algorithm: input.signature.algorithm,
      sequence: input.signature.sequence,
      signedAt: input.signature.signedAt,
      expiresAt: input.signature.expiresAt,
    },
  })

  const validSig = await input.verifier.verifyEd25519(
    canonical,
    input.signature.sigBase64,
    key.publicKeyPem,
  )
  if (!validSig) {
    return { ok: false, code: 'SIGNATURE_INVALID' }
  }

  const signedAtMs = Date.parse(input.signature.signedAt)
  const expiresAtMs = Date.parse(input.signature.expiresAt)
  if (!Number.isFinite(signedAtMs) || !Number.isFinite(expiresAtMs) || expiresAtMs <= signedAtMs) {
    return { ok: false, code: 'INVALID_TIMESTAMP' }
  }

  const localNowMs = input.clock.nowMs()
  const tolerance = input.clockSkewToleranceMs ?? DEFAULT_CLOCK_SKEW_TOLERANCE_MS
  const effectiveNowMs =
    input.serverTimeMs !== undefined && Number.isFinite(input.serverTimeMs)
      ? input.serverTimeMs
      : localNowMs
  const clockSkewWarning =
    input.serverTimeMs !== undefined && Math.abs(input.serverTimeMs - localNowMs) > tolerance

  if (effectiveNowMs > expiresAtMs + tolerance) {
    return { ok: false, code: 'METADATA_EXPIRED' }
  }
  if (effectiveNowMs + tolerance < signedAtMs) {
    return { ok: false, code: 'METADATA_NOT_YET_VALID' }
  }

  const lastSeq = await input.secureStore.getSequence(input.layer)
  if (input.signature.sequence <= lastSeq) {
    return { ok: false, code: 'SEQUENCE_REPLAY_OR_DOWNGRADE' }
  }

  return { ok: true, sequence: input.signature.sequence, clockSkewWarning }
}
