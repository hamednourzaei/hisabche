// ============================================
// The expired-subscription write lock — over real HTTP (fastify.inject).
//
// An owner whose subscription period had ended could still create, edit and
// delete everything, because nothing on the server looked at the period. The
// lock now lives in `requireWorkspaceContext`: a mutating request on an
// EXPIRED workspace answers 402 SUBSCRIPTION_EXPIRED; reads, auth and billing
// keep working; an active subscription is untouched.
//
// The routes below are registered with the REAL preHandlers
// (requireWorkspaceContext, requireActiveSubscriptionForWorkspaceParam) and the
// REAL BillingService; only the database, the membership resolver and the
// cache are faked, so what is under test is the decision and where it runs.
// ============================================

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/* ── In-memory tables that honour eq filters ───────────────────────────── */

type Row = Record<string, unknown>
const tables = new Map<string, Row[]>()
let failSubscriptionReads = false

function rowsOf(table: string): Row[] {
  const existing = tables.get(table)
  if (existing) return existing
  const created: Row[] = []
  tables.set(table, created)
  return created
}

function makeQuery(table: string) {
  const eqs: Array<[string, unknown]> = []
  let patch: Row | null = null
  const matching = () => rowsOf(table).filter((row) => eqs.every(([c, v]) => row[c] === v))
  const failure = () =>
    failSubscriptionReads && table === 'subscriptions'
      ? { data: null, error: { message: 'connection reset' } }
      : null

  const api = {
    select: () => api,
    order: () => api,
    limit: () => api,
    eq: (column: string, value: unknown) => {
      eqs.push([column, value])
      return api
    },
    update: (values: Row) => {
      patch = values
      return api
    },
    maybeSingle: async () => failure() ?? { data: matching()[0] ?? null, error: null },
    single: async () => failure() ?? { data: matching()[0] ?? null, error: null },
    then: (resolve: (v: { data: Row[]; error: null }) => unknown) => {
      const targets = matching()
      if (patch) for (const row of targets) Object.assign(row, patch)
      return Promise.resolve(resolve({ data: targets, error: null }))
    },
  }
  return api
}

vi.mock('../db', () => ({ supabase: { from: (t: string) => makeQuery(t) } }))

/* ── Cache: a Map with the same prefix-invalidation rule as memoryCache ── */

const cache = new Map<string, unknown>()
vi.mock('../utils/pagination', () => ({
  memoryCache: {
    get: async (key: string) => (cache.has(key) ? cache.get(key) : null),
    set: async (key: string, value: unknown) => {
      cache.set(key, value)
    },
    invalidate: async (prefix: string) => {
      for (const key of [...cache.keys()]) if (key.startsWith(prefix)) cache.delete(key)
    },
    // Authorization decisions are never cached without a shared store — as the
    // real memoryCache behaves when Redis is not configured.
    getShared: async () => null,
    setShared: async () => undefined,
  },
}))

vi.mock('../middleware/cache.middleware', () => ({ clearCache: async () => undefined }))

/* ── Membership: the caller is a member of WS only ─────────────────────── */

const WS = 'workspace-1'
const OTHER_WS = 'workspace-2'
const OWNER = 'user-owner'

vi.mock('../services/tenancy.service', async () => {
  const { ForbiddenError } = await import('../errors/auth.error')
  return {
    requireWorkspace: async (userId: string, requested: string | null) => {
      if (requested && requested !== WS) throw new ForbiddenError('No active workspace membership')
      return { workspaceId: WS, userId, role: 'owner' }
    },
  }
})

const { requireWorkspaceContext } = await import('../middleware/workspace.middleware')
const { requireActiveSubscriptionForWorkspaceParam } =
  await import('../middleware/subscription.middleware')
const { BillingService, isSubscriptionExpired } = await import('../services/billing.service')

/* ── App ───────────────────────────────────────────────────────────────── */

const DAY = 24 * 60 * 60 * 1000
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()

async function fakeAuthenticate(request: FastifyRequest) {
  request.userId = OWNER
}

const ok = async (_req: FastifyRequest, reply: FastifyReply) => reply.send({ ok: true })

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify()
  app.decorateRequest('userId', '')
  const guarded = { preHandler: [fakeAuthenticate, requireWorkspaceContext] }

  app.get('/api/invoices', guarded, ok)
  app.post('/api/invoices', guarded, ok)
  app.put('/api/invoices/:id', guarded, ok)
  app.patch('/api/invoices/:id', guarded, ok)
  app.delete('/api/invoices/:id', guarded, ok)
  app.post('/api/billing/upgrade', guarded, ok)
  app.post('/api/operations/budgets/check', guarded, ok)
  app.post('/api/sync/lease', guarded, ok)
  app.patch(
    '/api/workspaces/:id',
    { preHandler: [fakeAuthenticate, requireActiveSubscriptionForWorkspaceParam] },
    ok,
  )
  await app.ready()
  return app
}

function seedSubscription(overrides: Row) {
  rowsOf('subscriptions').push({
    id: 'sub-1',
    user_id: OWNER,
    workspace_id: WS,
    plan: 'pro',
    status: 'active',
    is_trial: false,
    trial_used: true,
    period_end: iso(30 * DAY),
    ...overrides,
  })
}

let app: FastifyInstance

