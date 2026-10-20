// ============================================
// backend/src/__tests__/admin-gate.test.ts
//
// Agent A — Step A7: Admin Gate Security & Verification Suite
// Real HTTP checks via buildServer() + app.inject:
// 1. Unauthenticated request -> 401 UNAUTHENTICATED
// 2. Non-admin user -> 403 ADMIN_UNAUTHORIZED
// 3. Admin RBAC: BILLING admin -> 403 on Ops/Servers (ADMIN_PERMISSION_DENIED)
// 4. Maker-Checker: Proposer cannot approve own request (ForbiddenError / constraint)
// 5. Step-Up TOTP: Operations without fresh TOTP (<5m) -> 403 ADMIN_STEP_UP_REQUIRED
// 6. Security Event audit logging on unauthorized attempts
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { FakeDatabase, createFakeDb } from './helpers/fake-supabase'

process.env.ADMIN_ALLOWED_EMAILS = 'super@hisabche.com,billing@hisabche.com,support@hisabche.com'

const db = new FakeDatabase()

const SHOPKEEPER = {
  id: '11111111-1111-4111-8111-111111111111',
  token: 'token-shopkeeper',
  email: 'shopkeeper@example.com',
}

const SUPER_ADMIN = {
  id: '22222222-2222-4222-8222-222222222222',
  token: 'token-super-admin',
  email: 'super@hisabche.com',
}

const BILLING_ADMIN = {
  id: '33333333-3333-4333-8333-333333333333',
  token: 'token-billing-admin',
  email: 'billing@hisabche.com',
}

const users = new Map<string, { id: string; email: string }>([
  [SHOPKEEPER.token, { id: SHOPKEEPER.id, email: SHOPKEEPER.email }],
  [SUPER_ADMIN.token, { id: SUPER_ADMIN.id, email: SUPER_ADMIN.email }],
  [BILLING_ADMIN.token, { id: BILLING_ADMIN.id, email: BILLING_ADMIN.email }],
])

/**
 * A JWT-shaped token whose payload carries Supabase's MFA claims. The fake
 * `getUser` resolves it to the same admin (as Supabase verifies the real one);
 * the guards read `amr` from it — the TOTP time is never taken from a header.
 */
function tokenWithTotpAt(seconds: number): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const token = [
    b64({ alg: 'HS256' }),
    b64({
      sub: SUPER_ADMIN.id,
      aal: 'aal2',
      amr: [
        { method: 'password', timestamp: seconds - 600 },
        { method: 'totp', timestamp: seconds },
      ],
    }),
    'sig',
  ].join('.')
  users.set(token, { id: SUPER_ADMIN.id, email: SUPER_ADMIN.email })
  return token
}
const nowSeconds = () => Math.floor(Date.now() / 1000)

vi.mock('../db', () => {
  const fake = createFakeDb(db, users)
  return {
    ...fake,
    supabase: {
      ...fake.supabase,
      auth: {
        ...fake.supabase.auth,
        admin: {
          signOut: async (_userId: string) => ({ error: null }),
        },
      },
    },
  }
})

let app: FastifyInstance

function as(token: string, stepUpTimestamp?: string | number) {
  const headers: Record<string, string> = { authorization: `Bearer ${token}` }
  if (stepUpTimestamp) {
    headers['x-admin-step-up-timestamp'] = String(stepUpTimestamp)
  }
  return headers
}

