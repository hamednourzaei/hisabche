// ============================================
// backend/src/middleware/jwt-verifier.ts
//
// Standalone Local JWT Verification Engine
// Cryptographically verifies GoTrue / Supabase / Keycloak JWT tokens locally
// using Node's native crypto (HS256/HS384/HS512 + RS256/ES256) with strict
// RFC 7519 claim validation (sub, exp, nbf, iat, iss, aud) and algorithm
// confusion protection, without making any network round-trip.
// ============================================

import { createHmac, createVerify, timingSafeEqual } from 'node:crypto'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export type SupportedJwtAlgorithm = 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'ES256'

export interface DecodedJwtPayload {
  sub: string
  email?: string | undefined
  role?: string | undefined
  exp?: number | undefined
  nbf?: number | undefined
  iat?: number | undefined
  iss?: string | undefined
  aud?: string | string[] | undefined
  app_metadata?: Record<string, unknown> | undefined
  user_metadata?: Record<string, unknown> | undefined
}

export interface LocalJwtVerifyOptions {
  /** PEM-encoded SPKI public key (or certificate) for RS256/ES256 verification. */
  publicKeyPem?: string | undefined
  /** Explicit allow-list of algorithms accepted by the verifier. */
  allowedAlgorithms?: readonly SupportedJwtAlgorithm[] | undefined
  /** Required issuer (`iss`). If set, missing or mismatched `iss` fails closed. */
  expectedIssuer?: string | readonly string[] | undefined
  /** Required audience (`aud`). If set, missing or mismatched `aud` fails closed. */
  expectedAudience?: string | readonly string[] | undefined
  /** Optional clock skew tolerance in seconds (default 0). */
  clockSkewSeconds?: number | undefined
  /** Optional current epoch override in seconds (primarily for deterministic testing). */
  nowSeconds?: number | undefined
}

export interface JwtVerificationResult {
  valid: boolean
  payload: DecodedJwtPayload | null
  algorithm?: SupportedJwtAlgorithm | undefined
  error?: string | undefined
}

const HMAC_ALGORITHMS = new Set<string>(['HS256', 'HS384', 'HS512'])
const ASYMMETRIC_ALGORITHMS = new Set<string>(['RS256', 'ES256'])

export function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return Buffer.from(base64, 'base64').toString('utf8')
}

export function base64UrlDecodeBytes(str: string): Buffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return Buffer.from(base64, 'base64')
}

export function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function matchesClaimValue(
  actual: string | string[] | undefined,
  expected: string | readonly string[],
): boolean {
  const expectedList = Array.isArray(expected) ? expected : [expected]
  if (typeof actual === 'string') {
    return expectedList.includes(actual)
  }
  if (Array.isArray(actual)) {
    return actual.some((entry) => typeof entry === 'string' && expectedList.includes(entry))
  }
  return false
}

function verifyHmacSignature(
  alg: 'HS256' | 'HS384' | 'HS512',
  signingInput: string,
  signatureB64: string,
  secret: string,
): boolean {
  // Reject public-key PEM strings passed as an HMAC secret (alg confusion attack).
  if (
    secret.includes('-----BEGIN PUBLIC KEY-----') ||
    secret.includes('-----BEGIN CERTIFICATE-----')
  ) {
    return false
  }
  const digestAlg = alg === 'HS256' ? 'sha256' : alg === 'HS384' ? 'sha384' : 'sha512'
  const expectedHmac = createHmac(digestAlg, secret).update(signingInput).digest()
  const expectedSignatureB64 = base64UrlEncode(expectedHmac)

  const sigBuffer = Buffer.from(signatureB64)
  const expectedSigBuffer = Buffer.from(expectedSignatureB64)
  return (
    sigBuffer.length === expectedSigBuffer.length && timingSafeEqual(sigBuffer, expectedSigBuffer)
  )
}

function verifyAsymmetricSignature(
  alg: 'RS256' | 'ES256',
  signingInput: string,
  signatureB64: string,
  publicKeyPem: string,
): boolean {
  const signatureBytes = base64UrlDecodeBytes(signatureB64)
  if (alg === 'RS256') {
    return createVerify('RSA-SHA256').update(signingInput).verify(publicKeyPem, signatureBytes)
  }
  // JWS ES256 encodes signature in IEEE P1363 raw format (64 bytes r||s).
  return createVerify('SHA256')
    .update(signingInput)
    .verify({ key: publicKeyPem, dsaEncoding: 'ieee-p1363' }, signatureBytes)
}

/**
 * Locally verifies a JWT signature and mandatory security claims (`sub`, `exp`,
 * `nbf`, `iat`, optional `iss`/`aud`) without making any network round-trip.
 */
