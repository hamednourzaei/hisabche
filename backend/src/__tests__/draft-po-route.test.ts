// ============================================
// The SERVER side of «reorder suggestion → draft purchase order».
//
// The offline engine has its own route tests (packages/local-engine purchasing.test.ts); both call
// `planDraftPurchaseOrders`. These prove the server refuses exactly what the device refuses —
// no guessed supplier, no free item, all-or-nothing — and writes nothing when it refuses.
// ============================================

import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createPurchaseOrder = vi.fn(async (_ctx: unknown, input: { supplierId: string }) => ({
  id: `po-${input.supplierId}`,
  supplierId: input.supplierId,
}))

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: async (request: { user?: unknown }) => {
    request.user = { id: 'u-1' }
  },
}))

vi.mock('../middleware/workspace.middleware', () => ({
  requireWorkspaceContext: async (request: { tenancy?: unknown }) => {
    request.tenancy = { workspaceId: 'ws-1', userId: 'u-1', role: 'owner' }
  },
}))

vi.mock('../middleware/authorize.middleware', () => ({
  requireCapability: () => async () => {},
}))

vi.mock('../services/purchasing.service', () => ({
  PurchasingService: class {
    createPurchaseOrder = createPurchaseOrder
  },
}))

vi.mock('../services/inventory/reorder.service', () => ({
  ReorderService: class {},
}))

import { inventoryInsightsRoutes } from '../routes/inventory-insights.routes'

async function post(suggestions: unknown) {
  const app = Fastify()
  await app.register(inventoryInsightsRoutes)
  return app.inject({
    method: 'POST',
    url: '/api/inventory/reorder-suggestions/draft-po',
    payload: { suggestions },
  })
}

const line = (over: Record<string, unknown> = {}) => ({
  productId: 'p1',
  supplierId: 's1',
  suggestedQuantity: 10,
  unitPrice: 50,
  ...over,
})

beforeEach(() => {
  createPurchaseOrder.mockClear()
})

describe('POST /api/inventory/reorder-suggestions/draft-po', () => {
  it('drafts one order per supplier at the price the owner chose', async () => {
    const res = await post([line(), line({ productId: 'p2', supplierId: 's2', unitPrice: 7 })])
    expect(res.statusCode).toBe(201)
    expect(res.json().count).toBe(2)
    // Canonical status (owner decision PO): a suggestion creates a DRAFT, not a pending order.
    expect(createPurchaseOrder.mock.calls[0]![1]).toMatchObject({ status: 'draft' })
    expect(createPurchaseOrder).toHaveBeenCalledTimes(2)
    expect(createPurchaseOrder.mock.calls[0]![1]).toMatchObject({
      supplierId: 's1',
      items: [{ productId: 'p1', quantity: 10, unitPrice: 50, totalPrice: 500 }],
    })
  })

  it('never invents a supplier — and writes nothing', async () => {
    const res = await post([line({ supplierId: undefined })])
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('DRAFT_PO_LINE_INCOMPLETE')
    expect(createPurchaseOrder).not.toHaveBeenCalled()
  })

  it('never accepts a free item — and writes nothing', async () => {
    const res = await post([line({ unitPrice: 0 })])
    expect(res.statusCode).toBe(400)
    expect(createPurchaseOrder).not.toHaveBeenCalled()
  })

  it('is all-or-nothing: one bad line refuses the batch, even when the first line is fine', async () => {
    const res = await post([line(), line({ productId: 'bad', supplierId: '' })])
    expect(res.statusCode).toBe(400)
    expect(res.json().incomplete).toEqual(['bad'])
    expect(createPurchaseOrder).not.toHaveBeenCalled()
  })

  it('an empty batch is refused', async () => {
    const res = await post([])
    expect(res.statusCode).toBe(400)
    expect(createPurchaseOrder).not.toHaveBeenCalled()
  })
})
