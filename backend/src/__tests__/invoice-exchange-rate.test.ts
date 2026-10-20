// ============================================
// An invoice in another currency is recorded with its rate, or not at all.
//
// What happened (13 Oct 2026): ten units of gold were in stock in afghani; ten
// more were bought in Iranian toman. The purchase entered the stock, the cost
// layer and the ledger figure for figure — toman counted as afghani — and
// every number built on them was wrong.
//
// The service is driven directly, with a database that answers what the test
// says, so «nothing was written» is a statement about real calls.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const writes: string[] = []
let rateColumn: 'present' | 'missing' = 'present'
let booksCurrency = 'AFN'

vi.mock('../db', () => {
  const builder = (table: string) => {
    let op = 'select'
    let columns = ''
    const q: any = {
      select: (cols?: string) => ((columns = cols ?? ''), q),
      insert: () => ((op = 'insert'), writes.push(`${table}:insert`), q),
      update: () => ((op = 'update'), writes.push(`${table}:update`), q),
      upsert: () => ((op = 'upsert'), writes.push(`${table}:upsert`), q),
      delete: () => ((op = 'delete'), writes.push(`${table}:delete`), q),
      eq: () => q,
      neq: () => q,
      in: () => q,
      is: () => q,
      gt: () => q,
      gte: () => q,
      lte: () => q,
      or: () => q,
      order: () => q,
      range: () => q,
      limit: () => q,
      maybeSingle: async () =>
        table === 'workspaces'
          ? { data: { base_currency: booksCurrency }, error: null }
          : { data: null, error: null },
      single: async () => ({ data: null, error: null }),
      then: (resolve: (value: unknown) => unknown) =>
        resolve(
          table === 'invoices' && columns === 'exchange_rate' && rateColumn === 'missing'
            ? {
                data: null,
                error: { code: '42703', message: 'column invoices.exchange_rate does not exist' },
              }
            : { data: [], error: null, count: 0 },
        ),
    }
    void op
    return q
  }
  const supabase = {
    from: (table: string) => builder(table),
    rpc: async (name: string) => {
      writes.push(`rpc:${name}`)
      return { data: 'INV-000001', error: null }
    },
  }
  return { supabase, default: supabase }
})

const ctx = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  role: 'owner',
} as any

const purchase = (over: Record<string, unknown> = {}) =>
  ({
    type: 'purchase',
    currency: 'IRR',
    items: [
      { productId: null, productName: 'طلا', quantity: 10, unitPrice: 1000, totalPrice: 10_000 },
    ],
    ...over,
  }) as any

beforeEach(() => {
  writes.length = 0
  rateColumn = 'present'
  booksCurrency = 'AFN'
})

describe('InvoiceService.create — another currency', () => {
  it('⚠️ with no rate it is refused, and nothing is written — not even a number is taken', async () => {
    const { InvoiceService } = await import('../services/invoice.service')
    for (const bad of [
      {},
      { exchangeRate: 0 },
      { exchangeRate: -3 },
      { exchangeRate: Number.NaN },
    ]) {
      await expect(new InvoiceService().create(ctx, purchase(bad))).rejects.toThrow(
        'INVOICE_EXCHANGE_RATE_REQUIRED',
      )
    }
    expect(writes).toEqual([])
  })

  it('⚠️ the same rule for a sale, and whatever the two currencies are', async () => {
    const { InvoiceService } = await import('../services/invoice.service')
    await expect(
      new InvoiceService().create(ctx, purchase({ type: 'sale', currency: 'USD' })),
    ).rejects.toThrow('INVOICE_EXCHANGE_RATE_REQUIRED')
    // A business that keeps its books in dollars: an AFGHANI invoice is the foreign one.
    booksCurrency = 'USD'
    await expect(
      new InvoiceService().create(ctx, purchase({ type: 'sale', currency: 'AFN' })),
    ).rejects.toThrow('INVOICE_EXCHANGE_RATE_REQUIRED')
    expect(writes).toEqual([])
  })

  it('with a rate, on a database that cannot keep it, it is refused by name — not booked without it', async () => {
    const { InvoiceService } = await import('../services/invoice.service')
    rateColumn = 'missing'
    await expect(
      new InvoiceService().create(ctx, purchase({ exchangeRate: 0.0016 })),
    ).rejects.toThrow('INVOICE_EXCHANGE_RATE_NOT_CONFIGURED')
    expect(writes).toEqual([])
  })

  it('an invoice in the books currency needs no rate and never asks whether one can be kept', async () => {
    const { InvoiceService } = await import('../services/invoice.service')
    rateColumn = 'missing'
    // Paid: a purchase owing money with no supplier is refused first (14 Oct).
    const attempt = new InvoiceService().create(
      ctx,
      purchase({ currency: 'AFN', paidAmount: 10_000, paymentMethod: 'cash' }),
    )
    // It goes on to be written (this database then has nothing to read back);
    // what matters is that neither refusal is the reason it stops.
    await attempt.catch((error: Error) => {
      expect(error.message).not.toContain('INVOICE_EXCHANGE_RATE')
    })
    expect(writes.some((entry) => entry.startsWith('rpc:'))).toBe(true)
  })
})

