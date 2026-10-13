// ============================================
// A cash payment names its till; an invoice paid at another rate than it was
// booked at shows the difference.
//
// Asked for on 13 October: «خرید از کدوم صندق پول کم بشه، فروخت به کدوم صندق
// تزریق بشه — یه هسته مشترک باشه که قاطی نشه».
//
// The shared core is `PaymentsService.recordPayment`: a sale's receipt, a
// purchase's payment, at invoice time or later, all pass through it. The
// service is driven directly with a repository that records what it was asked
// to write, so «nothing was written» is a statement about real calls.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { paymentPosting, tillAmountMinor } from '../services/payments/payments.domain'

const posted: Array<{ lines: Array<{ accountId: string; debit: number; credit: number }> }> = []
let fxAccount: 'present' | 'refused' = 'present'
let till: { id: string; currency: string | null; branchId: string | null } | Error = {
  id: 'till-1',
  currency: null,
  branchId: null,
}

vi.mock('../db', () => ({ supabase: {}, default: {} }))
vi.mock('../services/base-currency', () => ({ baseCurrencyOf: async () => 'AFN' }))
vi.mock('../utils/money-cache', () => ({ invalidateMoneyCaches: async () => {} }))
vi.mock('../services/event-log.service', () => ({ logBusinessEvent: async () => {} }))
vi.mock('../services/authorization', () => ({
  sod: { recordAction: async () => {} },
  scopes: { assertMay: async () => {} },
}))
vi.mock('../services/pos/till-choice', () => ({
  tillForPayment: async () => {
    if (till instanceof Error) throw till
    return till
  },
}))
vi.mock('../services/accounting', () => ({
  ledger: {
    ensureAccountsForRoles: async (_ctx: unknown, roles: string[]) => {
      if (roles.includes('fx_gain_loss') && fxAccount === 'refused') {
        throw new Error('accounts_role_check')
      }
      return { accounts: Object.fromEntries(roles.map((role) => [role, role])), missing: [] }
    },
    postDocument: async (_ctx: unknown, request: (typeof posted)[number]) => {
      posted.push(request)
      return { status: 'posted', entryId: 'entry-1', entryNumber: 'JE-1' }
    },
  },
}))

const ctx = { workspaceId: 'ws-1', userId: 'user-1', role: 'owner' } as any
const INVOICE = '11111111-1111-4111-8111-111111111111'

function fakeRepo(invoice: { currency: string | null; rate: number | null; total?: number }) {
  const recorded: Array<{ payment: any; till: any; key: string | null }> = []
  const repo = {
    recorded,
    paymentIdByClientRequestId: async () => null,
    openInvoicesFor: async () => [],
    openInvoicesByIds: async () => [
      {
        invoiceId: INVOICE,
        invoiceNumber: 'INV-1',
        total: invoice.total ?? 1000,
        allocated: 0,
        dueDate: '2026-10-13',
        invoiceDate: '2026-10-13',
        currency: invoice.currency,
        customerId: null,
        supplierId: null,
        type: 'purchase',
      },
    ],
    invoiceExchangeRates: async () => (invoice.rate === null ? [Number.NaN] : [invoice.rate]),
    invoiceRatesById: async () =>
      new Map(invoice.rate === null ? [] : [[INVOICE, invoice.rate] as const]),
    lastPaymentSequence: async () => 0,
    recordPayment: async (
      _ctx: unknown,
      payment: any,
      _allocations: any,
      key: string | null,
      t: any,
    ) => {
      recorded.push({ payment, till: t, key })
      return { id: 'payment-1', replayed: false }
    },
    attachJournalEntry: async () => {},
    getPayment: async () => ({
      id: 'payment-1',
      paymentNumber: 'PMT-2026-000001',
      direction: 'out',
      amount: 0,
      currency: 'AFN',
      entryDate: '2026-10-13',
      allocations: [],
    }),
  }
  return repo
}

