// ============================================
// backend/src/__tests__/batch-recall.test.ts
//
// WP-05 — a recalled carton cannot be sold, and the system says WHY it was
// refused instead of «not enough stock». The quantity is never touched: the
// goods exist and their value belongs on the balance sheet.
//
// The database is mocked (the query shapes are what this test pins); the
// migration itself is exercised against real Postgres in
// `batch-recall.pg.test.ts` and the shared FEFO core in
// `packages/validation/src/__tests__/lot-allocation.test.ts`.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

interface BatchRowState {
  id: string
  workspace_id: string
  product_id: string
  batch_number: string
  expiry_date: string | null
  manufactured_date: string | null
  received_qty: number
  remaining_qty: number
  cost_layer_id: string | null
  warehouse_id: string | null
  received_on: string
  recalled_at: string | null
  recalled_reason: string | null
  recalled_by: string | null
}

const state = {
  batches: [] as BatchRowState[],
  events: [] as Array<Record<string, unknown>>,
}

vi.mock('../services/event-log.service', () => ({
  logBusinessEvent: async (input: Record<string, unknown>) => {
    state.events.push(input)
  },
}))

type Filter = { kind: 'eq' | 'is' | 'not' | 'gt'; column: string; value: unknown }

function makeChain(table: string) {
  const filters: Filter[] = []
  let patch: Record<string, unknown> | null = null

  const rowsOf = (): BatchRowState[] => (table === 'stock_batches' ? state.batches : [])

  const matches = (row: BatchRowState) =>
    filters.every((filter) => {
      const current = (row as unknown as Record<string, unknown>)[filter.column]
      if (filter.kind === 'eq') return current === filter.value
      if (filter.kind === 'gt') return Number(current) > Number(filter.value)
      if (filter.kind === 'is') return current === null
      return current !== null
    })

  // A read applies the filters; an update additionally writes the patch, so a
  // second recall that matched nothing really did change nothing.
  const run = () => {
    const rows = rowsOf().filter(matches)
    if (patch) {
      for (const row of rows) Object.assign(row, patch)
    }
    return rows
  }

  const chain: Record<string, unknown> = {
    select: () => chain,
    update: (values: Record<string, unknown>) => {
      patch = values
      return chain
    },
    eq: (column: string, value: unknown) => {
      filters.push({ kind: 'eq', column, value })
      return chain
    },
    is: (column: string, value: unknown) => {
      filters.push({ kind: 'is', column, value })
      return chain
    },
    not: (column: string, _operator: string, value: unknown) => {
      filters.push({ kind: 'not', column, value })
      return chain
    },
    gt: (column: string, value: unknown) => {
      filters.push({ kind: 'gt', column, value })
      return chain
    },
    order: () => chain,
    range: async (from: number, to: number) => ({ data: run().slice(from, to + 1), error: null }),
    maybeSingle: async () => {
      const [row] = run()
      return { data: row ?? null, error: null }
    },
    single: async () => {
      const [row] = run()
      return { data: row ?? null, error: row ? null : { message: 'not found' } }
    },
  }

  return chain
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => makeChain(table),
    rpc: async () => ({ error: null }),
  },
}))

const CTX = { workspaceId: 'ws-1', userId: 'user-1', role: 'owner' } as const

function batch(overrides: Partial<BatchRowState> & { id: string }): BatchRowState {
  return {
    workspace_id: 'ws-1',
    product_id: 'prod-1',
    batch_number: overrides.id,
    expiry_date: '2027-01-31',
    manufactured_date: null,
    received_qty: 10,
    remaining_qty: 10,
    cost_layer_id: null,
    warehouse_id: null,
    received_on: '2026-11-01',
    recalled_at: null,
    recalled_reason: null,
    recalled_by: null,
    ...overrides,
  }
}

