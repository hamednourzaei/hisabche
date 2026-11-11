// ============================================
// backend/src/__tests__/v59-1-role-archetype-refusal.test.ts
//
// Proves role × archetype server enforcement through REAL `requireCapability`
// middleware + `buildServer()` + `app.inject()`:
//   1. Even if a user bypasses a hidden navigation item or hidden UI tab and calls
//      the HTTP endpoint directly, the Fastify server returns 403 CAPABILITY_REQUIRED.
//   2. Tests restricted actors across Exchange, Salon, Clothing, Mobile, and Gold
//      archetype routes + owner-only workspace/governance destinations.
// ============================================

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

const WS1 = '22222222-2222-4222-8222-222222222221'
const USER1 = '11111111-1111-4111-8111-111111111111'

const currentTenancy: {
  workspaceId: string
  userId: string
  role: 'owner' | 'manager' | 'seller'
  capabilities?: ReadonlySet<string> | null
} = {
  workspaceId: WS1,
  userId: USER1,
  role: 'seller',
}

const emptyBuilder = (): Record<string, unknown> => {
  const b: Record<string, unknown> = {
    select: () => b,
    insert: () => b,
    update: () => b,
    delete: () => b,
    eq: () => b,
    is: () => b,
    in: () => b,
    order: () => b,
    limit: () => b,
    returns: () => b,
    single: async () => ({ data: null, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject),
  }
  return b
}

vi.mock('../db', () => ({
  supabase: {
    from: () => emptyBuilder(),
    rpc: async () => ({ data: null, error: null }),
  },
}))
vi.mock('../middleware/auth.middleware', () => ({
  authenticate: async (req: { userId?: string }) => {
    req.userId = currentTenancy.userId
  },
}))
vi.mock('../middleware/workspace.middleware', () => ({
  requireWorkspaceContext: async (req: { tenancy?: unknown }) => {
    req.tenancy = {
      workspaceId: currentTenancy.workspaceId,
      userId: currentTenancy.userId,
      role: currentTenancy.role,
      ...(currentTenancy.capabilities !== undefined
        ? { capabilities: currentTenancy.capabilities }
        : {}),
    }
  },
}))

let app: FastifyInstance

beforeAll(async () => {
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
})

beforeEach(() => {
  currentTenancy.role = 'seller'
  delete currentTenancy.capabilities
})

describe('V59.1 Role × Archetype server HTTP refusal enforcement', () => {
  it.each([
    // Salon stylist (`seller`) trying team commissions / rate mutations
    { method: 'GET' as const, url: '/api/provider-commissions?from=2026-11-01&to=2026-11-11' },
    {
      method: 'PUT' as const,
      url: '/api/provider-commissions/rates',
      payload: { employeeId: USER1, rateBp: 2500 },
    },
    // Clothing / Exchange / Mobile seller trying financial variant report
    { method: 'GET' as const, url: '/api/accounting/profit-report/variants' },
    // Mobile cashier (`seller`) trying serial hold lock (`product.write` / manager default)
    {
      method: 'POST' as const,
      url: `/api/operations/serials/${USER1}/hold`,
      payload: { customerId: USER1 },
    },
    // Gold shop cashier (`seller`) trying to mutate metal board rate or run cashbox/gl admin actions
    {
      method: 'POST' as const,
      url: '/api/metal-rates',
      payload: { rateDate: '2026-11-11', rate24kMinorPerGram: 420000 },
    },
    // Exchange teller (`seller`) trying owner/manager settings update
    {
      method: 'PUT' as const,
      url: '/api/fx/settings',
      payload: { kycThresholdMinor: 500000 },
    },
    // Seller trying return scrap decision (`stock.adjust`)
    {
      method: 'POST' as const,
      url: `/api/invoices/${USER1}/returns`,
      payload: {
        returnType: 'sale_return',
        returnNumber: 'RET-1',
        returnDate: '2026-11-11',
        lines: [{ originalLineId: USER1, returnQuantity: 1, restockChoice: 'scrap' }],
      },
      // A seller MAY take a return; only the scrap decision is refused, with its own code.
      code: 'RETURN_STOCK_DECISION_NOT_PERMITTED',
    },
  ])(
    'seller receives HTTP 403 CAPABILITY_REQUIRED on hidden/restricted route $method $url',
    async (tc) => {
      currentTenancy.role = 'seller'
      const res = await app.inject({
        method: tc.method,
        url: tc.url,
        ...(tc.payload ? { payload: tc.payload } : {}),
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().code).toBe(('code' in tc && tc.code) || 'CAPABILITY_REQUIRED')
    },
  )

  it('manager receives HTTP 403 CAPABILITY_REQUIRED on owner-only governance destinations', async () => {
    currentTenancy.role = 'manager'
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/invoices/${USER1}`,
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('CAPABILITY_REQUIRED')
  })

  it('custom restricted profile (capabilities without invoice.create) refuses repair ticket create across archetypes', async () => {
    currentTenancy.role = 'seller'
    currentTenancy.capabilities = new Set(['invoice.read', 'customer.read'])
    const res = await app.inject({
      method: 'POST',
      url: '/api/repair-tickets',
      payload: {
        customerId: USER1,
        deviceLabel: 'iPhone 15',
        problem: 'Screen',
      },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('CAPABILITY_REQUIRED')
  })
})
