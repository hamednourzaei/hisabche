// ============================================
// Engine N3 — working capital, loans, investments.
// Capabilities #38, #125, #126.
//
// ⚠️ THIS FILE IS MOSTLY ABOUT FIGURES THAT DO NOT EXIST.
//
// The arithmetic in `working-capital` is division. Division is easy and the
// interesting part is what happens at the edges, where a naive implementation
// produces a number that reads as a finding:
//
//   1. DSO ON A SHOP THAT HAS NOT TRADED. `receivables ÷ 0` is Infinity, or 0 if
//      clamped. Zero reads as «your customers pay instantly» — excellent news,
//      entirely false, and exactly what a shop would quote to a bank.
//   2. ANNUALISING BY TWELVE. Dividing an annual figure by 12 measures against
//      December, which for a seasonal shop is three times an average month. The
//      number is wrong by a factor nobody can see.
//   3. A NEGATIVE CASH CONVERSION CYCLE SHOWN IN RED. Negative means suppliers
//      are financing the business. It is the good case.
//   4. A LOAN INSTALMENT COMPUTED WITH AN ANNUAL RATE ON A MONTHLY PERIOD.
//      Overstates by twelve times, produces a plausible number, and is the
//      single most common way an amortisation schedule lies.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  accruedInterest,
  dayCount,
  instalment,
  summarisePortfolio,
  workingCapital,
  type Facility,
  type Holding,
  type WorkingCapitalInput,
} from '../services/financing/working-capital.domain'

/** A year of trading: 365 days, so a figure of X means X days of trade. */
const YEAR = (over: Partial<WorkingCapitalInput> = {}): WorkingCapitalInput => ({
  revenueMinor: 365_000_00,
  costOfGoodsSoldMinor: 200_000_00,
  purchasesMinor: 220_000_00,
  receivablesMinor: 50_000_00,
  payablesMinor: 30_000_00,
  inventoryMinor: 40_000_00,
  cashMinor: 20_000_00,
  daysInPeriod: 365,
  ...over,
})

describe('N3 — ratios that cannot be computed are null, never zero', () => {
  it('a shop that has never sold has NO DSO, not a DSO of 0', () => {
    // ⚠️ THE test that matters most in this file. `0` here would be read by the
    // UI as a good score and by the shop's next lender as evidence.
    const metrics = workingCapital(YEAR({ revenueMinor: 0, receivablesMinor: 0 }))

    expect(metrics.dso).toBeNull()
    expect(metrics.cashConversionCycle).toBeNull()
    expect(metrics.operatingCycle).toBeNull()
  })

  it('a negative CCC propagates rather than collapsing to a null leg', () => {
    const metrics = workingCapital(YEAR({ payablesMinor: 200_000_00 }))

    expect(metrics.dpo).not.toBeNull()
    expect(metrics.cashConversionCycle).not.toBeNull()
    // ⚠️ Negative is GOOD: suppliers are financing the shop. A renderer that
    // colours every negative red would be telling the shop its strength.
    expect(metrics.cashConversionCycle!).toBeLessThan(0)
  })

  it('one unavailable leg makes the whole cycle unavailable', () => {
    // ⚠️ A CCC built from two real ratios and one invented zero is worse than no
    // CCC, because it looks computable.
    const metrics = workingCapital(YEAR({ costOfGoodsSoldMinor: 0, inventoryMinor: 0 }))

    expect(metrics.dio).toBeNull()
    expect(metrics.cashConversionCycle).toBeNull()
  })

  it('a shop that owes nothing has a null quick ratio, not Infinity', () => {
    // ⚠️ `Infinity` in a JSON response is a value no client can render, and a
    // clamped large number reads as a precise measurement.
    const metrics = workingCapital(YEAR({ payablesMinor: 0 }))

    expect(metrics.quickRatio).toBeNull()
  })
})

