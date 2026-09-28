// ============================================
// OAuth apps — the rules, the token endpoint on a real Fastify, and the
// wiring a unit test cannot see.
// ============================================

import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Fastify from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  generateClientId,
  generateClientSecret,
  mayEdit,
  mayInstall,
  parseScope,
  pkceMatches,
  redirectUriRegistered,
  redirectUriValid,
  sameDigest,
  sha256Hex,
} from '../services/oauth/oauth.domain'
import { OAuthError } from '../services/oauth/oauth.service'
import { buildOAuthRoutes } from '../routes/oauth.routes'

const SRC = join(__dirname, '..')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (...p: string[]) => strip(readFileSync(join(SRC, ...p), 'utf8'))

describe('PKCE (RFC 7636, S256 only)', () => {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')

  it('the verifier that made the challenge matches', () => {
    expect(pkceMatches(verifier, challenge)).toBe(true)
  })

  it('another verifier, a plain challenge, or a malformed one does not', () => {
    expect(pkceMatches(randomBytes(32).toString('base64url'), challenge)).toBe(false)
    expect(pkceMatches(verifier, verifier.slice(0, 43))).toBe(false) // «plain» method
    expect(pkceMatches('short', challenge)).toBe(false)
  })
})

describe('redirect URIs', () => {
  it.each(['https://app.example/cb', 'http://localhost:3000/cb'])('accepts %s', (u) =>
    expect(redirectUriValid(u)).toBe(true),
  )
  it.each([
    'http://app.example/cb',
    'https://app.example/cb#frag',
    'https://u:p@app.example/cb',
    'javascript:alert(1)',
  ])('refuses %s', (u) => expect(redirectUriValid(u)).toBe(false))
  it('matches exactly — no prefix, no subpath, no query drift', () => {
    const registered = ['https://app.example/cb']
    expect(redirectUriRegistered(registered, 'https://app.example/cb')).toBe(true)
    expect(redirectUriRegistered(registered, 'https://app.example/cb/evil')).toBe(false)
    expect(redirectUriRegistered(registered, 'https://app.example/cb?x=1')).toBe(false)
    expect(redirectUriRegistered(registered, 'https://app.example.evil/cb')).toBe(false)
  })
})

describe('apps', () => {
  it('ids and secrets have their shapes and are not guessable', () => {
    expect(generateClientId()).toMatch(/^hk_app_[0-9a-f]{32}$/)
    expect(generateClientSecret()).toMatch(/^hk_secret_[A-Za-z0-9_-]{43}$/)
    expect(generateClientSecret()).not.toBe(generateClientSecret())
  })

  it('a secret is compared by digest, in constant time', () => {
    const s = generateClientSecret()
    expect(sameDigest(sha256Hex(s), sha256Hex(s))).toBe(true)
    expect(sameDigest(sha256Hex(s), sha256Hex(`${s}x`))).toBe(false)
    expect(sameDigest('', '')).toBe(false)
  })

  it('scopes must all be known API scopes', () => {
    expect(parseScope('read:invoices  read:customers')).toEqual(['read:invoices', 'read:customers'])
    expect(parseScope('read:invoices admin:all')).toBeNull()
    expect(parseScope('ui:page')).toBeNull() // an installed-app UI scope is not an API scope
    expect(parseScope('   ')).toBeNull()
  })

  it('who may install: published → anyone; unreviewed → only the publisher; suspended → nobody', () => {
    const app = (status: Parameters<typeof mayInstall>[0]['status']) => ({
      status,
      ownerWorkspaceId: 'pub',
    })
    expect(mayInstall(app('published'), 'other')).toBe(true)
    expect(mayInstall(app('private'), 'other')).toBe(false)
    expect(mayInstall(app('private'), 'pub')).toBe(true)
    expect(mayInstall(app('in_review'), 'other')).toBe(false)
    expect(mayInstall(app('suspended'), 'pub')).toBe(false)
  })

  it('a reviewed app does not change under its installers', () => {
    expect(mayEdit('private')).toBe(true)
    expect(mayEdit('rejected')).toBe(true)
    expect(mayEdit('published')).toBe(false)
    expect(mayEdit('in_review')).toBe(false)
  })
})

