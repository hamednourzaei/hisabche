import { describe, expect, it } from 'vitest'
import { computeOverheadAllocation, OVERHEAD_BASES } from '../schemas/overhead-allocation'

describe('V61 §2.7 overhead allocation domain', () => {
  it('splits integer minor pool exactly across targets for every basis', () => {
    for (const basis of OVERHEAD_BASES) {
      const res = computeOverheadAllocation({
        basis,
        poolAmountMinor: 1000,
        targets: [
          { dimensionValueId: '11111111-1111-4111-8111-111111111111', driverValue: 1 },
          { dimensionValueId: '22222222-2222-4222-8222-222222222222', driverValue: 2 },
        ],
        manualWeights:
          basis === 'manual'
            ? {
                '11111111-1111-4111-8111-111111111111': 1,
                '22222222-2222-4222-8222-222222222222': 2,
              }
            : undefined,
      })
      expect(res.status).toBe('allocated')
      if (res.status === 'allocated') {
        const sum = res.allocations.reduce((s, a) => s + a.amountMinor, 0)
        expect(sum).toBe(1000)
        expect(res.allocations[0]!.amountMinor).toBe(333)
        expect(res.allocations[1]!.amountMinor).toBe(667)
      }
    }
  })

  it('returns unknown_cost with null allocations when pool or driver is null', () => {
    const res1 = computeOverheadAllocation({
      basis: 'revenue_share',
      poolAmountMinor: null,
      targets: [{ dimensionValueId: '11111111-1111-4111-8111-111111111111', driverValue: 10 }],
    })
    expect(res1).toEqual({ status: 'unknown_cost', allocations: null })

    const res2 = computeOverheadAllocation({
      basis: 'labour_hours',
      poolAmountMinor: 500,
      targets: [{ dimensionValueId: '11111111-1111-4111-8111-111111111111', driverValue: null }],
    })
    expect(res2).toEqual({ status: 'unknown_cost', allocations: null })
  })
})
