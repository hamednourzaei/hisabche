import { describe, expect, it, vi, beforeEach } from 'vitest'
import { evaluateThreeWayMatch } from '@hisabche/validation'

const state = {
  order: {
    id: 'po-1',
    status: 'confirmed',
    order_date: '2026-11-12',
    items: [
      {
        id: 'item-1',
        product_id: 'prod-1',
        variant_id: null,
        quantity: 5,
        received_quantity: 0,
        unit_price: 100,
        total_price: 500,
      },
    ],
  },
  movements: [] as unknown[],
  costReceipts: [] as unknown[],
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: table === 'purchase_orders' ? state.order : null,
              error: null,
            }),
          }),
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: (c1: string, v1: unknown) => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => {
                  if (table === 'purchase_orders') {
                    state.order.status = String(patch.status ?? state.order.status)
                    return { data: state.order, error: null }
                  }
                  return { data: null, error: null }
                },
              }),
            }),
            then: (resolve: (r: { error: null }) => void) => {
              if (table === 'purchase_order_items' && typeof patch.received_quantity === 'number') {
                const itm = state.order.items.find((x) => x.id === v1)
                if (itm) itm.received_quantity = patch.received_quantity
              }
              resolve({ error: null })
            },
          }),
        }),
      }),
      insert: async (rows: unknown[]) => {
        if (table === 'stock_movements') state.movements.push(...rows)
        return { error: null }
      },
    }),
  },
}))

vi.mock('../services/inventory-costing', () => ({
  costing: {
    recordReceipt: async (_ctx: unknown, arg: unknown) => {
      state.costReceipts.push(arg)
    },
  },
}))

vi.mock('../services/budgeting', () => ({
  budgets: { release: async () => undefined },
}))

describe('V61 §2.6 procurement partial receipt & three-way match payment gate', () => {
  beforeEach(() => {
    state.order.status = 'confirmed'
    state.order.items[0]!.received_quantity = 0
    state.movements = []
    state.costReceipts = []
  })

  it('supports partial receipt twice and refuses over-receipt', async () => {
    const { PurchasingService } = await import('../services/purchasing.service')
    const svc = new PurchasingService()
    const ctx = { workspaceId: 'ws-1', userId: 'u-1', role: 'owner' } as never

    // Receive 3 of 5 -> partially_received
    const r1 = await svc.receiveGoods(ctx, 'po-1', { lines: [{ itemId: 'item-1', quantity: 3 }] })
    expect((r1 as { status: string }).status).toBe('partially_received')
    expect(state.order.items[0]!.received_quantity).toBe(3)

    // Over-receipt 3 more (3+3 > 5) -> refused
    await expect(
      svc.receiveGoods(ctx, 'po-1', { lines: [{ itemId: 'item-1', quantity: 3 }] }),
    ).rejects.toThrow('PURCHASE_OVER_RECEIPT_REFUSED')

    // Receive remaining 2 -> received
    const r2 = await svc.receiveGoods(ctx, 'po-1', { lines: [{ itemId: 'item-1', quantity: 2 }] })
    expect((r2 as { status: string }).status).toBe('received')
    expect(state.order.items[0]!.received_quantity).toBe(5)
    expect(state.movements).toHaveLength(2)
  })

  it('blocks supplier payment on three-way match mismatch until approved', async () => {
    const { checkSupplierPaymentMatchGate } = await import('../services/payments/payments.service')

    const match = evaluateThreeWayMatch({
      poLines: [{ productId: 'prod-1', quantity: 5, unitPriceMinor: 100 }],
      receiptLines: [{ productId: 'prod-1', quantity: 3 }],
      invoiceLines: [{ productId: 'prod-1', quantity: 5, unitPriceMinor: 100 }],
    })
    expect(match.mayApprovePayment).toBe(false)

    const blocked = checkSupplierPaymentMatchGate({
      mayApprovePayment: match.mayApprovePayment,
      hasApprovedMismatchWorkflow: false,
    })
    expect(blocked).toEqual({ allowed: false, reason: 'PROCUREMENT_MATCH_PAYMENT_BLOCKED' })

    const approved = checkSupplierPaymentMatchGate({
      mayApprovePayment: match.mayApprovePayment,
      hasApprovedMismatchWorkflow: true,
    })
    expect(approved).toEqual({ allowed: true })
  })
})
