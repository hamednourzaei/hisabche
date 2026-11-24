// ============================================
// backend/src/middleware/jwt-verifier.ts
//
// Standalone Local JWT Verification Engine
// Cryptographically verifies GoTrue / Supabase / Keycloak JWT tokens
// locally using Node's native crypto, without making any network round-trip.
// Ensures 100% operational survival during international internet disconnection.
// ============================================

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export interface DecodedJwtPayload {
  sub: string
  email?: string | undefined
  role?: string | undefined
  exp?: number | undefined
  iat?: number | undefined
  iss?: string | undefined
  aud?: string | undefined
  app_metadata?: Record<string, unknown> | undefined
  user_metadata?: Record<string, unknown> | undefined
}

export function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return Buffer.from(base64, 'base64').toString('utf8')
}

export function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Locally verifies a HS256 JWT signature using the shared secret.
 * Zero network round-trips. Survives international internet cuts.
 */
export function verifyJwtSignatureLocally(
  token: string,
  secret: string,
): { valid: boolean; payload: DecodedJwtPayload | null; error?: string | undefined } {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return { valid: false, payload: null, error: 'Malformed JWT: must have 3 segments' }
  }

  const [headerB64, payloadB64, signatureB64] = parts
  if (!headerB64 || !payloadB64 || !signatureB64) {
    return { valid: false, payload: null, error: 'Malformed JWT segments' }
  }

  let header: { alg?: string; typ?: string }
  let payload: DecodedJwtPayload
  try {
    header = JSON.parse(base64UrlDecode(headerB64))
    payload = JSON.parse(base64UrlDecode(payloadB64))
  } catch {
    return { valid: false, payload: null, error: 'Invalid JSON in JWT header or payload' }
  }

  if (header.alg !== 'HS256') {
    return {
      valid: false,
      payload: null,
      error: `Unsupported JWT algorithm: ${header.alg}. Expected HS256.`,
    }
  }

  // Verify expiration
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    return { valid: false, payload: null, error: 'JWT token is expired' }
  }

  // Verify cryptographic HMAC-SHA256 signature
  const dataToSign = `${headerB64}.${payloadB64}`
  const expectedHmac = createHmac('sha256', secret).update(dataToSign).digest()
  const expectedSignatureB64 = base64UrlEncode(expectedHmac)

  const sigBuffer = Buffer.from(signatureB64)
  const expectedSigBuffer = Buffer.from(expectedSignatureB64)

  if (
    sigBuffer.length !== expectedSigBuffer.length ||
    !timingSafeEqual(sigBuffer, expectedSigBuffer)
  ) {
    return { valid: false, payload: null, error: 'Invalid JWT signature' }
  }

  return { valid: true, payload }
}

/**
 * Transforms a verified JWT payload into the standard SupabaseUser shape expected by downstream handlers.
 */
export function jwtPayloadToUser(payload: DecodedJwtPayload): SupabaseUser {
  return {
    id: payload.sub,
    app_metadata: payload.app_metadata ?? {},
    user_metadata: payload.user_metadata ?? {},
    aud: payload.aud ?? 'authenticated',
    created_at: payload.iat ? new Date(payload.iat * 1000).toISOString() : new Date().toISOString(),
    email: payload.email,
  } as SupabaseUser
}
