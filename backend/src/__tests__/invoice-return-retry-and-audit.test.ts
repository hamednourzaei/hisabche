// ============================================
// A retry is never a second return and never a second refund; every step leaves a trace;
// and a payment that IS a refund cannot be cancelled from the payment side.
// ============================================

import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { InvoiceReturnService } from '../services/sales/invoice-return.service'
import type { TenancyContext } from '../services/tenancy.service'

const logged: Array<{ action: string; entityId: string; metadata?: Record<string, unknown> }> = []
vi.mock('../utils/money-cache', () => ({ invalidateMoneyCaches: vi.fn() }))
vi.mock('../services/base-currency', () => ({ baseCurrencyOf: async () => 'AFN' }))
vi.mock('../services/event-log.service', () => ({
  logBusinessEvent: async (event: (typeof logged)[number]) => {
    logged.push(event)
  },
}))
vi.mock('../services/authorization', () => ({
  sod: { recordAction: async () => {}, assertAllowed: async () => {} },
  scopes: { assertMay: async () => {} },
}))
vi.mock('../services/accounting', () => ({
  ledger: {
    postDocument: async () => ({ status: 'posted', entryId: 'je-1' }),
    reverseDocument: async () => ({ status: 'reversed' }),
    ensureAccountsForRoles: async () => ({ accounts: {}, missing: [] }),
  },
}))

import { PaymentsService } from '../services/payments/payments.service'

const ctx = { workspaceId: 'ws', userId: 'user-1' } as unknown as TenancyContext

interface Script {
  /** What `invoice_returns … eq(client_request_id)` answers, call by call. */
  byKey?: Array<Record<string, unknown> | null>
  rpc?: (name: string, args: Record<string, unknown>) => { data?: unknown; error?: unknown }
  tables?: Record<string, Array<Record<string, unknown>>>
}

function scripted(script: Script) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  let keyLookups = 0
  const db = {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args })
      const answer = script.rpc?.(name, args) ?? { data: { id: 'ret-new' } }
      return { data: answer.data ?? null, error: answer.error ?? null }
    }),
    from(table: string) {
      let byKey = false
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (column: string) => {
          if (table === 'invoice_returns' && column === 'client_request_id') byKey = true
          return chain
        },
        in: () => chain,
        order: () => chain,
        maybeSingle: async () => {
          if (byKey) {
            const answer = (script.byKey ?? [])[keyLookups++] ?? null
            return { data: answer, error: null }
          }
          const rows = script.tables?.[table] ?? []
          if (table === 'invoices' && rows.length === 0) {
            return {
              data: { id: 'inv-1', currency: 'USD', total: 100, paid_amount: 100 },
              error: null,
            }
          }
          return { data: rows[0] ?? null, error: null }
        },
        then: (resolve: (value: unknown) => unknown) =>
          resolve({ data: script.tables?.[table] ?? [], count: 0, error: null }),
      }
      return chain
    },
  }
  return { db: db as unknown as SupabaseClient, calls }
}

const input = {
  originalInvoiceId: 'inv-1',
  returnType: 'sale_return' as const,
  returnNumber: 'R-1',
  returnDate: '2026-11-01',
  userId: 'user-1',
  clientRequestId: 'ret_abcdef12',
  lines: [
    {
      originalLineId: 'l1',
      returnQuantity: 1,
      restockChoice: 'restock' as const,
      reasonCode: 'other' as const,
    },
  ],
}
const existingReturn = {
  id: 'ret-1',
  original_invoice_id: 'inv-1',
  return_type: 'sale_return',
  return_number: 'R-1',
  return_date: '2026-11-01',
  total_subtotal_minor: 100,
  total_discount_minor: 0,
  total_tax_minor: 0,
  grand_total_minor: 100,
}

