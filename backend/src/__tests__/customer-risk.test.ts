// ============================================
// Engine N21 — customer risk and health.
// Capabilities #3, #9, #13, #18.
//
// ⚠️ THE HEADLINE: EVERY CUSTOMER WAS LATE ONCE.
//
// The obvious implementation averages lateness across all history, so a
// customer who paid on time for five years and slipped once comes out at a
// 20-day average and gets flagged. That is the failure this engine exists to
// avoid, and it is why the TREND signal exists separately from RECENT_LATE.
//
// The other four shapes are the same idea in different places — a plausible
// number that means something other than what a reader will take it to mean:
//
//   * a customer with ONE settled invoice gets `unknown`, not a score from one
//   * a customer who IMPROVES is not a risk signal, and must not be scored for
//     being forgiven
//   * a healthy customer gets a REAL low score, not null — because a null is
//     indistinguishable from «unmeasured» and the customer drops off the list
//   * the rule never reads the clock, so a customer's record means the same
//     thing today as it did last year
// ============================================

import { describe, expect, it } from 'vitest'

import {
  MIN_SETTLED_FOR_A_SCORE,
  customerRisk,
  daysLate,
  type PaymentBehaviour,
} from '../services/customers/customer-risk.domain'

const paid = (
  issuedOn: string,
  dueOn: string,
  settledOn: string,
  amountMinor = 100_000,
): PaymentBehaviour => ({
  invoiceId: `${issuedOn}-${dueOn}`,
  issuedOn,
  dueOn,
  settledOn,
  amountMinor,
  outstandingMinor: 0,
})

const unpaid = (issuedOn: string, dueOn: string, amountMinor = 100_000): PaymentBehaviour => ({
  invoiceId: `${issuedOn}-${dueOn}`,
  issuedOn,
  dueOn,
  settledOn: null,
  amountMinor,
  outstandingMinor: amountMinor,
})

describe('N21 — a customer with too little history is UNKNOWN, not safe', () => {
  it('one settled invoice is not a history', () => {
    // ⚠️ Averaging over one invoice gives a perfect record, and a perfect
    // record on one invoice reads as a customer the shop can rely on.
    const risk = customerRisk({
      customerId: 'c1',
      payments: [paid('2026-01-01', '2026-01-31', '2026-01-28')],
      creditLimitMinor: null,
    })

    expect(risk.band).toBe('unknown')
    expect(risk.score).toBeNull()
    expect(risk.reason).toBe('TOO_FEW_SETTLED')
    expect(MIN_SETTLED_FOR_A_SCORE).toBe(3)
  })

  it('a customer who never settled anything is unknown for a different reason', () => {
    const risk = customerRisk({
      customerId: 'c1',
      payments: [unpaid('2026-01-01', '2026-01-31')],
      creditLimitMinor: null,
    })

    expect(risk.reason).toBe('NO_SETTLED_INVOICES')
  })

  it('a customer with no record at all is unknown', () => {
    const risk = customerRisk({ customerId: 'c1', payments: [], creditLimitMinor: null })

    expect(risk.band).toBe('unknown')
    expect(risk.reason).toBe('NEVER_BOUGHT')
  })
})

describe('N21 — a healthy customer gets a REAL low score, not null', () => {
  it('pays early, has history, and is not on any list', () => {
    // ⚠️ THE distinction the file is about. `null` here would be read as
    // «unmeasured» by any UI, and the customer would quietly drop off the
    // list of people the shop calls.
    const risk = customerRisk({
      customerId: 'c1',
      payments: [
        paid('2026-01-01', '2026-01-31', '2026-01-28'),
        paid('2026-02-01', '2026-02-28', '2026-02-25'),
        paid('2026-03-01', '2026-03-31', '2026-03-29'),
        paid('2026-04-01', '2026-04-30', '2026-04-27'),
      ],
      creditLimitMinor: null,
    })

    expect(risk.band).toBe('healthy')
    expect(risk.score).toBe(5)
    expect(risk.signals).toEqual([])
    expect(risk.reason).toBeNull()
  })

  it('reports the average lateness it measured', () => {
    const risk = customerRisk({
      customerId: 'c1',
      payments: [
        paid('2026-01-01', '2026-01-31', '2026-02-03'), // 3 late
        paid('2026-02-01', '2026-02-28', '2026-03-03'), // 3 late
        paid('2026-03-01', '2026-03-31', '2026-04-05'), // 5 late
      ],
      creditLimitMinor: null,
    })

    expect(risk.facts.averageDaysLate).toBe(3.7)
    expect(risk.band).toBe('healthy')
  })
})

