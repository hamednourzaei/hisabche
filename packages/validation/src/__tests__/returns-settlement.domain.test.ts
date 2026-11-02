// ============================================
// What a return costs the customer and what is owed back — the pure rules.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  computeReturnDeductions,
  DEDUCTION_REASONS,
  previewReturn,
  proportionalReturnTaxMinor,
  refundableMinor,
  returnNetCreditMinor,
  returnPolicyFor,
  returnRefundStatus,
  RETURN_CONDITIONS,
} from '../schemas/universal-core'
import { returnEffectOfInvoice } from '../schemas/payments.domain'
import { buildPartySummary } from '../schemas/party-statement'

describe('computeReturnDeductions', () => {
  it('takes 30% of the net goods, once, in minor units', () => {
    const result = computeReturnDeductions(
      10000,
      [{ reason: 'return_fee', mode: 'percent', percent: 30 }],
      2,
    )
    expect(result.totalMinor).toBe(3000)
    expect(result.rows).toEqual([
      { reason: 'return_fee', mode: 'percent', percent: 30, amountMinor: 3000, note: '' },
    ])
  })

  it('a fixed amount is in major units of the invoice currency', () => {
    expect(
      computeReturnDeductions(10000, [{ reason: 'damage', mode: 'fixed', amount: 12.5 }], 2)
        .totalMinor,
    ).toBe(1250)
    // a currency with no decimals
    expect(
      computeReturnDeductions(500, [{ reason: 'damage', mode: 'fixed', amount: 120 }], 0)
        .totalMinor,
    ).toBe(120)
  })

  it('several deductions add up, and each percentage is of the SAME base (order does not matter)', () => {
    const a = computeReturnDeductions(
      10000,
      [
        { reason: 'return_fee', mode: 'percent', percent: 10 },
        { reason: 'damage', mode: 'percent', percent: 20 },
      ],
      2,
    )
    const b = computeReturnDeductions(
      10000,
      [
        { reason: 'damage', mode: 'percent', percent: 20 },
        { reason: 'return_fee', mode: 'percent', percent: 10 },
      ],
      2,
    )
    expect(a.totalMinor).toBe(3000)
    expect(b.totalMinor).toBe(3000)
  })

  it('no deductions is no deduction', () => {
    expect(computeReturnDeductions(10000, undefined, 2)).toEqual({ rows: [], totalMinor: 0 })
    expect(computeReturnDeductions(10000, [], 2).totalMinor).toBe(0)
  })

  it('refuses what cannot be explained or computed', () => {
    const attempt = (request: Parameters<typeof computeReturnDeductions>[1]) => () =>
      computeReturnDeductions(10000, request, 2)
    expect(attempt([{ reason: 'other', mode: 'fixed', amount: 5 }])).toThrow(
      'RETURN_DEDUCTION_NOTE_REQUIRED',
    )
    expect(attempt([{ reason: 'other', mode: 'fixed', amount: 5, note: '   ' }])).toThrow(
      'RETURN_DEDUCTION_NOTE_REQUIRED',
    )
    expect(attempt([{ reason: 'agreed', mode: 'percent', percent: 0 }])).toThrow(
      'RETURN_DEDUCTION_PERCENT_INVALID',
    )
    expect(attempt([{ reason: 'agreed', mode: 'percent', percent: 100.5 }])).toThrow(
      'RETURN_DEDUCTION_PERCENT_INVALID',
    )
    expect(attempt([{ reason: 'agreed', mode: 'percent' }])).toThrow(
      'RETURN_DEDUCTION_PERCENT_INVALID',
    )
    expect(attempt([{ reason: 'agreed', mode: 'fixed', amount: -1 }])).toThrow(
      'RETURN_DEDUCTION_AMOUNT_INVALID',
    )
    expect(attempt([{ reason: 'agreed', mode: 'fixed' }])).toThrow(
      'RETURN_DEDUCTION_AMOUNT_INVALID',
    )
    expect(attempt([{ reason: 'nonsense' as never, mode: 'fixed', amount: 1 }])).toThrow(
      'RETURN_DEDUCTION_REASON_INVALID',
    )
    expect(attempt([{ reason: 'agreed', mode: 'half' as never, amount: 1 }])).toThrow(
      'RETURN_DEDUCTION_MODE_INVALID',
    )
  })

  it('a deduction that rounds to nothing is refused, not silently dropped', () => {
    expect(() =>
      computeReturnDeductions(10, [{ reason: 'agreed', mode: 'percent', percent: 1 }], 2),
    ).toThrow('RETURN_DEDUCTION_AMOUNT_INVALID')
  })

  it('the shop can keep everything but never more than the goods', () => {
    expect(
      computeReturnDeductions(10000, [{ reason: 'agreed', mode: 'percent', percent: 100 }], 2)
        .totalMinor,
    ).toBe(10000)
    expect(() =>
      computeReturnDeductions(
        10000,
        [
          { reason: 'agreed', mode: 'percent', percent: 60 },
          { reason: 'damage', mode: 'percent', percent: 41 },
        ],
        2,
      ),
    ).toThrow('RETURN_DEDUCTION_EXCEEDS_BASE')
  })

  it('every reason has a place in the list the database and the labels share', () => {
    expect([...DEDUCTION_REASONS]).toEqual([
      'return_fee',
      'repackaging',
      'damage',
      'usage',
      'missing_parts',
      'agreed',
      'other',
    ])
    expect([...RETURN_CONDITIONS]).toEqual([
      'sealed',
      'opened',
      'used',
      'damaged',
      'defective',
      'incomplete',
    ])
  })
})

