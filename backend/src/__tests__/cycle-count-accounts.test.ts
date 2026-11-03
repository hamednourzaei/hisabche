// ============================================
// backend/src/__tests__/cycle-count-accounts.test.ts
//
// Owner decision CC: a stock count's shortage and surplus use TWO separate accounts, and no account is ever
// guessed. These tests drive the REAL CycleCountService (only the database, the ledger and the costing core
// are replaced) and the REAL route:
//
//   · accounts present  → ONE call to cycle_count_finish carrying the balanced shrinkage / gain lines;
//   · accounts missing  → the count is held in `pending_accounts`, nothing is adjusted, nothing is posted;
//   · `provisionAccounts` creates the standard accounts — only for someone who may manage accounts;
//   · the migration is not applied and value moved → refused, never completed silently without its entry;
//   · a clean count needs no account at all.
// ============================================

import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Rpc = { data: unknown; error: { code?: string; message: string } | null }
const state = {
  count: null as null | { id: string; status: string; warehouse_id: string; lines: unknown[] },
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  rpcResult: { data: 'completed', error: null } as Rpc,
  holdCalls: 0,
  holdError: null as null | { code?: string; message: string },
  resolved: { accounts: {} as Record<string, string>, missing: [] as string[] },
  ensured: { accounts: {} as Record<string, string>, missing: [] as string[] },
  ensureCalls: 0,
  /** Open cost layers returned by the (replaced) costing core. */
  layers: [] as unknown[],
}

vi.mock('../db', () => ({
  supabase: {
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ name, args })
      return state.rpcResult
    },
    from: () => ({
      update: () => ({
        eq: () => ({
          eq: () => ({
            in: () => ({
              select: async () => {
                state.holdCalls += 1
                return state.holdError
                  ? { data: null, error: state.holdError }
                  : { data: [{ id: 'c-1' }], error: null }
              },
            }),
          }),
        }),
      }),
    }),
  },
}))

vi.mock('../services/accounting', () => ({
  ledger: {
    resolveAccountsByRole: async () => state.resolved,
    ensureAccountsForRoles: async () => {
      state.ensureCalls += 1
      return state.ensured
    },
  },
}))

vi.mock('../services/inventory-costing', () => ({
  costing: { getLayers: async () => ({ layers: state.layers }) },
}))

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: async (request: { user?: unknown }) => {
    request.user = { id: 'u-1' }
  },
}))
const role = { value: 'manager' }
vi.mock('../middleware/workspace.middleware', () => ({
  requireWorkspaceContext: async (request: { tenancy?: unknown }) => {
    request.tenancy = { workspaceId: 'ws-1', userId: 'u-1', role: role.value }
  },
}))
vi.mock('../middleware/authorize.middleware', () => ({
  requireCapability: () => async () => {},
}))

import { cycleCountRoutes } from '../routes/cycle-count.routes'
import { CycleCountService } from '../services/inventory/cycle-count.service'

const P1 = '20000000-0000-4000-8000-000000000001'

/** A count whose one counted line is SHORT by 3 units. The costing mock has no layers, so the shortage is priced 0. */
function openCount(status = 'counting') {
  state.count = {
    id: 'c-1',
    status,
    warehouse_id: 'wh-1',
    lines: [{ product_id: P1, expected_qty: 10, counted_qty: 7 }],
  }
}

beforeEach(() => {
  state.rpcCalls = []
  state.rpcResult = { data: 'completed', error: null }
  state.holdCalls = 0
  state.holdError = null
  state.resolved = { accounts: {}, missing: [] }
  state.ensured = { accounts: {}, missing: [] }
  state.ensureCalls = 0
  state.layers = []
  role.value = 'manager'
  vi.spyOn(CycleCountService.prototype, 'get').mockImplementation(async () => state.count as never)
})

const ctx = { workspaceId: 'ws-1', userId: 'u-1', role: 'manager' } as never

describe('CycleCountService.complete — a count with no valued variance', () => {
  it('needs no account: it finishes through cycle_count_finish with no journal lines', async () => {
    openCount()
    // No cost layers => the priced shortage is worth 0, so no value moved.
    await new CycleCountService().complete(ctx, 'c-1')
    expect(state.rpcCalls[0]?.name).toBe('cycle_count_finish')
    expect(state.rpcCalls[0]?.args.p_journal_lines).toEqual([])
    expect(state.holdCalls).toBe(0)
  })
})