export function verifyJwtSignatureLocally(
  token: string,
  secretOrEmpty: string,
  options: LocalJwtVerifyOptions = {},
): JwtVerificationResult {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return { valid: false, payload: null, error: 'Malformed JWT: must have 3 segments' }
  }

  const [headerB64, payloadB64, signatureB64] = parts
  if (!headerB64 || !payloadB64 || !signatureB64) {
    return { valid: false, payload: null, error: 'Malformed JWT segments' }
  }

  let header: { alg?: unknown; typ?: unknown }
  let payload: DecodedJwtPayload
  try {
    header = JSON.parse(base64UrlDecode(headerB64)) as { alg?: unknown; typ?: unknown }
    payload = JSON.parse(base64UrlDecode(payloadB64)) as DecodedJwtPayload
  } catch {
    return { valid: false, payload: null, error: 'Invalid JSON in JWT header or payload' }
  }

  if (!header || typeof header !== 'object' || typeof header.alg !== 'string') {
    return { valid: false, payload: null, error: 'Missing JWT algorithm header' }
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, payload: null, error: 'Invalid JWT payload object' }
  }

  const alg = header.alg
  if (!HMAC_ALGORITHMS.has(alg) && !ASYMMETRIC_ALGORITHMS.has(alg)) {
    return {
      valid: false,
      payload: null,
      error: `Unsupported JWT algorithm: ${alg}.`,
    }
  }
  const typedAlg = alg as SupportedJwtAlgorithm

  if (options.allowedAlgorithms && !options.allowedAlgorithms.includes(typedAlg)) {
    return {
      valid: false,
      payload: null,
      error: `Disallowed JWT algorithm: ${typedAlg}.`,
    }
  }

  // Verify signature before accepting claims
  const signingInput = `${headerB64}.${payloadB64}`
  if (HMAC_ALGORITHMS.has(typedAlg)) {
    if (!secretOrEmpty) {
      return {
        valid: false,
        payload: null,
        error: `HMAC secret missing for algorithm ${typedAlg}`,
      }
    }
    const sigOk = verifyHmacSignature(
      typedAlg as 'HS256' | 'HS384' | 'HS512',
      signingInput,
      signatureB64,
      secretOrEmpty,
    )
    if (!sigOk) {
      return { valid: false, payload: null, error: 'Invalid JWT signature' }
    }
  } else {
    if (!options.publicKeyPem) {
      return {
        valid: false,
        payload: null,
        error: `Public key missing for asymmetric algorithm ${typedAlg}`,
      }
    }
    let sigOk: boolean
    try {
      sigOk = verifyAsymmetricSignature(
        typedAlg as 'RS256' | 'ES256',
        signingInput,
        signatureB64,
        options.publicKeyPem,
      )
    } catch {
      sigOk = false
    }
    if (!sigOk) {
      return { valid: false, payload: null, error: 'Invalid JWT signature' }
    }
  }

  // Mandatory subject
  if (typeof payload.sub !== 'string' || payload.sub.trim().length === 0) {
    return { valid: false, payload: null, error: 'Missing mandatory JWT sub claim' }
  }

  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000)
  const skewSeconds = Math.max(0, options.clockSkewSeconds ?? 0)

  // Mandatory finite `exp` (handles `exp === 0` properly as expired)
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
    return { valid: false, payload: null, error: 'Missing mandatory JWT exp claim' }
  }
  if (payload.exp + skewSeconds <= nowSeconds) {
    return { valid: false, payload: null, error: 'JWT token is expired' }
  }

  // Optional `nbf` (Not Before) enforcement
  if (payload.nbf !== undefined) {
    if (typeof payload.nbf !== 'number' || !Number.isFinite(payload.nbf)) {
      return { valid: false, payload: null, error: 'Invalid JWT nbf claim' }
    }
    if (payload.nbf - skewSeconds > nowSeconds) {
      return { valid: false, payload: null, error: 'JWT token is not yet active (nbf)' }
    }
  }

  // Optional `iat` sanity check
  if (payload.iat !== undefined) {
    if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat)) {
      return { valid: false, payload: null, error: 'Invalid JWT iat claim' }
    }
    if (payload.iat - skewSeconds > nowSeconds) {
      return { valid: false, payload: null, error: 'JWT token issued in the future (iat)' }
    }
  }

  // Optional `iss` verification
  if (options.expectedIssuer !== undefined) {
    if (!matchesClaimValue(payload.iss, options.expectedIssuer)) {
      return { valid: false, payload: null, error: 'Invalid JWT issuer (iss)' }
    }
  }

  // Optional `aud` verification
  if (options.expectedAudience !== undefined) {
    if (!matchesClaimValue(payload.aud, options.expectedAudience)) {
      return { valid: false, payload: null, error: 'Invalid JWT audience (aud)' }
    }
  }

  return { valid: true, payload, algorithm: typedAlg }
}

/**
 * Transforms a verified JWT payload into the standard SupabaseUser shape expected by downstream handlers.
 */
export function jwtPayloadToUser(payload: DecodedJwtPayload): SupabaseUser {
  const normalizedAud = Array.isArray(payload.aud)
    ? (payload.aud[0] ?? 'authenticated')
    : (payload.aud ?? 'authenticated')
  return {
    id: payload.sub,
    app_metadata: payload.app_metadata ?? {},
    user_metadata: payload.user_metadata ?? {},
    aud: normalizedAud,
    created_at:
      typeof payload.iat === 'number'
        ? new Date(payload.iat * 1000).toISOString()
        : new Date().toISOString(),
    email: payload.email,
  } as SupabaseUser
}
