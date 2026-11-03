// ============================================
// backend/src/__tests__/order-deposit-customer-list.test.ts
//
// GET /api/customers/:id/deposits — the customer's advances, each with what is
// left of it. This is the read the customer page's payments tab calls, so what
// matters here is what that screen receives:
//
//   · the remainder comes from the DATABASE's `order_deposit_balance`, the same
//     function apply/refund validate against — not a sum made up in the service;
//   · a row written before `posting_status` existed is «unknown», never «posted»;
//   · a failed balance read is a 500, NOT «no deposits» (error and empty are two
//     different answers);
//   · the read is scoped by workspace AND customer.
// ============================================

import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const state: {
  rows: Row[]
  rowError: { message: string } | null
  balance: Row | null
  balanceError: { message: string } | null
  rpcCalls: Array<{ name: string; params: Row }>
  filters: Array<[string, unknown]>
} = {
  rows: [],
  rowError: null,
  balance: null,
  balanceError: null,
  rpcCalls: [],
  filters: [],
}

function fromChain() {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  chain.select = self
  chain.eq = (column: string, value: unknown) => {
    state.filters.push([column, value])
    return chain
  }
  chain.order = async () => ({ data: state.rows, error: state.rowError })
  return chain
}

vi.mock('../db', () => ({
  supabase: {
    from: () => fromChain(),
    rpc: async (name: string, params: Row) => {
      state.rpcCalls.push({ name, params })
      return { data: state.balance, error: state.balanceError }
    },
  },
}))

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: async (request: { user?: unknown }) => {
    request.user = { id: 'u-1' }
  },
}))
vi.mock('../middleware/workspace.middleware', () => ({
  requireWorkspaceContext: async (request: { tenancy?: unknown }) => {
    request.tenancy = { workspaceId: 'ws-1', userId: 'u-1', role: 'manager' }
  },
}))
vi.mock('../middleware/authorize.middleware', () => ({
  requireCapability: (capability: string) => async () => {
    capabilities.push(capability)
    return undefined
  },
}))

// Hoisted with the mock factory: the route's guard records what it was asked for.
const capabilities = vi.hoisted(() => [] as string[])

vi.mock('../services/accounting', () => ({
  ledger: {
    ensureAccountsForRoles: async () => ({ accounts: {}, missing: [] }),
    postDocument: async () => ({ status: 'posted', entryId: 'je', entryNumber: 'JV-1' }),
  },
}))
vi.mock('../services/base-currency', () => ({
  baseCurrencyOf: async () => 'AFN',
}))
vi.mock('../utils/money-cache', () => ({
  invalidateMoneyCaches: async () => undefined,
}))

import { orderDepositRoutes } from '../routes/order-deposit.routes'

const CUSTOMER = 'c0000000-0000-4000-8000-000000000001'

const depositRow = (overrides: Row = {}): Row => ({
  id: '20000000-0000-4000-8000-000000000001',
  workspace_id: 'ws-1',
  order_id: '00000000-0000-4000-8000-0000000000aa',
  customer_id: CUSTOMER,
  amount_minor: 100_000,
  payment_method: 'cash',
  applied_invoice_id: null,
  currency: 'AFN',
  posting_status: 'posted',
  journal_entry_id: 'je-receipt',
  created_at: '2026-11-03T00:00:00Z',
  ...overrides,
})

beforeEach(() => {
  state.rows = [depositRow()]
  state.rowError = null
  state.balance = {
    deposit_id: '20000000-0000-4000-8000-000000000001',
    amount_minor: 100_000,
    applied_minor: 40_000,
    refunded_minor: 10_000,
    remaining_minor: 50_000,
  }
  state.balanceError = null
  state.rpcCalls = []
  state.filters = []
  capabilities.length = 0
})

const get = async () => {
  const app = Fastify()
  app.register(orderDepositRoutes)
  return app.inject({ method: 'GET', url: `/api/customers/${CUSTOMER}/deposits` })
}

describe('GET /api/customers/:id/deposits', () => {
  it('answers with what the screen shows, counting the remainder in the database', async () => {
    const response = await get()
    expect(response.statusCode).toBe(200)

    expect(response.json().data).toEqual([
      {
        id: '20000000-0000-4000-8000-000000000001',
        orderId: '00000000-0000-4000-8000-0000000000aa',
        customerId: CUSTOMER,
        currency: 'AFN',
        paymentMethod: 'cash',
        postingStatus: 'posted',
        journalEntryId: 'je-receipt',
        createdAt: '2026-11-03T00:00:00Z',
        amountMinor: 100_000,
        appliedMinor: 40_000,
        refundedMinor: 10_000,
        remainingMinor: 50_000,
        status: 'partially_used',
        pendingSync: false,
      },
    ])

    // The remainder is the database's count, not a subtraction this service made.
    expect(state.rpcCalls).toEqual([
      {
        name: 'order_deposit_balance',
        params: {
          p_workspace_id: 'ws-1',
          p_deposit_id: '20000000-0000-4000-8000-000000000001',
        },
      },
    ])
  })

  it('is scoped by workspace and customer, and asks for invoice.read', async () => {
    await get()
    expect(state.filters).toEqual([
      ['workspace_id', 'ws-1'],
      ['customer_id', CUSTOMER],
    ])
    expect(capabilities).toContain('invoice.read')
  })

  it('calls a deposit with no posting status unknown, never posted', async () => {
    state.rows = [
      depositRow({ posting_status: null, journal_entry_id: null }),
      depositRow({ id: '20000000-0000-4000-8000-000000000002', posting_status: 'pending_posting' }),
    ]
    const response = await get()
    expect(response.json().data.map((view: Row) => view.status)).toEqual([
      'posting_unknown',
      'pending_posting',
    ])
  })

  it('a balance that cannot be read is a failure, not an empty list', async () => {
    state.balanceError = { message: 'connection reset' }
    const response = await get()
    expect(response.statusCode).toBe(500)
    expect(response.json().error).toBe('Failed to read the customer deposits')
  })

  it('a failed deposit read is a failure, not «no deposits»', async () => {
    state.rows = []
    state.rowError = { message: 'permission denied for table order_deposits' }
    const response = await get()
    expect(response.statusCode).toBe(500)
    expect(response.json().error).toBe('Failed to read the customer deposits')
  })
})
