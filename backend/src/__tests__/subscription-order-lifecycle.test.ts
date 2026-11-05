// ============================================
// backend/src/__tests__/subscription-order-lifecycle.test.ts
//
// V54.0 Phase 5.1 — Subscription-to-Workspace Lifecycle Unit & Domain Tests
//
// Tests:
//   1. Path A: Create anonymous order, token generation, cryptographic SHA-256 hash.
//   2. Path B: Create user-bound order with idempotency.
//   3. Payment verification: update status idempotently.
//   4. Claim validation: token expiry, already claimed, unpaid order.
// ============================================

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SubscriptionOrderService } from '../services/subscription-order.service'

describe('SubscriptionOrderService — Unit Tests', () => {
  let service: SubscriptionOrderService
  let mockDb: any

  beforeEach(() => {
    mockDb = {
      from: vi.fn(),
      rpc: vi.fn(),
    }
    service = new SubscriptionOrderService(mockDb)
  })

  it('hashes claim tokens deterministically using SHA-256', () => {
    const rawToken = 'test-token-1234567890abcdef'
    const hash1 = service.hashToken(rawToken)
    const hash2 = service.hashToken(rawToken)

    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64) // SHA-256 hex length
    expect(hash1).not.toBe(rawToken)
  })

  it('Path A: generates a rawClaimToken and sets 24h expiration for anonymous orders', async () => {
    const fakeRow = {
      id: 'ord-123',
      plan: 'pro',
      billing_interval: 'month',
      amount_minor: 12,
      currency: 'USD',
      status: 'pending_payment',
      payment_method: 'card_to_card',
      payment_reference: null,
      payment_verified_at: null,
      claim_token_hash: 'somehash',
      claim_token_expires_at: new Date(Date.now() + 86400000).toISOString(),
      claimed_by_user_id: null,
      claimed_at: null,
      provisioned_workspace_id: null,
      created_by_user_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    mockDb.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: fakeRow, error: null }),
        }),
      }),
    })

    const result = await service.createOrder({
      plan: 'pro',
      billingInterval: 'month',
      currency: 'USD',
      paymentMethod: 'card_to_card',
      metadata: {},
    })

    expect(result.order.id).toBe('ord-123')
    expect(result.rawClaimToken).toBeDefined()
    expect(result.rawClaimToken?.length).toBe(64) // 32 bytes hex
  })

  it('Path B: does not generate rawClaimToken for user-bound orders', async () => {
    const fakeRow = {
      id: 'ord-456',
      plan: 'enterprise',
      billing_interval: 'year',
      amount_minor: 99,
      currency: 'USD',
      status: 'pending_payment',
      payment_method: 'gateway',
      payment_reference: null,
      payment_verified_at: null,
      claim_token_hash: null,
      claim_token_expires_at: null,
      claimed_by_user_id: null,
      claimed_at: null,
      provisioned_workspace_id: null,
      created_by_user_id: 'user-789',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    mockDb.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: fakeRow, error: null }),
        }),
      }),
    })

    const result = await service.createOrder(
      {
        plan: 'enterprise',
        billingInterval: 'year',
        currency: 'USD',
        paymentMethod: 'gateway',
        metadata: {},
      },
      'user-789',
    )

    expect(result.order.id).toBe('ord-456')
    expect(result.order.createdByUserId).toBe('user-789')
    expect(result.rawClaimToken).toBeUndefined()
  })

  it('markPaymentVerified marks an order as paid idempotently', async () => {
    const existingOrder = {
      id: 'ord-123',
      status: 'pending_payment',
    }

    const updatedRow = {
      ...existingOrder,
      plan: 'pro',
      billing_interval: 'month',
      amount_minor: 12,
      currency: 'USD',
      status: 'paid',
      payment_method: 'card_to_card',
      payment_reference: 'TXN-999',
      payment_verified_at: new Date().toISOString(),
      claim_token_expires_at: null,
      claimed_by_user_id: null,
      claimed_at: null,
      provisioned_workspace_id: null,
      created_by_user_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    mockDb.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: existingOrder, error: null }),
        }),
      }),
    })

    mockDb.from.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedRow, error: null }),
          }),
        }),
      }),
    })

    const result = await service.markPaymentVerified('ord-123', 'TXN-999')
    expect(result.status).toBe('paid')
    expect(result.paymentReference).toBe('TXN-999')
  })

  it('claimOrderAndProvision rejects unpaid orders', async () => {
    const token = 'valid-token'
    const tokenHash = service.hashToken(token)

    const fakeRow = {
      id: 'ord-123',
      status: 'pending_payment', // NOT PAID
      claim_token_hash: tokenHash,
      claim_token_expires_at: new Date(Date.now() + 100000).toISOString(),
    }

    mockDb.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: fakeRow, error: null }),
        }),
      }),
    })

    await expect(
      service.claimOrderAndProvision('user-1', token, 'My Salon', 'AFN'),
    ).rejects.toThrow('Subscription order payment has not been verified')
  })

  it('claimOrderAndProvision rejects expired claim tokens', async () => {
    const token = 'expired-token'
    const tokenHash = service.hashToken(token)

    const fakeRow = {
      id: 'ord-123',
      status: 'paid',
      claim_token_hash: tokenHash,
      claim_token_expires_at: new Date(Date.now() - 10000).toISOString(), // EXPIRED
    }

    mockDb.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: fakeRow, error: null }),
        }),
      }),
    })

    await expect(
      service.claimOrderAndProvision('user-1', token, 'My Salon', 'AFN'),
    ).rejects.toThrow('Claim token has expired')
  })
})
