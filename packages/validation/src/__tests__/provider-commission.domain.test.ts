// V54 (8 Nov 2026) — provider commission report rules (owner decision N-7).
import { describe, expect, it } from 'vitest'
import { buildProviderCommissionReport } from '../schemas/universal-core/provider-commission.domain'

const prices = new Map([
  ['nails', { priceMinor: 150_000, currency: 'AFN' }],
  ['gel', { priceMinor: 2_000, currency: 'USD' }],
  ['free', { priceMinor: null, currency: 'AFN' }],
])

describe('buildProviderCommissionReport', () => {
  it('counts only delivered sessions, at the rate, in minor units', () => {
    const report = buildProviderCommissionReport(
      [
        { practitionerId: 'zahra', serviceOfferingId: 'nails', status: 'delivered' },
        { practitionerId: 'zahra', serviceOfferingId: 'nails', status: 'delivered' },
        { practitionerId: 'zahra', serviceOfferingId: 'nails', status: 'scheduled' },
        { practitionerId: 'zahra', serviceOfferingId: 'nails', status: 'no_show' },
        { practitionerId: 'zahra', serviceOfferingId: 'nails', status: 'cancelled' },
      ],
      prices,
      new Map([['zahra', 2500]]),
    )
    expect(report.rows).toEqual([
      {
        practitionerId: 'zahra',
        currency: 'AFN',
        sessions: 2,
        baseMinor: 300_000,
        rateBp: 2500,
        commissionMinor: 75_000,
      },
    ])
  })

  it('no rate ⇒ commission unknown (null), never 0', () => {
    const report = buildProviderCommissionReport(
      [{ practitionerId: 'sara', serviceOfferingId: 'nails', status: 'delivered' }],
      prices,
      new Map(),
    )
    expect(report.rows[0]?.rateBp).toBeNull()
    expect(report.rows[0]?.commissionMinor).toBeNull()
  })

  it('a 0% rate is a real zero', () => {
    const report = buildProviderCommissionReport(
      [{ practitionerId: 'sara', serviceOfferingId: 'nails', status: 'delivered' }],
      prices,
      new Map([['sara', 0]]),
    )
    expect(report.rows[0]?.commissionMinor).toBe(0)
  })

  it('never adds two currencies; one row per provider × currency', () => {
    const report = buildProviderCommissionReport(
      [
        { practitionerId: 'zahra', serviceOfferingId: 'nails', status: 'delivered' },
        { practitionerId: 'zahra', serviceOfferingId: 'gel', status: 'delivered' },
      ],
      prices,
      new Map([['zahra', 1000]]),
    )
    expect(report.rows.map((r) => [r.currency, r.baseMinor, r.commissionMinor])).toEqual([
      ['AFN', 150_000, 15_000],
      ['USD', 2_000, 200],
    ])
  })

  it('unpriced and unassigned sessions are counted apart, not as zero', () => {
    const report = buildProviderCommissionReport(
      [
        { practitionerId: 'zahra', serviceOfferingId: 'free', status: 'delivered' },
        { practitionerId: 'zahra', serviceOfferingId: 'gone', status: 'delivered' },
        { practitionerId: null, serviceOfferingId: 'nails', status: 'delivered' },
      ],
      prices,
      new Map([['zahra', 1000]]),
    )
    expect(report.rows).toEqual([])
    expect(report.unpriced).toBe(2)
    expect(report.unassigned).toBe(1)
  })

  it('rounds half away from zero once per row', () => {
    const report = buildProviderCommissionReport(
      [{ practitionerId: 'z', serviceOfferingId: 'odd', status: 'delivered' }],
      new Map([['odd', { priceMinor: 5, currency: 'AFN' }]]),
      new Map([['z', 5000]]),
    )
    expect(report.rows[0]?.commissionMinor).toBe(3)
  })
})