describe('a retried return', () => {
  it('the same key after the first one finished: answers with it, calls nothing', async () => {
    const { db, calls } = scripted({ byKey: [existingReturn] })
    const result = (await new InvoiceReturnService(db).createReturn('ws', input)) as { id: string }
    expect(result.id).toBe('ret-1')
    expect(calls).toHaveLength(0)
  })

  it('the same key arriving twice AT ONCE: the loser is answered with the winner’s return', async () => {
    const { db, calls } = scripted({
      byKey: [null, existingReturn], // not there at the start, there once the trigger refused the twin
      rpc: () => ({ error: { code: '23505', message: 'INVOICE_ALREADY_RETURNED' } }),
    })
    const result = (await new InvoiceReturnService(db).createReturn('ws', input)) as { id: string }
    expect(result.id).toBe('ret-1')
    expect(calls.map((call) => call.name)).toEqual(['invoice_return_create'])
  })

  it('a different request on a returned invoice is still refused', async () => {
    const { db } = scripted({
      byKey: [null, null],
      rpc: () => ({ error: { code: '23505', message: 'INVOICE_ALREADY_RETURNED' } }),
    })
    await expect(new InvoiceReturnService(db).createReturn('ws', input)).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('sends the key to the database function, which stores it with the return', async () => {
    const { db, calls } = scripted({})
    await new InvoiceReturnService(db).createReturn('ws', input)
    expect(calls[0]!.args.p_return).toMatchObject({ clientRequestId: 'ret_abcdef12' })
  })
})

describe('a retried refund', () => {
  const rows = {
    invoice_returns: [
      {
        id: 'ret-1',
        original_invoice_id: 'inv-1',
        return_type: 'sale_return',
        return_number: 'R-1',
      },
    ],
    invoices: [{ id: 'inv-1', customer_id: 'cust-1', currency: 'USD', exchange_rate: 1 }],
  }
  const port = () => ({ recordPayment: vi.fn(async () => ({ id: 'pay-1' })) })

  it('sends the caller’s key with the reservation', async () => {
    const { db, calls } = scripted({
      tables: rows,
      rpc: (name) =>
        name === 'invoice_return_refund_reserve' ? { data: { id: 'refund-1' } } : { data: {} },
    })
    await new InvoiceReturnService(db, port()).refundReturn(ctx, 'inv-1', 'ret-1', {
      amount: 10,
      method: 'cash',
      clientRequestId: 'refund_abcd1234',
    })
    expect(calls[0]!.args).toMatchObject({ p_client_request_id: 'refund_abcd1234' })
  })

  it('the key of a refund that already PAID answers with its payment — and pays nothing', async () => {
    const payments = port()
    const { db, calls } = scripted({
      tables: rows,
      rpc: () => ({
        data: { id: 'refund-1', status: 'paid', paymentId: 'pay-9', replayed: true },
      }),
    })
    const result = await new InvoiceReturnService(db, payments).refundReturn(
      ctx,
      'inv-1',
      'ret-1',
      {
        amount: 10,
        method: 'cash',
        clientRequestId: 'refund_abcd1234',
      },
    )
    expect(result).toMatchObject({ paymentId: 'pay-9', replayed: true })
    expect(payments.recordPayment).not.toHaveBeenCalled()
    expect(calls.map((call) => call.name)).toEqual(['invoice_return_refund_reserve'])
  })

  it('the key of a refund still PENDING resumes it: paid once under the reservation id, then settled', async () => {
    const payments = port()
    const { db, calls } = scripted({
      tables: rows,
      rpc: (name) =>
        name === 'invoice_return_refund_reserve'
          ? { data: { id: 'refund-1', status: 'pending', replayed: true } }
          : { data: {} },
    })
    await new InvoiceReturnService(db, payments).refundReturn(ctx, 'inv-1', 'ret-1', {
      amount: 10,
      method: 'cash',
      clientRequestId: 'refund_abcd1234',
    })
    expect(payments.recordPayment).toHaveBeenCalledTimes(1)
    const [, , options] = payments.recordPayment.mock.calls[0] as unknown as [
      unknown,
      unknown,
      { clientRequestId: string },
    ]
    // the payment's own idempotency key is the reservation — a second call can only replay it
    expect(options.clientRequestId).toBe('refund-1')
    expect(calls.map((call) => call.name)).toEqual([
      'invoice_return_refund_reserve',
      'invoice_return_refund_settle',
    ])
  })

  it('a key reused for a different amount is refused (409), and nothing is paid', async () => {
    const payments = port()
    const { db } = scripted({
      tables: rows,
      rpc: () => ({ error: { code: 'P0001', message: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH' } }),
    })
    await expect(
      new InvoiceReturnService(db, payments).refundReturn(ctx, 'inv-1', 'ret-1', {
        amount: 99,
        method: 'cash',
        clientRequestId: 'refund_abcd1234',
      }),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(payments.recordPayment).not.toHaveBeenCalled()
  })
})

describe('the audit trail', () => {
  it('a return is logged on the invoice with who, why and how much', async () => {
    logged.length = 0
    const { db } = scripted({
      rpc: () => ({ data: { id: 'ret-9', grandTotalMinor: 16000, deductionMinor: 6000 } }),
    })
    await new InvoiceReturnService(db).createReturn('ws', {
      ...input,
      reasonCode: 'defective',
      deductions: [{ reason: 'return_fee', mode: 'percent', percent: 30 }],
    })
    expect(logged).toContainEqual(
      expect.objectContaining({
        action: 'invoice_returned',
        entityId: 'inv-1',
        metadata: expect.objectContaining({
          returnId: 'ret-9',
          reasonCode: 'defective',
          creditMinor: 16000,
          deductionMinor: 6000,
          deductions: ['return_fee'],
        }),
      }),
    )
  })

  it('a refund is logged with its payment, its method and its till', async () => {
    logged.length = 0
    const { db } = scripted({
      tables: {
        invoice_returns: [
          {
            id: 'ret-1',
            original_invoice_id: 'inv-1',
            return_type: 'sale_return',
            return_number: 'R-1',
          },
        ],
        invoices: [{ id: 'inv-1', customer_id: 'cust-1', currency: 'USD', exchange_rate: 1 }],
      },
      rpc: (name) =>
        name === 'invoice_return_refund_reserve' ? { data: { id: 'refund-1' } } : { data: {} },
    })
    await new InvoiceReturnService(db, {
      recordPayment: async () => ({ id: 'pay-1' }),
    }).refundReturn(ctx, 'inv-1', 'ret-1', { amount: 70, method: 'cash', tillSessionId: 'till-1' })
    expect(logged).toContainEqual(
      expect.objectContaining({
        action: 'return_refunded',
        entityId: 'inv-1',
        metadata: expect.objectContaining({
          refundId: 'refund-1',
          paymentId: 'pay-1',
          amountMinor: 7000,
          method: 'cash',
          tillSessionId: 'till-1',
        }),
      }),
    )
  })
})

describe('a payment that IS a refund', () => {
  const payment = {
    id: 'pay-1',
    direction: 'out',
    partyType: 'customer',
    partyId: 'cust-1',
    amount: 70,
    currency: 'AFN',
    method: 'cash',
    entryDate: '2026-11-01',
    status: 'posted',
    allocations: [],
  }

  it('cannot be cancelled on its own — the return counts it as paid back', async () => {
    const repo = {
      getPayment: vi.fn().mockResolvedValue(payment),
      refundOfPayment: vi.fn().mockResolvedValue('refund-1'),
      cancelPayment: vi.fn(),
    }
    await expect(
      new PaymentsService(repo as never).cancelPayment(ctx, 'pay-1', 'oops'),
    ).rejects.toThrow('PAYMENT_BELONGS_TO_A_REFUND')
    expect(repo.cancelPayment).not.toHaveBeenCalled()
  })

  it('an ordinary payment is looked up and goes on to be cancelled', async () => {
    const repo = {
      getPayment: vi.fn().mockResolvedValue(payment),
      refundOfPayment: vi.fn().mockResolvedValue(null),
      cancelPayment: vi.fn().mockRejectedValue(new Error('REACHED_THE_CANCEL')),
    }
    await expect(
      new PaymentsService(repo as never).cancelPayment(ctx, 'pay-1', 'oops'),
    ).rejects.toThrow('REACHED_THE_CANCEL')
    expect(repo.refundOfPayment).toHaveBeenCalledWith('ws', 'pay-1')
  })
})
