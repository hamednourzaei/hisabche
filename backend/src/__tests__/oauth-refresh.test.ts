// ============================================
// OAuth refresh tokens (developer-platform-08) — the layer in front of the
// database functions (developer-platform-08.pg.test.ts proves rotation, reuse
// detection and revocation themselves).
//
//   - the token endpoint, on a real Fastify: grant_type=refresh_token goes to
//     refresh(), a reuse answers invalid_grant, nothing is cacheable;
//   - /api/oauth/revoke answers 200 for a well-formed request, and the token
//     it was given is never echoed;
//   - a refresh token has a shape, is random, and only its hash is kept;
//   - the service: old access-token hash is dropped from the cache BEFORE a
//     reuse is reported; a database without migration 08 still issues a token
//     (without the fields it cannot honour).
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Fastify from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  ACCESS_TOKEN_SECONDS,
  REFRESH_TOKEN_SECONDS,
  generateRefreshToken,
  looksLikeRefreshToken,
} from '../services/oauth/oauth.domain'
import { OAuthError } from '../services/oauth/oauth.service'
import { buildOAuthRoutes } from '../routes/oauth.routes'

const SRC = join(__dirname, '..')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (...p: string[]) => strip(readFileSync(join(SRC, ...p), 'utf8'))

describe('a refresh token', () => {
  it('has its shape, is not guessable, and outlives the access token', () => {
    const token = generateRefreshToken()
    expect(token).toMatch(/^hk_refresh_[0-9a-f]{64}$/)
    expect(generateRefreshToken()).not.toBe(token)
    expect(looksLikeRefreshToken(token)).toBe(true)
    expect(looksLikeRefreshToken('hk_live_abc')).toBe(false)
    expect(REFRESH_TOKEN_SECONDS).toBeGreaterThan(ACCESS_TOKEN_SECONDS)
    expect(ACCESS_TOKEN_SECONDS).toBe(3600)
  })
})

describe('the token and revoke endpoints', () => {
  const refresh = vi.fn(async (input: { refreshToken: string }) => {
    if (input.refreshToken === 'good') {
      return {
        access_token: 'hk_live_new',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'hk_refresh_next',
        scope: 'read:invoices',
      }
    }
    if (input.refreshToken === 'replayed')
      throw new OAuthError('REFRESH_REUSED', 400, 'invalid_grant')
    throw new OAuthError('REFRESH_INVALID', 400, 'invalid_grant')
  })
  const exchange = vi.fn()
  const revoke = vi.fn(async (input: { clientSecret: string }) => {
    if (input.clientSecret !== 'secret')
      throw new OAuthError('CLIENT_INVALID', 401, 'invalid_client')
  })
  const app = Fastify()
  app.register(buildOAuthRoutes({ refresh, exchange, revoke } as never))
  beforeAll(() => app.ready())
  afterAll(() => app.close())

  const body = (refresh_token: string) => ({
    grant_type: 'refresh_token',
    refresh_token,
    client_id: 'hk_app_x',
    client_secret: 'secret',
  })

  it('grant_type=refresh_token rotates: new access and refresh tokens, never cached', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/oauth/token', payload: body('good') })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      access_token: 'hk_live_new',
      refresh_token: 'hk_refresh_next',
      expires_in: 3600,
    })
    expect(res.headers['cache-control']).toBe('no-store')
    expect(exchange).not.toHaveBeenCalled()
  })

  it.each([
    ['replayed', 'REFRESH_REUSED'],
    ['unknown', 'REFRESH_INVALID'],
  ])('a %s refresh token → 400 invalid_grant (%s)', async (token, code) => {
    const res = await app.inject({ method: 'POST', url: '/api/oauth/token', payload: body(token) })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'invalid_grant', error_description: code })
  })

  it('a refresh request with no token is invalid_request, and reaches neither grant', async () => {
    refresh.mockClear()
    const res = await app.inject({
      method: 'POST',
      url: '/api/oauth/token',
      payload: { grant_type: 'refresh_token', client_id: 'x', client_secret: 'y' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('invalid_request')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('revoke: 200 and an empty body — the token is never echoed', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/oauth/revoke',
      payload: { token: 'hk_refresh_abc', client_id: 'hk_app_x', client_secret: 'secret' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('{}')
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('revoke: a wrong client secret is invalid_client', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/oauth/revoke',
      payload: { token: 'hk_refresh_abc', client_id: 'hk_app_x', client_secret: 'wrong' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBe('invalid_client')
  })
})

describe('the service', () => {
  const service = read('services', 'oauth', 'oauth.service.ts')
  const refreshFn = service.slice(
    service.indexOf('async refresh('),
    service.indexOf('async revoke('),
  )

  it('only the hash of a refresh token is sent to the database', () => {
    expect(service).toContain('p_refresh_hash: sha256Hex(refreshToken)')
    expect(refreshFn).toContain('p_new_refresh_hash: sha256Hex(nextRefresh)')
    expect(service).not.toMatch(
      /p_\w*refresh\w*:\s*(refreshToken|nextRefresh|input\.refreshToken)\b/,
    )
  })

  it('the old access token leaves the cache BEFORE a reuse is reported', () => {
    const forget = refreshFn.indexOf('developer.forgetKeys([out.old_key_hash])')
    const reused = refreshFn.indexOf("throw new OAuthError('REFRESH_REUSED'")
    expect(forget).toBeGreaterThan(-1)
    expect(reused).toBeGreaterThan(forget)
  })

  it('the grant is recomputed against the installer and the live version on every refresh', () => {
    expect(refreshFn).toContain(
      'resolveWorkspaceAccess(row.installation.installed_by, row.workspace_id)',
    )
    expect(refreshFn).toContain('liveConfig(app, row.workspace_id)')
    expect(refreshFn).toContain('grantForKey(')
  })

  it('a database without migration 08 still issues a token — with no refresh fields', () => {
    const exchangeFn = service.slice(
      service.indexOf('async exchange('),
      service.indexOf('async refresh('),
    )
    expect(exchangeFn).toContain("supabase.rpc('install_oauth_app_with_refresh'")
    expect(exchangeFn).toContain("['PGRST202', '42883'].includes(withRefresh.error.code ?? '')")
    expect(exchangeFn).toContain("supabase.rpc('install_oauth_app', install)")
    const fallback = exchangeFn.slice(
      exchangeFn.lastIndexOf("supabase.rpc('install_oauth_app', install)"),
    )
    expect(fallback).not.toContain('refresh_token')
    expect(fallback).not.toContain('expires_in')
  })

  it('exchange, refresh and revoke authenticate the client in ONE place', () => {
    expect(service.match(/await clientApp\(/g)).toHaveLength(3)
    expect(service.match(/client_secret_hash\)/g)).toHaveLength(1)
  })
})