describe('proportionalReturnTaxMinor', () => {
  it('a part of the goods carries the same part of the tax', () => {
    // 1 000.00 net, 100.00 tax → 200.00 of goods carries 20.00
    expect(proportionalReturnTaxMinor(20000, 10000, 100000)).toBe(2000)
  })

  it('returning every line returns the whole tax', () => {
    const lines = [33333, 33333, 33334]
    const tax = lines.reduce((sum, net) => sum + proportionalReturnTaxMinor(net, 1001, 100000), 0)
    // rounding per line may differ by one minor unit from the invoice's tax — never by more
    expect(Math.abs(tax - 1001)).toBeLessThanOrEqual(1)
    expect(proportionalReturnTaxMinor(100000, 1001, 100000)).toBe(1001)
  })

  it('no tax, no base or nothing returned is no tax', () => {
    expect(proportionalReturnTaxMinor(100, 0, 1000)).toBe(0)
    expect(proportionalReturnTaxMinor(100, 10, 0)).toBe(0)
    expect(proportionalReturnTaxMinor(0, 10, 1000)).toBe(0)
  })
})

describe('returnNetCreditMinor', () => {
  it('goods - discount + tax - what the shop keeps', () => {
    expect(
      returnNetCreditMinor({
        subtotalMinor: 20000,
        discountMinor: 0,
        taxMinor: 2000,
        deductionMinor: 6000,
      }),
    ).toBe(16000)
    expect(
      returnNetCreditMinor({
        subtotalMinor: 20000,
        discountMinor: 2000,
        taxMinor: 1800,
        deductionMinor: 0,
      }),
    ).toBe(19800)
  })
})