describe('CycleCountService.complete — a count that moved value (shortage of 3 units at 10 = 30)', () => {
  beforeEach(() => {
    // 10 units on the shelf at 10 each; the count found 7.
    state.layers = [{ remainingQty: 10, unitCost: 10 }]
  })

  it('posts ONE balanced entry on the shrinkage account — through the single atomic call', async () => {
    openCount()
    state.resolved = { accounts: { inventory: 'a-inv', inventory_shrinkage: 'a-shr' }, missing: [] }
    await new CycleCountService().complete(ctx, 'c-1')

    expect(state.rpcCalls).toHaveLength(1)
    const args = state.rpcCalls[0]!.args
    expect(state.rpcCalls[0]!.name).toBe('cycle_count_finish')
    expect(args.p_journal_lines).toEqual([
      { account_id: 'a-shr', debit: 30, credit: 0 },
      { account_id: 'a-inv', debit: 0, credit: 30 },
    ])
    expect(args.p_shortage_value).toBe(30)
    expect(args.p_surplus_value).toBe(0)
    expect(state.holdCalls).toBe(0)
  })

  it('a missing account is NEVER guessed: the count waits in pending_accounts, nothing is adjusted or posted', async () => {
    openCount()
    state.resolved = {
      accounts: { inventory: 'a-inv' },
      missing: ['inventory_shrinkage'],
    }
    const result = (await new CycleCountService().complete(ctx, 'c-1')) as unknown as {
      pendingAccounts: string[]
    }

    expect(result.pendingAccounts).toEqual(['inventory_shrinkage'])
    expect(state.holdCalls).toBe(1)
    expect(state.rpcCalls).toEqual([])
    expect(state.ensureCalls).toBe(0)
  })

  it('provisionAccounts creates the standard accounts, then posts', async () => {
    openCount('pending_accounts')
    state.ensured = { accounts: { inventory: 'a-inv', inventory_shrinkage: 'a-shr' }, missing: [] }
    await new CycleCountService().complete(ctx, 'c-1', { provisionAccounts: true })

    expect(state.ensureCalls).toBe(1)
    expect(state.rpcCalls[0]!.args.p_journal_lines).toEqual([
      { account_id: 'a-shr', debit: 30, credit: 0 },
      { account_id: 'a-inv', debit: 0, credit: 30 },
    ])
  })

  it('without the finish function (migration not applied) it REFUSES — money never moves silently', async () => {
    openCount()
    state.resolved = { accounts: { inventory: 'a-inv', inventory_shrinkage: 'a-shr' }, missing: [] }
    state.rpcResult = { data: null, error: { code: '42883', message: 'function does not exist' } }
    await expect(new CycleCountService().complete(ctx, 'c-1')).rejects.toThrow(
      /CYCLE_COUNT_MIGRATION_REQUIRED/,
    )
    // Only the one attempt at the new function; the older no-journal path was NOT used.
    expect(state.rpcCalls.map((call) => call.name)).toEqual(['cycle_count_finish'])
  })

  it('holding a count when the status list does not know pending_accounts yet asks for the migration', async () => {
    openCount()
    state.resolved = { accounts: {}, missing: ['inventory', 'inventory_shrinkage'] }
    state.holdError = { code: '23514', message: 'violates check constraint' }
    await expect(new CycleCountService().complete(ctx, 'c-1')).rejects.toThrow(
      /CYCLE_COUNT_MIGRATION_REQUIRED/,
    )
  })

  it('a locked period is a coded refusal, not a 500', async () => {
    openCount()
    state.resolved = { accounts: { inventory: 'a-inv', inventory_shrinkage: 'a-shr' }, missing: [] }
    state.rpcResult = { data: null, error: { code: 'P0001', message: 'ACCOUNTING_PERIOD_LOCKED' } }
    await expect(new CycleCountService().complete(ctx, 'c-1')).rejects.toThrow(
      /ACCOUNTING_PERIOD_LOCKED/,
    )
  })
})

describe('CycleCountService.complete — status', () => {
  it('refuses a count that is already completed', async () => {
    openCount('completed')
    await expect(new CycleCountService().complete(ctx, 'c-1')).rejects.toThrow(
      /CYCLE_COUNT_NOT_OPEN/,
    )
    expect(state.rpcCalls).toEqual([])
  })

  it('accepts a count waiting for its accounts', async () => {
    openCount('pending_accounts')
    await new CycleCountService().complete(ctx, 'c-1')
    expect(state.rpcCalls[0]?.name).toBe('cycle_count_finish')
  })
})

describe('POST /api/cycle-counts/:id/complete', () => {
  const post = async (payload: Record<string, unknown> | undefined) => {
    const app = Fastify()
    await app.register(cycleCountRoutes)
    return app.inject({
      method: 'POST',
      url: '/api/cycle-counts/c-1/complete',
      ...(payload ? { payload } : {}),
    })
  }

  it('provisioning accounts needs account.manage — a seller is refused and nothing runs', async () => {
    openCount()
    role.value = 'seller'
    const res = await post({ provisionAccounts: true })
    expect(res.statusCode).toBe(403)
    expect(state.rpcCalls).toEqual([])
    expect(state.ensureCalls).toBe(0)
  })

  it('a manager may ask for it (the clean count here needs none, so none is created)', async () => {
    openCount()
    const res = await post({ provisionAccounts: true })
    expect(res.statusCode).toBe(200)
    expect(state.ensureCalls).toBe(0)
  })

  it('refuses a body it does not know', async () => {
    openCount()
    const res = await post({ postEverythingAnyway: true })
    expect(res.statusCode).toBe(400)
    expect(state.rpcCalls).toEqual([])
  })

  it('works with no body at all', async () => {
    openCount()
    expect((await post(undefined)).statusCode).toBe(200)
  })
})
