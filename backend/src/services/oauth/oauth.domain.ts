// ============================================
// backend/src/services/oauth/oauth.domain.ts
//
// The rules of OAuth apps (docs/developer-platform-05-oauth-migration.sql),
// as pure functions. The flow is OAuth 2.0 authorization code with PKCE
// (RFC 6749 + RFC 7636, S256 only):
//
//   1. the app sends the person to /oauth/authorize with client_id,
//      redirect_uri, scope, state and a code_challenge;
//   2. the person — an owner/manager of THEIR business — approves; the
//      server issues a one-time code (10 minutes, stored hashed);
//   3. the app's server trades code + code_verifier + client_secret for an
//      access token — an API key tied to the app.
//
// Every check below fails CLOSED and says which rule refused.
// ============================================

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { API_KEY_SCOPES, type ApiKeyScope } from '@hisabche/validation'

export const CODE_TTL_MS = 10 * 60_000

export function generateClientId(): string {
  return `hk_app_${randomBytes(16).toString('hex')}`
}

export function generateClientSecret(): string {
  return `hk_secret_${randomBytes(32).toString('base64url')}`
}

export function generateCode(): string {
  return randomBytes(32).toString('base64url')
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

/** Constant-time comparison of two hex digests of equal length. */
export function sameDigest(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, 'hex')
  const b = Buffer.from(bHex, 'hex')
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b)
}

/** RFC 7636 §4.1: 43–128 characters of the unreserved set. */
const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/
/** A S256 challenge: base64url of a SHA-256, no padding. */
export const CHALLENGE = /^[A-Za-z0-9_-]{43}$/

/** RFC 7636 §4.6: BASE64URL(SHA256(verifier)) === challenge. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!VERIFIER.test(verifier) || !CHALLENGE.test(challenge)) return false
  const computed = createHash('sha256').update(verifier, 'ascii').digest('base64url')
  const a = Buffer.from(computed)
  const b = Buffer.from(challenge)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * A registered redirect URI: https, or http on localhost for development.
 * No fragment (RFC 6749 §3.1.2), no credentials.
 */
export function redirectUriValid(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.hash || url.username || url.password) return false
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    return url.protocol === 'https:' || (url.protocol === 'http:' && local)
  } catch {
    return false
  }
}

/** Exact match against the registered list — no prefix, no wildcard (RFC 6749 §3.1.2.2). */
export function redirectUriRegistered(registered: readonly string[], requested: string): boolean {
  return registered.includes(requested)
}

/** A `scope` parameter → known scopes, or null if any is unknown. */
export function parseScope(raw: string): ApiKeyScope[] | null {
  const parts = [...new Set(raw.split(/\s+/).filter(Boolean))]
  if (parts.length === 0) return null
  const known = API_KEY_SCOPES as readonly string[]
  return parts.every((p) => known.includes(p)) ? (parts as ApiKeyScope[]) : null
}

export type AppStatus = 'private' | 'in_review' | 'published' | 'rejected' | 'suspended'

/**
 * May this workspace install this app?
 *
 * Published: anyone. Private / in review / rejected: only the publisher's
 * own workspace — how a developer tests their app before review. Suspended:
 * nobody.
 */
export function mayInstall(
  app: { status: AppStatus; ownerWorkspaceId: string },
  workspaceId: string,
): boolean {
  if (app.status === 'suspended') return false
  if (app.status === 'published') return true
  return app.ownerWorkspaceId === workspaceId
}

/** Which edits a publisher may make: none while the app is live or under review. */
export function mayEdit(status: AppStatus): boolean {
  return status === 'private' || status === 'rejected'
}
