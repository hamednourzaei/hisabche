// ============================================
// Gate 3: Payment Idempotency Verification
//
// Asserts that:
// 1. Two legitimate identical payments (even within 3 seconds) are both accepted without false-positive blocking.
// 2. Client-keyed requests (clientRequestId) are database-backed and idempotent: replayPayment is returned.
// 3. Concurrent twin collisions (Postgres 23505) resolve gracefully to the winner's replay.
// ============================================

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
    postDocument: async () => ({ entryId: 'je-1', entryNumber: 1, alreadyPosted: false }),
    ensureAccountsForRoles: async () => ({
      accounts: {
        receivable: 'acc-1',
        payable: 'acc-2',
        cash: 'acc-3',
        bank: 'acc-4',
        fx_gain_loss: 'acc-5',
        bank_fees: 'acc-6',
      },
      missing: [],
    }),
  },
}))

import { PaymentsService } from '../services/payments/payments.service'
import type { TenancyContext } from '../services/tenancy.service'

describe('Gate 3: Standard Database-Backed Payment Idempotency', () => {
  const ctx: TenancyContext = {
    workspaceId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    role: 'owner',
  }

  it('accepts two legitimate identical walk-in payments within 3 seconds without false-positive rejection', async () => {
    const recorded: string[] = []
    const fakeRepo: any = {
      paymentIdByClientRequestId: vi.fn().mockResolvedValue(null),
      lastPaymentSequence: vi.fn().mockResolvedValue(100),
      openInvoicesFor: vi.fn().mockResolvedValue([]),
      recordPayment: vi.fn().mockImplementation(async (_ctx, input, _alloc, clientRequestId) => {
        recorded.push(clientRequestId)
        return { id: `pmt-${recorded.length}`, replayed: false }
      }),
      getPayment: vi.fn().mockImplementation(async (_ws, id) => ({
        id,
        workspaceId: ctx.workspaceId,
        paymentNumber: 'PMT-2026-000101',
        direction: 'in',
        partyType: 'customer',
        partyId: null,
        amount: 1000,
        currency: 'AFN',
        entryDate: '2026-10-31',
        allocations: [],
        method: 'cash',
      })),
      bookingRate: vi.fn().mockResolvedValue(1.0),
      feeOf: vi.fn().mockResolvedValue(0),
      attachJournalEntry: vi.fn().mockResolvedValue(undefined),
    }

    const service = new PaymentsService(fakeRepo)

    const paymentInput = {
      direction: 'in' as const,
      partyType: 'customer' as const,
      partyId: null,
      amount: 1000,
      currency: 'AFN',
      entryDate: '2026-10-31',
    }

    // First payment
    const res1 = await service.recordPayment(ctx, paymentInput)
    expect(res1.id).toBe('pmt-1')

    // Second identical payment immediately after (within 3 seconds)
    const res2 = await service.recordPayment(ctx, paymentInput)
    expect(res2.id).toBe('pmt-2')

    // Both were recorded with unique persistent clientRequestIds
    expect(recorded).toHaveLength(2)
    expect(recorded[0]).not.toBe(recorded[1])
  })

  it('replays existing payment when identical clientRequestId is passed', async () => {
    const fakeRepo: any = {
      paymentIdByClientRequestId: vi.fn().mockImplementation(async (_ws, key) => {
        if (key === 'req-pay-123') return 'pmt-existing'
        return null
      }),
      getPayment: vi.fn().mockResolvedValue({
        id: 'pmt-existing',
        workspaceId: ctx.workspaceId,
        paymentNumber: 'PMT-2026-000100',
        direction: 'in',
        partyType: 'customer',
        partyId: 'cust-1',
        amount: 500,
        currency: 'AFN',
        entryDate: '2026-10-31',
        allocations: [],
        method: 'cash',
      }),
      bookingRate: vi.fn().mockResolvedValue(1.0),
      feeOf: vi.fn().mockResolvedValue(0),
      recordPayment: vi.fn(),
    }

    const service = new PaymentsService(fakeRepo)

    const res = await service.recordPayment(
      ctx,
      {
        direction: 'in',
        partyType: 'customer',
        partyId: 'cust-1',
        amount: 500,
      },
      { clientRequestId: 'req-pay-123' },
    )

    // Replayed from database lookup, repo.recordPayment never called
    expect(res.id).toBe('pmt-existing')
    expect((res as any).idempotentReplay).toBe(true)
    expect(fakeRepo.recordPayment).not.toHaveBeenCalled()
  })

  it('recovers and replays winner when concurrent twin loses race with 23505', async () => {
    let callCount = 0
    const fakeRepo: any = {
      paymentIdByClientRequestId: vi.fn().mockImplementation(async () => {
        callCount++
        // On initial pre-check, not found; on 23505 catch, winner is found
        return callCount > 1 ? 'pmt-winner' : null
      }),
      lastPaymentSequence: vi.fn().mockResolvedValue(100),
      openInvoicesFor: vi.fn().mockResolvedValue([]),
      recordPayment: vi.fn().mockRejectedValue({ code: '23505' }), // Unique index collision
      getPayment: vi.fn().mockResolvedValue({
        id: 'pmt-winner',
        workspaceId: ctx.workspaceId,
        paymentNumber: 'PMT-2026-000100',
        direction: 'in',
        partyType: 'customer',
        partyId: 'cust-1',
        amount: 750,
        currency: 'AFN',
        entryDate: '2026-10-31',
        allocations: [],
        method: 'cash',
      }),
      bookingRate: vi.fn().mockResolvedValue(1.0),
      feeOf: vi.fn().mockResolvedValue(0),
    }

    const service = new PaymentsService(fakeRepo)

    const res = await service.recordPayment(
      ctx,
      {
        direction: 'in',
        partyType: 'customer',
        partyId: 'cust-1',
        amount: 750,
      },
      { clientRequestId: 'req-concurrent-twin' },
    )

    expect(res.id).toBe('pmt-winner')
    expect((res as any).idempotentReplay).toBe(true)
  })
})