describe('WP-05 batch recall', () => {
  beforeEach(() => {
    state.batches = [batch({ id: 'batch-a', batch_number: 'B-JAN' })]
    state.events = []
  })

  it('blocks the batch, records who and why, and keeps the quantity', async () => {
    const { traceabilityService } = await import('../services/traceability/traceability.service')

    const result = await traceabilityService.recallBatch(CTX, 'batch-a', {
      reason: '  supplier recall  ',
    })

    expect(result.recalledAt).toBeTruthy()
    expect(result.recalledReason).toBe('supplier recall')
    // The carton still exists and is still worth money.
    expect(result.remainingQty).toBe(10)

    const row = state.batches.find((b) => b.id === 'batch-a')!
    expect(row.recalled_by).toBe('user-1')
    expect(row.remaining_qty).toBe(10)

    expect(state.events).toHaveLength(1)
    expect(state.events[0]).toMatchObject({
      entityType: 'batch',
      entityId: 'batch-a',
      action: 'batch_recalled',
      workspaceId: 'ws-1',
    })
    expect(String(state.events[0]!.title)).toContain('supplier recall')
  })

  it('a second recall keeps the FIRST reason — a retry cannot rewrite the record', async () => {
    const { traceabilityService } = await import('../services/traceability/traceability.service')

    await traceabilityService.recallBatch(CTX, 'batch-a', { reason: 'supplier recall' })
    const again = await traceabilityService.recallBatch(CTX, 'batch-a', {
      reason: 'someone changed their mind',
    })

    expect(again.recalledReason).toBe('supplier recall')
    expect(state.events).toHaveLength(1)
  })

  it('refuses a recall with no reason — a block nobody can explain is a block nobody can defend', async () => {
    const { traceabilityService } = await import('../services/traceability/traceability.service')

    await expect(
      traceabilityService.recallBatch(CTX, 'batch-a', { reason: '   ' }),
    ).rejects.toThrow('BATCH_RECALL_REASON_REQUIRED')
    expect(state.batches[0]!.recalled_at).toBeNull()
  })

  it('refuses a batch that is not this workspace’s — or does not exist', async () => {
    const { traceabilityService } = await import('../services/traceability/traceability.service')

    state.batches = [batch({ id: 'batch-other', workspace_id: 'ws-2' })]
    await expect(
      traceabilityService.recallBatch(CTX, 'batch-other', { reason: 'recall' }),
    ).rejects.toThrow('Batch')
  })

  it('releasing the recall makes the batch sellable again', async () => {
    const { traceabilityService } = await import('../services/traceability/traceability.service')

    await traceabilityService.recallBatch(CTX, 'batch-a', { reason: 'supplier recall' })
    const released = await traceabilityService.releaseBatchRecall(CTX, 'batch-a')

    expect(released.recalledAt).toBeNull()
    expect(released.recalledReason).toBeNull()
    const row = state.batches.find((b) => b.id === 'batch-a')!
    expect(row.recalled_by).toBeNull()
    expect(state.events.map((event) => event.action)).toEqual([
      'batch_recalled',
      'batch_recall_released',
    ])
  })

  it('releasing a batch that was never blocked is a no-op, not an error', async () => {
    const { traceabilityService } = await import('../services/traceability/traceability.service')

    const result = await traceabilityService.releaseBatchRecall(CTX, 'batch-a')
    expect(result.recalledAt).toBeNull()
    expect(state.events).toEqual([])
  })

  it('an issue that only a recalled batch could cover is refused as BATCH_RECALLED', async () => {
    const { traceabilityService } = await import('../services/traceability/traceability.service')

    state.batches = [
      batch({
        id: 'batch-a',
        remaining_qty: 5,
        recalled_at: '2026-11-17T09:00:00.000Z',
        recalled_reason: 'supplier recall',
      }),
    ]

    await expect(
      traceabilityService.issueFromBatches(CTX, {
        productId: 'prod-1',
        quantity: 2,
        consumerType: 'invoice',
        consumerId: 'inv-1',
      }),
    ).rejects.toThrow('BATCH_RECALLED')
  })

  it('an issue nothing covers is still BATCH_INSUFFICIENT_STOCK — the two refusals stay distinct', async () => {
    const { traceabilityService } = await import('../services/traceability/traceability.service')

    state.batches = []
    await expect(
      traceabilityService.issueFromBatches(CTX, {
        productId: 'prod-1',
        quantity: 2,
        consumerType: 'invoice',
        consumerId: 'inv-1',
      }),
    ).rejects.toThrow('BATCH_INSUFFICIENT_STOCK')
  })
})
