// WP-16: core deposit is a liability line, and returning the same core twice
// can never pay twice. The rule only decides the number; it never posts money.

import { describe, expect, it } from 'vitest'
import { buildCoreDepositLine, planCoreRefund } from '../schemas/universal-core/auto-parts.domain'

describe('auto-parts core charge (WP-16)', () => {
  it('builds a separate liability line for a core-tracked part', () => {
    const line = buildCoreDepositLine('p1', 'Alternator', 3, 2500)
    expect(line).toEqual({
      productId: 'p1',
      description: 'Core Deposit: Alternator',
      quantity: 3,
      unitPriceMinor: 2500,
      totalMinor: 7500,
      accountRole: 'core_deposit',
    })
  })

  it('refunds a returned core once, then refuses a second refund', () => {
    expect(
      planCoreRefund({
        depositPerUnitMinor: 2500,
        returnedQuantity: 2,
        alreadyRefundedQuantity: 0,
      }),
    ).toEqual({
      refundMinor: 5000,
      doubleRefundBlocked: false,
    })
    expect(
      planCoreRefund({
        depositPerUnitMinor: 2500,
        returnedQuantity: 2,
        alreadyRefundedQuantity: 1,
      }),
    ).toEqual({
      refundMinor: 2500,
      doubleRefundBlocked: false,
    })
    expect(
      planCoreRefund({
        depositPerUnitMinor: 2500,
        returnedQuantity: 2,
        alreadyRefundedQuantity: 2,
      }),
    ).toEqual({
      refundMinor: 0,
      doubleRefundBlocked: true,
    })
  })

  it('an unknown deposit stays unknown, never zero or invented', () => {
    expect(
      planCoreRefund({
        depositPerUnitMinor: Number.NaN,
        returnedQuantity: 1,
        alreadyRefundedQuantity: 0,
      }).refundMinor,
    ).toBeNull()
  })
})
