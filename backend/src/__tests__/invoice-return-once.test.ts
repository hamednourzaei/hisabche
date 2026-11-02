// One return per invoice: a second, different return is refused before the RPC runs, and
// a retry of the SAME request still gets the first answer back.

import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { InvoiceReturnService } from '../services/sales/invoice-return.service'

vi.mock('../utils/money-cache', () => ({ invalidateMoneyCaches: vi.fn() }))

const input = {
  originalInvoiceId: 'inv-1',
  returnType: 'sale_return' as const,
  returnNumber: 'R-2',
  returnDate: '2026-11-01',
  lines: [
    {
      originalLineId: 'line-1',
      returnQuantity: 1,
      restockChoice: 'restock' as const,
      reasonCode: 'other' as const,
    },
  ],
}

function fakeDb(existingReturns: number) {
  const rpc = vi.fn(async () => ({ data: { id: 'ret-new' }, error: null }))
  const db = {
    rpc,
    from(table: string) {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        maybeSingle: async () => ({
          data: table === 'invoices' ? { id: 'inv-1', currency: 'AFN' } : null,
          error: null,
        }),
        then: (resolve: (value: unknown) => unknown) =>
          resolve({
            data: null,
            count: table === 'invoice_returns' ? existingReturns : 0,
            error: null,
          }),
      }
      return chain
    },
  }
  return { db: db as unknown as SupabaseClient, rpc }
}

describe('InvoiceReturnService.createReturn — once per invoice', () => {
  it('refuses a second return with INVOICE_ALREADY_RETURNED and never calls the RPC', async () => {
    const { db, rpc } = fakeDb(1)
    await expect(new InvoiceReturnService(db).createReturn('ws', input)).rejects.toThrow(
      'INVOICE_ALREADY_RETURNED',
    )
    expect(rpc).not.toHaveBeenCalled()
  })

  it('records the first return', async () => {
    const { db, rpc } = fakeDb(0)
    await new InvoiceReturnService(db).createReturn('ws', input)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('maps the database trigger refusal (a concurrent second return) to the same code', async () => {
    const { db, rpc } = fakeDb(0)
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'INVOICE_ALREADY_RETURNED' },
    } as never)
    await expect(new InvoiceReturnService(db).createReturn('ws', input)).rejects.toThrow(
      'INVOICE_ALREADY_RETURNED',
    )
  })
})
