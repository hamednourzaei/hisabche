// ============================================
// `autoAllocate: false` — the allocations in the request are FINAL.
//
// A payment recorded on a device already told its person which invoices (if any) it settled. Online, a payment with no
// allocations still means «settle what this party owes, oldest first»; from a device that said otherwise, the server
// settles nothing it was not told to. Also the two shared rules the device now applies: the named invoice must belong
// to the paying party, and a foreign payment needs a rate.
// ============================================

import { recordPaymentSchema } from '@hisabche/validation'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../services/base-currency', () => ({ baseCurrencyOf: async () => 'AFN' }))
vi.mock('../utils/money-cache', () => ({ invalidateMoneyCaches: async () => {} }))
vi.mock('../services/event-log.service', () => ({ logBusinessEvent: async () => {} }))
vi.mock('../services/authorization', () => ({
  sod: { recordAction: async () => {} },
  scopes: { assertMay: async () => {} },
}))
vi.mock('../services/accounting', () => ({
  ledger: {
    postDocument: async () => ({ status: 'posted', entryId: 'je-1' }),
    ensureAccountsForRoles: async () => ({
      accounts: {
        receivable: 'acc-receivable',
        payable: 'acc-payable',
        cash: 'acc-cash',
        bank: 'acc-bank',
        fx_gain_loss: 'acc-fx',
        bank_fees: 'acc-fees',
      },
      missing: [],
    }),
  },
}))

import { PaymentsService } from '../services/payments/payments.service'
import type { TenancyContext } from '../services/tenancy.service'

const ctx: TenancyContext = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  role: 'owner',
}

const oldInvoice = {
  invoiceId: 'inv-old',
  invoiceNumber: 'INV-1',
  total: 500,
  allocated: 0,
  dueDate: '2026-10-01',
  invoiceDate: '2026-10-01',
  currency: 'AFN',
  customerId: 'party-1',
  supplierId: null,
}

function service() {
  const recorded: Array<{ allocations: unknown[] }> = []
  const repo = {
    paymentIdByClientRequestId: vi.fn().mockResolvedValue(null),
    lastPaymentSequence: vi.fn().mockResolvedValue(1),
    openInvoicesFor: vi.fn().mockResolvedValue([oldInvoice]),
    openInvoicesByIds: vi.fn().mockResolvedValue([oldInvoice]),
    invoiceExchangeRates: vi.fn().mockResolvedValue([]),
    recordPayment: vi.fn().mockImplementation(async (_ctx, _payment, allocations) => {
      recorded.push({ allocations })
      return { id: 'pay-1', replayed: false }
    }),
    getPayment: vi.fn().mockResolvedValue({
      id: 'pay-1',
      direction: 'in',
      partyType: 'customer',
      partyId: 'party-1',
      amount: 100,
      currency: 'AFN',
      method: 'cash',
      entryDate: '2026-11-01',
      status: 'posted',
      allocations: [],
    }),
    feeOf: vi.fn().mockResolvedValue(0),
    attachJournalEntry: vi.fn().mockResolvedValue(undefined),
  }
  return { svc: new PaymentsService(repo as never), repo, recorded }
}

const base = {
  direction: 'in' as const,
  partyType: 'customer' as const,
  partyId: 'party-1',
  amount: 100,
  method: 'cash',
}

describe('autoAllocate', () => {
  it('absent: no allocations still settles the oldest open invoice (online behaviour unchanged)', async () => {
    const { svc, recorded } = service()
    await svc.recordPayment(ctx, base)
    expect(recorded[0]!.allocations).toEqual([{ invoiceId: 'inv-old', amount: 100 }])
  })

  it('false: no allocations means none — the open invoice is not touched and not even read', async () => {
    const { svc, repo, recorded } = service()
    await svc.recordPayment(ctx, { ...base, autoAllocate: false })
    expect(repo.openInvoicesFor).not.toHaveBeenCalled()
    expect(recorded[0]!.allocations).toEqual([])
  })

  it('false with named allocations: exactly those', async () => {
    const { svc, recorded } = service()
    await svc.recordPayment(ctx, {
      ...base,
      autoAllocate: false,
      allocations: [{ invoiceId: 'inv-old', amount: 60 }],
    })
    expect(recorded[0]!.allocations).toEqual([{ invoiceId: 'inv-old', amount: 60 }])
  })
})

describe('the shared rules', () => {
  it("another customer's invoice is refused", async () => {
    const { svc } = service()
    await expect(
      svc.recordPayment(ctx, {
        ...base,
        partyId: 'someone-else',
        allocations: [{ invoiceId: 'inv-old', amount: 60 }],
      }),
    ).rejects.toThrow('PAYMENT_ALLOCATION_PARTY_MISMATCH')
  })

  it('a foreign payment with no rate is refused', async () => {
    const { svc } = service()
    await expect(svc.recordPayment(ctx, { ...base, currency: 'USD' })).rejects.toThrow(
      'PAYMENT_EXCHANGE_RATE_REQUIRED',
    )
  })
})

describe('the request contract', () => {
  it('the body schema the route hands to Fastify names autoAllocate (a field the schema does not name is dropped)', () => {
    const schema = zodToJsonSchema(recordPaymentSchema as never, { target: 'jsonSchema7' }) as {
      properties?: Record<string, unknown>
    }
    expect(Object.keys(schema.properties ?? {})).toContain('autoAllocate')
  })

  it('a request from an older client (no field) still parses, with the field absent', () => {
    const parsed = recordPaymentSchema.parse({
      direction: 'in',
      partyType: 'customer',
      partyId: '33333333-3333-4333-8333-333333333333',
      amount: 5,
    })
    expect('autoAllocate' in parsed).toBe(false)
  })
})
