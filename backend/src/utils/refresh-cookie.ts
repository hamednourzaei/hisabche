// ============================================
// backend/src/utils/refresh-cookie.ts
//
// The web app's refresh token lives in an httpOnly cookie, out of reach of any
// script on the page. localStorage — even "encrypted" with a key shipped in the
// JS bundle — is readable by every script an XSS manages to run.
//
// ---------------------------------------------------------------------------
// WHO GETS A COOKIE
//
// Only a caller that asks with `X-Auth-Transport: cookie` (the web app on an
// http(s) origin). Desktop runs from file:// and mobile is not a browser: a
// SameSite cookie never reaches the API from there, so they keep the token in
// the response body exactly as before.
//
// WHY SameSite=Lax IS ENOUGH HERE
//
// Site and API are the same site (hisabche.com / api.hisabche.com), so the
// cookie is first-party. A cross-site page cannot make the browser attach it
// to a POST, and the custom header forces a CORS preflight the allow-list
// refuses — so /refresh cannot be driven from another origin, and even if it
// could, the new access token in the response is unreadable to that origin.
// ============================================

import type { FastifyReply, FastifyRequest } from 'fastify'

export const REFRESH_COOKIE = 'hisabche_rt'
/** Only the auth routes ever receive it. */
const COOKIE_PATH = '/api/auth'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export function wantsCookieTransport(request: FastifyRequest): boolean {
  return String(request.headers['x-auth-transport'] ?? '').toLowerCase() === 'cookie'
}

export function readRefreshCookie(request: FastifyRequest): string | null {
  const header = request.headers.cookie
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() !== REFRESH_COOKIE) continue
    try {
      const value = decodeURIComponent(part.slice(eq + 1).trim())
      return value.length > 0 ? value : null
    } catch {
      return null
    }
  }
  return null
}

function serialise(value: string, maxAge: number): string {
  return [
    `${REFRESH_COOKIE}=${encodeURIComponent(value)}`,
    `Path=${COOKIE_PATH}`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    // Browsers accept Secure cookies from http://localhost, so dev works too.
    'Secure',
    'SameSite=Lax',
  ].join('; ')
}

export function setRefreshCookie(reply: FastifyReply, refreshToken: string): void {
  reply.header('set-cookie', serialise(refreshToken, MAX_AGE_SECONDS))
}

export function clearRefreshCookie(reply: FastifyReply): void {
  reply.header('set-cookie', serialise('', 0))
}

/**
 * The session part of a login/signup/refresh answer. In cookie transport the
 * refresh token goes into the cookie and is NOT repeated in the body.
 */
export function sessionBody(
  request: FastifyRequest,
  reply: FastifyReply,
  session: { access_token: string; refresh_token: string; expires_at?: number | undefined },
): { token: string; refreshToken?: string; expiresAt: number | null } {
  const base = { token: session.access_token, expiresAt: session.expires_at ?? null }
  if (wantsCookieTransport(request)) {
    setRefreshCookie(reply, session.refresh_token)
    return base
  }
  return { ...base, refreshToken: session.refresh_token }
}
