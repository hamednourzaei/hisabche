// ============================================
// Engine N10 — cohorts, funnels, segments.
// Capabilities #130, #131, #108.
//
// ⚠️ THE HEADLINE OF THIS FILE: `null` IS NOT `0`, AND THE DIFFERENCE IS THE
// WHOLE PRODUCT.
//
// A cohort measured from this month's buyers can only report what already
// happened. Every unfilled cell in a retention table is a month that has not
// occurred yet, and rendering it as 0 is how a retention chart manufactures a
// cliff that costs a shop the customers it spent two years acquiring. It is the
// single most misread chart in this class of product, and the fix is one
// character.
//
// The other three failures are the same shape in different clothes:
//
//   * a CUSTOMER, not an order, is the unit — otherwise one large repeat buyer
//     outranks fifty small loyal ones and the shop learns the wrong lesson
//   * a FUNNEL that goes UP is unreadable, so the steps are intersected rather
//     than trusted
//   * an ABSENT value satisfies no segment rule, so `days_since_last: null`
//     (never bought) cannot be listed by a "less than 30 days" rule
// ============================================

import { describe, expect, it } from 'vitest'

import {
  buildCohorts,
  COHORT_WINDOW_MONTHS,
  buildFunnel,
  evaluateSegment,
  type SegmentFacts,
} from '../services/analytics/cohort.domain'
import type { OpenInvoice } from '../services/payments/payments.domain'

const invoice = (customerId: string, invoiceDate: string, total = 100): OpenInvoice => ({
  invoiceId: `${customerId}-${invoiceDate}`,
  invoiceNumber: '',
  total,
  allocated: 0,
  dueDate: invoiceDate,
  invoiceDate,
})

const AS_OF = '2026-09-30'

describe('N10 — the unit of a cohort is the CUSTOMER', () => {
  it('two invoices from one customer are one customer', () => {
    const rows = buildCohorts(
      [invoice('a', '2026-08-05'), invoice('a', '2026-09-05'), invoice('b', '2026-08-06')],
      (i) => i.invoiceId.split('-')[0] ?? null,
      AS_OF,
    )

    const august = rows.find((r) => r.cohort === '2026-08')
    expect(august?.size).toBe(2)
  })

  it('the cohort month is the WHOLE cohort, not a retention rate', () => {
    // ⚠️ 100% at month 0 is not "perfectly retained" — it is the definition of a
    // cohort. Anyone who bought in August IS in August's cohort.
    const rows = buildCohorts([invoice('a', '2026-08-05')], () => 'a', AS_OF)

    expect(rows[0]?.retained[0]).toBe(1)
  })

  it('average value per customer does not let money drive the shape', () => {
    const rows = buildCohorts(
      [invoice('whale', '2026-08-01', 100_000), invoice('minnow', '2026-08-02', 100)],
      (i) => i.invoiceId.split('-')[0] ?? null,
      AS_OF,
    )

    // ⚠️ The whale's money is visible, but `size` is still 2 and the retention
    // shape is still counted in people.
    expect(rows[0]?.size).toBe(2)
    expect(rows[0]?.averageValuePerCustomer).toBe(50_050)
  })
})

describe('N10 — a month that has not happened is null, NOT zero', () => {
  it('a cohort two weeks old has null beyond the current month', () => {
    // ⚠️ THE test the whole file is about. In September, a September cohort has
    // had no chance to be retained in October, and a 0 there reads as «everyone
    // left».
    const rows = buildCohorts([invoice('a', '2026-09-20')], () => 'a', AS_OF)

    expect(rows[0]?.retained[0]).toBe(1)
    expect(rows[0]?.retained[1]).toBeNull()
  })

  it('a fully observed cohort reports real numbers, then nulls', () => {
    // ⚠️ The window is FIXED at twelve months, so a three-month-old cohort has
    // three real cells and nine nulls. The first version asserted a three-element
    // array and failed — correctly, because a table that changes width with its
    // data cannot be compared with last month's.
    const rows = buildCohorts(
      [invoice('a', '2026-07-05'), invoice('a', '2026-08-05')],
      () => 'a',
      AS_OF,
    )

    expect(rows[0]?.retained.slice(0, 3)).toEqual([1, 1, 0])
    expect(rows[0]?.retained).toHaveLength(12)
    expect(rows[0]?.retained[3]).toBeNull()
    expect(rows[0]?.observedThrough).toBe('2026-09')
  })

  it('the window is a named constant, not a number in a test', () => {
    // ⚠️ Fixed rather than derived from the data, so a chart comparing two
    // months is comparing like with like.
    expect(COHORT_WINDOW_MONTHS).toBe(12)
  })

  it('says how far it can see', () => {
    const rows = buildCohorts([invoice('a', '2026-07-05')], () => 'a', AS_OF)
    expect(rows[0]?.observedThrough).toBe('2026-09')
  })

  it('a customer who bought once is not churned at month zero', () => {
    // ⚠️ Counting them as churned immediately is what makes every retention
    // chart look like a cliff.
    const rows = buildCohorts([invoice('a', '2026-09-05')], () => 'a', AS_OF)

    expect(rows[0]?.churned).toBe(0)
  })

  it('a zero-total invoice is not a purchase', () => {
    // ⚠️ A fully-discounted invoice is a real sale; a voided one at zero total is
    // not. Counting them puts customers in cohorts they never joined.
    const rows = buildCohorts([invoice('a', '2026-08-05', 0)], () => 'a', AS_OF)
    expect(rows).toEqual([])
  })

  it('an invoice with no customer is skipped, not bucketed as unknown', () => {
    const rows = buildCohorts([invoice('a', '2026-08-05')], () => null, AS_OF)
    expect(rows).toEqual([])
  })
})

