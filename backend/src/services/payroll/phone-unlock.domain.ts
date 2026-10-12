// ============================================
// backend/src/services/payroll/phone-unlock.domain.ts
//
// «Confirmed by the phone's own lock» — the checks, with no I/O.
//
// The phone holds a private key it only uses after its owner unlocks it
// (fingerprint, face, or the phone's PIN — the phone decides which). It gives
// us the PUBLIC half once, and afterwards signs each submission. This file
// answers one question: was THIS submission signed by THAT key, on one of our
// pages, after the phone's owner was verified?
//
// ⚠️ WHAT THIS IS NOT. No fingerprint or face reaches the server, so nothing
// here recognises a person. It proves «the registered phone, unlocked» —
// whoever registered it first is whom it vouches for. Registration is
// trust-on-first-use: the key is taken as given (no attestation is checked).
// ============================================

import { createHash, createPublicKey, verify, type KeyObject } from 'node:crypto'

import { UNLOCK_ALGORITHMS, type UnlockAlgorithm } from '@hisabche/validation'

export type UnlockProblem =
  | 'ATTENDANCE_UNLOCK_MALFORMED'
  | 'ATTENDANCE_UNLOCK_WRONG_CEREMONY'
  | 'ATTENDANCE_UNLOCK_CHALLENGE_MISMATCH'
  | 'ATTENDANCE_UNLOCK_ORIGIN_NOT_ALLOWED'
  | 'ATTENDANCE_UNLOCK_NOT_VERIFIED'
  | 'ATTENDANCE_UNLOCK_KEY_UNSUPPORTED'
  | 'ATTENDANCE_UNLOCK_SIGNATURE_INVALID'

const BASE64URL = /^[A-Za-z0-9_-]+$/

export function fromBase64Url(value: unknown, maxBytes: number): Buffer | null {
  if (typeof value !== 'string' || value.length === 0 || !BASE64URL.test(value)) return null
  if (value.length > Math.ceil((maxBytes * 4) / 3) + 4) return null
  const bytes = Buffer.from(value, 'base64url')
  return bytes.length > 0 && bytes.length <= maxBytes ? bytes : null
}

/** The challenge a message stands for: base64url(SHA-256(message)). */
export function challengeOf(message: string): string {
  return createHash('sha256').update(message, 'utf8').digest('base64url')
}

export function isUnlockAlgorithm(value: unknown): value is UnlockAlgorithm {
  return (UNLOCK_ALGORITHMS as readonly unknown[]).includes(value)
}

/** The key as node reads it — or null when it is not the kind it claims to be. */
export function readPublicKey(spki: Buffer, algorithm: UnlockAlgorithm): KeyObject | null {
  let key: KeyObject
  try {
    key = createPublicKey({ key: spki, format: 'der', type: 'spki' })
  } catch {
    return null
  }
  if (algorithm === -7) {
    return key.asymmetricKeyType === 'ec' && key.asymmetricKeyDetails?.namedCurve === 'prime256v1'
      ? key
      : null
  }
  return key.asymmetricKeyType === 'rsa' && (key.asymmetricKeyDetails?.modulusLength ?? 0) >= 2048
    ? key
    : null
}

interface Ceremony {
  kind: 'webauthn.create' | 'webauthn.get'
  clientDataJSON: Buffer
  authenticatorData: Buffer
  /** What the phone must have signed over. */
  challenge: string
  /** The pages that are ours. */
  origins: readonly string[]
}

const USER_PRESENT = 0x01
const USER_VERIFIED = 0x04

/**
 * The part common to registering and signing: the browser's own account of
 * what it did (`clientDataJSON`) and the authenticator's (`authenticatorData`).
 */
