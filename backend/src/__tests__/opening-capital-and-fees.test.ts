// ============================================
// What the business started with, and what a transfer cost.
//
//   · «سرمایه‌ی افتتاحیه»: cash into a till or the bank, credited to the
//     owner's capital — booked when recorded, so the till's close does not
//     book it again; and the goods a product started with, the same way
//   · a payment's fee: its own line, never inside the exchange difference
//
// The services are driven directly, with a database and a ledger that record
// what they were asked to write.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { cashMovedOf, paymentPosting } from '../services/payments/payments.domain'
import { movementsNetMinor, transfersNetMinor, type CashMovement } from '../services/pos/pos.domain'

type Line = { accountId: string; debit: number; credit: number }
const posted: Array<{ sourceType: string; sourceId: string; lines: Line[] }> = []
const upserts: Array<{ table: string; row: Record<string, unknown> }> = []
let session: Record<string, unknown> | null = null
let roleRefused: string | null = null
let alreadyPosted = false

vi.mock('../db', () => {
  const builder = (table: string) => {
    const q: any = {
      select: () => q,
      eq: () => q,
      in: () => q,
      order: () => q,
      range: () => q,
      upsert: async (row: Record<string, unknown>) => {
        upserts.push({ table, row })
        return { error: null }
      },
      maybeSingle: async () => ({ data: table === 'pos_sessions' ? session : null, error: null }),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null }),
    }
    return q
  }
  const supabase = { from: (table: string) => builder(table) }
  return { supabase, default: supabase }
})
vi.mock('../services/base-currency', () => ({ baseCurrencyOf: async () => 'AFN' }))
vi.mock('../utils/money-cache', () => ({ invalidateMoneyCaches: async () => {} }))
vi.mock('../services/event-log.service', () => ({ logBusinessEvent: async () => {} }))
vi.mock('../services/authorization', () => ({
  sod: { recordAction: async () => {} },
  scopes: { assertMay: async () => {} },
}))
vi.mock('../services/pos/till-choice', () => ({
  tillForPayment: async () => ({ id: 'till-1', currency: null, branchId: null }),
}))
vi.mock('../services/accounting', () => ({
  AccountingService: class {},
  ledger: {
    ensureAccountsForRoles: async (_ctx: unknown, roles: string[]) => {
      if (roleRefused && roles.includes(roleRefused)) throw new Error('accounts_role_check')
      return { accounts: Object.fromEntries(roles.map((role) => [role, role])), missing: [] }
    },
    postDocument: async (_ctx: unknown, request: (typeof posted)[number]) => {
      posted.push(request)
      return alreadyPosted
        ? { status: 'already_posted', entryId: 'entry-1' }
        : { status: 'posted', entryId: 'entry-1', entryNumber: 'JE-1' }
    },
  },
}))

const ctx = { workspaceId: 'ws-1', userId: 'user-1', role: 'owner' } as any
const ENTRY = '77777777-7777-4777-8777-777777777777'
const TILL = '11111111-1111-4111-8111-111111111111'
const INVOICE = '22222222-2222-4222-8222-222222222222'