beforeEach(async () => {
  tables.clear()
  cache.clear()
  failSubscriptionReads = false
  rowsOf('workspaces').push({ id: WS, owner_id: OWNER })
  app = await buildApp()
})

afterEach(async () => {
  await app.close()
})

/* ═══════════════════════════════════════════════════════════════════════ */

describe('expired workspace', () => {
  beforeEach(() => seedSubscription({ period_end: iso(-DAY) }))

  it.each([
    ['POST', '/api/invoices'],
    ['PUT', '/api/invoices/inv-1'],
    ['PATCH', '/api/invoices/inv-1'],
    ['DELETE', '/api/invoices/inv-1'],
    ['POST', '/api/sync/lease'],
  ] as const)('%s %s → 402 SUBSCRIPTION_EXPIRED', async (method, url) => {
    const res = await app.inject({ method, url })
    expect(res.statusCode).toBe(402)
    expect(res.json()).toMatchObject({ code: 'SUBSCRIPTION_EXPIRED' })
  })

  it('still serves reads', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/invoices' })
    expect(res.statusCode).toBe(200)
  })

  it('still allows billing/renewal', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/billing/upgrade' })
    expect(res.statusCode).toBe(200)
  })

  it('still allows a read-only POST from the allow-list', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/operations/budgets/check' })
    expect(res.statusCode).toBe(200)
  })

  it('locks workspace-by-:id writes for a member', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/workspaces/${WS}` })
    expect(res.statusCode).toBe(402)
    expect(res.json()).toMatchObject({ code: 'SUBSCRIPTION_EXPIRED' })
  })

  it('answers a non-member 403, never revealing another shop is expired', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/workspaces/${OTHER_WS}` })
    expect(res.statusCode).toBe(403)
  })

  it('unlocks immediately when the subscription is renewed', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/invoices' })).statusCode).toBe(402)

    await new BillingService().upgradeSubscriptionRow('sub-1', 'pro', 'month')

    expect((await app.inject({ method: 'POST', url: '/api/invoices' })).statusCode).toBe(200)
  })

  it('resolves a legacy row without workspace_id through the OWNER, not the actor', async () => {
    tables.set('subscriptions', [])
    seedSubscription({ workspace_id: null, period_end: iso(-DAY) })
    const res = await app.inject({ method: 'POST', url: '/api/invoices' })
    expect(res.statusCode).toBe(402)
  })
})

describe('active workspace', () => {
  beforeEach(() => seedSubscription({}))

  it.each([
    ['POST', '/api/invoices'],
    ['PATCH', '/api/invoices/inv-1'],
    ['DELETE', '/api/invoices/inv-1'],
  ] as const)('%s %s is unaffected', async (method, url) => {
    const res = await app.inject({ method, url })
    expect(res.statusCode).toBe(200)
  })

  it('a trial inside its grace window is not locked', async () => {
    tables.set('subscriptions', [])
    seedSubscription({ is_trial: true, trial_used: false, period_end: iso(-2 * DAY) })
    expect((await app.inject({ method: 'POST', url: '/api/invoices' })).statusCode).toBe(200)
  })
})

describe('unknown is not expired', () => {
  it('no subscription row → writes proceed (nothing positively expired)', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/invoices' })).statusCode).toBe(200)
  })

  it('lookup failure → 500 SUBSCRIPTION_LOOKUP_FAILED, neither granted nor 402', async () => {
    seedSubscription({ period_end: iso(-DAY) })
    failSubscriptionReads = true
    const res = await app.inject({ method: 'POST', url: '/api/invoices' })
    expect(res.statusCode).toBe(500)
    expect(res.json()).toMatchObject({ code: 'SUBSCRIPTION_LOOKUP_FAILED' })
  })
})

describe('isSubscriptionExpired', () => {
  const now = new Date('2026-09-13T00:00:00Z')
  const base = { isTrial: false, trialUsed: true }

  it('period in the past → expired; in the future → not', () => {
    expect(
      isSubscriptionExpired({ ...base, status: 'active', periodEnd: '2026-09-12T00:00:00Z' }, now),
    ).toBe(true)
    expect(
      isSubscriptionExpired({ ...base, status: 'active', periodEnd: '2026-09-14T00:00:00Z' }, now),
    ).toBe(false)
  })

  it('status expired/cancelled → expired even with a future period', () => {
    expect(
      isSubscriptionExpired({ ...base, status: 'expired', periodEnd: '2027-01-01T00:00:00Z' }, now),
    ).toBe(true)
    expect(
      isSubscriptionExpired(
        { ...base, status: 'cancelled', periodEnd: '2027-01-01T00:00:00Z' },
        now,
      ),
    ).toBe(true)
  })

  it('missing or unreadable period_end is not positive knowledge', () => {
    expect(isSubscriptionExpired({ ...base, status: 'active', periodEnd: null }, now)).toBe(false)
    expect(isSubscriptionExpired({ ...base, status: 'active', periodEnd: 'garbage' }, now)).toBe(
      false,
    )
  })
})

describe('the lock is wired where every workspace route passes', () => {
  it('requireWorkspaceContext calls rejectIfSubscriptionExpired', () => {
    const source = readFileSync(
      join(__dirname, '..', 'middleware', 'workspace.middleware.ts'),
      'utf8',
    )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(source).toContain(
      'await rejectIfSubscriptionExpired(request, reply, request.tenancy.workspaceId)',
    )
  })
})
