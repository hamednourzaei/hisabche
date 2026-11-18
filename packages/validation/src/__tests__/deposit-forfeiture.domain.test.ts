import { describe, expect, it } from 'vitest'

import {
  DEFAULT_DEPOSIT_FORFEITURE_POLICY,
  decideDepositForfeiture,
  type DepositForfeitureInput,
} from '../schemas/universal-core/deposit-forfeiture.domain'

const base: DepositForfeitureInput = {
  depositAmountMinor: 10000,
  alreadyAppliedMinor: 0,
  cancelledOn: '2026-01-01',
  asOf: '2026-02-01',
  reason: 'customer cancelled after deadline',
}

const on = (over: Partial<typeof DEFAULT_DEPOSIT_FORFEITURE_POLICY> = {}) => ({
  ...DEFAULT_DEPOSIT_FORFEITURE_POLICY,
  enabled: true,
  ...over,
})

describe('WP-13 deposit forfeiture', () => {
  it('is OFF by default: no reason, no money taken', () => {
    expect(decideDepositForfeiture({ ...base, reason: '' })).toEqual({
      forfeit: false,
      reason: 'POLICY_OFF',
    })
  })

  it('takes the full remaining deposit after the deadline when the cap is 100', () => {
    expect(decideDepositForfeiture(base, on())).toEqual({
      forfeit: true,
      amountMinor: 10000,
      daysAfterCancel: 31,
    })
  })

  it('refuses before the grace period', () => {
    expect(
      decideDepositForfeiture({ ...base, asOf: '2026-01-10' }, on({ afterCancelDays: 30 })),
    ).toEqual({ forfeit: false, reason: 'WITHIN_GRACE' })
  })

  it('caps the forfeiture at the configured percentage of what is still unapplied', () => {
    expect(
      decideDepositForfeiture(
        { ...base, alreadyAppliedMinor: 4000 },
        on({ maxShareOfDepositPercent: 25 }),
      ),
    ).toEqual({ forfeit: true, amountMinor: 1500, daysAfterCancel: 31 })
  })

  it('never charges the part already consumed by an invoice', () => {
    const decision = decideDepositForfeiture({ ...base, alreadyAppliedMinor: 10000 }, on())
    expect(decision).toEqual({ forfeit: false, reason: 'NOTHING_TO_FORFEIT' })
  })

  it('requires a stated reason when the policy says so', () => {
    expect(decideDepositForfeiture({ ...base, reason: '  ' }, on())).toEqual({
      forfeit: false,
      reason: 'REASON_REQUIRED',
    })
  })

  it('refuses an absurdly long reason rather than pasting a document into the audit', () => {
    expect(decideDepositForfeiture({ ...base, reason: 'x'.repeat(501) }, on())).toEqual({
      forfeit: false,
      reason: 'REASON_TOO_LONG',
    })
  })

  it('does NOT treat an invalid date as day zero — that would grant the forfeiture', () => {
    expect(decideDepositForfeiture({ ...base, cancelledOn: 'not-a-date' }, on())).toEqual({
      forfeit: false,
      reason: 'DATE_INVALID',
    })
  })

  it('refuses an impossible amount and an impossible percentage', () => {
    expect(decideDepositForfeiture({ ...base, alreadyAppliedMinor: 10001 }, on())).toEqual({
      forfeit: false,
      reason: 'AMOUNT_INVALID',
    })
    expect(decideDepositForfeiture(base, on({ maxShareOfDepositPercent: 101 }))).toEqual({
      forfeit: false,
      reason: 'PERCENT_INVALID',
    })
  })

  it('does not forfeit before the cancellation day', () => {
    expect(decideDepositForfeiture({ ...base, asOf: '2025-12-31' }, on())).toEqual({
      forfeit: false,
      reason: 'DATE_INVALID',
    })
  })
})
