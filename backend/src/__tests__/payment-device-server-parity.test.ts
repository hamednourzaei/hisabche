// ============================================
// backend/src/__tests__/payment-device-server-parity.test.ts
//
// Shared-core integration audit SC-05 / SC-06 (finding F-004): ONE payment,
// booked by BOTH real implementations, must produce ONE financial result.
//
// The device suite (payment-posting-parity.test.ts) and the server suite
// (till-on-payments.test.ts) each assert the same hand-computed numbers, and the
// golden corpus proves the shared arithmetic (paymentPosting) is one function.
// But four green tests in four layers do not prove the layers agree: nothing
// drove the REAL device route and the REAL server service with ONE input and
// compared the journal they actually wrote. A divergence in how either side maps
// the posting to lines (the party role, the exchange-difference sign, cash vs
// bank) would slip through every existing suite.
//
// Here the device runs on a real node:sqlite database through createTestEngine,
// and the server runs the real PaymentsService.recordPayment / cancelPayment
// with recording ports (the till-on-payments pattern). Both sides are fed the
// SAME payment and the normalized journal lines are compared.
//
// ⚠️ Books currency is AFN (zero-decimal) in every scenario, so a journal amount
// in major units IS the minor-unit amount — no implicit /100 anywhere. The
// PAYMENT may be foreign (USD); the books it lands in are afghani.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── The server's ports, recorded (same shape as till-on-payments.test.ts) ───
const posted: Array<{
  sourceType: string
  sourceId: string
  lines: Array<{ accountId: string; debit: number; credit: number }>
}> = []
const reversed: Array<{ sourceType: string; sourceId: string; reason: string }> = []
let reverseBehavior: 'ok' | 'period_closed' = 'ok'
let cancelRepoCalls = 0

vi.mock('../db', () => ({ supabase: {}, default: {} }))
vi.mock('../services/base-currency', () => ({ baseCurrencyOf: async () => 'AFN' }))
vi.mock('../utils/money-cache', () => ({ invalidateMoneyCaches: async () => {} }))
vi.mock('../services/event-log.service', () => ({ logBusinessEvent: async () => {} }))
vi.mock('../services/authorization', () => ({
  sod: { recordAction: async () => {}, assertAllowed: async () => {} },
  scopes: { assertMay: async () => {} },
}))
vi.mock('../services/pos/till-choice', () => ({
  tillForPayment: async () => ({ id: 'till-1', currency: null, branchId: null }),
}))
vi.mock('../services/accounting', () => ({
  ledger: {
    ensureAccountsForRoles: async (_ctx: unknown, roles: string[]) => ({
      accounts: Object.fromEntries(roles.map((role) => [role, role])),
      missing: [],
    }),
    postDocument: async (_ctx: unknown, request: (typeof posted)[number]) => {
      posted.push(request)
      return { status: 'posted', entryId: 'entry-1', entryNumber: 'JE-1' }
    },
    reverseDocument: async (
      _ctx: unknown,
      sourceType: string,
      sourceId: string,
      opts: { reason: string },
    ) => {
      if (reverseBehavior === 'period_closed') throw new Error('ACCOUNTING_PERIOD_LOCKED')
      reversed.push({ sourceType, sourceId, reason: opts.reason })
      return { status: 'reversed', entryId: 'entry-rev-1' }
    },
  },
}))

const { PaymentsService } = await import('../services/payments/payments.service')

// ─── The REAL device engine, on a real SQLite database (imported by path) ───
const { createTestDb, createTestEngine, TEST_WORKSPACE_ID } =
  (await import('../../../packages/local-engine/src/__tests__/test-db')) as typeof import('../../../packages/local-engine/src/__tests__/test-db')

const WS = TEST_WORKSPACE_ID
const C1 = '00000000-0000-4000-8000-000000000001'
const INV = '00000000-0000-4000-9000-000000000001'

const ctx = { workspaceId: WS, userId: 'user-1', role: 'owner' } as never

interface InvoiceFixture {
  currency: string
  rate: number | null
  total: number
  type: 'sale' | 'purchase'
}

