import { describe, expect, it } from 'vitest'
import {
  crossExchangeAtRates,
  parseRate,
  partnerBalances,
  rateBoardRefusal,
  reconcileCurrencyCashbox,
  resolveOfflineFxConflict,
  summarizeExchangeOperations,
  tradeRefusal,
} from '../index'

describe('currency exchange workflows (V59 8.6)', () => {
  it('converts across two foreign currencies via book currency and returns null when a rate is missing', () => {
    const usdToAfn = parseRate('70')!
    const eurToAfn = parseRate('77')!
    // 110.00 USD -> 7700 AFN -> 100.00 EUR
    const res = crossExchangeAtRates({
      amountMinor: 11_000,
      fromCurrency: 'USD',
      toCurrency: 'EUR',
      bookCurrency: 'AFN',
      fromRateToBookMicro: usdToAfn,
      bookToTargetRateMicro: eurToAfn,
    })
    expect(res).not.toBeNull()
    expect(res!.intermediateBookMinor).toBe(7_700)
    expect(res!.targetMinor).toBe(10_000)

    expect(
      crossExchangeAtRates({
        amountMinor: 11_000,
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        bookCurrency: 'AFN',
        fromRateToBookMicro: usdToAfn,
        bookToTargetRateMicro: null,
      }),
    ).toBeNull()
  })

  it('reconciles cashbox strictly per currency and preserves unknown instead of zero', () => {
    expect(reconcileCurrencyCashbox(50_000, 50_000, 'usd')).toEqual({
      currency: 'USD',
      expectedMinor: 50_000,
      countedMinor: 50_000,
      varianceMinor: 0,
      status: 'matched',
    })
    expect(reconcileCurrencyCashbox(50_000, 48_000, 'USD')).toEqual({
      currency: 'USD',
      expectedMinor: 50_000,
      countedMinor: 48_000,
      varianceMinor: -2_000,
      status: 'short',
    })
    expect(reconcileCurrencyCashbox(50_000, 52_500, 'EUR')).toEqual({
      currency: 'EUR',
      expectedMinor: 50_000,
      countedMinor: 52_500,
      varianceMinor: 2_500,
      status: 'over',
    })
    expect(reconcileCurrencyCashbox(null, 100, 'USD')).toEqual({
      currency: 'USD',
      expectedMinor: null,
      countedMinor: 100,
      varianceMinor: null,
      status: 'unknown',
    })
  })

  it('routes offline queued FX sells that exceed server holdings to PENDING_REVIEW', () => {
    expect(
      resolveOfflineFxConflict({
        localTradeId: 'tx-1',
        requestedSide: 'sell',
        requestedAmountMinor: 10_000,
        serverHeldMinor: 4_000,
      }),
    ).toEqual({
      localTradeId: 'tx-1',
      resolution: 'PENDING_REVIEW',
      reason: 'FX_OFFLINE_POSITION_SHORT',
      shortfallMinor: 6_000,
    })

    expect(
      resolveOfflineFxConflict({
        localTradeId: 'tx-2',
        requestedSide: 'buy',
        requestedAmountMinor: 10_000,
        serverHeldMinor: 0,
      }),
    ).toEqual({
      localTradeId: 'tx-2',
      resolution: 'APPLY',
      reason: null,
      shortfallMinor: 0,
    })
  })

  it('summarizes FX trades and open remittances grouped strictly by currency', () => {
    const summary = summarizeExchangeOperations({
      bookCurrency: 'AFN',
      trades: [
        {
          id: '1',
          side: 'buy',
          currency: 'USD',
          amountMinor: 10_000,
          rateMicro: parseRate('70')!,
          bookAmountMinor: 7_000,
          status: 'posted',
          createdAt: '2026-11-11T08:00:00Z',
        },
        {
          id: '2',
          side: 'sell',
          currency: 'USD',
          amountMinor: 6_000,
          rateMicro: parseRate('72')!,
          bookAmountMinor: 4_320,
          status: 'posted',
          createdAt: '2026-11-11T09:00:00Z',
        },
        {
          id: '3',
          side: 'buy',
          currency: 'EUR',
          amountMinor: 5_000,
          rateMicro: parseRate('77')!,
          bookAmountMinor: 3_850,
          status: 'posted',
          createdAt: '2026-11-11T09:30:00Z',
        },
      ],
      remittances: [
        {
          counterparty: 'Herat',
          direction: 'outgoing',
          status: 'sent',
          currency: 'USD',
          amountMinor: 25_000,
        },
        {
          counterparty: 'Herat',
          direction: 'incoming',
          status: 'paid',
          currency: 'EUR',
          amountMinor: 10_000,
        },
      ],
      cashboxVariances: [
        { currency: 'USD', varianceMinor: 0 },
        { currency: 'EUR', varianceMinor: -500 },
      ],
      pendingReviewCount: 1,
    })

    expect(summary.currencies).toHaveLength(2)
    const usd = summary.currencies.find((c) => c.currency === 'USD')!
    expect(usd.heldMinor).toBe(4_000)
    expect(usd.realizedBookMinor).toBe(120)
    expect(summary.openRemittancesByCurrency).toEqual([
      { currency: 'USD', openCount: 1, openAmountMinor: 25_000 },
    ])
    expect(summary.unreconciledCurrencies).toEqual(['EUR'])
    expect(summary.pendingReviewCount).toBe(1)
    expect(
      partnerBalances([
        {
          counterparty: 'Herat',
          direction: 'incoming',
          status: 'paid',
          currency: 'EUR',
          amountMinor: 10_000,
        },
      ]),
    ).toEqual([{ counterparty: 'Herat', currency: 'EUR', balanceMinor: 10_000 }])
  })

  it('refuses inverted rate spreads and missing KYC identity above threshold', () => {
    expect(rateBoardRefusal({ currency: 'USD', buyRate: '72', sellRate: '70' })).toBe(
      'FX_RATE_SPREAD_NEGATIVE',
    )
    expect(
      tradeRefusal({
        trade: { side: 'buy', currency: 'USD', amountMinor: 10_000, rate: '70' },
        bookCurrency: 'AFN',
        bookAmountMinor: 7_000,
        kycThresholdMinor: 5_000,
      }),
    ).toBe('FX_KYC_REQUIRED')
  })
})
