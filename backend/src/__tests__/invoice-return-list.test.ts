// The returns list must not use a PostgREST embed: invoice_return_lines has no foreign key
// to invoice_returns, so the embed answered PGRST200 and the invoice page never saw a return.

import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { InvoiceReturnService } from '../services/sales/invoice-return.service'

const header = {
  id: 'ret-1',
  original_invoice_id: 'inv-1',
  return_type: 'sale_return',
  return_number: 'R-1',
  return_date: '2026-11-01',
  total_subtotal_minor: '2000',
  total_discount_minor: 0,
  total_tax_minor: 0,
  grand_total_minor: '2000',
}

function fakeDb() {
  const selects: string[] = []
  const rowsOf = (table: string) =>
    table === 'invoices'
      ? [{ id: 'inv-1' }]
      : table === 'invoice_returns'
        ? [header]
        : [{ id: 'line-1', return_id: 'ret-1', quantity: 1 }]
  const db = {
    from(table: string) {
      const chain: Record<string, unknown> = {
        select: (columns: string) => {
          selects.push(`${table}:${columns}`)
          return chain
        },
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        maybeSingle: async () => ({ data: rowsOf(table)[0], error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          resolve({ data: rowsOf(table), error: null }),
      }
      return chain
    },
  }
  return { db: db as unknown as SupabaseClient, selects }
}

describe('InvoiceReturnService.getReturns', () => {
  it('reads the lines with a second query, never an embed, and answers camelCase', async () => {
    const { db, selects } = fakeDb()
    const rows = await new InvoiceReturnService(db).getReturns('ws', 'inv-1')

    expect(selects.every((entry) => !entry.includes('invoice_return_lines('))).toBe(true)
    expect(selects).toContain('invoice_return_lines:*')
    expect(rows).toEqual([
      expect.objectContaining({
        id: 'ret-1',
        originalInvoiceId: 'inv-1',
        returnType: 'sale_return',
        returnNumber: 'R-1',
        returnDate: '2026-11-01',
        grandTotalMinor: 2000,
        lines: [expect.objectContaining({ id: 'line-1' })],
      }),
    ])
  })
})