/** A recording repository: the server service runs for real, persistence is observed. */
function fakeRepo(invoice: InvoiceFixture | null) {
  const recorded: Array<{ payment: Record<string, unknown>; allocations: unknown }> = []
  let cancelled = false
  const repo = {
    recorded,
    paymentIdByClientRequestId: async (): Promise<string | null> => null,
    openInvoicesFor: async () => [],
    openInvoicesByIds: async () =>
      invoice
        ? [
            {
              invoiceId: INV,
              invoiceNumber: 'INV-1',
              total: invoice.total,
              allocated: 0,
              dueDate: '2026-11-01',
              invoiceDate: '2026-11-01',
              currency: invoice.currency,
              customerId: invoice.type === 'sale' ? C1 : null,
              supplierId: invoice.type === 'purchase' ? C1 : null,
              type: invoice.type,
            },
          ]
        : [],
    invoiceExchangeRates: async () => (invoice?.rate == null ? [] : [invoice.rate]),
    invoiceRatesById: async () =>
      new Map(invoice?.rate == null ? [] : ([[INV, invoice.rate]] as const)),
    lastPaymentSequence: async () => 0,
    recordPayment: async (_c: unknown, payment: Record<string, unknown>, allocations: unknown) => {
      recorded.push({ payment, allocations })
      return { id: 'payment-server-1', replayed: false }
    },
    attachJournalEntry: async () => {},
    feeOf: async () => 0,
    refundOfPayment: async () => null,
    cancelPayment: async () => {
      cancelRepoCalls++
      cancelled = true
    },
    getPayment: async () => ({
      id: 'payment-server-1',
      paymentNumber: 'PMT-2026-000001',
      direction: 'in',
      partyType: 'customer',
      partyId: C1,
      amount: 500,
      currency: 'AFN',
      method: 'cash',
      entryDate: '2026-11-20',
      status: cancelled ? 'cancelled' : 'posted',
      allocations: [],
    }),
  }
  return repo
}

type NormalLine = { role: string; debit: number; credit: number }

const normalizeServer = (): NormalLine[] =>
  posted
    .flatMap((entry) => entry.lines)
    .map((line) => ({ role: line.accountId, debit: line.debit, credit: line.credit }))
    .sort((a, b) => a.role.localeCompare(b.role))

let db: ReturnType<typeof createTestDb>
let engine: ReturnType<typeof createTestEngine>

const deviceLines = (paymentId: string): NormalLine[] =>
  db
    .all<{ role: string; debit: number; credit: number }>(
      `SELECT a.role AS role, l.debit AS debit, l.credit AS credit
         FROM journal_entry e
         JOIN journal_line l ON l.journal_id = e.id
         JOIN account a ON a.id = l.account_id
        WHERE e.source_type = 'payment' AND e.source_id = ?
        ORDER BY a.role`,
      [paymentId],
    )
    .map((row) => ({ role: row.role, debit: Number(row.debit), credit: Number(row.credit) }))

function seedDeviceInvoice(fx: InvoiceFixture) {
  db.run(
    `INSERT INTO invoice (id, workspace_id, invoice_number, type, customer_id, supplier_id, date, total, paid_amount, currency, exchange_rate, status, updated_at)
     VALUES (?, ?, 'INV-1', ?, ?, ?, '2026-11-01', ?, 0, ?, ?, 'pending', datetime('now'))`,
    [
      INV,
      WS,
      fx.type,
      fx.type === 'sale' ? C1 : null,
      fx.type === 'purchase' ? C1 : null,
      fx.total,
      fx.currency,
      fx.rate,
    ],
  )
}

beforeEach(() => {
  posted.length = 0
  reversed.length = 0
  reverseBehavior = 'ok'
  cancelRepoCalls = 0
  db = createTestDb()
  engine = createTestEngine(db)
})

/** Run ONE payment through both real implementations and return each side's lines. */
async function bothSides(input: {
  device: Record<string, unknown>
  server: Record<string, unknown>
  invoice: InvoiceFixture | null
  paymentId: string
}) {
  if (input.invoice) seedDeviceInvoice(input.invoice)
  const res = await engine.request({
    method: 'POST',
    path: '/payments',
    body: { id: input.paymentId, ...input.device },
  })
  expect(res.status, JSON.stringify(res.data)).toBe(201)

  const service = new PaymentsService(fakeRepo(input.invoice) as never)
  await service.recordPayment(ctx, input.server as never, { clientRequestId: input.paymentId })

  return { device: deviceLines(input.paymentId), server: normalizeServer() }
}