const pay = (over: Record<string, unknown> = {}) =>
  ({
    direction: 'out',
    partyType: 'supplier',
    partyId: null,
    amount: 500,
    method: 'cash',
    allocations: [{ invoiceId: INVOICE, amount: 500 }],
    ...over,
  }) as any

async function service(repo: ReturnType<typeof fakeRepo>) {
  const { PaymentsService } = await import('../services/payments/payments.service')
  return new PaymentsService(repo as any)
}

const sides = (entry: (typeof posted)[number]) => ({
  debit: entry.lines.reduce((sum, line) => sum + line.debit, 0),
  credit: entry.lines.reduce((sum, line) => sum + line.credit, 0),
})

beforeEach(() => {
  posted.length = 0
  fxAccount = 'present'
  till = { id: 'till-1', currency: null, branchId: null }
})

describe('what a payment moves in the till it names', () => {
  const base = { amount: 500, bookCurrency: 'AFN', rate: 1 }

  it('a till in the payment’s currency moves by the amount itself', () => {
    expect(tillAmountMinor({ ...base, currency: 'AFN', tillCurrency: 'AFN' })).toBe(50_000)
    expect(tillAmountMinor({ ...base, currency: 'USD', tillCurrency: 'USD', rate: 70 })).toBe(
      50_000,
    )
  })

  it('a foreign payment taken into a books-currency till moves by its value at the rate', () => {
    // 6,500,000 toman at 0.0016 afghani each = 10,400 afghani.
    expect(
      tillAmountMinor({
        amount: 6_500_000,
        currency: 'IRR',
        tillCurrency: 'AFN',
        bookCurrency: 'AFN',
        rate: 0.0016,
      }),
    ).toBe(1_040_000)
  })

  it('⚠️ between two currencies with no rate between them there is no figure — not a guessed one', () => {
    // A toman payment and a dollar till: the rate given is toman→afghani.
    expect(
      tillAmountMinor({
        amount: 100,
        currency: 'IRR',
        tillCurrency: 'USD',
        bookCurrency: 'AFN',
        rate: 0.0016,
      }),
    ).toBeNull()
    // A books-currency payment and a dollar till.
    expect(
      tillAmountMinor({
        amount: 100,
        currency: 'AFN',
        tillCurrency: 'USD',
        bookCurrency: 'AFN',
        rate: 1,
      }),
    ).toBeNull()
    expect(tillAmountMinor({ ...base, amount: 0, currency: 'AFN', tillCurrency: 'AFN' })).toBeNull()
  })
})

describe('the exchange difference of a payment', () => {
  it('same rate as the invoice (or no rate of its own): no difference, both sides the cash figure', () => {
    expect(
      paymentPosting({
        direction: 'in',
        amount: 100,
        paymentRate: 70,
        allocations: [{ amount: 100, rate: 70 }],
      }),
    ).toEqual({ cash: 7000, party: 7000, difference: 0, fee: 0 })
    expect(
      paymentPosting({
        direction: 'out',
        amount: 100,
        paymentRate: 1,
        allocations: [{ amount: 100, rate: null }],
      }),
    ).toEqual({ cash: 100, party: 100, difference: 0, fee: 0 })
  })

  it('a sale of 100 dollars booked at 70 and received at 72 is a GAIN of 200', () => {
    expect(
      paymentPosting({
        direction: 'in',
        amount: 100,
        paymentRate: 72,
        allocations: [{ amount: 100, rate: 70 }],
      }),
    ).toEqual({ cash: 7200, party: 7000, difference: 200, fee: 0 })
  })

  it('the same sale received at 68 is a LOSS of 200', () => {
    expect(
      paymentPosting({
        direction: 'in',
        amount: 100,
        paymentRate: 68,
        allocations: [{ amount: 100, rate: 70 }],
      }),
    ).toEqual({ cash: 6800, party: 7000, difference: -200, fee: 0 })
  })

  it('⚠️ a purchase is the other way round: paying MORE afghani than was owed is the loss', () => {
    expect(
      paymentPosting({
        direction: 'out',
        amount: 100,
        paymentRate: 72,
        allocations: [{ amount: 100, rate: 70 }],
      }),
    ).toEqual({ cash: 7200, party: 7000, difference: -200, fee: 0 })
    expect(
      paymentPosting({
        direction: 'out',
        amount: 100,
        paymentRate: 68,
        allocations: [{ amount: 100, rate: 70 }],
      }),
    ).toEqual({ cash: 6800, party: 7000, difference: 200, fee: 0 })
  })

  it('an advance has no earlier rate: only the part that settles an invoice differs', () => {
    // 150 received at 72; 100 of it settles an invoice booked at 70.
    expect(
      paymentPosting({
        direction: 'in',
        amount: 150,
        paymentRate: 72,
        allocations: [{ amount: 100, rate: 70 }],
      }),
    ).toEqual({ cash: 10_800, party: 10_600, difference: 200, fee: 0 })
  })
})

