import { describe, expect, it, vi, beforeEach } from 'vitest'

const state = {
  policy: {
    id: 'pol-1',
    workspace_id: 'ws-1',
    basis: 'revenue_share',
    source_account_ids: ['11111111-1111-4111-8111-111111111111'],
    target_dimension_id: '22222222-2222-4222-8222-222222222222',
    manual_weights: null,
    version: 1,
    is_active: true,
  } as Record<string, unknown> | null,
  runs: [] as Array<Record<string, unknown>>,
  postedDocs: [] as unknown[],
  reversedDocs: [] as unknown[],
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => {
      const filters: Record<string, unknown> = {}
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (c: string, v: unknown) => {
          filters[c] = v
          return chain
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === 'overhead_policies') return { data: state.policy, error: null }
          if (table === 'overhead_allocation_runs') {
            const found = state.runs.find(
              (r) =>
                (!filters.idempotency_key || r.idempotency_key === filters.idempotency_key) &&
                (!filters.id || r.id === filters.id),
            )
            return { data: found ?? null, error: null }
          }
          return { data: null, error: null }
        },
        insert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              const saved = { id: `run-${state.runs.length + 1}`, ...row }
              if (table === 'overhead_allocation_runs') state.runs.push(saved)
              return { data: saved, error: null }
            },
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: () => ({
            eq: async () => {
              if (table === 'overhead_allocation_runs' && state.runs[0]) {
                Object.assign(state.runs[0], patch)
              }
              return { error: null }
            },
          }),
        }),
      }
      return chain
    },
  },
}))

vi.mock('../services/base-currency', () => ({
  baseCurrencyOf: async () => 'AFN',
}))

vi.mock('../services/accounting/accounting.service', () => {
  const impl = {
    postDocument: async (_ctx: unknown, req: unknown) => {
      state.postedDocs.push(req)
      return { status: 'posted', entryId: 'je-1', entryNumber: 'JE-001' }
    },
    reverseDocument: async (_ctx: unknown, type: string, id: string, opts: unknown) => {
      state.reversedDocs.push({ type, id, opts })
      return { status: 'posted', entryId: 'je-rev-1', entryNumber: 'JE-002' }
    },
  }
  return {
    accountingService: impl,
    AccountingService: class {
      postDocument = impl.postDocument
      reverseDocument = impl.reverseDocument
    },
  }
})

describe('V61 §2.7 OverheadAllocationService', () => {
  beforeEach(() => {
    state.runs = []
    state.postedDocs = []
    state.reversedDocs = []
  })

  it('posts once per period (re-run is no-op), refuses unknown cost, and reverses via ledger.reverseDocument', async () => {
    const { overheadAllocationService } =
      await import('../services/accounting/overhead-allocation.service')
    const ctx = { workspaceId: 'ws-1', userId: 'u-1', role: 'owner' } as never

    // Unknown cost stays unknown (never 0)
    await expect(
      overheadAllocationService.runAllocation(ctx, {
        period: '2026-11',
        entryDate: '2026-11-30',
        poolAmountMinor: null,
        targets: [{ dimensionValueId: '33333333-3333-4333-8333-333333333333', driverValue: 100 }],
      }),
    ).rejects.toThrow('OVERHEAD_COST_UNKNOWN')

    // First run posts one balanced journal document
    const first = await overheadAllocationService.runAllocation(ctx, {
      period: '2026-11',
      entryDate: '2026-11-30',
      poolAmountMinor: 1000,
      targets: [
        { dimensionValueId: '33333333-3333-4333-8333-333333333333', driverValue: 1 },
        { dimensionValueId: '44444444-4444-4444-8444-444444444444', driverValue: 3 },
      ],
    })
    expect(first.replay).toBe(false)
    expect(state.postedDocs).toHaveLength(1)

    // Re-run same period is a no-op
    const second = await overheadAllocationService.runAllocation(ctx, {
      period: '2026-11',
      entryDate: '2026-11-30',
      poolAmountMinor: 1000,
      targets: [
        { dimensionValueId: '33333333-3333-4333-8333-333333333333', driverValue: 1 },
        { dimensionValueId: '44444444-4444-4444-8444-444444444444', driverValue: 3 },
      ],
    })
    expect(second.replay).toBe(true)
    expect(state.postedDocs).toHaveLength(1)

    // Reversal calls ledger.reverseDocument
    await overheadAllocationService.reverseRun(ctx, 'run-1', 'Correction', '2026-11-30')
    expect(state.reversedDocs).toHaveLength(1)
    expect(state.runs[0]!.status).toBe('reversed')
  })
})
