// ============================================
// The referral programme's rules, as the owner specified them.
//
// Every test here is a commitment about money owed to a real person, so each
// one names the failure it prevents rather than the function it calls.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  COMMISSION_PERIOD_LIMIT,
  PAYOUT_THRESHOLD_MINOR,
  REFERRAL_RATE_BPS,
  SIGNUP_DISCOUNT_BPS,
  commissionEndsAt,
  commissionMinor,
  discountedFirstPaymentMinor,
  eligibility,
  generateReferralCode,
  isAttributionOpen,
  isReferralCodeShape,
} from '../services/referral'
import { buildReferralList, summarize } from '../services/referral/referral.domain'
import { intervalOfPeriod } from '../services/billing.service'

const src = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('the rate and the amount', () => {
  it('is 10%, floored', () => {
    expect(REFERRAL_RATE_BPS).toBe(1000)
    expect(commissionMinor(1200)).toBe(120) // $12.00 → $1.20
    expect(commissionMinor(9900)).toBe(990) // $99.00 → $9.90
  })

  it('⚠️ floors rather than rounds — never pays out money nobody was charged', () => {
    // 5 minor units at 10% is 0.5; rounding up would pay a unit that was
    // never collected, and over thousands of referrals that is real money.
    expect(commissionMinor(5)).toBe(0)
    expect(commissionMinor(15)).toBe(1)
  })

  it('refuses nonsense instead of producing a number', () => {
    expect(commissionMinor(0)).toBe(0)
    expect(commissionMinor(-1200)).toBe(0)
    expect(commissionMinor(Number.NaN)).toBe(0)
    expect(commissionMinor(1200, 0)).toBe(0)
  })
})

describe('what earns, and what does not', () => {
  const base = { priceMinor: 1200, periodIndex: 1, hasSuccessfulPayment: true, isTrial: false }

  it('a paid period earns', () => {
    expect(eligibility(base)).toBe('ok')
  })

  it('⚠️ a trial earns nothing — nothing was paid', () => {
    // 10% of nothing is not a commission; it is a promise to pay out of the
    // company's own pocket for a customer who may never convert.
    expect(eligibility({ ...base, isTrial: true })).toBe('trial')
  })

  it('⚠️ an unpriced plan earns nothing, and says so', () => {
    // `free` costs nothing and `enterprise` is negotiated elsewhere. «No price
    // on file» is a different fact from «earned zero».
    expect(eligibility({ ...base, priceMinor: null })).toBe('unpriced_plan')
    expect(eligibility({ ...base, priceMinor: 0 })).toBe('unpriced_plan')
  })

  it('⚠️ a signup with no payment earns nothing', () => {
    expect(eligibility({ ...base, hasSuccessfulPayment: false })).toBe('not_paid_yet')
  })

  it('⚠️ the window is 12 periods, and the 13th earns nothing', () => {
    // An uncapped 10% is a permanent claim on every customer's revenue.
    expect(COMMISSION_PERIOD_LIMIT).toBe(12)
    expect(eligibility({ ...base, periodIndex: 12 })).toBe('ok')
    expect(eligibility({ ...base, periodIndex: 13 })).toBe('window_exhausted')
    expect(eligibility({ ...base, periodIndex: 0 })).toBe('window_exhausted')
  })
})

describe('the new business’s welcome discount', () => {
  it('is 10% off the first payment', () => {
    expect(SIGNUP_DISCOUNT_BPS).toBe(1000)
    expect(discountedFirstPaymentMinor(1200)).toBe(1080)
  })

  it('⚠️ the commission is taken from what was PAID, not from the list price', () => {
    // Otherwise the discount comes out of the margin twice.
    const paid = discountedFirstPaymentMinor(1200)
    expect(commissionMinor(paid)).toBe(108)
    expect(commissionMinor(1200)).toBe(120)
  })
})

describe('the windows', () => {
  it('the commission window closes 12 months after the first payment', () => {
    expect(commissionEndsAt('2026-01-15T00:00:00.000Z')).toBe('2027-01-15T00:00:00.000Z')
  })

  it('⚠️ attribution expires — a code clicked today does not credit a sign-up in two years', () => {
    const now = new Date('2026-06-01T00:00:00.000Z')
    expect(isAttributionOpen('2026-07-01T00:00:00.000Z', now)).toBe(true)
    expect(isAttributionOpen('2026-05-01T00:00:00.000Z', now)).toBe(false)
    // Unknown expiry is open, not closed: refusing on missing data would
    // silently drop attributions the database never recorded a deadline for.
    expect(isAttributionOpen(null, now)).toBe(true)
  })
})

describe('the code', () => {
  it('⚠️ has no look-alike characters', () => {
    // It is read off one screen and typed into another phone; `0/O` or `1/I/L`
    // is a sign-up that silently credits nobody.
    const generated = generateReferralCode(new Uint8Array(16).fill(7))
    expect(generated).not.toMatch(/[01OIL]/)
    expect(isReferralCodeShape(generated)).toBe(true)
  })

  it('rejects anything that is not one of ours before it reaches the database', () => {
    expect(isReferralCodeShape('abc')).toBe(false)
    expect(isReferralCodeShape('HELLO0')).toBe(false)
    expect(isReferralCodeShape(null)).toBe(false)
  })
})