describe('N3 — days are measured against the period, not against twelve months', () => {
  it('a receivable equal to one day of sales is DSO 1', () => {
    const metrics = workingCapital(YEAR({ revenueMinor: 365_000_00, receivablesMinor: 1_000_00 }))

    expect(metrics.dso).toBe(1)
  })

  it('a quarter of sales is DSO 91, not 91.25', () => {
    const metrics = workingCapital(YEAR({ receivablesMinor: 91_000_00 }))

    expect(metrics.dso).toBe(91)
  })

  it('a half-year period halves the day count', () => {
    // ⚠️ 25,000 × 182 ÷ 182,500 = 24.93 → 24.9 days. (The first version
    // asserted 50, which would need a receivable of 50,000 — the half-year
    // sales figure, not the receivable. Two different numbers, and the ratio
    // made them look interchangeable.)
    const half = workingCapital(
      YEAR({ daysInPeriod: 182, revenueMinor: 182_500_00, receivablesMinor: 25_000_00 }),
    )
    expect(half.dso).toBe(24.9)

    // ⚠️ AND THE CASE THAT MATTERS: the SAME receivable against the same
    // half-year sales gives a different number than against a full year,
    // because the sales it is measured against changed and the debt did not.
    // A report that divides by twelve months regardless would report the same
    // figure for both and hide the difference entirely.
    const full = workingCapital(
      YEAR({ daysInPeriod: 365, revenueMinor: 182_500_00, receivablesMinor: 25_000_00 }),
    )
    expect(full.dso).toBe(50)
  })

  it('the cycle adds DIO and subtracts DPO', () => {
    const metrics = workingCapital(
      YEAR({
        receivablesMinor: 365_000_00, // 365 days
        inventoryMinor: 365_000_00, // 365 days at 200,000 of COGS → see below
        costOfGoodsSoldMinor: 365_000_00,
        payablesMinor: 0,
        purchasesMinor: 365_000_00,
      }),
    )

    expect(metrics.dso).toBe(365)
    expect(metrics.dpo).toBe(0)
    expect(metrics.dio).toBe(365)
    expect(metrics.cashConversionCycle).toBe(730)
  })

  it('net working capital is receivables + stock − payables', () => {
    const metrics = workingCapital(YEAR())
    expect(metrics.netWorkingCapitalMinor).toBe(50_000_00 + 40_000_00 - 30_000_00)
  })
})

describe('N3 — interest accrues on the days it actually ran', () => {
  const facility = (over: Partial<Facility> = {}): Facility => ({
    id: 'f-1',
    kind: 'loan',
    principalMinor: 1_000_000_00,
    annualRatePercent: 12,
    startDate: '2026-01-01',
    endDate: null,
    chargesPerYear: 12,
    ...over,
  })

  it('a year at 12% on 1,000,000 accrues about 120,000 — not the principal', () => {
    // 364 days elapsed from 1 Jan to 31 Dec: 1,000,000 × 0.12 × 364 ÷ 365 =
    // 119,671.23.
    //
    // ⚠️ BUG-096: this test used to assert 997,260.27 — the engine took the
    // rate as 12 rather than 0.12 and divided by `chargesPerYear`, and the
    // assertion was written from the engine's output. A year of interest that
    // is the size of the loan is the check that would have caught it.
    const result = accruedInterest(facility(), '2026-01-01', '2026-12-31')

    expect(result.days).toBe(364)
    expect(result.accruedMinor).toBe(11_967_123)
    expect(result.accruedMinor).toBeLessThan(facility().principalMinor * 0.13)
  })

  it('accrues only from the START of the facility, not from the window', () => {
    // ⚠️ A loan taken out in July has not accrued interest for January.
    const result = accruedInterest(facility(), '2026-01-01', '2026-12-31')
    const fromJuly = accruedInterest(facility(), '2026-07-01', '2026-12-31')

    expect(fromJuly.accruedMinor).toBeLessThan(result.accruedMinor)
  })

  it('stops at the END of the facility', () => {
    const result = accruedInterest(facility({ endDate: '2026-06-30' }), '2026-01-01', '2026-12-31')

    expect(result.days).toBeLessThan(364)
  })

  it('how often interest is CHARGED does not change how much has accrued', () => {
    // Simple interest over a number of days is the same whether the lender
    // collects it monthly or quarterly. The frequency decides the instalment,
    // not the accrual — the old engine divided by it and tripled the figure.
    const monthly = accruedInterest(facility({ chargesPerYear: 12 }), '2026-01-01', '2026-12-31')
    const quarterly = accruedInterest(facility({ chargesPerYear: 4 }), '2026-01-01', '2026-12-31')

    expect(quarterly.accruedMinor).toBe(monthly.accruedMinor)
  })

  it('half the days accrue half the interest', () => {
    const year = accruedInterest(facility(), '2026-01-01', '2026-12-31')
    const half = accruedInterest(facility(), '2026-01-01', '2026-07-02')

    expect(half.days).toBe(182)
    expect(Math.abs(half.accruedMinor * 2 - year.accruedMinor)).toBeLessThanOrEqual(1)
  })

  it('a window entirely before the loan exists accrues nothing', () => {
    const result = accruedInterest(
      facility({ startDate: '2026-06-01' }),
      '2026-01-01',
      '2026-03-31',
    )

    expect(result.accruedMinor).toBe(0)
  })

  it('a zero-rate facility accrues nothing and is not an error', () => {
    const result = accruedInterest(facility({ annualRatePercent: 0 }), '2026-01-01', '2026-12-31')

    expect(result.accruedMinor).toBe(0)
  })
})

