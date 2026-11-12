import { describe, expect, it } from 'vitest'
import { computeCustomerRfmByCurrency } from '@hisabche/validation'

describe('B.2.15 & B.2.16 RFM segmentation & SMS outbox', () => {
  it('computes RFM per currency without summing across currencies and marks zero-sale customers as no_data', () => {
    const rows = computeCustomerRfmByCurrency(
      ['c1', 'c2'],
      [
        { customerId: 'c1', currency: 'AFN', date: '2026-05-20', totalMinor: 10_000 },
        { customerId: 'c1', currency: 'AFN', date: '2026-05-25', totalMinor: 20_000 },
        { customerId: 'c1', currency: 'AFN', date: '2026-05-30', totalMinor: 30_000 },
        { customerId: 'c1', currency: 'USD', date: '2026-05-28', totalMinor: 5_000 },
      ],
      '2026-06-01',
      'AFN',
    )

    const c1Afn = rows.find((r) => r.customerId === 'c1' && r.currency === 'AFN')
    const c1Usd = rows.find((r) => r.customerId === 'c1' && r.currency === 'USD')
    const c2 = rows.find((r) => r.customerId === 'c2')

    expect(c1Afn?.monetaryMinor).toBe(60_000)
    expect(c1Afn?.segment).toBe('champions')
    expect(c1Usd?.monetaryMinor).toBe(5_000)
    expect(c2?.segment).toBe('no_data')
  })
})