describe('one payment, one financial result on the device and the server', () => {
  it('a dollar receipt at 72 against a dollar invoice frozen at 70 books the SAME gain on both sides', async () => {
    const { device, server } = await bothSides({
      paymentId: '00000000-0000-4000-8000-000000000201',
      invoice: { currency: 'USD', rate: 70, total: 100, type: 'sale' },
      device: {
        direction: 'in',
        partyType: 'customer',
        partyId: C1,
        amount: 100,
        currency: 'USD',
        exchangeRate: 72,
        method: 'cash',
        allocations: [{ invoiceId: INV, amount: 100 }],
      },
      server: {
        direction: 'in',
        partyType: 'customer',
        partyId: C1,
        amount: 100,
        currency: 'USD',
        exchangeRate: 72,
        method: 'cash',
        autoAllocate: false,
        allocations: [{ invoiceId: INV, amount: 100 }],
      },
    })
    // cash 7200 in; the debt closed at its own 7000; 200 is a gain.
    expect(device).toEqual([
      { role: 'cash', debit: 7200, credit: 0 },
      { role: 'fx_gain_loss', debit: 0, credit: 200 },
      { role: 'receivable', debit: 0, credit: 7000 },
    ])
    expect(server).toEqual(device)
  })

  it('a bank transfer debits the bank, not the drawer, on BOTH sides', async () => {
    const { device, server } = await bothSides({
      paymentId: '00000000-0000-4000-8000-000000000202',
      invoice: null,
      device: {
        direction: 'in',
        partyType: 'customer',
        partyId: C1,
        amount: 500,
        currency: 'AFN',
        method: 'bank',
      },
      server: {
        direction: 'in',
        partyType: 'customer',
        partyId: C1,
        amount: 500,
        currency: 'AFN',
        method: 'bank',
        autoAllocate: false,
      },
    })
    expect(device).toEqual([
      { role: 'bank', debit: 500, credit: 0 },
      { role: 'receivable', debit: 0, credit: 500 },
    ])
    expect(server).toEqual(device)
  })

  it('a partial payment closes the same part of the debt on both sides, leaving the same remainder', async () => {
    const { device, server } = await bothSides({
      paymentId: '00000000-0000-4000-8000-000000000203',
      invoice: { currency: 'AFN', rate: null, total: 1000, type: 'sale' },
      device: {
        direction: 'in',
        partyType: 'customer',
        partyId: C1,
        amount: 600,
        currency: 'AFN',
        method: 'cash',
        allocations: [{ invoiceId: INV, amount: 600 }],
      },
      server: {
        direction: 'in',
        partyType: 'customer',
        partyId: C1,
        amount: 600,
        currency: 'AFN',
        method: 'cash',
        autoAllocate: false,
        allocations: [{ invoiceId: INV, amount: 600 }],
      },
    })
    expect(device).toEqual([
      { role: 'cash', debit: 600, credit: 0 },
      { role: 'receivable', debit: 0, credit: 600 },
    ])
    expect(server).toEqual(device)
    // The remainder a person reads is the same: 1000 - 600 = 400 still owed.
    const inv = db.all<{ paid_amount: number; total: number }>(
      'SELECT paid_amount, total FROM invoice WHERE id = ?',
      [INV],
    )[0]!
    expect(Number(inv.total) - Number(inv.paid_amount)).toBe(400)
  })

  it('a dollar purchase paid at 72 against one booked at 70 books the SAME loss on both sides', async () => {
    const { device, server } = await bothSides({
      paymentId: '00000000-0000-4000-8000-000000000204',
      invoice: { currency: 'USD', rate: 70, total: 100, type: 'purchase' },
      device: {
        direction: 'out',
        partyType: 'supplier',
        partyId: C1,
        amount: 100,
        currency: 'USD',
        exchangeRate: 72,
        method: 'cash',
        allocations: [{ invoiceId: INV, amount: 100 }],
      },
      server: {
        direction: 'out',
        partyType: 'supplier',
        partyId: C1,
        amount: 100,
        currency: 'USD',
        exchangeRate: 72,
        method: 'cash',
        autoAllocate: false,
        allocations: [{ invoiceId: INV, amount: 100 }],
      },
    })
    // The payable closes by its own 7000; cash leaves by 7200; 200 is a loss.
    expect(device).toEqual([
      { role: 'cash', debit: 0, credit: 7200 },
      { role: 'fx_gain_loss', debit: 200, credit: 0 },
      { role: 'payable', debit: 7000, credit: 0 },
    ])
    expect(server).toEqual(device)
  })
})

