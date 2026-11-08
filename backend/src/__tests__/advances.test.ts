// ============================================
// advances-02 (8 Nov 2026) — پیش‌فروش / پیش‌خرید on the ONE deposit engine.
//
//   pre_sale      receipt Dr cash|bank / Cr customer advances; apply = order_deposit_apply
//   pre_purchase  payment Dr supplier advances / Cr cash|bank; apply = supplier_advance_apply
//
// No revenue and no expense: those come with the sale / purchase invoice.
// The database and ledger port are replaced; the money sides are the claim.
// ============================================

import { describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => ({ supabase: {} }))
vi.mock('../utils/money-cache', () => ({ invalidateMoneyCaches: async () => {} }))

const { OrderDepositService } = await import('../services/sales/order-deposit.service')

type Row = Record<string, unknown>

function harness(existing?: Row) {
  const posts: Array<Record<string, unknown>> = []
  const rpcs: Array<{ fn: string; args: Record<string, unknown> }> = []
  const inserted: Row[] = []
  let stored: Row | null = existing ?? null

  const chain = () => {
    const c: Record<string, unknown> = {}
    c.select = () => c
    c.eq = () => c
    c.order = () => c
    c.single = async () => ({ data: stored, error: null })
    c.maybeSingle = async () => ({ data: stored, error: null })
    c.insert = (row: Row) => {
      inserted.push(row)
      stored = {
        ...row,
        amount_minor: row.amount_minor,
        posting_status: null,
        journal_entry_id: null,
        applied_invoice_id: null,
        created_at: 'now',
      }
      return c
    }
    c.update = (patch: Row) => {
      stored = { ...(stored ?? {}), ...patch }
      return c
    }
    return c
  }
  const db = {
    from: () => chain(),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcs.push({ fn, args })
      return {
        data: {
          replayed: false,
          deposit_id: args.p_deposit_id,
          amount_minor: args.p_amount_minor,
          currency: 'AFN',
          balance: {},
        },
        error: null,
      }
    },
  }
  const ledgerPort = {
    ensureAccountsForRoles: async (_ctx: unknown, roles: string[]) => ({
      accounts: Object.fromEntries(roles.map((r) => [r, `acc-${r}`])),
      missing: [],
    }),
    postDocument: async (_ctx: unknown, request: Record<string, unknown>) => {
      posts.push(request)
      return { status: 'posted', entryId: 'je-1', entryNumber: 'JV-1' }
    },
  }
  const service = new OrderDepositService(db as never, ledgerPort as never, async () => 'AFN')
  return { service, posts, rpcs, inserted }
}

const ctx = { workspaceId: 'ws', userId: 'u1', role: 'owner' } as never

describe('creating an advance', () => {
  it('pre-sale: its own document, Dr cash / Cr customer advances — no revenue', async () => {
    const h = harness()
    await h.service.createOrderDeposit(ctx, {
      orderId: '',
      customerId: 'cust',
      amountMinor: 5000,
      sourceType: 'pre_sale',
      note: '  ۲۰ کارتن روغن  ',
    })
    const row = h.inserted[0]!
    expect(row.order_id).toBe(row.id)
    expect(row.source_type).toBe('pre_sale')
    expect(row.note).toBe('۲۰ کارتن روغن')
    expect(h.posts[0]?.lines).toEqual([
      { accountId: 'acc-cash', debit: 5000, credit: 0 },
      { accountId: 'acc-customer_advances', debit: 0, credit: 5000 },
    ])
  })

  it('pre-purchase: Dr supplier advances / Cr cash — no expense, no stock', async () => {
    const h = harness()
    await h.service.createOrderDeposit(ctx, {
      orderId: '',
      customerId: 'supplier',
      amountMinor: 8000,
      paymentMethod: 'bank',
      sourceType: 'pre_purchase',
    })
    expect(h.posts[0]?.lines).toEqual([
      { accountId: 'acc-supplier_advances', debit: 8000, credit: 0 },
      { accountId: 'acc-bank', debit: 0, credit: 8000 },
    ])
  })
})

describe('applying an advance', () => {
  const base = {
    workspace_id: 'ws',
    customer_id: 'p',
    amount_minor: 8000,
    payment_method: 'cash',
    currency: 'AFN',
    posting_status: 'posted',
    journal_entry_id: 'je',
    applied_invoice_id: null,
    created_at: 'x',
  }

  it('a pre-purchase settles the purchase invoice through the supplier function', async () => {
    const h = harness({ ...base, id: 'adv', order_id: 'adv', source_type: 'pre_purchase' })
    await h.service.applyDeposit(ctx, 'adv', 'adv', {
      invoiceId: 'pinv',
      amountMinor: 8000,
      idempotencyKey: 'key-12345678',
    })
    expect(h.rpcs[0]?.fn).toBe('supplier_advance_apply')
    expect(h.rpcs[0]?.args).toMatchObject({
      p_advances_account_id: 'acc-supplier_advances',
      p_payable_account_id: 'acc-payable',
    })
  })

  it('a pre-sale settles the sale invoice through the customer function', async () => {
    const h = harness({ ...base, id: 'adv', order_id: 'adv', source_type: 'pre_sale' })
    await h.service.applyDeposit(ctx, 'adv', 'adv', {
      invoiceId: 'sinv',
      amountMinor: 8000,
      idempotencyKey: 'key-12345678',
    })
    expect(h.rpcs[0]?.fn).toBe('order_deposit_apply')
    expect(h.rpcs[0]?.args).toMatchObject({ p_advances_account_id: 'acc-customer_advances' })
  })

  it('a pre-purchase refund brings money back in through the supplier function', async () => {
    const h = harness({ ...base, id: 'adv', order_id: 'adv', source_type: 'pre_purchase' })
    await h.service.refundDeposit(ctx, 'adv', 'adv', {
      amountMinor: 1000,
      idempotencyKey: 'key-12345678',
      reason: 'supplier cancelled',
    })
    expect(h.rpcs[0]?.fn).toBe('supplier_advance_refund')
    expect(h.rpcs[0]?.args).toMatchObject({ p_advances_account_id: 'acc-supplier_advances' })
  })
})
