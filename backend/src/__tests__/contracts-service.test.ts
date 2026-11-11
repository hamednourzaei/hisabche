import { describe, expect, it } from 'vitest'
import {
  canBillContractPeriod,
  contractBillIdempotencyKey,
  evaluateSlaBreach,
} from '@hisabche/validation'

describe('V60 Slice 9: Contracts & recurring obligations rules', () => {
  it('produces a deterministic idempotency key per contract and billing period', () => {
    const k1 = contractBillIdempotencyKey('contract-123', '2026-11')
    const k2 = contractBillIdempotencyKey('contract-123', '2026-11')
    const k3 = contractBillIdempotencyKey('contract-123', '2026-12')
    expect(k1).toBe(k2)
    expect(k1).not.toBe(k3)
  })

  it('termination stops future invoices while preserving completed history status checks', () => {
    expect(canBillContractPeriod('active')).toBe(true)
    expect(canBillContractPeriod('terminated')).toBe(false)
    expect(canBillContractPeriod('paused')).toBe(false)
    expect(canBillContractPeriod('expired')).toBe(false)
  })

  it('flags SLA breach without auto-penalizing unless an explicit penalty policy is passed', () => {
    const ok = evaluateSlaBreach(24, 18)
    expect(ok).toEqual({ breached: false, code: 'SLA_OK', penaltyMinor: null })

    const breached = evaluateSlaBreach(24, 30)
    expect(breached).toEqual({ breached: true, code: 'SLA_BREACHED', penaltyMinor: null })

    const withPolicy = evaluateSlaBreach(24, 30, 500)
    expect(withPolicy).toEqual({ breached: true, code: 'SLA_BREACHED', penaltyMinor: 500 })
  })
})
