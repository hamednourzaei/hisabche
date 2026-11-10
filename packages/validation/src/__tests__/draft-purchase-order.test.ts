// ============================================
// The one rule behind «reorder suggestion → draft purchase order».
// The server route and the offline engine both call it (their own tests prove
// that); this file holds the rule itself.
// ============================================

import { describe, expect, it } from 'vitest'

import { planDraftPurchaseOrders } from '../schemas/draft-purchase-order.domain'
import { receiveRefusal } from '../schemas/purchasing.domain'
import {
  createPurchaseOrderSchema,
  settablePurchaseOrderStatusSchema,
} from '../schemas/purchasing.schema'

const line = (over: Record<string, unknown> = {}) => ({
  productId: 'p1',
  supplierId: 's1',
  suggestedQuantity: 10,
  unitPrice: 50,
  ...over,
})

describe('planDraftPurchaseOrders', () => {
  it('groups complete lines by supplier, in first-seen order', () => {
    const plan = planDraftPurchaseOrders([
      line({ productId: 'a', supplierId: 's2' }),
      line({ productId: 'b', supplierId: 's1' }),
      line({ productId: 'c', supplierId: 's2', suggestedQuantity: 3, unitPrice: 7 }),
    ])
    expect(plan).toEqual({
      ok: true,
      groups: [
        {
          supplierId: 's2',
          lines: [
            { productId: 'a', quantity: 10, unitPrice: 50 },
            { productId: 'c', quantity: 3, unitPrice: 7 },
          ],
        },
        { supplierId: 's1', lines: [{ productId: 'b', quantity: 10, unitPrice: 50 }] },
      ],
    })
  })

  it('never invents a supplier', () => {
    for (const supplierId of [undefined, null, '']) {
      const plan = planDraftPurchaseOrders([line({ supplierId })])
      expect(plan).toEqual({
        ok: false,
        incomplete: [{ productId: 'p1', issues: ['SUPPLIER_REQUIRED'] }],
      })
    }
  })

  it('never accepts a free item or a missing price', () => {
    for (const unitPrice of [undefined, 0, -5]) {
      const plan = planDraftPurchaseOrders([line({ unitPrice })])
      expect(plan.ok).toBe(false)
      if (!plan.ok) expect(plan.incomplete[0]?.issues).toEqual(['UNIT_PRICE_REQUIRED'])
    }
  })

  it('refuses a quantity that is not a positive number', () => {
    for (const suggestedQuantity of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const plan = planDraftPurchaseOrders([line({ suggestedQuantity })])
      expect(plan.ok, String(suggestedQuantity)).toBe(false)
    }
  })

  it('is all-or-nothing: one bad line refuses the whole batch and names every bad line', () => {
    const plan = planDraftPurchaseOrders([
      line({ productId: 'good' }),
      line({ productId: 'no-supplier', supplierId: undefined }),
      line({ productId: 'no-price-and-qty', unitPrice: 0, suggestedQuantity: 0 }),
    ])
    expect(plan).toEqual({
      ok: false,
      incomplete: [
        { productId: 'no-supplier', issues: ['SUPPLIER_REQUIRED'] },
        { productId: 'no-price-and-qty', issues: ['QUANTITY_INVALID', 'UNIT_PRICE_REQUIRED'] },
      ],
    })
  })

  it('an empty batch is not a plan', () => {
    expect(planDraftPurchaseOrders([])).toEqual({ ok: false, incomplete: [] })
  })
})

describe('a draft purchase order', () => {
  it('is a status a client may set, and it is never receivable', () => {
    expect(settablePurchaseOrderStatusSchema.safeParse('draft').success).toBe(true)
    expect(receiveRefusal('draft')).toBe('PURCHASE_ORDER_DRAFT')
    expect(receiveRefusal('pending')).toBeNull()
    expect(receiveRefusal('approved')).toBeNull()
  })

  it('does not change what an ordinary order defaults to', () => {
    const parsed = createPurchaseOrderSchema.parse({
      supplierId: '11111111-1111-4111-8111-111111111111',
      items: [],
    })
    expect(parsed.status).toBe('pending')
  })
})

describe('a purchase line may name its variant (V55 P2)', () => {
  const order = (item: Record<string, unknown>) =>
    createPurchaseOrderSchema.parse({
      supplierId: '11111111-1111-4111-8111-111111111111',
      items: [
        {
          productId: '11111111-1111-4111-8111-111111111112',
          quantity: 2,
          unitPrice: 50,
          totalPrice: 100,
          ...item,
        },
      ],
    })

  it('a line carries the variant it buys', () => {
    expect(order({ variantId: '11111111-1111-4111-8111-111111111113' }).items[0]?.variantId).toBe(
      '11111111-1111-4111-8111-111111111113',
    )
  })

  it('a line without a variant stays legal (legacy orders, plain products)', () => {
    expect(order({}).items[0]?.variantId).toBeUndefined()
  })

  it('a variant id must still BE a uuid', () => {
    expect(
      createPurchaseOrderSchema.safeParse({
        supplierId: '11111111-1111-4111-8111-111111111111',
        items: [
          {
            productId: '11111111-1111-4111-8111-111111111112',
            variantId: 'v-1',
            quantity: 2,
            unitPrice: 50,
            totalPrice: 100,
          },
        ],
      }).success,
    ).toBe(false)
  })
})