describe('PaymentsService.recordPayment — the till', () => {
  it('⚠️ no till named = no till touched: nothing is inferred from who recorded it', async () => {
    const repo = fakeRepo({ currency: null, rate: null })
    const result = await (await service(repo)).recordPayment(ctx, pay())
    expect(repo.recorded[0]!.till).toBeNull()
    expect(result).toMatchObject({ tillSessionId: null })
  })

  it('a purchase paid in cash from a named till: that till, and what leaves it', async () => {
    const repo = fakeRepo({ currency: null, rate: null })
    const result = await (await service(repo)).recordPayment(ctx, pay({ tillSessionId: 'till-1' }))
    expect(repo.recorded[0]!.till).toEqual({ sessionId: 'till-1', amountMinor: 50_000 })
    expect(repo.recorded[0]!.payment.direction).toBe('out')
    expect(result).toMatchObject({ tillSessionId: 'till-1' })
  })

  it('a sale received in cash into a named till is the same core, the other direction', async () => {
    const repo = fakeRepo({ currency: null, rate: null })
    await (
      await service(repo)
    ).recordPayment(ctx, pay({ direction: 'in', partyType: 'customer', tillSessionId: 'till-1' }))
    expect(repo.recorded[0]!.till).toEqual({ sessionId: 'till-1', amountMinor: 50_000 })
    expect(repo.recorded[0]!.payment.direction).toBe('in')
  })

  it('⚠️ a card or a transfer cannot name a till — refused, and NOTHING is written', async () => {
    const repo = fakeRepo({ currency: null, rate: null })
    await expect(
      (await service(repo)).recordPayment(ctx, pay({ method: 'card', tillSessionId: 'till-1' })),
    ).rejects.toThrow('PAYMENT_TILL_ONLY_CASH')
    expect(repo.recorded).toEqual([])
    expect(posted).toEqual([])
  })

  it('⚠️ a closed till, or one this member may not use: refused before the payment exists', async () => {
    const repo = fakeRepo({ currency: null, rate: null })
    for (const code of [
      'PAYMENT_TILL_NOT_OPEN',
      'PAYMENT_TILL_NOT_FOUND',
      'PAYMENT_TILL_NOT_PERMITTED',
    ]) {
      till = new Error(code)
      await expect(
        (await service(repo)).recordPayment(ctx, pay({ tillSessionId: 'till-1' })),
      ).rejects.toThrow(code)
    }
    expect(repo.recorded).toEqual([])
    expect(posted).toEqual([])
  })

  it('a toman payment out of an afghani till needs its rate, and the till moves by afghani', async () => {
    const repo = fakeRepo({ currency: 'IRR', rate: 0.0016, total: 6_500_000 })
    await (
      await service(repo)
    ).recordPayment(
      ctx,
      pay({
        amount: 6_500_000,
        currency: 'IRR',
        exchangeRate: 0.0016,
        tillSessionId: 'till-1',
        allocations: [{ invoiceId: INVOICE, amount: 6_500_000 }],
      }),
    )
    expect(repo.recorded[0]!.till).toEqual({ sessionId: 'till-1', amountMinor: 1_040_000 })
    // The payment itself stays in its own currency.
    expect(repo.recorded[0]!.payment).toMatchObject({ amount: 6_500_000, currency: 'IRR' })
  })

  it('⚠️ a toman payment and a dollar till: refused, nothing written', async () => {
    till = { id: 'till-usd', currency: 'USD', branchId: null }
    const repo = fakeRepo({ currency: 'IRR', rate: 0.0016, total: 6_500_000 })
    await expect(
      (await service(repo)).recordPayment(
        ctx,
        pay({
          amount: 100,
          currency: 'IRR',
          exchangeRate: 0.0016,
          tillSessionId: 'till-usd',
          allocations: [{ invoiceId: INVOICE, amount: 100 }],
        }),
      ),
    ).rejects.toThrow('PAYMENT_TILL_CURRENCY_MISMATCH')
    expect(repo.recorded).toEqual([])
  })

  it('the request key travels with the till, so a retry cannot move the drawer twice', async () => {
    const repo = fakeRepo({ currency: null, rate: null })
    await (
      await service(repo)
    ).recordPayment(ctx, pay({ tillSessionId: 'till-1' }), {
      clientRequestId: 'request-key-1',
    })
    expect(repo.recorded[0]!.key).toBe('request-key-1')
    expect(repo.recorded[0]!.till).not.toBeNull()
  })
})