describe('what the rate is used for', () => {
  const read = (path: string) =>
    readFileSync(join(__dirname, '..', path), 'utf8')
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n')
      .split(/\s+/)
      .join(' ')
  const service = read('services/invoice.service.ts')
  const payments = read('services/payments/payments.service.ts')
  /**
   * ⚠️ The lines and the conversion moved to the shared package in Phase 2 of
   * the offline edition (so the device posts the same journal). The assertion
   * follows the rule to its one home; the backend file re-exports it.
   */
  const shared = (path: string) =>
    readFileSync(join(__dirname, '..', '..', '..', 'packages', 'validation', 'src', path), 'utf8')
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n')
      .split(/\s+/)
      .join(' ')

  it('⚠️ a purchase’s cost layer is in the books currency', () => {
    expect(service).toContain('unitCost: quantity > 0 ? (lineTotal * exchangeRate) / quantity : 0,')
  })

  it('⚠️ the ledger gets the total at the invoice’s rate; the cost of goods is not converted twice', () => {
    expect(service).toContain(
      'const total = InvoiceService.inBooksCurrency(Number(data.total) || 0, rate)',
    )
    // Lines and conversion live in a pure module since 18 Oct 2026 (posted as
    // is by inventory-avco-01.pg.test); the service only calls it.
    expect(service).toContain('costOfGoodsSold: data.costOfGoodsSold,')
    const posting = shared('schemas/invoice-posting.domain.ts')
    expect(posting).toContain('const cost = Number(input.costOfGoodsSold) || 0')
    expect(posting).toContain('return rate === 1 ? amount : Math.round(amount * rate * 100) / 100')
  })

  it('every later posting of the same invoice reads the rate it was frozen with', () => {
    // Made, edited, re-posted, approved: four places that book an invoice —
    // plus «قیمت خرید» after a purchase (refreshBuyPrices), which converts at
    // the same frozen rate.
    expect(service.split('await this.storedExchangeRate(ctx.workspaceId').length - 1).toBe(4)
    expect(service).toContain('...(exchangeRate !== 1 ? { exchange_rate: exchangeRate } : {}),')
  })

  it('the route forwards it — a field its manual mapping does not name never arrives', () => {
    expect(read('routes/invoice.routes.ts')).toContain(
      '...(Number(body.exchangeRate) > 0 ? { exchangeRate: Number(body.exchangeRate) } : {}),',
    )
  })

  it('⚠️ money in another currency is booked at a rate decided BEFORE it is recorded', () => {
    const decide = payments.indexOf(
      "if (bookingRate === null) throw new ValidationError('PAYMENT_EXCHANGE_RATE_REQUIRED')",
    )
    const record = payments.indexOf('await this.repo.recordPayment(')
    expect(decide).toBeGreaterThan(-1)
    expect(record).toBeGreaterThan(decide)
    // Booked through `paymentPosting`: the cash at the payment's rate, the
    // debt at its invoice's (till-on-payments.test.ts holds the arithmetic).
    expect(payments.split(/\s+/).join(' ')).toContain('paymentRate: bookingRate,')
    expect(payments).not.toContain('round2(amount * bookingRate),')
    // The payment made with the invoice carries the invoice's own rate.
    expect(service).toContain(
      '? { exchangeRate: Number((data as { exchangeRate?: number }).exchangeRate) }',
    )
  })
})

describe('an amount owed needs somebody who owes it (live audit, 14 Oct)', () => {
  it('⚠️ an unpaid invoice with no party is refused — and nothing is written, not even a number', async () => {
    // INV-000084 on the live site: a sale with no customer, nothing paid —
    // a receivable that belongs to nobody.
    const { InvoiceService } = await import('../services/invoice.service')
    await expect(new InvoiceService().create(ctx, purchase({ currency: 'AFN' }))).rejects.toThrow(
      'INVOICE_CREDIT_NEEDS_PARTY',
    )
    expect(writes).toEqual([])
  })

  it('«نسیه» counts as owing; a part paid in cash does not cover the rest', async () => {
    const { InvoiceService } = await import('../services/invoice.service')
    for (const over of [
      { paymentMethod: 'credit', paidAmount: 10_000 },
      {
        payments: [
          { method: 'cash', amount: 4_000 },
          { method: 'credit', amount: 6_000 },
        ],
      },
      { paidAmount: 9_999, paymentMethod: 'cash' },
    ]) {
      writes.length = 0
      await expect(
        new InvoiceService().create(ctx, purchase({ currency: 'AFN', ...over })),
      ).rejects.toThrow('INVOICE_CREDIT_NEEDS_PARTY')
      expect(writes).toEqual([])
    }
  })
})