describe('N10 — a funnel cannot go UP', () => {
  const ids = (...list: string[]) => new Set(list)

  it('each step is intersected with the one before it', () => {
    // ⚠️ Step 2's raw set contains someone who never bought. Counting them
    // makes the funnel rise, which is unreadable and wrong.
    const funnel = buildFunnel([
      { name: 'Ordered', customerIds: ids('a', 'b', 'c') },
      { name: 'Paid', customerIds: ids('a', 'b', 'x') },
    ])

    expect(funnel.steps[1]?.customers).toBe(2)
    expect(funnel.steps[1]?.name).toBe('Paid')
  })

  it('counts are non-increasing down the funnel', () => {
    const funnel = buildFunnel([
      { name: 'Ordered', customerIds: ids('a', 'b', 'c', 'd') },
      { name: 'Paid', customerIds: ids('a', 'b', 'c') },
      { name: 'Repeat', customerIds: ids('a', 'e', 'f') },
    ])

    const counts = funnel.steps.map((s) => s.customers)
    expect(counts).toEqual([4, 3, 1])
    for (let i = 1; i < counts.length; i += 1) {
      expect(counts[i]!).toBeLessThanOrEqual(counts[i - 1]!)
    }
  })

  it('the first step has no conversion rate, not 100%', () => {
    const funnel = buildFunnel([{ name: 'Ordered', customerIds: ids('a') }])

    expect(funnel.steps[0]?.conversionPercent).toBeNull()
  })

  it('an empty funnel has NO overall rate, not 0%', () => {
    // ⚠️ 0/0 is not 0. A funnel that starts empty has no conversion rate, and a
    // 0% reads as «nobody converted» — a very different statement.
    const funnel = buildFunnel([{ name: 'Ordered', customerIds: new Set<string>() }])

    expect(funnel.overallPercent).toBeNull()
  })

  it('a step after an empty one is also empty', () => {
    const funnel = buildFunnel([
      { name: 'Ordered', customerIds: new Set<string>() },
      { name: 'Paid', customerIds: ids('a') },
    ])

    expect(funnel.steps[1]?.customers).toBe(0)
    expect(funnel.steps[1]?.conversionPercent).toBeNull()
  })
})

describe('N10 — an absent value satisfies no segment rule', () => {
  const facts = (over: Partial<SegmentFacts> = {}): SegmentFacts => ({
    totalSpent: 1000,
    invoiceCount: 5,
    averageInvoice: 200,
    daysSinceLast: 10,
    overdue: 0,
    ...over,
  })

  it('a customer who never bought is NOT "less than 30 days"', () => {
    // ⚠️ THE failure. `daysSinceLast: null` means never, and treating it as 0
    // would list every dormant customer as a recent one — the exact opposite of
    // what a segment is for.
    const segment = evaluateSegment(
      [{ field: 'days_since_last', operator: 'less_than', value: 30 }],
      facts({ daysSinceLast: null }),
    )

    expect(segment).toBe(false)
  })

  it('a real value is compared normally', () => {
    expect(
      evaluateSegment([{ field: 'days_since_last', operator: 'less_than', value: 30 }], facts()),
    ).toBe(true)
  })

  it('ALL rules must pass', () => {
    const rules = [
      { field: 'total_spent' as const, operator: 'greater_than' as const, value: 500 },
      { field: 'invoice_count' as const, operator: 'greater_than' as const, value: 3 },
    ]

    expect(evaluateSegment(rules, facts())).toBe(true)
    expect(evaluateSegment(rules, facts({ invoiceCount: 1 }))).toBe(false)
  })

  it('"between" is inclusive on both ends', () => {
    const between = [
      { field: 'total_spent' as const, operator: 'between' as const, value: 1000, valueTo: 2000 },
    ]

    expect(evaluateSegment(between, facts({ totalSpent: 1000 }))).toBe(true)
    expect(evaluateSegment(between, facts({ totalSpent: 2000 }))).toBe(true)
    expect(evaluateSegment(between, facts({ totalSpent: 2001 }))).toBe(false)
  })

  it('no rules means EVERYONE, not nobody', () => {
    // An empty AND is vacuously true, which is the one case where that is right:
    // a segment with no conditions means «all customers».
    expect(evaluateSegment([], facts())).toBe(true)
  })
})
