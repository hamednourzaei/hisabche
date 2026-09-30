// ============================================
// Engine N4 — installments, late fees, and the block toggle.
// Capabilities #123, #124.
//
// ⚠️ THE OWNER'S DECISION, WHICH THIS FILE IS BUILT AROUND.
//
// «یک فاکتور ساخته می‌شه… پس یک فاکتور داریم، نه چند تا.» One claims document.
// The schedule says when money was agreed to arrive; the money itself arrives
// through `POST /api/payments`, which already allocates correctly. So the
// financial path is untouched, and what is left to get right is scheduling,
// fees, and the block decision.
//
// ⚠️ THREE PLACES WHERE THIS ENGINE CAN LOSE REAL MONEY.
//
//   1. THE SUM DOES NOT FOOT. 1000 split three ways is 334/333/333 or 333/333/334
//      — never 333/333/334 twice, and never three of 333. A schedule whose parts
//      do not equal the whole is a schedule the customer disputes and the shop
//      cannot answer.
//   2. THE 31ST SKIPS A MONTH. `new Date('2026-01-31')` plus one month lands in
//      March: the customer is billed on the 3rd of March for the second
//      installment AND again on the 3rd of April. Two charges, one plan, and the
//      difference is only visible to someone reading the dates carefully.
//   3. A FEE CHARGED ON A PAID INSTALLMENT, OR ON THE WHOLE INVOICE. Both look
//      reasonable and both take money the customer did not owe. A shop that has
//      settled nine of ten payments should not be charged late fees on the ten.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_BLOCK_POLICY,
  DEFAULT_LATE_FEE_SETTINGS,
  addMonths,
  daysBetween,
  decideBlock,
  overdueInstallments,
  planSchedule,
  type InstallmentSchedule,
} from '../services/commerce/installment.domain'

const TOTAL = 100_000 // 1000.00 in minor units

describe('N4 — a schedule always foots to the total', () => {
  it('splits evenly when it can', () => {
    const plan = planSchedule({ totalMinor: 90_000, count: 3, firstDueDate: '2026-09-30' })

    expect(plan.map((p) => p.amountMinor)).toEqual([30_000, 30_000, 30_000])
  })

  it('puts the remainder on the FIRST payment', () => {
    // ⚠️ 1000 ÷ 3 = 333.33. Three payments of 333 is 999 — a short invoice the
    // customer will notice. The first payment is the one they are told about
    // first, so it carries the rounding.
    const plan = planSchedule({ totalMinor: TOTAL, count: 3, firstDueDate: '2026-09-30' })

    expect(plan.map((p) => p.amountMinor)).toEqual([33_334, 33_333, 33_333])
    expect(plan.reduce((sum, p) => sum + p.amountMinor, 0)).toBe(TOTAL)
  })

  it('foots for every count, including awkward ones', () => {
    for (const count of [2, 3, 4, 5, 6, 7, 9, 11, 13]) {
      const plan = planSchedule({ totalMinor: TOTAL, count, firstDueDate: '2026-09-30' })
      expect(
        plan.reduce((sum, p) => sum + p.amountMinor, 0),
        `${count} payments did not foot`,
      ).toBe(TOTAL)
    }
  })

  it('refuses a single payment — that is not a plan', () => {
    expect(() => planSchedule({ totalMinor: TOTAL, count: 1, firstDueDate: '2026-09-30' })).toThrow(
      /INSTALLMENT_COUNT_INVALID/,
    )
  })

  it('refuses a zero or negative total', () => {
    expect(() => planSchedule({ totalMinor: 0, count: 3, firstDueDate: '2026-09-30' })).toThrow(
      /INSTALLMENT_TOTAL_INVALID/,
    )
  })
})

describe('N4 — monthly dates clamp instead of skipping a month', () => {
  it('the 31st of January plus a month is the end of February', () => {
    // ⚠️ THE BUG. `new Date('2026-01-31')` + 1 month is 2026-03-03, so a plan
    // starting on the 31st would bill twice in March and never in February.
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
  })

  it('the 30th of April plus a month is the 30th of May', () => {
    expect(addMonths('2026-04-30', 1)).toBe('2026-05-30')
  })

  it('a leap year clamps to the 29th', () => {
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
  })

  it('rolls over the year', () => {
    expect(addMonths('2026-12-15', 2)).toBe('2027-02-15')
  })

  it('a plan built on the 31st never lands twice in one month', () => {
    const plan = planSchedule({ totalMinor: TOTAL, count: 4, firstDueDate: '2026-01-31' })
    const months = plan.map((p) => p.dueDate.slice(0, 7))

    expect(new Set(months).size).toBe(4)
  })
})