describe('refundableMinor — only money the customer really gave', () => {
  const base = { invoiceTotalMinor: 110000, refundedMinor: 0 }

  it('a fully paid invoice: the whole credit can go back', () => {
    expect(refundableMinor({ ...base, invoicePaidMinor: 110000, netCreditMinor: 16000 })).toBe(
      16000,
    )
  })

  it('an unpaid invoice: the credit only lowers the debt, nothing to hand over', () => {
    expect(refundableMinor({ ...base, invoicePaidMinor: 0, netCreditMinor: 16000 })).toBe(0)
  })

  it('part paid: the credit beyond the debt it cancelled', () => {
    // 1 100 owed, 400 paid → 700 still owed; a return worth 880 cancels 700, leaves 180
    expect(refundableMinor({ ...base, invoicePaidMinor: 40000, netCreditMinor: 88000 })).toBe(18000)
  })

  it('what was already refunded or is reserved is not offered again', () => {
    const input = { ...base, invoicePaidMinor: 110000, netCreditMinor: 16000 }
    expect(refundableMinor({ ...input, refundedMinor: 10000 })).toBe(6000)
    expect(refundableMinor({ ...input, refundedMinor: 10000, pendingMinor: 6000 })).toBe(0)
    expect(refundableMinor({ ...input, refundedMinor: 20000 })).toBe(0)
  })

  it('agrees with returnEffectOfInvoice, its major-unit twin', () => {
    for (const [total, paid, returned, refunded] of [
      [1100, 1100, 160, 0],
      [1100, 0, 160, 0],
      [1100, 400, 880, 0],
      [1100, 1100, 160, 100],
      [1100, 400, 880, 180],
    ] as const) {
      const major = returnEffectOfInvoice(total, paid, returned, refunded).credit
      const minor = refundableMinor({
        invoiceTotalMinor: total * 100,
        invoicePaidMinor: paid * 100,
        netCreditMinor: returned * 100,
        refundedMinor: refunded * 100,
      })
      expect(minor / 100).toBe(major)
    }
  })
})

describe('returnRefundStatus', () => {
  const input = { invoiceTotalMinor: 110000, invoicePaidMinor: 110000, netCreditMinor: 16000 }
  it('walks not_due → pending → partial → refunded', () => {
    expect(returnRefundStatus({ ...input, invoicePaidMinor: 0, refundedMinor: 0 })).toBe('not_due')
    expect(returnRefundStatus({ ...input, refundedMinor: 0 })).toBe('pending')
    expect(returnRefundStatus({ ...input, refundedMinor: 5000 })).toBe('partial')
    expect(returnRefundStatus({ ...input, refundedMinor: 16000 })).toBe('refunded')
  })
})

describe('returnPolicyFor — a default for the form, never a refusal', () => {
  it('a hardware shop shelves a sealed or opened box again, not a used or broken one', () => {
    const policy = returnPolicyFor(['hardware'])
    expect(policy.defaultDestination('sealed')).toBe('restock')
    expect(policy.defaultDestination('opened')).toBe('restock')
    expect(policy.defaultDestination('used')).toBe('scrap')
    expect(policy.defaultDestination('damaged')).toBe('scrap')
    expect(policy.defaultDestination('defective')).toBe('scrap')
    expect(policy.defaultDestination('incomplete')).toBe('scrap')
  })

  it('a bakery, a pharmacy and a cosmetics shop shelve only what is still sealed', () => {
    for (const key of ['bakery', 'pharmacy', 'cosmetics', 'dairy', 'butcher']) {
      const policy = returnPolicyFor([key])
      expect(policy.defaultDestination('sealed'), key).toBe('restock')
      expect(policy.defaultDestination('opened'), key).toBe('scrap')
    }
  })

  it('a business of several trades takes the most careful default among them', () => {
    expect(returnPolicyFor(['hardware', 'grocery']).defaultDestination('opened')).toBe('restock')
    expect(returnPolicyFor(['hardware', 'bakery']).defaultDestination('opened')).toBe('scrap')
  })

  it('the sales model alone says nothing about the goods', () => {
    expect(returnPolicyFor(['retail']).defaultDestination('opened')).toBe('restock')
    expect(returnPolicyFor(['wholesale', 'clothing']).defaultDestination('opened')).toBe('restock')
  })

  it('a trade that sells time has no shelf', () => {
    const policy = returnPolicyFor(['consulting', 'education'])
    expect(policy.goodsGoBackOnShelf).toBe(false)
    expect(policy.defaultDestination('sealed')).toBe('scrap')
  })

  it('no trade chosen: the general default, with a shelf', () => {
    const policy = returnPolicyFor(undefined)
    expect(policy.goodsGoBackOnShelf).toBe(true)
    expect(policy.shelvedByDefault).toEqual(['sealed', 'opened'])
  })
})

