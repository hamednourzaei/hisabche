// ============================================
// backend/src/__tests__/forecast-followup.test.ts
//
// N3 — cash forecast. N4 — opportunities that have gone quiet.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  STALE_AFTER_DAYS,
  averagePaymentDelay,
  findStaleOpportunities,
  forecastCash,
} from '../services/intelligence/forecast.domain'

const asOf = new Date('2026-09-06T00:00:00Z')
const inDays = (n: number) => new Date(asOf.getTime() + n * 86_400_000).toISOString()
const agoDays = (n: number) => new Date(asOf.getTime() - n * 86_400_000).toISOString()

describe('N3 — how late customers actually pay', () => {
  it('averages the observed lateness', () => {
    const delay = averagePaymentDelay([
      { dueDate: '2026-01-01', settledAt: '2026-01-11' }, // 10 late
      { dueDate: '2026-02-01', settledAt: '2026-02-05' }, // 4 late
    ])
    expect(delay).toMatchObject({ averageDaysLate: 7, sampleSize: 2, basis: 'observed' })
  })

  it('⚠️ an early payment does not offset a late one', () => {
    // Cash that arrived early is already in the bank and forecasts nothing.
    // Averaging signed lateness would let a few prompt payers hide a chronic
    // late payer — the single most useful thing this figure has to say.
    const delay = averagePaymentDelay([
      { dueDate: '2026-01-10', settledAt: '2026-01-01' }, // 9 EARLY → counts 0
      { dueDate: '2026-02-01', settledAt: '2026-02-21' }, // 20 late
    ])
    expect(delay.averageDaysLate).toBe(10)
  })

  it('says when there is no history rather than assuming punctuality', () => {
    expect(averagePaymentDelay([])).toMatchObject({ basis: 'none', averageDaysLate: 0 })
    expect(averagePaymentDelay([{ dueDate: null, settledAt: '2026-01-01' }]).basis).toBe('none')
  })
})

describe('N3 — the forecast', () => {
  const delay = { averageDaysLate: 0, sampleSize: 5, basis: 'observed' as const }

  it('counts receivables due inside the window', () => {
    const forecast = forecastCash({
      asOf,
      openingCashMinor: 100_000,
      delay,
      receivables: [
        { invoiceId: 'a', outstandingMinor: 50_000, dueDate: inDays(3) },
        { invoiceId: 'b', outstandingMinor: 70_000, dueDate: inDays(20) },
      ],
    })

    const [week, month] = forecast.windows
    expect(week).toMatchObject({
      days: 7,
      expectedInflowMinor: 50_000,
      projectedCashMinor: 150_000,
    })
    expect(month).toMatchObject({ days: 30, expectedInflowMinor: 120_000 })
  })

  it('⚠️ shifts due dates by the observed lateness', () => {
    // An invoice due on day 6 from customers who pay 10 days late is NOT
    // week-one cash. A forecast that assumed otherwise fails to predict
    // exactly the shortfall that hurts.
    const late = { averageDaysLate: 10, sampleSize: 20, basis: 'observed' as const }
    const forecast = forecastCash({
      asOf,
      openingCashMinor: 0,
      delay: late,
      receivables: [{ invoiceId: 'a', outstandingMinor: 50_000, dueDate: inDays(6) }],
    })
    expect(forecast.windows[0]!.expectedInflowMinor).toBe(0)
    expect(forecast.windows[1]!.expectedInflowMinor).toBe(50_000)
  })

  it('⚠️ overdue money is reported separately, never as scheduled inflow', () => {
    // It should already be here. Counting it as «arriving on day N» makes the
    // forecast optimistic in the one case where that is most dangerous.
    const forecast = forecastCash({
      asOf,
      openingCashMinor: 0,
      delay,
      receivables: [{ invoiceId: 'a', outstandingMinor: 90_000, dueDate: agoDays(40) }],
    })
    expect(forecast.windows[0]).toMatchObject({ expectedInflowMinor: 0, overdueMinor: 90_000 })
  })

  it('⚠️ an invoice with no due date is never placed on a day', () => {
    // Visible in `undatedMinor`, but scheduling it would invent a date — and a
    // forecast built on invented dates is confidently wrong.
    const forecast = forecastCash({
      asOf,
      openingCashMinor: 0,
      delay,
      receivables: [{ invoiceId: 'a', outstandingMinor: 30_000, dueDate: null }],
    })
    expect(forecast.windows[0]).toMatchObject({ expectedInflowMinor: 0, undatedMinor: 30_000 })
  })

  it('ignores a fully settled receivable', () => {
    const forecast = forecastCash({
      asOf,
      openingCashMinor: 0,
      delay,
      receivables: [{ invoiceId: 'a', outstandingMinor: 0, dueDate: inDays(2) }],
    })
    expect(forecast.windows[0]!.expectedInflowMinor).toBe(0)
  })
})

describe('N4 — opportunities that have gone quiet', () => {
  it('flags one with no activity for longer than the threshold', () => {
    const stale = findStaleOpportunities(
      [
        {
          id: 'o1',
          name: 'Kabul retail',
          stage: 'proposal',
          lastActivityAt: agoDays(30),
          createdAt: agoDays(60),
        },
      ],
      asOf,
    )
    expect(stale[0]).toMatchObject({ id: 'o1', daysSilent: 30, neverContacted: false })
  })

  it('leaves a recently touched one alone', () => {
    expect(
      findStaleOpportunities(
        [{ id: 'o1', name: 'x', stage: null, lastActivityAt: agoDays(2), createdAt: agoDays(60) }],
        asOf,
      ),
    ).toEqual([])
  })

  it('⚠️ measures a never-contacted opportunity from its CREATION', () => {
    // One created today with no activity is not stale; one created two months
    // ago with no activity is the most neglected thing in the pipeline.
    const fresh = findStaleOpportunities(
      [{ id: 'new', name: 'x', stage: null, lastActivityAt: null, createdAt: agoDays(1) }],
      asOf,
    )
    expect(fresh).toEqual([])

    const old = findStaleOpportunities(
      [{ id: 'old', name: 'x', stage: null, lastActivityAt: null, createdAt: agoDays(60) }],
      asOf,
    )
    expect(old[0]).toMatchObject({ daysSilent: 60, neverContacted: true })
  })

  it('sorts quietest first', () => {
    const stale = findStaleOpportunities(
      [
        {
          id: 'recent',
          name: 'a',
          stage: null,
          lastActivityAt: agoDays(20),
          createdAt: agoDays(90),
        },
        {
          id: 'ancient',
          name: 'b',
          stage: null,
          lastActivityAt: agoDays(200),
          createdAt: agoDays(300),
        },
      ],
      asOf,
    )
    expect(stale.map((s) => s.id)).toEqual(['ancient', 'recent'])
  })

  it('the threshold defaults to 14 days and is a parameter', () => {
    // No scheduler and no time-based trigger exists — `services/rules`
    // evaluates conditions against facts it is handed. So this is a read
    // model with a documented default, not a new automation framework (G2).
    expect(STALE_AFTER_DAYS).toBe(14)
    const item = [
      { id: 'o1', name: 'x', stage: null, lastActivityAt: agoDays(10), createdAt: agoDays(60) },
    ]
    expect(findStaleOpportunities(item, asOf, 7)).toHaveLength(1)
    expect(findStaleOpportunities(item, asOf, 14)).toEqual([])
  })
})
