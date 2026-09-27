// #142 — receiving a purchase order moved the stock once per request: the
// status was checked nowhere and written last, and `stock_movements` has no
// source key. Two concurrent receives (double-click, retry, two devices) put
// the goods on the shelf twice. The transition is now claimed first, with a
// conditional update only one caller can win.
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const state = {
  order: {} as Row,
  movementInserts: 0,
  failMovements: false,
}

/** A PostgREST-shaped chain whose UPDATE matches rows the way Postgres does. */
function table(name: string) {
  const filters: Array<[string, unknown]> = []
  let op: 'select' | 'update' | 'insert' = 'select'
  let patch: Row = {}
  const notFilters: Array<[string, unknown]> = []
  const matches = () =>
    filters.every(([k, v]) => state.order[k] === v) &&
    notFilters.every(([k, v]) => state.order[k] !== v)
  const chain = {
    select: () => chain,
    eq: (k: string, v: unknown) => {
      filters.push([k, v])
      return chain
    },
    neq: (k: string, v: unknown) => {
      notFilters.push([k, v])
      return chain
    },
    update: (p: Row) => {
      op = 'update'
      patch = p
      return chain
    },
    insert: async () => {
      op = 'insert'
      if (name === 'stock_movements') {
        if (state.failMovements) return { error: { message: 'boom' } }
        state.movementInserts += 1
      }
      return { error: null }
    },
    maybeSingle: async () => {
      // Yield so two callers interleave between their read and their write.
      await Promise.resolve()
      if (name !== 'purchase_orders' || !matches()) return { data: null, error: null }
      if (op === 'update') Object.assign(state.order, patch)
      return { data: { ...state.order }, error: null }
    },
    then: (resolve: (v: { error: null }) => void) => {
      if (op === 'update' && name === 'purchase_orders' && matches())
        Object.assign(state.order, patch)
      resolve({ error: null })
    },
  }
  return chain
}

vi.mock('../db', () => ({ supabase: { from: (name: string) => table(name) } }))
vi.mock('../utils/pagination', () => ({
  memoryCache: { get: vi.fn(), set: vi.fn(), invalidate: vi.fn(), delPattern: vi.fn() },
}))
vi.mock('../services/inventory-costing', () => ({
  costing: { recordReceipt: vi.fn(async () => undefined) },
}))
vi.mock('../services/budgeting', () => ({ budgets: { release: vi.fn(async () => undefined) } }))
vi.mock('../services/accounting', () => ({ ledger: {} }))
vi.mock('../services/event-log.service', () => ({ logBusinessEvent: vi.fn() }))

const { default: PurchasingService } = await import('../services/purchasing.service')
const service = new PurchasingService()
const ctx = { workspaceId: 'ws', userId: 'u', role: 'owner' as const }

beforeEach(() => {
  state.order = {
    id: 'po',
    workspace_id: 'ws',
    status: 'pending',
    order_date: '2026-09-26',
    items: [{ id: 'line', product_id: 'p', quantity: 10, unit_price: 5, total_price: 50 }],
  }
  state.movementInserts = 0
  state.failMovements = false
})

describe('receiveGoods — once', () => {
  it('two concurrent receives: one succeeds, one is refused, stock moves once', async () => {
    const results = await Promise.allSettled([
      service.receiveGoods(ctx, 'po'),
      service.receiveGoods(ctx, 'po'),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const refused = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(String(refused.reason.message)).toContain('PURCHASE_ORDER_ALREADY_RECEIVED')
    expect(state.movementInserts).toBe(1)
    expect(state.order.status).toBe('received')
  })

  it('a received order is refused before anything moves', async () => {
    state.order.status = 'received'
    await expect(service.receiveGoods(ctx, 'po')).rejects.toThrow('PURCHASE_ORDER_ALREADY_RECEIVED')
    expect(state.movementInserts).toBe(0)
  })

  it('if the stock write fails, the order goes back to its prior status', async () => {
    state.failMovements = true
    await expect(service.receiveGoods(ctx, 'po')).rejects.toThrow(/stock movements/)
    expect(state.order.status).toBe('pending')
  })
})

describe('a purchase order is never «received» except by receiving it', () => {
  it('the schema refuses «received» on create and on edit', async () => {
    const { createPurchaseOrderSchema, updatePurchaseOrderSchema } =
      await import('@hisabche/validation')
    expect(
      updatePurchaseOrderSchema.safeParse({
        id: '11111111-1111-4111-8111-111111111111',
        status: 'received',
      }).success,
    ).toBe(false)
    expect(
      updatePurchaseOrderSchema.safeParse({
        id: '11111111-1111-4111-8111-111111111111',
        status: 'cancelled',
      }).success,
    ).toBe(true)
    const create = createPurchaseOrderSchema.shape.status
    expect(create.safeParse('received').success).toBe(false)
  })

  it('⚠️ a received order cannot be edited back to pending (it would be received twice)', async () => {
    state.order.status = 'received'
    await expect(
      service.updatePurchaseOrder(ctx, 'po', { id: 'po', status: 'pending' } as never),
    ).rejects.toThrow('PURCHASE_ORDER_ALREADY_RECEIVED')
    expect(state.order.status).toBe('received')
  })

  it('an order that is not received changes status normally', async () => {
    state.order.status = 'pending'
    await service.updatePurchaseOrder(ctx, 'po', { id: 'po', status: 'approved' } as never)
    expect(state.order.status).toBe('approved')
  })
})
