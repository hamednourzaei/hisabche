// The returns core, service side: what is refused before the database, what the list
// answers (deductions, refundable, status), and the reserve → pay → settle refund.

import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  InvoiceReturnService,
  type CreateReturnInput,
  type RefundPaymentPort,
} from '../services/sales/invoice-return.service'
import type { TenancyContext } from '../services/tenancy.service'

vi.mock('../utils/money-cache', () => ({ invalidateMoneyCaches: vi.fn() }))
vi.mock('../services/base-currency', () => ({ baseCurrencyOf: async () => 'AFN' }))

type Rows = Record<string, Array<Record<string, unknown>>>
type Rpc = (name: string, args: Record<string, unknown>) => { data?: unknown; error?: unknown }

function fakeDb(rows: Rows, rpc: Rpc = () => ({ data: { id: 'ret-new' } })) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const db = {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args })
      const answer = rpc(name, args)
      return { data: answer.data ?? null, error: answer.error ?? null }
    }),
    from(table: string) {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        maybeSingle: async () => ({ data: (rows[table] ?? [])[0] ?? null, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          resolve({ data: rows[table] ?? [], count: (rows[table] ?? []).length, error: null }),
      }
      return chain
    },
  }
  return { db: db as unknown as SupabaseClient, calls }
}

const line = {
  originalLineId: 'line-1',
  returnQuantity: 2,
  restockChoice: 'restock' as const,
  reasonCode: 'other' as const,
}
const base: CreateReturnInput = {
  originalInvoiceId: 'inv-1',
  returnType: 'sale_return',
  returnNumber: 'R-1',
  returnDate: '2026-11-01',
  lines: [line],
}
const invoice = [{ id: 'inv-1', currency: 'USD', total: 1100, paid_amount: 1100 }]

describe('createReturn — refused before the database, so the invoice keeps its one return', () => {
  const refused = async (input: Partial<CreateReturnInput>, code: string) => {
    const { db, calls } = fakeDb({ invoices: invoice })
    await expect(
      new InvoiceReturnService(db).createReturn('ws', { ...base, ...input }),
    ).rejects.toThrow(code)
    expect(calls).toHaveLength(0)
  }

  it('no lines', () => refused({ lines: [] }, 'RETURN_LINES_REQUIRED'))
  it('a line twice', () => refused({ lines: [line, line] }, 'RETURN_LINE_DUPLICATE'))
  it('a zero quantity', () =>
    refused({ lines: [{ ...line, returnQuantity: 0 }] }, 'RETURN_QUANTITY_INVALID'))
  it('an unknown condition', () =>
    refused({ lines: [{ ...line, conditionCode: 'soggy' as never }] }, 'INVALID_RETURN_CONDITION'))
  it('an unknown document reason', () => refused({ reasonCode: 'bored' }, 'INVALID_RETURN_REASON'))
  it('«other» with no note', () =>
    refused(
      { deductions: [{ reason: 'other', mode: 'fixed', amount: 5 }] },
      'RETURN_DEDUCTION_NOTE_REQUIRED',
    ))
  it('a percentage above 100', () =>
    refused(
      { deductions: [{ reason: 'agreed', mode: 'percent', percent: 130 }] },
      'RETURN_DEDUCTION_PERCENT_INVALID',
    ))
  it('deductions on a purchase return', () =>
    refused(
      {
        returnType: 'purchase_return',
        deductions: [{ reason: 'return_fee', mode: 'percent', percent: 10 }],
      },
      'RETURN_DEDUCTION_NOT_ALLOWED',
    ))
})