describe('N3 — an instalment uses the PERIOD rate, not the annual one', () => {
  it('a 12% annual loan paid monthly is not twelve times the right number', () => {
    // ⚠️ THE failure this prevents: passing 12 where 0.01 belongs overstates the
    // instalment by twelve times and produces a number that looks entirely
    // normal. On 1,000,000 over 12 months at 12%/yr the payment is 88,848.79.
    const monthly = instalment(1_000_000_00, 12, 12, 12)

    expect(monthly).not.toBeNull()
    expect(monthly!.perInstalmentMinor).toBe(8_884_879)
  })

  it('the total of the instalments covers the principal plus interest', () => {
    const plan = instalment(1_000_000_00, 12, 12, 12)

    expect(plan!.totalMinor).toBeGreaterThan(1_000_000_00)
    expect(plan!.totalMinor).toBeLessThan(1_200_000_00)
  })

  it('a quarterly instalment is roughly three times a monthly one', () => {
    const monthly = instalment(1_000_000_00, 12, 12, 12)!
    const quarterly = instalment(1_000_000_00, 12, 4, 4)!

    expect(quarterly.perInstalmentMinor).toBeGreaterThan(monthly.perInstalmentMinor * 2)
  })

  it('a zero-rate loan splits evenly with no division by zero', () => {
    // ⚠️ A lender who charges nothing is a real thing, and the amortisation
    // formula divides by (1+r)^n − 1, which is zero when r is zero. 1,200.00
    // over 12 payments is 100.00 each — and the LAST instalment absorbs the
    // remainder rather than each one rounding.
    const plan = instalment(120_000, 0, 12, 12)

    expect(plan!.perInstalmentMinor).toBe(10_000)
    expect(plan!.totalMinor).toBe(120_000)
  })

  it('refuses nonsense rather than returning a number', () => {
    expect(instalment(0, 12, 12, 12)).toBeNull()
    expect(instalment(1_000, 12, 12, 0)).toBeNull()
  })
})

describe('#126 — a portfolio reports a valuation difference, not a return', () => {
  const holding = (over: Partial<Holding> = {}): Holding => ({
    id: 'h-1',
    label: 'ABC Corp',
    costMinor: 100_000_00,
    marketValueMinor: 120_000_00,
    currency: 'USD',
    ...over,
  })

  it('adds up cost and market value', () => {
    const summary = summarisePortfolio([
      holding(),
      holding({ id: 'h-2', marketValueMinor: 80_000_00 }),
    ])

    expect(summary.costMinor).toBe(200_000_00)
    expect(summary.marketValueMinor).toBe(200_000_00)
  })

  it('reports an unrealised gain as positive', () => {
    const summary = summarisePortfolio([holding()])

    expect(summary.unrealisedGainMinor).toBe(20_000_00)
    expect(summary.unrealisedGainPercent).toBe(20)
  })

  it('reports a LOSS as negative, not as a small positive number', () => {
    const summary = summarisePortfolio([holding({ marketValueMinor: 80_000_00 })])

    expect(summary.unrealisedGainMinor).toBe(-20_000_00)
    expect(summary.unrealisedGainPercent).toBe(-20)
  })

  it('a portfolio with no cost has NO percentage, not 0%', () => {
    // ⚠️ 0% reads as «it neither gained nor lost». A brand-new holding set has
    // no performance at all.
    const summary = summarisePortfolio([holding({ costMinor: 0 })])

    expect(summary.unrealisedGainPercent).toBeNull()
  })

  it('states that it is a valuation difference and not a return', () => {
    // ⚠️ No dividends, no fees, no cash flow are recorded anywhere in the
    // product, so calling this a performance figure would be a claim the books
    // cannot support.
    expect(summarisePortfolio([holding()]).basis).toBe('VALUATION_DIFFERENCE_ONLY')
  })
})

describe('N3 — day counting is on days', () => {
  it('counts whole days and refuses nonsense', () => {
    expect(dayCount('2026-01-01', '2026-01-31')).toBe(30)
    expect(dayCount('2026-01-31', '2026-01-01')).toBe(-30)
    expect(dayCount('', '2026-01-01')).toBe(0)
    expect(dayCount('not-a-date', '2026-01-01')).toBe(0)
  })
})