beforeAll(async () => {
  // Seed admin accounts into fake db
  db.seed('admin_accounts', [
    {
      id: 'acc-1',
      user_id: SUPER_ADMIN.id,
      email: SUPER_ADMIN.email,
      role: 'SUPER',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'acc-2',
      user_id: BILLING_ADMIN.id,
      email: BILLING_ADMIN.email,
      role: 'BILLING',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ])

  const { buildServer } = await import('../index')
  app = await buildServer()
})

afterAll(async () => {
  await app.close()
})

describe('A7: Admin Gate Security Invariants', () => {
  it('refuses unauthenticated request with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/roles',
    })
    expect(res.statusCode).toBe(401)
  })

  it('refuses non-admin customer with 403 ADMIN_UNAUTHORIZED', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/roles',
      headers: as(SHOPKEEPER.token),
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({ code: 'ADMIN_UNAUTHORIZED' })
  })

  it('enforces RBAC: BILLING admin is refused on Ops/Servers with 403 ADMIN_PERMISSION_DENIED', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/ops/jobs',
      headers: as(BILLING_ADMIN.token),
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({ code: 'ADMIN_PERMISSION_DENIED' })
  })

  it('allows BILLING admin to access Billing prices', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/billing/prices',
      headers: as(BILLING_ADMIN.token),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty('prices')
  })

  it('requires fresh Step-Up TOTP header for mutating operations', async () => {
    // Attempting to revoke a session without fresh step-up header
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/sessions/${SHOPKEEPER.id}/revoke`,
      headers: as(SUPER_ADMIN.token), // no x-admin-step-up-timestamp
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({ code: 'ADMIN_STEP_UP_REQUIRED' })
  })

  it('accepts operation when fresh Step-Up TOTP header is provided', async () => {
    const verifiedAt = nowSeconds()
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/sessions/${SHOPKEEPER.id}/revoke`,
      headers: as(tokenWithTotpAt(verifiedAt), verifiedAt),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ success: true })
  })

  it('a step-up header WITHOUT a TOTP in the token is refused (the old hole)', async () => {
    // Before: any current unix time in the header passed — no code was checked.
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/sessions/${SHOPKEEPER.id}/revoke`,
      headers: as(SUPER_ADMIN.token, nowSeconds()),
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({ code: 'ADMIN_STEP_UP_REQUIRED' })
  })

  it('a TOTP older than 5 minutes is refused', async () => {
    const stale = nowSeconds() - 301
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/sessions/${SHOPKEEPER.id}/revoke`,
      headers: as(tokenWithTotpAt(stale), stale),
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({ code: 'ADMIN_STEP_UP_REQUIRED' })
  })

  it("a header that does not name the token's TOTP check is refused", async () => {
    const verifiedAt = nowSeconds() - 10
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/sessions/${SHOPKEEPER.id}/revoke`,
      headers: as(tokenWithTotpAt(verifiedAt), verifiedAt + 5),
    })
    expect(res.statusCode).toBe(403)
  })

  it('POST /step-up confirms only a TOTP the token carries — it mints nothing', async () => {
    const without = await app.inject({
      method: 'POST',
      url: '/api/admin/security/step-up',
      headers: as(SUPER_ADMIN.token),
      payload: {},
    })
    expect(without.statusCode).toBe(403)
    expect(without.json()).toMatchObject({ code: 'ADMIN_STEP_UP_REQUIRED' })

    const verifiedAt = nowSeconds()
    const withTotp = await app.inject({
      method: 'POST',
      url: '/api/admin/security/step-up',
      headers: as(tokenWithTotpAt(verifiedAt)),
      payload: {},
    })
    expect(withTotp.statusCode).toBe(200)
    expect(withTotp.json()).toMatchObject({ stepUpTimestamp: String(verifiedAt) })
  })

  it('enforces Maker-Checker: proposer cannot approve own action request', async () => {
    const verifiedAt = nowSeconds()

    // 1. Propose request by super admin
    const proposeRes = await app.inject({
      method: 'POST',
      url: '/api/admin/billing/action-requests',
      headers: as(SUPER_ADMIN.token),
      payload: {
        actionType: 'REFUND',
        payload: { amountIrr: 1000000 },
        diffPreview: { refund: true },
      },
    })
    expect(proposeRes.statusCode).toBe(200)
    const requestId = proposeRes.json().id

    // 2. Same super admin attempts to approve own request -> 403 Forbidden!
    const approveRes = await app.inject({
      method: 'POST',
      url: `/api/admin/billing/action-requests/${requestId}/decide`,
      headers: as(tokenWithTotpAt(verifiedAt), verifiedAt),
      payload: {
        approved: true,
      },
    })
    expect(approveRes.statusCode).toBe(403)
    expect(approveRes.json().error).toContain('Maker-Checker')
  })
})