describe('createReturn — what reaches the database function', () => {
  it('sends the deductions, the document meta and the condition of each line', async () => {
    const { db, calls } = fakeDb({ invoices: invoice })
    await new InvoiceReturnService(db).createReturn('ws', {
      ...base,
      reasonCode: 'customer_change_of_mind',
      notes: 'box opened',
      deductions: [
        { reason: 'return_fee', mode: 'percent', percent: 30 },
        { reason: 'damage', mode: 'fixed', amount: 5, note: 'dent' },
      ],
      lines: [{ ...line, conditionCode: 'opened' }],
    })
    const call = calls.find((entry) => entry.name === 'invoice_return_create')!
    expect(call.args.p_fraction_digits).toBe(2)
    expect(call.args.p_return).toMatchObject({
      reasonCode: 'customer_change_of_mind',
      notes: 'box opened',
    })
    expect(call.args.p_lines).toEqual([
      expect.objectContaining({ originalLineId: 'line-1', quantity: 2, conditionCode: 'opened' }),
    ])
    expect(call.args.p_deductions).toEqual([
      { reason: 'return_fee', mode: 'percent', percent: 30 },
      { reason: 'damage', mode: 'fixed', amount: 5, note: 'dent' },
    ])
  })

  it('leaves the deductions argument out when there are none, so a plain return works before the migration', async () => {
    const { db, calls } = fakeDb({ invoices: invoice })
    await new InvoiceReturnService(db).createReturn('ws', base)
    expect(calls[0]!.args).not.toHaveProperty('p_deductions')
  })

  it('says which migration is missing when deductions need the new function', async () => {
    const { db } = fakeDb({ invoices: invoice }, () => ({
      error: {
        code: 'PGRST202',
        message: 'Could not find the function public.invoice_return_create',
      },
    }))
    await expect(
      new InvoiceReturnService(db).createReturn('ws', {
        ...base,
        deductions: [{ reason: 'return_fee', mode: 'percent', percent: 10 }],
      }),
    ).rejects.toThrow('RETURN_MIGRATION_05_REQUIRED')
  })

  it('answers a database refusal with its own code, not a 500', async () => {
    const refusal = (message: string) =>
      fakeDb({ invoices: invoice }, () => ({ error: { code: 'P0001', message } })).db
    await expect(
      new InvoiceReturnService(refusal('RETURN_DEDUCTION_EXCEEDS_BASE')).createReturn('ws', base),
    ).rejects.toMatchObject({ statusCode: 400 })
    await expect(
      new InvoiceReturnService(refusal('INVOICE_ALREADY_RETURNED')).createReturn('ws', base),
    ).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('getReturns — what the invoice page is told', () => {
  const header = {
    id: 'ret-1',
    original_invoice_id: 'inv-1',
    return_type: 'sale_return',
    return_number: 'R-1',
    return_date: '2026-11-01',
    total_subtotal_minor: 20000,
    total_discount_minor: 0,
    total_tax_minor: 2000,
    grand_total_minor: 16000,
    deduction_minor: 6000,
    refunded_minor: 4000,
    reason_code: 'customer_change_of_mind',
    notes: null,
  }

  it('camelCase, with the deductions, the credit and what can still be paid back', async () => {
    const { db } = fakeDb({
      invoices: invoice,
      invoice_returns: [header],
      invoice_return_lines: [
        {
          id: 'l1',
          return_id: 'ret-1',
          quantity: 2,
          condition_code: 'opened',
          restock_choice: 'restock',
        },
      ],
      invoice_return_deductions: [
        {
          return_id: 'ret-1',
          reason_code: 'return_fee',
          mode: 'percent',
          percent: 30,
          amount_minor: 6000,
          note: null,
        },
      ],
      invoice_return_refunds: [{ return_id: 'ret-1', status: 'pending', amount_minor: 3000 }],
    })
    const [entry] = await new InvoiceReturnService(db).getReturns('ws', 'inv-1')
    expect(entry).toMatchObject({
      id: 'ret-1',
      grandTotalMinor: 16000,
      deductionMinor: 6000,
      refundedMinor: 4000,
      pendingRefundMinor: 3000,
      // 160.00 credit, 40.00 paid back, 30.00 reserved → 90.00 left
      refundableMinor: 9000,
      refundStatus: 'partial',
      reasonCode: 'customer_change_of_mind',
    })
    expect(entry!.deductions).toEqual([
      { reason: 'return_fee', mode: 'percent', percent: 30, amountMinor: 6000, note: '' },
    ])
    expect(entry!.lines[0]).toMatchObject({ conditionCode: 'opened', restockChoice: 'restock' })
  })

  it('an unpaid invoice has nothing to hand back', async () => {
    const { db } = fakeDb({
      invoices: [{ id: 'inv-1', currency: 'USD', total: 1100, paid_amount: 0 }],
      invoice_returns: [{ ...header, refunded_minor: 0 }],
    })
    const [entry] = await new InvoiceReturnService(db).getReturns('ws', 'inv-1')
    expect(entry).toMatchObject({ refundableMinor: 0, refundStatus: 'not_due' })
  })

  it('a database without invoice-return-05 still lists its returns', async () => {
    const plain = { ...header } as Record<string, unknown>
    for (const key of ['deduction_minor', 'refunded_minor', 'reason_code', 'notes'])
      delete plain[key]
    const { db } = fakeDb({ invoices: invoice, invoice_returns: [plain] })
    const [entry] = await new InvoiceReturnService(db).getReturns('ws', 'inv-1')
    expect(entry).toMatchObject({
      deductionMinor: 0,
      refundedMinor: 0,
      reasonCode: null,
      deductions: [],
    })
  })
})

describe('refundReturn — reserve, pay through the payment core, settle', () => {
  const ctx = { workspaceId: 'ws', userId: 'user-1' } as unknown as TenancyContext
  const rows: Rows = {
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
  const answer: Rpc = (name) =>
    name === 'invoice_return_refund_reserve'
      ? { data: { id: 'refund-1' } }
      : { data: { status: 'paid' } }
  const port = (impl?: RefundPaymentPort['recordPayment']) => ({
    recordPayment: vi.fn(impl ?? (async () => ({ id: 'pay-1' }))),
  })

  it('pays the customer OUT, keyed by the reservation, then settles', async () => {
    const { db, calls } = fakeDb(rows, answer)
    const payments = port()
    const result = await new InvoiceReturnService(db, payments).refundReturn(
      ctx,
      'inv-1',
      'ret-1',
      {
        amount: 70,
        method: 'cash',
        tillSessionId: 'till-1',
      },
    )
    expect(result).toEqual({
      refundId: 'refund-1',
      paymentId: 'pay-1',
      amountMinor: 7000,
      replayed: false,
    })

    expect(calls.map((call) => call.name)).toEqual([
      'invoice_return_refund_reserve',
      'invoice_return_refund_settle',
    ])
    expect(calls[0]!.args).toMatchObject({
      p_amount_minor: 7000,
      p_method: 'cash',
      p_return_id: 'ret-1',
    })
    expect(calls[1]!.args).toMatchObject({ p_refund_id: 'refund-1', p_payment_id: 'pay-1' })

    const [, input, options] = payments.recordPayment.mock.calls[0]!
    expect(input).toMatchObject({
      direction: 'out',
      partyType: 'customer',
      partyId: 'cust-1',
      amount: 70,
      currency: 'USD',
      method: 'cash',
      tillSessionId: 'till-1',
      reference: 'R-1',
    })
    // The same key twice is one payment: the reservation id is the idempotency key.
    expect(options).toEqual({ clientRequestId: 'refund-1' })
  })

  it('a bank refund is a transfer and touches no till', async () => {
    const { db } = fakeDb(rows, answer)
    const payments = port()
    await new InvoiceReturnService(db, payments).refundReturn(ctx, 'inv-1', 'ret-1', {
      amount: 10,
      method: 'bank',
      tillSessionId: 'till-1',
    })
    const [, input] = payments.recordPayment.mock.calls[0]!
    expect(input.method).toBe('transfer')
    expect(input).not.toHaveProperty('tillSessionId')
  })

  it('a refused payment releases the reservation and says why', async () => {
    const { db, calls } = fakeDb(rows, answer)
    const payments = port(async () => {
      throw new Error('TILL_CLOSED')
    })
    await expect(
      new InvoiceReturnService(db, payments).refundReturn(ctx, 'inv-1', 'ret-1', {
        amount: 10,
        method: 'cash',
      }),
    ).rejects.toThrow('TILL_CLOSED')
    expect(calls.map((call) => call.name)).toEqual([
      'invoice_return_refund_reserve',
      'invoice_return_refund_fail',
    ])
  })

  it('a payment that was made but could not be settled is never forgotten', async () => {
    const { db, calls } = fakeDb(rows, (name) =>
      name === 'invoice_return_refund_settle'
        ? { error: { code: 'XX000', message: 'connection reset' } }
        : { data: { id: 'refund-1' } },
    )
    await expect(
      new InvoiceReturnService(db, port()).refundReturn(ctx, 'inv-1', 'ret-1', {
        amount: 10,
        method: 'cash',
      }),
    ).rejects.toThrow('REFUND_PAID_NOT_SETTLED')
    // Not released: the reservation stays pending and keeps counting against the cap.
    expect(calls.map((call) => call.name)).not.toContain('invoice_return_refund_fail')
  })

  it('refuses over the refundable amount with 409, and never calls the payment core', async () => {
    const { db } = fakeDb(rows, () => ({
      error: { code: 'P0001', message: 'REFUND_EXCEEDS_REFUNDABLE: refundable 0, requested 1000' },
    }))
    const payments = port()
    await expect(
      new InvoiceReturnService(db, payments).refundReturn(ctx, 'inv-1', 'ret-1', {
        amount: 10,
        method: 'cash',
      }),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(payments.recordPayment).not.toHaveBeenCalled()
  })

  it('refuses a bad amount or method before anything is reserved', async () => {
    const { db, calls } = fakeDb(rows, answer)
    const service = new InvoiceReturnService(db, port())
    await expect(
      service.refundReturn(ctx, 'inv-1', 'ret-1', { amount: 0, method: 'cash' }),
    ).rejects.toThrow('INVALID_REFUND_AMOUNT')
    await expect(
      service.refundReturn(ctx, 'inv-1', 'ret-1', { amount: Number.NaN, method: 'cash' }),
    ).rejects.toThrow('INVALID_REFUND_AMOUNT')
    await expect(
      service.refundReturn(ctx, 'inv-1', 'ret-1', { amount: 5, method: 'cheque' as never }),
    ).rejects.toThrow('INVALID_REFUND_METHOD')
    expect(calls).toHaveLength(0)
  })

  it('only a return of THIS invoice, and only a sale return, is paid back', async () => {
    const { db } = fakeDb(rows, answer)
    await expect(
      new InvoiceReturnService(db, port()).refundReturn(ctx, 'another-invoice', 'ret-1', {
        amount: 5,
        method: 'cash',
      }),
    ).rejects.toThrow('Return')
    const purchase = fakeDb(
      {
        ...rows,
        invoice_returns: [{ ...rows.invoice_returns![0]!, return_type: 'purchase_return' }],
      },
      answer,
    ).db
    await expect(
      new InvoiceReturnService(purchase, port()).refundReturn(ctx, 'inv-1', 'ret-1', {
        amount: 5,
        method: 'cash',
      }),
    ).rejects.toThrow('REFUND_NOT_ALLOWED')
  })
})