describe('a refund lowers the credit a customer is owed, never the debt', () => {
  it('returnEffectOfInvoice takes refunded cash off the credit only', () => {
    expect(returnEffectOfInvoice(100, 100, 30, 0)).toEqual({
      outstanding: 0,
      applied: 0,
      credit: 30,
    })
    expect(returnEffectOfInvoice(100, 100, 30, 12)).toEqual({
      outstanding: 0,
      applied: 0,
      credit: 18,
    })
    expect(returnEffectOfInvoice(100, 100, 30, 99)).toEqual({
      outstanding: 0,
      applied: 0,
      credit: 0,
    })
    // debt a return cancelled stays cancelled whatever was refunded
    expect(returnEffectOfInvoice(100, 0, 30, 30)).toEqual({
      outstanding: 70,
      applied: 30,
      credit: 0,
    })
  })

  it('the party summary: a refunded return no longer shows as owed to the customer', () => {
    const summary = (refundedMinor: number) =>
      buildPartySummary({
        rows: {
          invoices: [
            {
              id: 'inv-1',
              type: 'sale',
              status: 'pending',
              total: 100,
              paid_amount: 100,
              date: '2026-10-01',
              due_date: '2026-10-10',
              currency: 'AFN',
            },
          ],
          payments: [],
          returns: [
            {
              id: 'ret-1',
              original_invoice_id: 'inv-1',
              return_type: 'sale_return',
              return_number: 'RET-1',
              return_date: '2026-10-20',
              grand_total_minor: 30,
              refunded_minor: refundedMinor,
              currency: 'AFN',
            },
          ],
          openingBalance: 0,
        },
        bookCurrency: 'AFN',
        asOf: '2026-10-28',
      })
    expect(summary(0).returnCredit).toBe(30)
    expect(summary(0).netBalance).toBe(-30)
    expect(summary(12).returnCredit).toBe(18)
    expect(summary(12).netBalance).toBe(-18)
    expect(summary(30).returnCredit).toBe(0)
    expect(summary(30).netBalance).toBe(0)
  })
})

describe('previewReturn — the form shows what the database will book', () => {
  // 1 000.00 net + 100.00 tax, two lines of 5 × 100.00
  const items = [
    { id: 'a', quantity: 5, unitPrice: 100, discount: 0 },
    { id: 'b', quantity: 5, unitPrice: 100, discount: 0 },
  ]
  const base = { items, invoiceTax: 100, fractionDigits: 2 }

  it('two of the first line with a 30% deduction: the same figures the migration test books', () => {
    const preview = previewReturn({
      ...base,
      picked: { a: 2 },
      deductions: [{ reason: 'return_fee', mode: 'percent', percent: 30 }],
    })
    expect(preview).toEqual({
      subtotalMinor: 20000,
      discountMinor: 0,
      taxMinor: 2000,
      deductionMinor: 6000,
      creditMinor: 16000,
      error: null,
    })
  })

  it('several lines add up, and everything back returns the whole tax', () => {
    const preview = previewReturn({ ...base, picked: { a: 5, b: 5 }, deductions: [] })
    expect(preview.taxMinor).toBe(10000)
    expect(preview.creditMinor).toBe(110000)
  })

  it('a line discount is returned in proportion', () => {
    const preview = previewReturn({
      items: [{ id: 'a', quantity: 4, unitPrice: 50, discount: 20 }],
      picked: { a: 2 },
      invoiceTax: 0,
      deductions: [],
      fractionDigits: 2,
    })
    // 2 × 50 = 100.00, a tenth of the 200.00 gross is the discount share: 10.00
    expect(preview).toMatchObject({ subtotalMinor: 10000, discountMinor: 1000, creditMinor: 9000 })
  })

  it('nothing picked is nothing to return', () => {
    expect(previewReturn({ ...base, picked: {}, deductions: [] }).creditMinor).toBe(0)
    expect(previewReturn({ ...base, picked: { a: 0 }, deductions: [] }).creditMinor).toBe(0)
  })

  it('a deduction that cannot be taken is named, and not counted', () => {
    const preview = previewReturn({
      ...base,
      picked: { a: 1 },
      deductions: [{ reason: 'damage', mode: 'fixed', amount: 500 }],
    })
    expect(preview.error).toBe('RETURN_DEDUCTION_EXCEEDS_BASE')
    expect(preview.deductionMinor).toBe(0)
    expect(preview.creditMinor).toBe(11000)
  })
})
