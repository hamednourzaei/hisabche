// ============================================
// V54 5.4 (8 Nov 2026) — materials used by a delivered service session.
//
// Proved with the costing and ledger ports replaced (the database side of
// «once per line» is consume_cost_layers' own `already_consumed`, held by its
// pg test):
//   · a NEW issue writes one stock movement; an `already_consumed` one writes none;
//   · ONE ledger entry per session — Dr cogs / Cr inventory — for the summed cost,
//     keyed by the session, so a retried delivery books nothing new;
//   · zero cost books nothing.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = {
  issues: [] as Array<Record<string, unknown>>,
  issueAnswers: [] as Array<{ status: 'consumed' | 'already_consumed'; totalCost: number }>,
  posts: [] as Array<Record<string, unknown>>,
  inserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
}

vi.mock('../services/inventory-costing', () => ({
  costing: {
    recordIssue: async (_ctx: unknown, request: Record<string, unknown>) => {
      state.issues.push(request)
      const answer = state.issueAnswers.shift() ?? { status: 'consumed', totalCost: 0 }
      return { ...answer, quantity: request.quantity, shortfall: 0 }
    },
  },
}))

vi.mock('../services/accounting', () => ({
  ledger: {
    ensureAccountsForRoles: async () => ({ accounts: { cogs: 'acc-cogs', inventory: 'acc-inv' } }),
    postDocument: async (_ctx: unknown, request: Record<string, unknown>) => {
      state.posts.push(request)
      return { status: 'posted', entryId: 'e1', entryNumber: 'JE-1' }
    },
  },
}))

vi.mock('../db', () => ({ supabase: {} }))

const { ServiceDeliveryService } =
  await import('../services/service-delivery/service-delivery.service')

const SESSION = {
  id: 'ses-1',
  workspace_id: 'ws',
  customer_id: 'c1',
  service_offering_id: 'svc',
  practitioner_id: null,
  branch_id: null,
  session_date: '2026-11-08',
  start_time: '10:00',
  end_time: '11:00',
  duration_minutes: 60,
  status: 'scheduled',
  settlement_method: 'complementary',
  package_credit_id: null,
  invoice_id: null,
  client_notes: null,
  internal_notes: null,
  created_at: 'x',
  updated_at: 'x',
}

function fakeDb() {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq = () => chain
  chain.is = () => chain
  chain.maybeSingle = async () => ({ data: SESSION, error: null })
  return {
    rpc: async () => ({ data: { package_credit_id: null }, error: null }),
    from: (table: string) => ({
      ...chain,
      insert: async (row: Record<string, unknown>) => {
        state.inserts.push({ table, row })
        return { error: null }
      },
    }),
  }
}

const ctx = { workspaceId: 'ws', userId: 'u1', role: 'owner' } as never
const MATERIALS = [
  { productId: 'gel', quantity: 2 },
  { productId: 'tips', quantity: 10 },
]

beforeEach(() => {
  state.issues = []
  state.issueAnswers = []
  state.posts = []
  state.inserts = []
})

describe('materials of a delivered session', () => {
  it('first delivery: one movement per line, one entry for the summed cost', async () => {
    state.issueAnswers = [
      { status: 'consumed', totalCost: 120 },
      { status: 'consumed', totalCost: 30.5 },
    ]
    const service = new ServiceDeliveryService(fakeDb() as never)
    await service.deliver(ctx, 'ses-1', {
      settlementMethod: 'complementary',
      reason: 'r',
      consumables: MATERIALS,
    } as never)

    expect(state.inserts.filter((i) => i.table === 'stock_movements')).toHaveLength(2)
    expect(state.posts).toHaveLength(1)
    expect(state.posts[0]).toMatchObject({
      sourceType: 'stock_adjustment',
      sourceId: 'ses-1',
      date: '2026-11-08',
      lines: [
        { accountId: 'acc-cogs', debit: 150.5, credit: 0 },
        { accountId: 'acc-inv', debit: 0, credit: 150.5 },
      ],
    })
  })

  it('a retried delivery writes no second movement; the entry is asked under the same key', async () => {
    state.issueAnswers = [
      { status: 'already_consumed', totalCost: 120 },
      { status: 'already_consumed', totalCost: 30.5 },
    ]
    const service = new ServiceDeliveryService(fakeDb() as never)
    await service.deliver(ctx, 'ses-1', {
      settlementMethod: 'complementary',
      reason: 'r',
      consumables: MATERIALS,
    } as never)

    expect(state.inserts.filter((i) => i.table === 'stock_movements')).toHaveLength(0)
    // postDocument books a source once; the same key and amount mean «already posted».
    expect(state.posts).toHaveLength(1)
    expect(state.posts[0]).toMatchObject({ sourceId: 'ses-1' })
  })

  it('materials with no cost behind them book nothing', async () => {
    state.issueAnswers = [{ status: 'consumed', totalCost: 0 }]
    const service = new ServiceDeliveryService(fakeDb() as never)
    await service.deliver(ctx, 'ses-1', {
      settlementMethod: 'complementary',
      reason: 'r',
      consumables: [{ productId: 'gel', quantity: 1 }],
    } as never)
    expect(state.posts).toHaveLength(0)
  })
})
