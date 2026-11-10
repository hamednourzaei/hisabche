// ============================================
// The rules of the QA document's business packs (10 Nov 2026): clothing
// grid and variant stock, repair moves, money changer (rate maths, average
// cost, partner balances), salon (overlap, commission). Numbers checked by
// hand in the comments — a test that only echoes the code proves nothing.
// ============================================

import { describe, expect, it } from 'vitest'
import {
  canMoveRepair,
  checkVariantStockMove,
  commissionReport,
  convertAtRate,
  expandVariantMatrix,
  formatRate,
  identityRequired,
  parseRate,
  partnerBalances,
  positionsFrom,
  rateBoardRefusal,
  remittanceMoveRefusal,
  repairEstimateRefusal,
  repairMoveRefusal,
  sessionsOverlap,
  summarizeVariantStock,
  totalsByAttribute,
  tradeRefusal,
  warrantyState,
  type FxTradeRow,
} from '../index'

describe('clothing: the size × colour grid', () => {
  it('makes every cell once, and skips the cells the product already has', () => {
    const input = {
      axes: [
        { name: 'Size', values: ['S', 'M'] },
        { name: 'Colour', values: ['Black', 'White'] },
      ],
      skuPrefix: 'TS',
    }
    const first = expandVariantMatrix(input, [])
    expect(first.ok && first.cells.map((c) => c.sku)).toEqual([
      'TS-S-BLACK',
      'TS-S-WHITE',
      'TS-M-BLACK',
      'TS-M-WHITE',
    ])
    // Run again with one cell already there (written in another order): 3 new, 1 skipped.
    const again = expandVariantMatrix(input, [
      {
        sku: 'old',
        attributes: [
          { name: 'colour', value: 'black' },
          { name: 'size', value: 's' },
        ],
      },
    ])
    expect(again.ok && again.cells.length).toBe(3)
    expect(again.ok && again.skipped).toBe(1)
  })

  it('refuses a repeated value and a grid over 300 cells', () => {
    expect(
      expandVariantMatrix({ axes: [{ name: 'Size', values: ['L', 'l'] }], skuPrefix: 'X' }, []),
    ).toEqual({ ok: false, code: 'VARIANT_MATRIX_DUPLICATE_VALUE' })
    const many = Array.from({ length: 20 }, (_, i) => `v${i}`)
    const big = expandVariantMatrix(
      {
        axes: [
          { name: 'A', values: many },
          { name: 'B', values: many },
        ],
        skuPrefix: 'X',
      },
      [],
    )
    expect(big).toEqual({ ok: false, code: 'VARIANT_MATRIX_TOO_LARGE' })
  })

  it('assign uses only what is on no variant; remove only what the variant holds', () => {
    // Product 10 in the warehouse, 7 already on variants → 3 free.
    const base = { productOnHand: 10, variantsOnHand: 7, variantOnHand: 2 }
    expect(checkVariantStockMove({ ...base, mode: 'assign', quantity: 3 })).toBeNull()
    expect(checkVariantStockMove({ ...base, mode: 'assign', quantity: 4 })).toBe(
      'VARIANT_STOCK_NOT_ENOUGH_UNASSIGNED',
    )
    expect(checkVariantStockMove({ ...base, mode: 'remove', quantity: 3 })).toBe(
      'VARIANT_STOCK_NOT_ENOUGH',
    )
    expect(checkVariantStockMove({ ...base, mode: 'receive', quantity: 99 })).toBeNull()
  })

  it('reads stock per variant and totals all size L whatever the colour', () => {
    const lines = summarizeVariantStock(
      [
        {
          id: 'a',
          sku: 'L-B',
          attributes: [
            { name: 'Size', value: 'L' },
            { name: 'Colour', value: 'Black' },
          ],
        },
        {
          id: 'b',
          sku: 'L-W',
          attributes: [
            { name: 'Size', value: 'L' },
            { name: 'Colour', value: 'White' },
          ],
        },
        {
          id: 'c',
          sku: 'M-B',
          attributes: [
            { name: 'Size', value: 'M' },
            { name: 'Colour', value: 'Black' },
          ],
        },
      ],
      [
        { variantId: 'a', warehouseId: 'w1', quantity: 3 },
        { variantId: 'a', warehouseId: 'w2', quantity: 1 },
        { variantId: 'b', warehouseId: 'w1', quantity: 2 },
      ],
      new Map([['a', 5]]),
    )
    expect(lines.map((l) => [l.variantId, l.onHand, l.sold])).toEqual([
      ['a', 4, 5],
      ['b', 2, 0],
      ['c', 0, 0],
    ])
    expect(totalsByAttribute(lines, 'size')).toEqual([
      { value: 'L', onHand: 6, sold: 5 },
      { value: 'M', onHand: 0, sold: 0 },
    ])
  })
})