describe('PaymentsService.recordPayment — the books', () => {
  const dollarPurchase = { currency: 'USD', rate: 70, total: 100 }
  const usd = (rate: number, over: Record<string, unknown> = {}) =>
    pay({
      amount: 100,
      currency: 'USD',
      exchangeRate: rate,
      allocations: [{ invoiceId: INVOICE, amount: 100 }],
      ...over,
    })

  it('paid at the invoice’s rate: two lines, as always', async () => {
    await (await service(fakeRepo(dollarPurchase))).recordPayment(ctx, usd(70))
    expect(posted[0]!.lines).toEqual([
      { accountId: 'payable', debit: 7000, credit: 0 },
      { accountId: 'cash', debit: 0, credit: 7000 },
    ])
  })

  it('⚠️ a purchase booked at 70 and paid at 72: the payable closes by 7000, cash leaves by 7200, 200 is a loss', async () => {
    await (await service(fakeRepo(dollarPurchase))).recordPayment(ctx, usd(72))
    expect(posted[0]!.lines).toEqual([
      { accountId: 'payable', debit: 7000, credit: 0 },
      { accountId: 'cash', debit: 0, credit: 7200 },
      { accountId: 'fx_gain_loss', debit: 200, credit: 0 },
    ])
    expect(sides(posted[0]!).debit).toBe(sides(posted[0]!).credit)
  })

  it('⚠️ a sale booked at 70 and received at 72: the receivable closes by 7000 and 200 is a gain', async () => {
    await (
      await service(fakeRepo(dollarPurchase))
    ).recordPayment(ctx, usd(72, { direction: 'in', partyType: 'customer' }))
    expect(posted[0]!.lines).toEqual([
      { accountId: 'cash', debit: 7200, credit: 0 },
      { accountId: 'receivable', debit: 0, credit: 7000 },
      { accountId: 'fx_gain_loss', debit: 0, credit: 200 },
    ])
    expect(sides(posted[0]!).debit).toBe(sides(posted[0]!).credit)
  })

  it('on a database that cannot hold the account, the payment is still booked — balanced, as before', async () => {
    fxAccount = 'refused'
    await (await service(fakeRepo(dollarPurchase))).recordPayment(ctx, usd(72))
    expect(posted[0]!.lines).toEqual([
      { accountId: 'payable', debit: 7200, credit: 0 },
      { accountId: 'cash', debit: 0, credit: 7200 },
    ])
  })

  it('a payment in the books currency never asks for the exchange account', async () => {
    await (await service(fakeRepo({ currency: null, rate: null }))).recordPayment(ctx, pay())
    expect(posted[0]!.lines).toHaveLength(2)
  })
})