function checkCeremony(input: Ceremony): { origin: string } | { problem: UnlockProblem } {
  let client: { type?: unknown; challenge?: unknown; origin?: unknown }
  try {
    client = JSON.parse(input.clientDataJSON.toString('utf8')) as typeof client
  } catch {
    return { problem: 'ATTENDANCE_UNLOCK_MALFORMED' }
  }
  if (!client || typeof client !== 'object') return { problem: 'ATTENDANCE_UNLOCK_MALFORMED' }
  if (client.type !== input.kind) return { problem: 'ATTENDANCE_UNLOCK_WRONG_CEREMONY' }
  if (client.challenge !== input.challenge) {
    return { problem: 'ATTENDANCE_UNLOCK_CHALLENGE_MISMATCH' }
  }
  if (typeof client.origin !== 'string' || !input.origins.includes(client.origin)) {
    return { problem: 'ATTENDANCE_UNLOCK_ORIGIN_NOT_ALLOWED' }
  }

  // rpIdHash (32) · flags (1) · signCount (4) · …
  if (input.authenticatorData.length < 37) return { problem: 'ATTENDANCE_UNLOCK_MALFORMED' }
  // The key is bound to the host of the page it was made on. The page asks
  // for exactly its own host, so anything else was made somewhere else.
  const host = new URL(client.origin).hostname
  const expected = createHash('sha256').update(host, 'utf8').digest()
  if (!expected.equals(input.authenticatorData.subarray(0, 32))) {
    return { problem: 'ATTENDANCE_UNLOCK_ORIGIN_NOT_ALLOWED' }
  }
  const flags = input.authenticatorData[32] ?? 0
  // Present is a tap; VERIFIED is the fingerprint, face or PIN. Both, always.
  if ((flags & USER_PRESENT) === 0 || (flags & USER_VERIFIED) === 0) {
    return { problem: 'ATTENDANCE_UNLOCK_NOT_VERIFIED' }
  }
  return { origin: client.origin }
}

export interface EnrollmentInput {
  clientDataJSON: Buffer
  authenticatorData: Buffer
  publicKey: Buffer
  algorithm: unknown
  challenge: string
  origins: readonly string[]
}

export function verifyEnrollment(
  input: EnrollmentInput,
): { ok: true; algorithm: UnlockAlgorithm } | { ok: false; problem: UnlockProblem } {
  if (!isUnlockAlgorithm(input.algorithm)) {
    return { ok: false, problem: 'ATTENDANCE_UNLOCK_KEY_UNSUPPORTED' }
  }
  if (!readPublicKey(input.publicKey, input.algorithm)) {
    return { ok: false, problem: 'ATTENDANCE_UNLOCK_KEY_UNSUPPORTED' }
  }
  const ceremony = checkCeremony({ ...input, kind: 'webauthn.create' })
  if ('problem' in ceremony) return { ok: false, problem: ceremony.problem }
  return { ok: true, algorithm: input.algorithm }
}

export interface AssertionInput {
  clientDataJSON: Buffer
  authenticatorData: Buffer
  signature: Buffer
  publicKey: Buffer
  algorithm: number
  challenge: string
  origins: readonly string[]
}

export function verifyAssertion(
  input: AssertionInput,
): { ok: true } | { ok: false; problem: UnlockProblem } {
  if (!isUnlockAlgorithm(input.algorithm)) {
    return { ok: false, problem: 'ATTENDANCE_UNLOCK_KEY_UNSUPPORTED' }
  }
  const key = readPublicKey(input.publicKey, input.algorithm)
  if (!key) return { ok: false, problem: 'ATTENDANCE_UNLOCK_KEY_UNSUPPORTED' }

  const ceremony = checkCeremony({ ...input, kind: 'webauthn.get' })
  if ('problem' in ceremony) return { ok: false, problem: ceremony.problem }

  // The authenticator signs its own data followed by the hash of the browser's.
  const signed = Buffer.concat([
    input.authenticatorData,
    createHash('sha256').update(input.clientDataJSON).digest(),
  ])
  let good = false
  try {
    good = verify('sha256', signed, key, input.signature)
  } catch {
    good = false
  }
  return good ? { ok: true } : { ok: false, problem: 'ATTENDANCE_UNLOCK_SIGNATURE_INVALID' }
}