describe('mobile: repair slip', () => {
  it('moves forward, can wait for parts, and never leaves delivered or cancelled', () => {
    expect(canMoveRepair('received', 'diagnosing')).toBe(true)
    expect(canMoveRepair('repairing', 'waiting_parts')).toBe(true)
    expect(canMoveRepair('ready', 'delivered')).toBe(true)
    expect(canMoveRepair('received', 'delivered')).toBe(false)
    expect(canMoveRepair('delivered', 'repairing')).toBe(false)
    expect(canMoveRepair('cancelled', 'received')).toBe(false)
  })

  it('a cancel needs a note; an invoice only on delivery; an estimate needs its currency', () => {
    expect(repairMoveRefusal('received', { status: 'cancelled' })).toBe(
      'REPAIR_CANCEL_NOTE_REQUIRED',
    )
    expect(
      repairMoveRefusal('diagnosing', {
        status: 'ready',
        invoiceId: '9d1c5f3a-1b2c-4d5e-8f90-123456789abc',
      }),
    ).toBe('REPAIR_INVOICE_ONLY_ON_DELIVERY')
    expect(repairEstimateRefusal({ estimateMinor: 500, currency: null })).toBe(
      'REPAIR_ESTIMATE_CURRENCY_REQUIRED',
    )
    expect(repairEstimateRefusal({ estimateMinor: null, currency: null })).toBeNull()
  })

  it('warranty: no record is unknown, never «under warranty»', () => {
    expect(warrantyState(null, '2026-11-10')).toBe('unknown')
    expect(warrantyState('2026-11-10', '2026-11-10')).toBe('active')
    expect(warrantyState('2026-11-09T00:00:00Z', '2026-11-10')).toBe('expired')
  })
})