describe('the wiring', () => {
  const read = (path: string) =>
    readFileSync(join(__dirname, '..', path), 'utf8')
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n')
      .split(/\s+/)
      .join(' ')

  it('⚠️ a till shows the payments that NAME it — not the payments of whoever opened it', () => {
    const pos = read('services/pos/pos.service.ts')
    const named = pos.slice(
      pos.indexOf('private async loadSettlements('),
      pos.indexOf('private async loadInferredSettlements('),
    )
    expect(named).toContain(".eq('workspace_id', ctx.workspaceId)")
    expect(named).toContain(".eq('pos_session_id', session.id)")
    expect(named).toContain(".eq('status', 'posted')")
    expect(named).toContain('amountMinor: Number(row.till_amount_minor) || 0')
    expect(named).not.toContain('openedBy')
    // The inference survives only for a database without the column.
    expect(named).toContain("isMissingColumn(error, 'pos_session_id')")
  })

  it('the till is read inside the workspace and must be open; a branch till is for its branch', () => {
    const choice = read('services/pos/till-choice.ts')
    expect(choice).toContain(".eq('workspace_id', ctx.workspaceId)")
    expect(choice).toContain(
      "if (row.status !== 'open') throw new ConflictError('PAYMENT_TILL_NOT_OPEN')",
    )
    expect(choice).toContain("throw new ForbiddenError('PAYMENT_TILL_NOT_PERMITTED')")
  })

  it('⚠️ both routes name the field — a mapping that does not name it drops it', () => {
    expect(read('routes/payments.routes.ts')).toContain(
      'tillSessionId: z.string().uuid().nullable().optional()',
    )
    expect(read('routes/payments.routes.ts')).toContain(
      'exchangeRate: z.number().positive().finite().optional()',
    )
    expect(read('routes/invoice.routes.ts')).toContain(
      '{ tillSessionId: body.tillSessionId as string }',
    )
  })

  it('an invoice asks the till BEFORE it is written, and only its cash part reaches it', () => {
    const invoice = read('services/invoice.service.ts')
    const ask = invoice.indexOf('await this.payments.assertTillTakes(ctx, data.tillSessionId')
    expect(ask).toBeGreaterThan(-1)
    expect(ask).toBeLessThan(invoice.indexOf("await assertWithinLimit(workspaceId, 'invoices')"))
    expect(invoice).toContain("...(data.tillSessionId && tranche.method === 'cash'")
    expect(invoice).toContain('if (data.tillSessionId && tillCash > 0) {')
  })

  it('with the till, payment + allocations + till are ONE database call', () => {
    const repo = read('services/payments/payments.repository.ts')
    expect(repo).toContain("? 'payments_record_at_till'")
    expect(repo).toContain("throw new ConflictError('PAYMENT_TILL_NOT_CONFIGURED')")
  })

  it('⚠️ stock on its own moves no money: no inventory code writes a payment or a till movement', () => {
    // A stock increase is not a purchase and a decrease is not a sale. Money
    // moves when a PAYMENT is recorded against an invoice — never because a
    // quantity changed (an adjustment, a transfer, waste, a count, production).
    const services = join(__dirname, '..', 'services')
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : []
      })
    const folders = [
      'inventory',
      'inventory-costing',
      'inventory-insights',
      'manufacturing',
      'cycle-count',
      'purchasing',
    ]
    const files = ['warehouse.service.ts', 'product.service.ts', 'supplier.service.ts']
    const stockCode = walk(services).filter((path) => {
      const parts = path.split(sep)
      return (
        parts.some((part) => folders.includes(part)) || files.includes(parts[parts.length - 1]!)
      )
    })
    expect(stockCode.length).toBeGreaterThan(10)
    for (const path of stockCode) {
      const code = readFileSync(path, 'utf8')
      for (const moneyWriter of [
        'pos_cash_movements',
        'payments_record',
        'recordPayment(',
        'recordMovement(',
        "from('payments')",
      ]) {
        expect(code.includes(moneyWriter), path + ' → ' + moneyWriter).toBe(false)
      }
    }
  })
})