describe('the ledger reads net of reversals', () => {
  const referral = {
    id: 'r1',
    referred_name: 'شرکت الف',
    signed_up_at: '2026-01-01T00:00:00.000Z',
    first_paid_at: '2026-01-05T00:00:00.000Z',
  }

  const earned = {
    referral_id: 'r1',
    kind: 'earned',
    plan: 'pro',
    interval: 'month',
    period_index: 1,
    base_amount_minor: 1200,
    amount_minor: 120,
    currency: 'USD',
    status: 'pending',
    created_at: '2026-01-05T00:00:00.000Z',
  }

  it('⚠️ a refund REVERSES rather than deletes', () => {
    // The earned row stays exactly as it was; the balance is the sum. Editing
    // it would destroy the record of what was paid and when.
    const reversal = {
      ...earned,
      kind: 'reversal',
      amount_minor: -120,
      created_at: '2026-02-01T00:00:00.000Z',
    }
    const [row] = buildReferralList([referral], [earned, reversal])
    expect(row?.commissionMinor).toBe(0)

    const totals = summarize([referral], [earned, reversal], new Date('2026-02-10T00:00:00.000Z'))
    expect(totals.totalMinor).toBe(0)
  })

  it('⚠️ a void row counts for nothing at all', () => {
    const voided = { ...earned, status: 'void' }
    expect(summarize([referral], [voided]).totalMinor).toBe(0)
  })

  it('⚠️ a signup that never paid is still a row, with zero', () => {
    // Dropping it would make the list disagree with the «invited» count.
    const unpaid = { id: 'r2', signed_up_at: '2026-03-01T00:00:00.000Z', first_paid_at: null }
    const rows = buildReferralList([referral, unpaid], [earned])
    expect(rows).toHaveLength(2)
    expect(rows[1]?.commissionMinor).toBe(0)
    expect(rows[1]?.isActive).toBe(false)
  })

  it('«active» means they have PAID, not that they exist', () => {
    const unpaid = { id: 'r2', signed_up_at: '2026-03-01T00:00:00.000Z', first_paid_at: null }
    const totals = summarize([referral, unpaid], [earned])
    expect(totals.referredCount).toBe(2)
    expect(totals.activeCount).toBe(1)
  })

  it('counts the periods left in the window', () => {
    const [row] = buildReferralList([referral], [{ ...earned, period_index: 3 }])
    expect(row?.paidPeriods).toBe(3)
    expect(row?.periodsRemaining).toBe(9)
  })

  it('⚠️ mixed currencies have no single total', () => {
    // Adding dollars to afghanis is not a number. The page shows them apart.
    const afn = { ...earned, currency: 'AFN', amount_minor: 500 }
    const totals = summarize([referral], [earned, afn])
    expect(totals.currency).toBeNull()
    expect(totals.currencies.sort()).toEqual(['AFN', 'USD'])
  })

  it('a cash payout has a threshold', () => {
    expect(PAYOUT_THRESHOLD_MINOR).toBe(1000)
    expect(summarize([], []).payoutThresholdMinor).toBe(1000)
  })
})

describe('the interval a commission is calculated against', () => {
  it('⚠️ is derived from the period, never guessed', () => {
    // Wrong by a factor of eight if guessed: $99 a year vs $12 a month.
    expect(intervalOfPeriod('2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z')).toBe('month')
    expect(intervalOfPeriod('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z')).toBe('year')
  })

  it('⚠️ falls back to the SMALLER interval on bad data — under-pays, never over-pays', () => {
    expect(intervalOfPeriod('2026-01-01T00:00:00Z', null)).toBe('month')
    expect(intervalOfPeriod('nonsense', 'nonsense')).toBe('month')
  })
})

describe('the core boundary', () => {
  it('⚠️ only the repository names the referral tables', () => {
    const service = code(src('services/referral/referral.service.ts'))
    const domain = code(src('services/referral/referral.domain.ts'))
    for (const file of [service, domain]) {
      expect(file).not.toMatch(/from\(['"]referral/)
      expect(file).not.toContain('supabase')
    }
  })

  it('⚠️ the price comes from ONE place', () => {
    // A second copy of a price is how the pricing page and the commission come
    // to disagree about what somebody paid.
    const routes = code(src('routes/billing.routes.ts'))
    expect(routes).toContain('PLAN_PRICING[key as Plan]')
    expect(routes).not.toMatch(/key === 'pro' \? 12/)
  })

  it('⚠️ the commission is credited in ONE place, not at each call site', () => {
    const billing = code(src('services/billing.service.ts'))
    expect((billing.match(/this\.creditReferral\(/g) ?? []).length).toBe(2)
    expect(billing).toContain('referralService.recordPayment(')
  })

  it('⚠️ self-referral is refused', () => {
    const service = code(src('services/referral/referral.service.ts'))
    expect(service).toContain('if (owner.user_id === input.referredUserId) return')
  })
})
