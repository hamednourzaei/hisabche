// ============================================
// API surface tests.
//
// These build the real Fastify application in-process and drive it with
// `inject()`. They previously fetched https://hisabche.onrender.com over the
// network, which made every local and CI run depend on production being
// reachable — ordinary latency showed up as a failing unit test, and a genuine
// regression would have been indistinguishable from a slow deploy.
//
// Nothing here touches Supabase: the assertions cover the routing table, the
// public-path allowlist and the auth guard, all of which run before any
// handler reaches the database.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// The auth guard calls `supabase.auth.getUser()` to validate a bearer token.
// Stubbing it keeps the suite off the network entirely and makes rejection
// deterministic: an unverifiable token yields no user, so the guard must 401.
// Flipped by the readiness tests: every query then fails as an unreachable
// database would.
const db = vi.hoisted(() => ({ down: false }))

vi.mock('../db', () => {
  const rejectToken = async () => ({ data: { user: null }, error: { message: 'invalid token' } })

  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    then: (
      resolve: (value: { data: never[] | null; error: { message: string } | null }) => unknown,
    ) =>
      resolve(
        db.down
          ? { data: null, error: { message: 'connection refused' } }
          : { data: [], error: null },
      ),
  }

  const supabase = {
    auth: { getUser: rejectToken },
    from: () => query,
  }

  return {
    supabase,
    default: supabase,
    checkDatabaseConnection: async () => true,
    dbStats: { queries: 0, errors: 0 },
    withConnection: async <T>(fn: () => Promise<T>) => fn(),
  }
})

let app: FastifyInstance

beforeAll(async () => {
  // Importing the module registers routes; the `VITEST` guard in index.ts keeps
  // it from binding a port or starting the job scheduler.
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
}, 60_000)

afterAll(async () => {
  await app?.close()
})

describe('API health', () => {
  it('GET /api/health reports ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok' })
  })

  it('GET /api/health names the exact build and whether Redis is actually reached', async () => {
    const body = (await app.inject({ method: 'GET', url: '/api/health' })).json()
    expect(body).toHaveProperty('commit')
    expect(typeof body.redisConnected).toBe('boolean')
  })

  it('⚠️ GET /ready is 200 with a database and 503 without — the status code is what a load balancer reads', async () => {
    const up = await app.inject({ method: 'GET', url: '/ready' })
    expect(up.statusCode).toBe(200)
    expect(up.json()).toMatchObject({ database: 'connected' })

    db.down = true
    try {
      const down = await app.inject({ method: 'GET', url: '/ready' })
      expect(down.statusCode).toBe(503)
      expect(down.json()).toMatchObject({ status: 'error', database: 'disconnected' })
    } finally {
      db.down = false
    }
  })

  it('render.yaml health-checks /ready, not a path that answers 401', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const yaml = readFileSync(join(__dirname, '..', '..', '..', 'render.yaml'), 'utf8')
    const path = /^\s*healthCheckPath:\s*(\S+)\s*$/m.exec(yaml)?.[1]
    expect(path).toBe('/ready')
  })

  it('GET /live is public', async () => {
    const res = await app.inject({ method: 'GET', url: '/live' })
    expect(res.statusCode).toBe(200)
  })

  it('GET /docs serves the Swagger UI', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs' })

    // Swagger UI answers the bare path with a redirect to /docs/static/index.html.
    expect([200, 302]).toContain(res.statusCode)
  })
})

describe('auth guard', () => {
  // Every one of these must be rejected before the handler runs. If the
  // preHandler allowlist ever grows a wildcard, these turn red.
  it.each([
    ['/api/products'],
    ['/api/invoices'],
    ['/api/customers'],
    ['/api/warehouses'],
    ['/api/accounting/accounts'],
  ])('GET %s without a token is rejected', async (url) => {
    const res = await app.inject({ method: 'GET', url })

    expect(res.statusCode).toBe(401)
  })

  it('rejects a malformed bearer token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/invoices',
      headers: { authorization: 'Bearer not-a-real-token' },
    })

    expect(res.statusCode).toBe(401)
  })

  it('does not leak a stack trace on rejection', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/invoices' })

    expect(res.body).not.toContain('at ')
    expect(res.body.toLowerCase()).not.toContain('supabase')
  })
})

describe('public auth routes', () => {
  it('POST /api/auth/login is reachable without a token', async () => {
    // An empty body must fail validation (400), not authentication (401) —
    // that is what proves the route is on the public allowlist.
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {},
    })

    expect(res.statusCode).not.toBe(401)
    expect(res.statusCode).toBeGreaterThanOrEqual(400)
    expect(res.statusCode).toBeLessThan(500)
  })

  it('rejects a login payload with an invalid email before touching the database', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'not-an-email', password: 'whatever123' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('serializes a validation failure instead of collapsing into a 500', async () => {
    // Regression: the hand-rolled zod→JSON-schema converter listed every field
    // as required, including `.optional()` ones. The 400 response schema
    // declares an optional `details`, so fast-json-stringify threw when the
    // error handler omitted it — turning every bad-input 400 into a 500 and
    // hiding the validation message from the client.
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'not-an-email', password: 'x' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.statusCode).not.toBe(500)
    // The body must still be readable JSON, not a serializer failure page.
    expect(() => res.json()).not.toThrow()
  })
})

describe('unknown routes', () => {
  it('answers 401, not 404, for an unauthenticated unknown path', async () => {
    // ⚠️ This test used to assert 404, and passed only because '/api' was in
    // the public-paths list in index.ts. That list is matched with
    // `url.startsWith(p)`, so '/api' made EVERY /api/* route public — a
    // global authentication bypass, not an API-hygiene nicety.
    //
    // With the entry removed, an unknown path now falls through to
    // authenticate() and answers 401. That is also the better behaviour on its
    // own merits: an unauthenticated caller learning which /api paths exist
    // from the 404-vs-401 difference is route enumeration.
    const res = await app.inject({ method: 'GET', url: '/api/definitely-not-a-route' })

    expect(res.statusCode).toBe(401)
  })

  it('still answers 404 for an unknown path that is genuinely public', async () => {
    // The counterweight: authentication must not have swallowed routing
    // entirely. A public prefix still resolves to a real 404.
    const res = await app.inject({ method: 'GET', url: '/api/health/not-a-real-subpath' })

    expect(res.statusCode).toBe(404)
  })
})
