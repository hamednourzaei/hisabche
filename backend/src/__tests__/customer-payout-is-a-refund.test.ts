// ============================================
// Money paid OUT to a customer is the credit of a return being paid back.
//
//   · it settles none of the customer's open invoices (it used to go to the oldest one,
//     which would re-open the debt the customer was just credited for)
//   · it closes the receivable the return credited, not the supplier payable
// Paying a SUPPLIER is unchanged.
// ============================================

import { describe, expect, it, vi } from 'vitest'

vi.mock('../services/base-currency', () => ({ baseCurrencyOf: async () => 'AFN' }))
vi.mock('../utils/money-cache', () => ({ invalidateMoneyCaches: async () => {} }))
vi.mock('../services/event-log.service', () => ({ logBusinessEvent: async () => {} }))
vi.mock('../services/authorization', () => ({
  sod: { recordAction: async () => {} },
  scopes: { assertMay: async () => {} },
}))

const posted: Array<{ lines: Array<{ accountId: string; debit: number; credit: number }> }> = []
vi.mock('../services/accounting', () => ({
  ledger: {
    postDocument: async (_ctx: unknown, document: (typeof posted)[number]) => {
      posted.push(document)
      return { status: 'posted', entryId: 'je-1' }
    },
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

function service(direction: 'in' | 'out', partyType: 'customer' | 'supplier') {
  const recorded: Array<{ allocations: unknown[] }> = []
  const openInvoicesFor = vi.fn().mockResolvedValue([
    // the oldest open invoice of that party — what auto-allocation used to eat
    {
      invoiceId: 'inv-old',
      invoiceNumber: 'INV-1',
      total: 500,
      allocated: 0,
      dueDate: '2026-10-01',
      invoiceDate: '2026-10-01',
      currency: 'AFN',
    },
  ])
  const repo = {
    paymentIdByClientRequestId: vi.fn().mockResolvedValue(null),
    lastPaymentSequence: vi.fn().mockResolvedValue(1),
    openInvoicesFor,
    openInvoicesByIds: vi.fn().mockResolvedValue([]),
    recordPayment: vi.fn().mockImplementation(async (_ctx, _payment, allocations) => {
      recorded.push({ allocations })
      return { id: 'pay-1', replayed: false }
    }),
    getPayment: vi.fn().mockResolvedValue({
      id: 'pay-1',
      direction,
      partyType,
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
  return { svc: new PaymentsService(repo as never), repo, recorded, openInvoicesFor }
}

const pay = (svc: PaymentsService, direction: 'in' | 'out', partyType: 'customer' | 'supplier') =>
  svc.recordPayment(ctx, { direction, partyType, partyId: 'party-1', amount: 100, method: 'cash' })

describe('money out to a customer', () => {
  it('settles none of their invoices', async () => {
    const { svc, recorded, openInvoicesFor } = service('out', 'customer')
    await pay(svc, 'out', 'customer')
    expect(openInvoicesFor).not.toHaveBeenCalled()
    expect(recorded[0]!.allocations).toEqual([])
  })

  it('debits the receivable the return credited, and credits the cash', async () => {
    posted.length = 0
    const { svc } = service('out', 'customer')
    await pay(svc, 'out', 'customer')
    const lines = posted[0]!.lines
    expect(lines).toContainEqual({ accountId: 'acc-receivable', debit: 100, credit: 0 })
    expect(lines).toContainEqual({ accountId: 'acc-cash', debit: 0, credit: 100 })
    expect(lines.some((line) => line.accountId === 'acc-payable')).toBe(false)
  })
})

describe('the other three directions are unchanged', () => {
  it('money out to a SUPPLIER still settles their oldest invoice and debits the payable', async () => {
    posted.length = 0
    const { svc, recorded, openInvoicesFor } = service('out', 'supplier')
    await pay(svc, 'out', 'supplier')
    expect(openInvoicesFor).toHaveBeenCalled()
    expect(recorded[0]!.allocations).toEqual([{ invoiceId: 'inv-old', amount: 100 }])
    expect(posted[0]!.lines).toContainEqual({ accountId: 'acc-payable', debit: 100, credit: 0 })
  })

  it('money IN from a customer still settles their oldest invoice and credits the receivable', async () => {
    posted.length = 0
    const { svc, recorded, openInvoicesFor } = service('in', 'customer')
    await pay(svc, 'in', 'customer')
    expect(openInvoicesFor).toHaveBeenCalled()
    expect(recorded[0]!.allocations).toEqual([{ invoiceId: 'inv-old', amount: 100 }])
    expect(posted[0]!.lines).toContainEqual({ accountId: 'acc-receivable', debit: 0, credit: 100 })
    expect(posted[0]!.lines).toContainEqual({ accountId: 'acc-cash', debit: 100, credit: 0 })
  })
})