describe('the token endpoint', () => {
  const exchange = vi.fn(async (input: { code: string }) => {
    if (input.code === 'good')
      return { access_token: 'hk_live_x', token_type: 'Bearer', scope: 'read:invoices' }
    throw new OAuthError('CODE_INVALID', 400, 'invalid_grant')
  })
  const app = Fastify()
  app.register(buildOAuthRoutes({ exchange } as never))
  beforeAll(() => app.ready())
  afterAll(() => app.close())

  const form = (fields: Record<string, string>) =>
    app.inject({
      method: 'POST',
      url: '/api/oauth/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams(fields).toString(),
    })
  const full = {
    grant_type: 'authorization_code',
    redirect_uri: 'https://app.example/cb',
    client_id: 'hk_app_x',
    client_secret: 'hk_secret_x',
    code_verifier: 'v'.repeat(43),
  }

  it('reads a form-encoded request, as OAuth clients send it', async () => {
    const res = await form({ ...full, code: 'good' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      access_token: 'hk_live_x',
      token_type: 'Bearer',
      scope: 'read:invoices',
    })
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('answers errors in the RFC 6749 shape', async () => {
    const res = await form({ ...full, code: 'spent' })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'invalid_grant', error_description: 'CODE_INVALID' })
    const missing = await form({ grant_type: 'authorization_code' })
    expect(missing.json().error).toBe('invalid_request')
  })
})

describe('wiring', () => {
  const service = read('services', 'oauth', 'oauth.service.ts')
  const routes = read('routes', 'oauth.routes.ts')

  it('the token is an API key tied to the app — no second token system', () => {
    expect(service).toContain('await keys.insertKey({')
    expect(service).toContain('app_id: app.id,')
  })

  it('the grant is recomputed at exchange against what the installer holds NOW', () => {
    const exchangeBody = service.slice(service.indexOf('async exchange('))
    expect(exchangeBody).toContain('resolveWorkspaceAccess(code.user_id, code.workspace_id)')
    expect(exchangeBody.indexOf('grantForKey(')).toBeGreaterThan(
      exchangeBody.indexOf('resolveWorkspaceAccess('),
    )
  })

  it('the code is spent by the database before the verifier is checked', () => {
    const exchangeBody = service.slice(service.indexOf('async exchange('))
    expect(exchangeBody.indexOf("rpc('redeem_oauth_code'")).toBeLessThan(
      exchangeBody.indexOf('pkceMatches('),
    )
  })

  it('an unregistered redirect_uri is refused before anything else is looked at', () => {
    const request = service.slice(service.indexOf('async function authorizationRequest'))
    expect(request.indexOf('redirectUriRegistered(')).toBeLessThan(request.indexOf('mayInstall('))
  })

  it('consent and app management need workspace.manage; review needs a platform admin', () => {
    expect(routes).toContain(
      "const manage = [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')]",
    )
    expect(routes).toContain('const admin = [authenticate, platformAdminGuard]')
    for (const path of [
      "'/api/oauth/authorize'",
      "'/api/developer/apps'",
      "'/api/developer/installed-apps'",
    ]) {
      const at = routes.indexOf(path)
      expect(routes.slice(at, at + 80)).toContain('preHandler: manage')
    }
  })

  it('only /api/oauth/token is public, and no oauth route is open to API keys', async () => {
    expect(read('index.ts')).toContain(
      "const exactPublicPaths = ['/api/billing/plans', '/api/oauth/token']",
    )
    const { API_ROUTE_SCOPES } = await import('../services/developer/developer.domain')
    expect(
      Object.keys(API_ROUTE_SCOPES).filter((k) => /oauth|developer|marketplace|admin/.test(k)),
    ).toEqual([])
  })
})