describe('a replayed payment is ONE posting on both sides', () => {
  it('the device answers a repeated id with the first payment, never a second entry', async () => {
    const id = '00000000-0000-4000-8000-000000000301'
    const body = {
      id,
      direction: 'in',
      partyType: 'customer',
      partyId: C1,
      amount: 500,
      currency: 'AFN',
      method: 'cash',
    }
    const first = await engine.request({ method: 'POST', path: '/payments', body })
    expect(first.status).toBe(201)
    const again = await engine.request({ method: 'POST', path: '/payments', body })
    expect(again.status).toBeLessThan(300)
    expect(deviceLines(id)).toEqual([
      { role: 'cash', debit: 500, credit: 0 },
      { role: 'receivable', debit: 0, credit: 500 },
    ])
    const entries = db.all<{ n: number }>(
      `SELECT COUNT(*) AS n FROM journal_entry WHERE source_type = 'payment' AND source_id = ?`,
      [id],
    )[0]!
    expect(Number(entries.n)).toBe(1)
  })

  it('the server answers a repeated clientRequestId with the first payment, booking nothing new', async () => {
    const repo = fakeRepo(null)
    // The key already landed: the lookup returns the winner.
    repo.paymentIdByClientRequestId = async () => 'payment-server-1'
    const service = new PaymentsService(repo as never)
    const result = await service.recordPayment(
      ctx,
      {
        direction: 'in',
        partyType: 'customer',
        partyId: C1,
        amount: 500,
        currency: 'AFN',
        method: 'cash',
        autoAllocate: false,
      } as never,
      { clientRequestId: 'replay-key-1' },
    )
    expect(result).toMatchObject({ id: 'payment-server-1' })
    expect(repo.recorded).toHaveLength(0)
  })
})

describe('cancelling a payment reverses it on both sides, and fails closed (SC-06)', () => {
  it('the device posts a dated reversal and the books net to zero', async () => {
    const id = '00000000-0000-4000-8000-000000000401'
    await engine.request({
      method: 'POST',
      path: '/payments',
      body: {
        id,
        direction: 'in',
        partyType: 'customer',
        partyId: C1,
        amount: 500,
        currency: 'AFN',
        method: 'cash',
      },
    })
    const res = await engine.request({
      method: 'POST',
      path: `/payments/${id}/cancel`,
      body: { reason: 'اشتباه' },
    })
    expect(res.status, JSON.stringify(res.data)).toBe(200)

    // Original + reversal, and the net per account is zero.
    const net = db.all<{ role: string; net: number }>(
      `SELECT a.role AS role, ROUND(SUM(l.debit) - SUM(l.credit), 2) AS net
         FROM journal_entry e
         JOIN journal_line l ON l.journal_id = e.id
         JOIN account a ON a.id = l.account_id
        WHERE e.source_id = ? AND e.source_type IN ('payment', 'reversal')
        GROUP BY a.role`,
      [id],
    )
    expect(net.length).toBeGreaterThan(0)
    for (const row of net) expect(Number(row.net)).toBe(0)
    const payment = db.all<{ status: string }>('SELECT status FROM payment WHERE id = ?', [id])[0]!
    expect(payment.status).toBe('cancelled')
  })

  it('the server reverses the ledger BEFORE marking the payment cancelled', async () => {
    const repo = fakeRepo(null)
    const service = new PaymentsService(repo as never)
    await service.cancelPayment(ctx, 'payment-server-1', 'اشتباه')
    expect(reversed).toEqual([
      { sourceType: 'payment', sourceId: 'payment-server-1', reason: 'اشتباه' },
    ])
    expect(cancelRepoCalls).toBe(1)
  })

  it('a locked period makes the server cancel fail closed: reversal throws, payment NOT cancelled', async () => {
    reverseBehavior = 'period_closed'
    const repo = fakeRepo(null)
    const service = new PaymentsService(repo as never)
    await expect(service.cancelPayment(ctx, 'payment-server-1', 'اشتباه')).rejects.toThrow(
      'ACCOUNTING_PERIOD_LOCKED',
    )
    // The money fact was not erased: the repo cancel never ran.
    expect(cancelRepoCalls).toBe(0)
    expect(reversed).toHaveLength(0)
  })
})