describe('N21 — the TREND is what a lifetime average cannot see', () => {
  it('a customer who got worse is flagged even with a fine lifetime average', () => {
    // ⚠️ THE failure this engine exists for. Five years on time, then a bad
    // quarter: the lifetime average stays excellent and the customer is
    // deteriorating. Only the split sees it.
    const risk = customerRisk({
      customerId: 'c1',
      payments: [
        paid('2026-01-01', '2026-01-31', '2026-01-28'),
        paid('2026-02-01', '2026-02-28', '2026-02-25'),
        paid('2026-03-01', '2026-03-31', '2026-03-29'),
        paid('2026-04-01', '2026-04-30', '2026-06-15'), // 46 late
        paid('2026-05-01', '2026-05-31', '2026-07-10'), // 40 late
      ],
      creditLimitMinor: null,
    })

    expect(risk.band).not.toBe('healthy')
    expect(risk.signals.map((s) => s.key)).toContain('TREND')
    // ⚠️ THE NUMBERS THAT MAKE THE POINT. The first two payments were THREE
    // DAYS EARLY (−3); the last three average 28 days late; the lifetime
    // average is 15.6.
    //
    // A reader looking only at 15.6 sees «about two weeks late, unremarkable»
    // and moves on. The split is the only instrument that shows the direction.
    expect(risk.facts.olderDaysLate).toBe(-3)
    expect(risk.facts.recentDaysLate).toBe(28)
    expect(risk.facts.averageDaysLate).toBe(15.6)
  })

  it('a customer who IMPROVES is not a risk signal', () => {
    // ⚠️ A score that punished improvement would punish the shop for being
    // forgiven, and would make a recovering customer worth less than a chronic
    // one.
    const risk = customerRisk({
      customerId: 'c1',
      payments: [
        paid('2026-01-01', '2026-01-31', '2026-02-25'), // 25 late
        paid('2026-02-01', '2026-02-28', '2026-03-25'), // 25 late
        paid('2026-03-01', '2026-03-31', '2026-04-05'), // 5 late
        paid('2026-04-01', '2026-04-30', '2026-05-02'), // 2 late
      ],
      creditLimitMinor: null,
    })

    expect(risk.signals.map((s) => s.key)).not.toContain('TREND')
    expect(risk.band).toBe('healthy')
  })

  it('a small wobble is not deterioration', () => {
    // ⚠️ The threshold has to exist, or every customer with any variance is
    // flagged and the list becomes the whole customer base.
    const risk = customerRisk({
      customerId: 'c1',
      payments: [
        paid('2026-01-01', '2026-01-31', '2026-02-05'),
        paid('2026-02-01', '2026-02-28', '2026-03-05'),
        paid('2026-03-01', '2026-03-31', '2026-04-06'),
        paid('2026-04-01', '2026-04-30', '2026-05-08'), // 8 late
      ],
      creditLimitMinor: null,
    })

    expect(risk.signals.map((s) => s.key)).not.toContain('TREND')
  })
})

describe('N21 — unpaid invoices and broken promises are separate signals', () => {
  it('several overdue invoices is a signal', () => {
    const risk = customerRisk({
      customerId: 'c1',
      payments: [
        paid('2026-01-01', '2026-01-31', '2026-01-28'),
        paid('2026-02-01', '2026-02-28', '2026-02-25'),
        paid('2026-03-01', '2026-03-31', '2026-03-29'),
        unpaid('2026-05-01', '2026-05-31'),
        unpaid('2026-06-01', '2026-06-30'),
      ],
      creditLimitMinor: null,
      // ⚠️ PASSED IN. Without it the rule takes the latest date in the record as
      // «today» — so the newest unpaid invoice sets the reference and can never
      // itself be overdue. A caller that knows the date says so.
      asOf: '2026-07-15',
    })

    expect(risk.signals.map((s) => s.key)).toContain('GROWING_DEBT')
    expect(risk.facts.outstandingMinor).toBe(200_000)
  })

  it('an invoice due ON the reference date is due, not overdue', () => {
    const risk = customerRisk({
      customerId: 'c1',
      payments: [
        paid('2026-01-01', '2026-01-31', '2026-01-28'),
        paid('2026-02-01', '2026-02-28', '2026-02-25'),
        paid('2026-03-01', '2026-03-31', '2026-03-29'),
        unpaid('2026-05-01', '2026-05-31'),
      ],
      creditLimitMinor: null,
      asOf: '2026-05-31',
    })

    expect(risk.signals.map((s) => s.key)).not.toContain('GROWING_DEBT')
  })

  it('a missed PROMISE is a signal, because it never becomes an invoice', () => {
    // ⚠️ A broken promise is the one risk that leaves no record in the books —
    // which is exactly why it has to be counted explicitly.
    const risk = customerRisk({
      customerId: 'c1',
      payments: [
        paid('2026-01-01', '2026-01-31', '2026-01-28'),
        paid('2026-02-01', '2026-02-28', '2026-02-25'),
        paid('2026-03-01', '2026-03-31', '2026-03-29'),
      ],
      creditLimitMinor: null,
      brokenPromiseCount: 3,
    })

    expect(risk.signals.map((s) => s.key)).toContain('BROKEN_PROMISE')
  })

  it('every signal carries the figures behind it', () => {
    // ⚠️ A weight a salesperson cannot check is a weight they will not act on.
    const risk = customerRisk({
      customerId: 'c1',
      payments: [
        paid('2026-01-01', '2026-01-31', '2026-04-01'),
        paid('2026-02-01', '2026-02-28', '2026-06-01'),
        paid('2026-03-01', '2026-03-31', '2026-07-01'),
      ],
      creditLimitMinor: null,
    })

    for (const signal of risk.signals) {
      expect(Object.keys(signal.evidence).length, signal.key).toBeGreaterThan(0)
      expect(signal.detail.length, signal.key).toBeGreaterThan(10)
    }
  })
})

describe('N21 — the rule never reads the clock', () => {
  it('day arithmetic is on days', () => {
    expect(daysLate('2026-01-31', '2026-02-03')).toBe(3)
    expect(daysLate('2026-01-31', '2026-01-28')).toBe(-3)
  })

  it('the same record scores the same forever', () => {
    // ⚠️ A scoring function that calls Date.now() changes its answer with the
    // wall clock, so you cannot tell a customer's behaviour from their record's
    // vintage. Every date here comes from the data.
    const payments = [
      paid('2026-01-01', '2026-01-31', '2026-01-28'),
      paid('2026-02-01', '2026-02-28', '2026-02-25'),
      paid('2026-03-01', '2026-03-31', '2026-03-29'),
    ]

    const first = customerRisk({ customerId: 'c1', payments, creditLimitMinor: null })
    const second = customerRisk({ customerId: 'c1', payments, creditLimitMinor: null })

    expect(second).toEqual(first)
  })
})