const sides = (lines: Line[]) => ({
  debit: lines.reduce((sum, line) => sum + line.debit, 0),
  credit: lines.reduce((sum, line) => sum + line.credit, 0),
})
const read = (path: string) =>
  readFileSync(join(__dirname, '..', path), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')

beforeEach(() => {
  posted.length = 0
  upserts.length = 0
  roleRefused = null
  alreadyPosted = false
  session = {
    id: TILL,
    status: 'open',
    opening_float_minor: 0,
    opened_at: '2026-10-13',
    opened_by: 'user-1',
  }
})

describe('a till counts opening capital, and its close does not book it twice', () => {
  const movement = (kind: CashMovement['kind'], amountMinor: number): CashMovement => ({
    id: kind,
    kind,
    amountMinor,
    reason: 'x',
    createdAt: '2026-10-13T08:00:00Z',
  })

  it('⚠️ it is with the transfers (already booked), not with ordinary cash in (booked at close)', () => {
    const movements = [movement('opening_capital', 5_000_000), movement('cash_in', 20_000)]
    expect(transfersNetMinor(movements)).toBe(5_000_000)
    expect(movementsNetMinor(movements)).toBe(20_000)
  })
})

describe('PosService.recordOpeningCapital', () => {
  const load = async () => new (await import('../services/pos/pos.service')).PosService()

  it('into a till: Dr cash / Cr capital, and the drawer movement with the SAME id', async () => {
    const result = await (
      await load()
    ).recordOpeningCapital(ctx, {
      entryId: ENTRY,
      amountMinor: 5_000_000,
      into: 'till',
      sessionId: TILL,
    })
    expect(posted).toHaveLength(1)
    expect(posted[0]).toMatchObject({ sourceType: 'opening_capital', sourceId: ENTRY })
    expect(posted[0]!.lines).toEqual([
      { accountId: 'cash', debit: 5_000_000, credit: 0 },
      { accountId: 'owner_capital', debit: 0, credit: 5_000_000 },
    ])
    expect(upserts).toEqual([
      {
        table: 'pos_cash_movements',
        row: expect.objectContaining({
          id: ENTRY,
          session_id: TILL,
          workspace_id: 'ws-1',
          kind: 'opening_capital',
          amount_minor: 5_000_000,
        }),
      },
    ])
    expect(result).toMatchObject({ entryId: ENTRY, alreadyRecorded: false })
  })

  it('into the bank: Dr bank / Cr capital, and NO till is touched', async () => {
    await (
      await load()
    ).recordOpeningCapital(ctx, { entryId: ENTRY, amountMinor: 100_000, into: 'bank' })
    expect(posted[0]!.lines).toEqual([
      { accountId: 'bank', debit: 100_000, credit: 0 },
      { accountId: 'owner_capital', debit: 0, credit: 100_000 },
    ])
    expect(upserts).toEqual([])
  })

  it('⚠️ a retry posts nothing new and says so (the ledger and the upsert are both keyed by the id)', async () => {
    alreadyPosted = true
    const result = await (
      await load()
    ).recordOpeningCapital(ctx, {
      entryId: ENTRY,
      amountMinor: 5_000_000,
      into: 'till',
      sessionId: TILL,
    })
    expect(result.alreadyRecorded).toBe(true)
    expect(read('services/pos/pos.service.ts')).toContain(
      "kind: 'opening_capital', amount_minor: input.amountMinor, reason, created_by: ctx.userId, }, { onConflict: 'id', ignoreDuplicates: true },",
    )
  })

  it.each([
    ['a closed till', { status: 'closed' }, 'POS_SESSION_NOT_OPEN'],
    ['a suspended till', { status: 'suspended' }, 'POS_SESSION_NOT_OPEN'],
    ['a till that counts in dollars', { currency: 'USD' }, 'OPENING_CAPITAL_TILL_CURRENCY'],
  ])('⚠️ %s is refused BEFORE anything is booked', async (_name, over, code) => {
    session = { ...session, ...over }
    await expect(
      (await load()).recordOpeningCapital(ctx, {
        entryId: ENTRY,
        amountMinor: 1000,
        into: 'till',
        sessionId: TILL,
      }),
    ).rejects.toThrow(code)
    expect(posted).toEqual([])
    expect(upserts).toEqual([])
  })

  it('no till named for «into a till», or no amount: refused, nothing booked', async () => {
    const pos = await load()
    await expect(
      pos.recordOpeningCapital(ctx, { entryId: ENTRY, amountMinor: 1000, into: 'till' }),
    ).rejects.toThrow('OPENING_CAPITAL_TILL_REQUIRED')
    await expect(
      pos.recordOpeningCapital(ctx, { entryId: ENTRY, amountMinor: 0, into: 'bank' }),
    ).rejects.toThrow('OPENING_CAPITAL_AMOUNT_INVALID')
    expect(posted).toEqual([])
  })

  it('on a database without the capital account it says «not configured» — it does not book elsewhere', async () => {
    roleRefused = 'owner_capital'
    await expect(
      (await load()).recordOpeningCapital(ctx, { entryId: ENTRY, amountMinor: 1000, into: 'bank' }),
    ).rejects.toThrow('OPENING_CAPITAL_NOT_CONFIGURED')
    expect(posted).toEqual([])
  })

  it('the route asks for the right to post to the ledger, and is in the concurrency register', () => {
    const routes = read('routes/pos.routes.ts')
    const route = routes.slice(routes.indexOf("'/opening-capital',"))
    expect(route.slice(0, 200)).toContain("requireCapability('ledger.post')")
    expect(route.slice(0, 200)).toContain('requireWorkspaceContext')
    expect(read('utils/concurrency-safety-map.ts')).toContain("route: 'POST /opening-capital',")
  })
})

describe('the goods a product started with are capital too', () => {
  const product = read('services/product.service.ts')

  it('⚠️ opening stock is booked Dr inventory / Cr capital, for what was VALUED, once per product', () => {
    expect(product).toContain(
      'await this.bookOpeningStock(ctx, productId, valued * unitCost, entryDate)',
    )
    expect(product).toContain("sourceType: 'opening_stock', sourceId: productId,")
    expect(product).toContain(
      '{ accountId: accounts.inventory, debit: amount, credit: 0 }, { accountId: accounts.owner_capital, debit: 0, credit: amount },',
    )
    // Counted only when the cost layer was actually made.
    expect(product.indexOf('valued += entry.quantity')).toBeGreaterThan(
      product.indexOf('await costing.recordReceipt(ctx, {'),
    )
  })

  it('no purchase price = no value = nothing booked; and it never fails the product', () => {
    expect(product).toContain('if (unitCost <= 0) return')
    expect(product).toContain('if (!(amount > 0)) return')
    const book = product.slice(product.indexOf('private async bookOpeningStock('))
    expect(book.slice(0, 900)).toContain('} catch (err) {')
  })
})

describe('the fee of a payment', () => {
  it('what moves in the cash: less the fee on money in, plus the fee on money out', () => {
    expect(cashMovedOf('in', 100, 2)).toBe(98)
    expect(cashMovedOf('out', 100, 2)).toBe(102)
    expect(cashMovedOf('in', 100, 0)).toBe(100)
  })

  it('money in: the customer’s debt closes by ALL of it; the fee is a cost of ours', () => {
    expect(
      paymentPosting({
        direction: 'in',
        amount: 100,
        paymentRate: 1,
        allocations: [{ amount: 100, rate: null }],
        fee: 2,
      }),
    ).toEqual({ cash: 98, party: 100, difference: 0, fee: 2 })
  })

  it('money out: the supplier is paid in full, and the fee is paid on top', () => {
    expect(
      paymentPosting({
        direction: 'out',
        amount: 100,
        paymentRate: 1,
        allocations: [{ amount: 100, rate: null }],
        fee: 5,
      }),
    ).toEqual({ cash: 105, party: 100, difference: 0, fee: 5 })
  })

  it('⚠️ a fee and a different rate are TWO figures — the fee is not hidden in the exchange difference', () => {
    // 100 dollars booked at 70, received at 72, and the changer kept 2 dollars.
    expect(
      paymentPosting({
        direction: 'in',
        amount: 100,
        paymentRate: 72,
        allocations: [{ amount: 100, rate: 70 }],
        fee: 2,
      }),
    ).toEqual({ cash: 7056, party: 7000, difference: 200, fee: 144 })
  })
})

describe('PaymentsService.recordPayment — with a fee', () => {
  function fakeRepo() {
    const recorded: Array<{ payment: any; till: any; fee: number | null }> = []
    return {
      recorded,
      paymentIdByClientRequestId: async () => null,
      openInvoicesFor: async () => [],
      openInvoicesByIds: async () => [
        {
          invoiceId: INVOICE,
          invoiceNumber: 'INV-1',
          total: 1000,
          allocated: 0,
          dueDate: '2026-10-13',
          invoiceDate: '2026-10-13',
          currency: null,
          customerId: null,
          supplierId: null,
          type: 'sale',
        },
      ],
      invoiceExchangeRates: async () => [],
      invoiceRatesById: async () => new Map(),
      lastPaymentSequence: async () => 0,
      recordPayment: async (
        _c: unknown,
        payment: any,
        _a: unknown,
        _k: unknown,
        till: any,
        fee: number | null,
      ) => {
        recorded.push({ payment, till, fee })
        return { id: 'payment-1', replayed: false }
      },
      attachJournalEntry: async () => {},
      getPayment: async () => ({ id: 'payment-1', paymentNumber: 'PMT-1', allocations: [] }),
    }
  }
  const pay = (over: Record<string, unknown> = {}) =>
    ({
      direction: 'in',
      partyType: 'customer',
      partyId: null,
      amount: 100,
      method: 'cash',
      allocations: [{ invoiceId: INVOICE, amount: 100 }],
      ...over,
    }) as any
  const service = async (repo: ReturnType<typeof fakeRepo>) =>
    new (await import('../services/payments/payments.service')).PaymentsService(repo as any)

  it('⚠️ received 100 less a fee of 2 into a till: the invoice is settled by 100, the drawer gets 98', async () => {
    const repo = fakeRepo()
    await (await service(repo)).recordPayment(ctx, pay({ feeAmount: 2, tillSessionId: 'till-1' }))
    expect(repo.recorded[0]!.payment.amount).toBe(100)
    expect(repo.recorded[0]!.fee).toBe(2)
    expect(repo.recorded[0]!.till).toEqual({ sessionId: 'till-1', amountMinor: 98 })
    expect(posted[0]!.lines).toEqual([
      { accountId: 'cash', debit: 98, credit: 0 },
      { accountId: 'bank_fees', debit: 2, credit: 0 },
      { accountId: 'receivable', debit: 0, credit: 100 },
    ])
    expect(sides(posted[0]!.lines).debit).toBe(sides(posted[0]!.lines).credit)
  })

  it('paid 100 plus a fee of 5 out of a till: the supplier’s debt closes by 100, the drawer loses 105', async () => {
    const repo = fakeRepo()
    await (
      await service(repo)
    ).recordPayment(
      ctx,
      pay({ direction: 'out', partyType: 'supplier', feeAmount: 5, tillSessionId: 'till-1' }),
    )
    expect(repo.recorded[0]!.till).toEqual({ sessionId: 'till-1', amountMinor: 105 })
    expect(posted[0]!.lines).toEqual([
      { accountId: 'payable', debit: 100, credit: 0 },
      { accountId: 'bank_fees', debit: 5, credit: 0 },
      { accountId: 'cash', debit: 0, credit: 105 },
    ])
  })

  it('⚠️ a fee that is all of the money received is refused, and NOTHING is written', async () => {
    const repo = fakeRepo()
    await expect((await service(repo)).recordPayment(ctx, pay({ feeAmount: 100 }))).rejects.toThrow(
      'PAYMENT_FEE_EXCEEDS_AMOUNT',
    )
    expect(repo.recorded).toEqual([])
    expect(posted).toEqual([])
  })

  it('no fee: no fee is sent, and the entry has its two lines', async () => {
    const repo = fakeRepo()
    await (await service(repo)).recordPayment(ctx, pay())
    expect(repo.recorded[0]!.fee).toBeNull()
    expect(posted[0]!.lines).toHaveLength(2)
  })

  it('without the fee account the entry is still balanced — cash booked gross', async () => {
    roleRefused = 'bank_fees'
    const repo = fakeRepo()
    await (await service(repo)).recordPayment(ctx, pay({ feeAmount: 2 }))
    expect(posted[0]!.lines).toEqual([
      { accountId: 'cash', debit: 100, credit: 0 },
      { accountId: 'receivable', debit: 0, credit: 100 },
    ])
  })

  it('the route names the field, and the write is ONE database call', () => {
    expect(read('routes/payments.routes.ts')).toContain(
      'feeAmount: z.number().positive().finite().optional()',
    )
    const repo = read('services/payments/payments.repository.ts')
    expect(repo).toContain("? 'payments_record_with_fee'")
    expect(repo).toContain("throw new ConflictError('PAYMENT_FEE_NOT_CONFIGURED')")
  })
})

describe('an invoice’s payments say their till and their fee', () => {
  const related = read('services/invoices/invoice-related.service.ts')

  it('⚠️ read APART from the payments: a database without the columns still lists them', () => {
    const extras = related.slice(
      related.indexOf('private async paymentExtras('),
      related.indexOf('private async journalEntry('),
    )
    expect(extras).toContain(".select('id, pos_session_id')")
    expect(extras).toContain(".select('id, fee_amount')")
    expect(extras).toContain(".select('id, label')")
    expect(extras).toContain('if (tills.error && !missing(tills.error)) {')
    // Each read is inside the workspace.
    expect(extras.split(".eq('workspace_id', ctx.workspaceId)").length - 1).toBe(3)
    // The base read does not name the new columns.
    expect(related).toContain(
      'payment:payments(id, payment_number, entry_date, method, reference, status)',
    )
  })

  it('each payment carries the three fields', () => {
    expect(related).toContain('tillSessionId: extra?.tillSessionId ?? null,')
    expect(related).toContain('tillLabel: extra?.tillLabel ?? null,')
    expect(related).toContain('feeAmount: extra?.feeAmount ?? null,')
  })
})
