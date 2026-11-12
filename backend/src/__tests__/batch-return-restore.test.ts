import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockState = {
  products: [{ id: 'prod-1', tracking_mode: 'batch' }] as Array<{
    id: string
    tracking_mode: string
  }>,
  lotAllocations: [] as Array<Record<string, unknown>>,
  batches: [] as Array<{ id: string; remaining_qty: number; received_qty: number }>,
}

function makeChain(table: string) {
  const filters: Record<string, unknown> = {}
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: (col: string, val: unknown) => {
      filters[col] = val
      return chain
    },
    in: (col: string, vals: unknown[]) => {
      filters[`${col}__in`] = vals
      return chain
    },
    not: () => chain,
    order: () => chain,
    single: async () => {
      if (table === 'stock_batches') {
        const b = mockState.batches.find((x) => x.id === filters.id)
        return { data: b ?? null, error: b ? null : { message: 'not found' } }
      }
      return { data: null, error: null }
    },
    insert: async (row: Record<string, unknown>) => {
      if (table === 'lot_allocations') {
        mockState.lotAllocations.push({
          id: `alloc-${mockState.lotAllocations.length + 1}`,
          ...row,
        })
      }
      return { error: null }
    },
    update: (patch: Record<string, unknown>) => ({
      eq: (col: string, val: unknown) => ({
        eq: async (col2: string, val2: unknown) => {
          if (table === 'stock_batches') {
            const id = col === 'id' ? val : val2
            const b = mockState.batches.find((x) => x.id === id)
            if (b && typeof patch.remaining_qty === 'number') b.remaining_qty = patch.remaining_qty
          }
          return { error: null }
        },
      }),
    }),
    then: (resolve: (val: { data: unknown[]; error: null }) => void) => {
      if (table === 'products') {
        resolve({ data: mockState.products, error: null })
      } else if (table === 'lot_allocations') {
        const rows = mockState.lotAllocations.filter(
          (r) =>
            (!filters.consumer_type || r.consumer_type === filters.consumer_type) &&
            (!filters.consumer_id || r.consumer_id === filters.consumer_id) &&
            (!filters.product_id || r.product_id === filters.product_id),
        )
        resolve({ data: rows, error: null })
      } else {
        resolve({ data: [], error: null })
      }
    },
  }
  return chain
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => makeChain(table),
  },
}))

describe('V61 §2.5 batch return restore', () => {
  beforeEach(() => {
    mockState.products = [{ id: 'prod-1', tracking_mode: 'batch' }]
    mockState.batches = [
      { id: 'batch-a', remaining_qty: 0, received_qty: 5 },
      { id: 'batch-b', remaining_qty: 2, received_qty: 5 },
    ]
    mockState.lotAllocations = []
  })

  it('restores exact batch quantities from lot_allocations and is idempotent per returnId', async () => {
    mockState.lotAllocations = [
      {
        id: 'alloc-1',
        workspace_id: 'ws-1',
        product_id: 'prod-1',
        batch_id: 'batch-a',
        consumer_type: 'invoice',
        consumer_id: 'inv-1',
        quantity: 2,
      },
      {
        id: 'alloc-2',
        workspace_id: 'ws-1',
        product_id: 'prod-1',
        batch_id: 'batch-b',
        consumer_type: 'invoice',
        consumer_id: 'inv-1',
        quantity: 3,
      },
    ]

    const { traceabilityService } = await import('../services/traceability/traceability.service')
    const res = await traceabilityService.restoreBatchesForReturn(
      { workspaceId: 'ws-1' },
      {
        originalInvoiceId: 'inv-1',
        returnId: 'ret-1',
        entryDate: '2026-11-12',
        lines: [{ productId: 'prod-1', quantity: 4 }],
      },
    )

    expect(res.restored).toEqual([
      { batchId: 'batch-a', productId: 'prod-1', quantity: 2 },
      { batchId: 'batch-b', productId: 'prod-1', quantity: 2 },
    ])
    expect(mockState.batches.find((b) => b.id === 'batch-a')?.remaining_qty).toBe(2)
    expect(mockState.batches.find((b) => b.id === 'batch-b')?.remaining_qty).toBe(4)

    // Replay same returnId does not double-restore
    const replay = await traceabilityService.restoreBatchesForReturn(
      { workspaceId: 'ws-1' },
      {
        originalInvoiceId: 'inv-1',
        returnId: 'ret-1',
        entryDate: '2026-11-12',
        lines: [{ productId: 'prod-1', quantity: 4 }],
      },
    )
    expect(replay.restored).toHaveLength(2)
    expect(mockState.batches.find((b) => b.id === 'batch-a')?.remaining_qty).toBe(2)
  })

  it('refuses with BATCH_ALLOCATION_HISTORY_MISSING when lot_allocations is missing', async () => {
    const { traceabilityService } = await import('../services/traceability/traceability.service')
    await expect(
      traceabilityService.restoreBatchesForReturn(
        { workspaceId: 'ws-1' },
        {
          originalInvoiceId: 'inv-no-history',
          returnId: 'ret-2',
          entryDate: '2026-11-12',
          lines: [{ productId: 'prod-1', quantity: 1 }],
        },
      ),
    ).rejects.toThrow('BATCH_ALLOCATION_HISTORY_MISSING')
  })
})