describe('money changer', () => {
  it('reads a rate exactly (Persian digits and ٫), and refuses what is not one', () => {
    expect(parseRate('70.25')).toBe(70_250_000n)
    expect(parseRate('۷۰٫۲۵')).toBe(70_250_000n)
    expect(parseRate('0')).toBeNull()
    expect(parseRate('7.1234567')).toBeNull()
    expect(formatRate(70_250_000n)).toBe('70.25')
  })

  it('converts in whole minor units: $100.00 at 70.25 = 7,025 AFN (0 digits)', () => {
    expect(convertAtRate(10_000, 70_250_000n, 'USD', 'AFN')).toBe(7_025)
    // 1,000 AFN at 0.0142 USD/AFN = 14.20 USD → 1,420 cents.
    expect(convertAtRate(1_000, 14_200n, 'AFN', 'USD')).toBe(1_420)
  })

  it('a board that sells below its buy price is refused', () => {
    expect(rateBoardRefusal({ currency: 'USD', buyRate: '71', sellRate: '70.5' })).toBe(
      'FX_RATE_SPREAD_NEGATIVE',
    )
    expect(rateBoardRefusal({ currency: 'USD', buyRate: '70', sellRate: '70.5' })).toBeNull()
  })

  it('identity: at or above the threshold; never when none is set', () => {
    expect(identityRequired(null, 10 ** 12)).toBe(false)
    expect(identityRequired(100_000, 100_000)).toBe(true)
    expect(
      tradeRefusal({
        trade: { side: 'buy', currency: 'USD', amountMinor: 1, rate: '70' },
        bookCurrency: 'AFN',
        bookAmountMinor: 200_000,
        kycThresholdMinor: 100_000,
      }),
    ).toBe('FX_KYC_REQUIRED')
    expect(
      tradeRefusal({
        trade: { side: 'buy', currency: 'AFN', amountMinor: 1, rate: '1' },
        bookCurrency: 'AFN',
        bookAmountMinor: 1,
        kycThresholdMinor: null,
      }),
    ).toBe('FX_SAME_AS_BOOK_CURRENCY')
  })

  it('average cost and realized spread, by hand', () => {
    const t = (
      id: string,
      side: FxTradeRow['side'],
      amountMinor: number,
      book: number,
      at: string,
    ): FxTradeRow => ({
      id,
      side,
      currency: 'USD',
      amountMinor,
      rateMicro: 1n,
      bookAmountMinor: book,
      status: 'posted',
      createdAt: at,
    })
    // Buy $100 for 7,000 AFN, buy $100 for 7,200 → $200 held, cost 14,200 (avg 71).
    // Sell $50 for 3,650 → cost out 14,200 × 50/200 = 3,550; realized 100.
    const [usd] = positionsFrom(
      [
        t('1', 'buy', 10_000, 7_000, '2026-11-01'),
        t('2', 'buy', 10_000, 7_200, '2026-11-02'),
        t('3', 'sell', 5_000, 3_650, '2026-11-03'),
        { ...t('4', 'buy', 99_999, 1, '2026-11-04'), status: 'voided' },
      ],
      'AFN',
    )
    expect(usd).toMatchObject({
      currency: 'USD',
      heldMinor: 15_000,
      costMinor: 10_650,
      realizedMinor: 100,
      shortMinor: 0,
    })
    // 10,650 AFN / $150 = 71 AFN per dollar.
    expect(usd?.averageRateMicro).toBe(71_000_000n)
  })

  it('hawala: an incoming payout needs its code; partner balance from paid ones only', () => {
    expect(remittanceMoveRefusal('incoming', 'created', { status: 'paid' })).toBe(
      'REMITTANCE_CODE_REQUIRED',
    )
    expect(remittanceMoveRefusal('incoming', 'created', { status: 'sent' })).toBe(
      'REMITTANCE_MOVE_NOT_ALLOWED',
    )
    expect(remittanceMoveRefusal('outgoing', 'paid', { status: 'cancelled', reason: 'x' })).toBe(
      'REMITTANCE_MOVE_NOT_ALLOWED',
    )
    expect(
      partnerBalances([
        {
          counterparty: 'Herat',
          direction: 'incoming',
          status: 'paid',
          currency: 'USD',
          amountMinor: 500,
        },
        {
          counterparty: 'herat ',
          direction: 'outgoing',
          status: 'paid',
          currency: 'USD',
          amountMinor: 200,
        },
        {
          counterparty: 'Herat',
          direction: 'outgoing',
          status: 'sent',
          currency: 'USD',
          amountMinor: 9_999,
        },
      ]),
    ).toEqual([{ counterparty: 'Herat', currency: 'USD', balanceMinor: 300 }])
  })
})

describe('salon', () => {
  it('touching sessions do not overlap; crossing ones do', () => {
    expect(
      sessionsOverlap({ start: '10:00', end: '11:00' }, { start: '11:00', end: '12:00' }),
    ).toBe(false)
    expect(
      sessionsOverlap({ start: '10:00:00', end: '11:00:00' }, { start: '10:30', end: '10:45' }),
    ).toBe(true)
  })

  it('commission: unknown charge is counted not valued; no rate is null, not zero', () => {
    const lines = commissionReport(
      [
        { practitionerId: 'p1', currency: 'AFN', chargedMinor: 1_000 },
        { practitionerId: 'p1', currency: 'AFN', chargedMinor: 500 },
        { practitionerId: 'p1', currency: 'AFN', chargedMinor: null },
        { practitionerId: 'p2', currency: 'AFN', chargedMinor: 800 },
        { practitionerId: null, currency: 'AFN', chargedMinor: 9_999 },
      ],
      new Map([['p1', 3_500]]),
    )
    expect(lines).toEqual([
      {
        practitionerId: 'p1',
        currency: 'AFN',
        sessions: 3,
        unknownSessions: 1,
        baseMinor: 1_500,
        rateBp: 3_500,
        commissionMinor: 525,
      },
      {
        practitionerId: 'p2',
        currency: 'AFN',
        sessions: 1,
        unknownSessions: 0,
        baseMinor: 800,
        rateBp: null,
        commissionMinor: null,
      },
    ])
  })
})