describe('N4 — a late fee is charged on what is overdue, and only on that', () => {
  const line = (over: Partial<InstallmentSchedule> = {}): InstallmentSchedule => ({
    id: 'line-1',
    invoiceId: 'inv-1',
    seq: 1,
    dueDate: '2026-09-01',
    amountMinor: 33_333,
    paidMinor: 0,
    ...over,
  })

  it('charges nothing until a full month has passed', () => {
    const settings = { ...DEFAULT_LATE_FEE_SETTINGS, value: 5_000 }
    const [overdue] = overdueInstallments([line()], '2026-09-20', settings)

    expect(overdue?.feeMinor).toBe(0)
  })

  it('charges one period after a month, two after two', () => {
    const settings = { ...DEFAULT_LATE_FEE_SETTINGS, value: 5_000 }

    expect(overdueInstallments([line()], '2026-10-05', settings)[0]?.feeMinor).toBe(5_000)
    expect(overdueInstallments([line()], '2026-11-05', settings)[0]?.feeMinor).toBe(10_000)
  })

  it('does NOT charge an installment that is already paid', () => {
    // ⚠️ A schedule row whose amount is fully covered is settled, however old it
    // is. Charging on the DATE alone would keep billing a payment that arrived
    // on time.
    const settings = { ...DEFAULT_LATE_FEE_SETTINGS, value: 5_000 }
    const overdue = overdueInstallments([line({ paidMinor: 33_333 })], '2026-12-31', settings)

    expect(overdue).toEqual([])
  })

  it('charges on the OVERDUE part, not the whole installment', () => {
    const settings = {
      basis: 'percentage' as const,
      value: 10,
      graceDays: 0,
      maxShareOfOverduePercent: 100,
    }
    const overdue = overdueInstallments(
      [line({ amountMinor: 33_333, paidMinor: 30_000 })],
      '2026-11-01',
      settings,
    )

    // 3,333 overdue × 10% = 333 — not 33,333 × 10% = 3,333.
    expect(overdue[0]?.feeMinor).toBe(333)
  })

  it('caps the fee and says it did', () => {
    const settings = {
      basis: 'per_period' as const,
      value: 50_000,
      graceDays: 0,
      maxShareOfOverduePercent: 20,
    }
    const overdue = overdueInstallments([line()], '2027-06-01', settings)

    // 20% of 33,333 rounds to 6,667 — the cap is applied to the rounded figure,
    // not the exact one, because the fee is money and money is an integer.
    expect(overdue[0]?.feeMinor).toBe(6_667)
    expect(overdue[0]?.capped).toBe(true)
  })

  it('the default settings charge NOTHING', () => {
    // ⚠️ G4: a setting nobody was asked about must have a stated default, and
    // this one is zero. A shop that never configured late fees is not charged
    // them because a field was absent.
    expect(DEFAULT_LATE_FEE_SETTINGS.value).toBe(0)
    expect(overdueInstallments([line()], '2030-01-01')).toEqual([])
  })

  it('honours a grace period', () => {
    const settings = { ...DEFAULT_LATE_FEE_SETTINGS, value: 5_000, graceDays: 40 }
    // Due 1 Sep. On 20 Oct it is 49 days late — PAST a 40-day grace, so a fee is
    // due. (The first version of this test used 20 Oct expecting zero, which
    // was wrong: 49 > 40. The engine was right and the expectation was not.)
    expect(overdueInstallments([line()], '2026-10-20', settings)[0]?.feeMinor).toBe(5_000)
    // On 30 Sep it is 29 days late — inside the grace. ⚠️ INSIDE the grace the
    // line is not overdue at all, so it comes back as no row rather than as a
    // row with a zero fee. That is deliberate: a caller that renders "0 late
    // fees" from an empty list and a caller that renders it from a zeroed row
    // are different screens, and only one of them is true.
    expect(overdueInstallments([line()], '2026-09-30', settings)).toEqual([])
    // Two periods late: 20 Nov is 80 days, floor(80/30) = 2 fees.
    expect(overdueInstallments([line()], '2026-11-20', settings)[0]?.feeMinor).toBe(10_000)
  })
})

describe("N4 — blocking is the shop's choice and is off by default", () => {
  const overdue = [
    {
      scheduleId: 'l1',
      invoiceId: 'inv-1',
      seq: 1,
      dueDate: '2026-09-01',
      daysLate: 60,
      overdueMinor: 33_333,
      feeMinor: 0,
      capped: false,
    },
  ]

  it('does not block unless the shop turned it on', () => {
    // ⚠️ The debt still SHOWS either way — blocking is about credit, not about
    // visibility. A debtor who can see what they owe is the whole point.
    expect(DEFAULT_BLOCK_POLICY.blockOnOverdue).toBe(false)
    expect(decideBlock(overdue)).toEqual({ blocked: false, reason: 'POLICY_OFF' })
  })

  it('blocks when the policy is on and the debt is old enough', () => {
    const decision = decideBlock(overdue, {
      blockOnOverdue: true,
      graceDays: 30,
      minAmountToBlockMinor: 0,
    })

    expect(decision.blocked).toBe(true)
    expect(decision.blocked && decision.amountMinor).toBe(33_333)
  })

  it('respects the grace period', () => {
    const decision = decideBlock(overdue, {
      blockOnOverdue: true,
      graceDays: 90,
      minAmountToBlockMinor: 0,
    })

    expect(decision).toEqual({ blocked: false, reason: 'WITHIN_GRACE' })
  })

  it('does not block a trivial debt — freezing a customer costs more than the debt', () => {
    const decision = decideBlock(overdue, {
      blockOnOverdue: true,
      graceDays: 0,
      minAmountToBlockMinor: 1_000_000,
    })

    expect(decision).toEqual({ blocked: false, reason: 'BELOW_THRESHOLD' })
  })

  it('nothing overdue means nothing to decide', () => {
    const decision = decideBlock([], {
      blockOnOverdue: true,
      graceDays: 0,
      minAmountToBlockMinor: 0,
    })
    expect(decision.blocked).toBe(false)
  })
})

describe('N4 — day arithmetic is on days, not on milliseconds', () => {
  it('counts whole days across a month boundary', () => {
    expect(daysBetween('2026-09-01', '2026-10-01')).toBe(30)
  })

  it('counts a leap day', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
  })

  it('is zero on the same day and negative before it', () => {
    expect(daysBetween('2026-09-01', '2026-09-01')).toBe(0)
    expect(daysBetween('2026-09-10', '2026-09-01')).toBe(-9)
  })
})
