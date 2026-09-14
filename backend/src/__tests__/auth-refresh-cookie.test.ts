// ============================================
// Refresh token in an httpOnly cookie for the web app (X-Auth-Transport: cookie),
// in the response body for everyone else. Driven through the real Fastify app.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const session = (n: number) => ({
  access_token: `access-token-${n}`,
  refresh_token: `refresh-token-${n}-abcdefgh`,
  expires_at: 1_900_000_000,
})

const refreshSession = vi.fn(async ({ refresh_token }: { refresh_token: string }) =>
  refresh_token.startsWith('refresh-token-')
    ? { data: { session: session(2) }, error: null }
    : { data: { session: null }, error: { message: 'invalid' } },
)

vi.mock('../db', () => {
  const query: Record<string, unknown> = {}
  for (const k of ['select', 'eq', 'in', 'is', 'order', 'limit']) query[k] = () => query
  query.maybeSingle = async () => ({ data: null, error: null })
  query.single = async () => ({ data: null, error: null })
  query.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null })

  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: { message: 'invalid token' } }),
      admin: { signOut: async () => ({ error: null }) },
    },
    from: () => query,
  }
  const createAuthClient = () => ({
    auth: {
      signInWithPassword: async () => ({
        data: {
          user: {
            id: '11111111-1111-4111-8111-111111111111',
            email: 'a@b.co',
            created_at: '2026-01-01T00:00:00.000Z',
            user_metadata: {},
          },
          session: session(1),
        },
        error: null,
      }),
      refreshSession,
    },
  })
  return {
    supabase,
    default: supabase,
    createAuthClient,
    checkDatabaseConnection: async () => true,
    dbStats: { queries: 0, errors: 0 },
    withConnection: async <T>(fn: () => Promise<T>) => fn(),
  }
})

let app: FastifyInstance

beforeAll(async () => {
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
}, 60_000)

afterAll(async () => {
  await app?.close()
})

const login = (headers: Record<string, string> = {}) =>
  app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'content-type': 'application/json', ...headers },
    payload: { email: 'a@b.co', password: 'Password123!' },
  })

const cookieOf = (res: { headers: Record<string, unknown> }) =>
  String(res.headers['set-cookie'] ?? '')

describe('login', () => {
  it('body transport (desktop/mobile): refresh token in the body, no cookie', async () => {
    const res = await login()
    expect(res.statusCode).toBe(200)
    expect(res.json().refreshToken).toBe('refresh-token-1-abcdefgh')
    expect(res.json().token).toBe('access-token-1')
    expect(cookieOf(res)).toBe('')
  })

  it('cookie transport (web): httpOnly cookie, refresh token NOT in the body', async () => {
    const res = await login({ 'x-auth-transport': 'cookie' })
    expect(res.statusCode).toBe(200)
    expect(res.json().refreshToken).toBeUndefined()
    expect(res.json().token).toBe('access-token-1')
    const c = cookieOf(res)
    expect(c).toContain('hisabche_rt=refresh-token-1-abcdefgh')
    expect(c).toContain('HttpOnly')
    expect(c).toContain('Secure')
    expect(c).toContain('SameSite=Lax')
    expect(c).toContain('Path=/api/auth')
  })
})

describe('refresh', () => {
  it('cookie transport renews from the cookie and rotates it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: {
        'content-type': 'application/json',
        'x-auth-transport': 'cookie',
        cookie: 'other=1; hisabche_rt=refresh-token-1-abcdefgh',
      },
      payload: {},
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ token: 'access-token-2', expiresAt: 1_900_000_000 })
    expect(cookieOf(res)).toContain('hisabche_rt=refresh-token-2-abcdefgh')
  })

  it('a stored token from before the cookie is moved onto the cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { 'content-type': 'application/json', 'x-auth-transport': 'cookie' },
      payload: { refreshToken: 'refresh-token-1-abcdefgh' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().refreshToken).toBeUndefined()
    expect(cookieOf(res)).toContain('hisabche_rt=refresh-token-2-abcdefgh')
  })

  it('the cookie is ignored without the transport header (no silent cookie auth)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: {
        'content-type': 'application/json',
        cookie: 'hisabche_rt=refresh-token-1-abcdefgh',
      },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('an invalid cookie answers 401 and clears the cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: {
        'content-type': 'application/json',
        'x-auth-transport': 'cookie',
        cookie: 'hisabche_rt=revoked-token-xyz',
      },
      payload: {},
    })
    expect(res.statusCode).toBe(401)
    expect(cookieOf(res)).toContain('Max-Age=0')
  })

  it('body transport still works unchanged', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { 'content-type': 'application/json' },
      payload: { refreshToken: 'refresh-token-1-abcdefgh' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().refreshToken).toBe('refresh-token-2-abcdefgh')
    expect(cookieOf(res)).toBe('')
  })
})

describe('logout', () => {
  it('clears the cookie even when the access token is already expired', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer expired',
        'x-auth-transport': 'cookie',
      },
      payload: {},
    })
    expect(res.statusCode).toBe(401)
    expect(cookieOf(res)).toContain('hisabche_rt=;')
    expect(cookieOf(res)).toContain('Max-Age=0')
  })
})

describe('CORS', () => {
  it('allows the transport header in preflight', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/auth/refresh',
      headers: {
        origin: 'https://hisabche.com',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type,x-auth-transport',
      },
    })
    expect(String(res.headers['access-control-allow-headers'] ?? '').toLowerCase()).toContain(
      'x-auth-transport',
    )
    expect(res.headers['access-control-allow-credentials']).toBe('true')
  })
})
