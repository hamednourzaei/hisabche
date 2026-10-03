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
import {
  API_KEY_SCOPES,
  API_VERSIONS,
  WEBHOOK_EVENT_RESOURCE,
  WEBHOOK_EVENTS,
  type ApiKeyScope,
  type AppHealthLevel,
  type AppRiskFlag,
  type WebhookEventType,
} from '@hisabche/validation'

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

/** The app's webhook signing secret — the same shape as an endpoint's. */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString('base64url')}`
}

// ─── Versions and installations ─────────────────────────────────────────────

/** Can this platform still serve an app built against `apiVersion`? */
export function isCompatible(apiVersion: string): boolean {
  return (API_VERSIONS as readonly string[]).includes(apiVersion)
}

/**
 * The events an installation actually subscribes to: those the app asked for
 * AND whose resource the installer granted read access to. An event about
 * invoices never reaches an app that may not read invoices.
 */
export function eventsForGrant(
  events: readonly string[],
  granted: readonly string[],
): WebhookEventType[] {
  return events.filter(
    (e): e is WebhookEventType =>
      (WEBHOOK_EVENTS as readonly string[]).includes(e) &&
      granted.includes(WEBHOOK_EVENT_RESOURCE[e as WebhookEventType].scope),
  )
}

/** What moving to another version changes, scope by scope. */
export function scopeDiff(current: readonly string[], next: readonly string[]) {
  return {
    added: next.filter((s) => !current.includes(s)),
    removed: current.filter((s) => !next.includes(s)),
  }
}

/**
 * Permissions disclosure: every scope with whether it reads or changes data,
 * and every event the app would receive. Shown on the listing AND on the
 * consent screen, from the same function.
 */
export function permissionDisclosure(scopes: readonly string[], events: readonly string[]) {
  return {
    scopes: scopes.map((scope) => ({
      scope,
      access: scope.startsWith('write:') ? ('write' as const) : ('read' as const),
    })),
    events: events.filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e)),
  }
}

// ─── Health ─────────────────────────────────────────────────────────────────

/**
 * Explicit thresholds (G4). Below MIN_SAMPLE a rate says nothing — one failed
 * request of two is not «50% failing» — so the answer is «low volume», and no
 * traffic at all is «no data», never «healthy» (راهنمای سشن §۷٫۵).
 */
export const HEALTH_THRESHOLDS = { minSample: 20, degraded: 0.05, failing: 0.25 } as const

export interface HealthCounts {
  requests24h: number
  serverErrors24h: number
  deliveries24h: number
  failedDeliveries24h: number
}

export function appHealth(c: HealthCounts): {
  level: AppHealthLevel
  serverErrorRate: number | null
  deliveryFailureRate: number | null
} {
  const rate = (bad: number, all: number) => (all >= HEALTH_THRESHOLDS.minSample ? bad / all : null)
  const serverErrorRate = rate(c.serverErrors24h, c.requests24h)
  const deliveryFailureRate = rate(c.failedDeliveries24h, c.deliveries24h)
  if (c.requests24h + c.deliveries24h === 0)
    return { level: 'no_data', serverErrorRate, deliveryFailureRate }
  const worst = Math.max(serverErrorRate ?? -1, deliveryFailureRate ?? -1)
  const level: AppHealthLevel =
    worst < 0
      ? 'low_volume'
      : worst >= HEALTH_THRESHOLDS.failing
        ? 'failing'
        : worst >= HEALTH_THRESHOLDS.degraded
          ? 'degraded'
          : 'healthy'
  return { level, serverErrorRate, deliveryFailureRate }
}

// ─── Security review ────────────────────────────────────────────────────────

/** What an admin is shown about a version before publishing it. */
export function riskFlags(input: {
  version: {
    redirect_uris: readonly string[]
    requested_scopes: readonly string[]
    webhook_url: string | null
  }
  previous: { requested_scopes: readonly string[] } | null
  publisherVerified: boolean
  openReports: number
}): Array<{ flag: AppRiskFlag; detail: string[] }> {
  const flags: Array<{ flag: AppRiskFlag; detail: string[] }> = []
  const added = input.previous
    ? scopeDiff(input.previous.requested_scopes, input.version.requested_scopes).added
    : [...input.version.requested_scopes]
  if (added.length > 0) flags.push({ flag: 'NEW_SCOPES', detail: added })
  const writes = input.version.requested_scopes.filter((s) => s.startsWith('write:'))
  if (writes.length > 0) flags.push({ flag: 'WRITE_SCOPES', detail: writes })
  const local = input.version.redirect_uris.filter((u) => !u.startsWith('https://'))
  if (local.length > 0) flags.push({ flag: 'LOCALHOST_REDIRECT', detail: local })
  if (input.version.webhook_url) {
    const hosts = new Set(input.version.redirect_uris.map((u) => hostOf(u)))
    const hook = hostOf(input.version.webhook_url)
    if (hook && !hosts.has(hook)) flags.push({ flag: 'WEBHOOK_HOST_MISMATCH', detail: [hook] })
  }
  if (!input.publisherVerified) flags.push({ flag: 'UNVERIFIED_PUBLISHER', detail: [] })
  if (input.openReports > 0)
    flags.push({ flag: 'OPEN_REPORTS', detail: [String(input.openReports)] })
  return flags
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

// ─── Token lifetimes (developer-platform-08) ────────────────────────────────

/** An access token lives one hour; the refresh token renews it. */
export const ACCESS_TOKEN_SECONDS = 60 * 60
/** A refresh token lives thirty days from its last rotation. */
export const REFRESH_TOKEN_SECONDS = 30 * 24 * 60 * 60

/** A refresh token: shown once, stored only as its SHA-256. */
export function generateRefreshToken(): string {
  return `hk_refresh_${randomBytes(32).toString('hex')}`
}

export function looksLikeRefreshToken(value: string): boolean {
  return /^hk_refresh_[0-9a-f]{64}$/.test(value)
}
