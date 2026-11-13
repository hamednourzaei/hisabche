// ============================================
// backend/src/__tests__/monitoring-wall.test.ts
//
// V63 · M-6 — the TV wall credential.
//
//  1. a wall token is stored as a hash and never as its own value;
//  2. an active, unexpired, unrevoked token verifies;
//  3. an expired token, a revoked token and a mismatched address are refused;
//  4. a wall token is not an admin credential: it cannot open an admin route;
//  5. /api/wall/* stays outside the admin chain and answers 401 without one.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb } from './helpers/fake-supabase'

process.env.ADMIN_ALLOWED_EMAILS = 'super@hisabche.com'

const db = new FakeDatabase()
const users = new Map<string, { id: string; email: string }>()

vi.mock('../db', () => createFakeDb(db, users))

// ⚠️ Every module that touches `../db` is imported INSIDE beforeAll, after the
// mock factory has something to read. A static import here would resolve the
// mocked module while `db` above is still in its temporal dead zone.
let hashWallToken: (token: string) => string
let WallTokenService: typeof import('../services/monitoring/wall-token.service').WallTokenService
let isPublicApiPath: (path: string) => boolean

const ACTIVE = 'active-wall-token-0123456789abcdef'
const EXPIRED = 'expired-wall-token-0123456789abcdef'
const REVOKED = 'revoked-wall-token-0123456789abcdef'
const IP_BOUND = 'ip-bound-wall-token-0123456789abcdef'

const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString()
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

function tokenRow(token: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `id-${token.slice(0, 8)}`,
    token_hash: hashWallToken(token),
    label: 'wall',
    ip_cidr: null,
    expires_at: inOneHour,
    revoked_at: null,
    created_by: 'super@hisabche.com',
    created_at: new Date().toISOString(),
    last_used_at: null,
    ...overrides,
  }
}

let app: FastifyInstance

beforeAll(async () => {
  const wall = await import('../services/monitoring/wall-token.service')
  hashWallToken = wall.hashWallToken
  WallTokenService = wall.WallTokenService
  const storefront = await import('../routes/storefront.routes')
  isPublicApiPath = storefront.isPublicApiPath

  db.seed('admin_wall_tokens', [
    tokenRow(ACTIVE),
    tokenRow(EXPIRED, { expires_at: oneHourAgo }),
    tokenRow(REVOKED, { revoked_at: new Date().toISOString() }),
    tokenRow(IP_BOUND, { ip_cidr: '203.0.113.0/24' }),
  ])

  const { buildServer } = await import('../index')
  app = await buildServer({ testRuntime: true })
})

afterAll(async () => {
  await app.close()
})

describe('the stored form', () => {
  it('hashes a token one-way and never keeps the value', () => {
    expect(hashWallToken('abc')).toMatch(/^[0-9a-f]{64}$/)
    expect(hashWallToken(ACTIVE)).not.toBe(ACTIVE)
    expect(hashWallToken(ACTIVE)).toBe(hashWallToken(ACTIVE))
  })
})

describe('WallTokenService.verify', () => {
  it('accepts an active token from any address when no range is bound', async () => {
    const row = await WallTokenService.verify(ACTIVE, '198.51.100.7')
    expect(row?.label).toBe('wall')
  })

  it('refuses an expired token', async () => {
    await expect(WallTokenService.verify(EXPIRED, '198.51.100.7')).resolves.toBeNull()
  })

  it('refuses a revoked token', async () => {
    await expect(WallTokenService.verify(REVOKED, '198.51.100.7')).resolves.toBeNull()
  })

  it('refuses a token presented from outside its bound range', async () => {
    await expect(WallTokenService.verify(IP_BOUND, '198.51.100.7')).resolves.toBeNull()
    const inside = await WallTokenService.verify(IP_BOUND, '203.0.113.42')
    expect(inside?.label).toBe('wall')
  })

  it('refuses a token that is not in the table', async () => {
    await expect(WallTokenService.verify('x'.repeat(40), '203.0.113.42')).resolves.toBeNull()
  })
})

describe('the wall is not an admin door', () => {
  it('cannot open an admin route', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/roles',
      headers: { 'x-wall-token': ACTIVE },
    })
    expect(res.statusCode).toBe(401)
  })

  it('answers 401 on /api/wall/overview without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/wall/overview' })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ code: 'WALL_TOKEN_REQUIRED' })
  })

  // 12 Nov 2026 (V63 audit): the cookie exchange and the SSE stream had no
  // caller and were removed; the wall polls with the header.
  it('refuses an expired token on the overview', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/wall/overview',
      headers: { 'x-wall-token': EXPIRED },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ code: 'WALL_TOKEN_REQUIRED' })
  })

  it('a token in a cookie is not a credential', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/wall/overview',
      headers: { cookie: `hisabche_wall=${ACTIVE}` },
    })
    expect(res.statusCode).toBe(401)
  })

  it('the removed stream and session routes are gone', async () => {
    for (const [method, url] of [
      ['GET', '/api/wall/stream'],
      ['POST', '/api/wall/session'],
      ['GET', '/api/admin/monitor/stream'],
    ] as const) {
      const res = await app.inject({ method, url })
      expect(res.statusCode, url).not.toBe(200)
    }
  })

  it('keeps /api/wall/ public and /api/wallx private', () => {
    expect(isPublicApiPath('/api/wall/overview')).toBe(true)
    expect(isPublicApiPath('/api/wallx')).toBe(false)
    expect(isPublicApiPath('/api/admin/monitor/overview')).toBe(false)
  })
})
