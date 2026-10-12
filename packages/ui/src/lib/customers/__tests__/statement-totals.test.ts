import { describe, expect, it } from 'vitest'
import { getStatementTotals } from '../statement-totals'

describe('getStatementTotals', () => {
  it('handles 3 currencies with one payment only and no invoices (hand-calculated)', () => {
    // 3 currencies configured, but only USD has an actual payment
    const summary = {
      bookCurrency: 'AFN',
      currencies: ['AFN', 'USD', 'EUR'],
      byCurrency: [
        {
          currency: 'AFN',
          totalSales: 0,
          totalPurchases: 0,
          totalReceived: 0,
          totalPaid: 0,
          openingBalance: 0,
          netBalance: 0,
        },
        {
          currency: 'USD',
          totalSales: 0,
          totalPurchases: 0,
          totalReceived: 500,
          totalPaid: 0,
          openingBalance: 0,
          netBalance: -500,
        },
        {
          currency: 'EUR',
          totalSales: 0,
          totalPurchases: 0,
          totalReceived: 0,
          totalPaid: 0,
          openingBalance: 0,
          netBalance: 0,
        },
      ],
    }

    const ledger = {
      movements: [{ currency: 'USD' }],
    }

    const totals = getStatementTotals(summary, ledger)

    // Hand-calculated: only USD should be returned because AFN and EUR have zero movement
    expect(totals).toHaveLength(1)
    expect(totals[0]).toEqual({
      currency: 'USD',
      totalSales: 0,
      totalPurchases: 0,
      totalReceived: 500,
      totalPaid: 0,
      openingBalance: 0,
      netBalance: -500,
    })
  })

  it('never falls back to top-level summary when byCurrency is missing or empty', () => {
    const mixedSummary = {
      bookCurrency: 'AFN',
      currencies: ['AFN', 'USD'],
      totalSales: 1500,
      totalPurchases: 0,
      totalReceived: 0,
      totalPaid: 0,
      netBalance: 1500,
      byCurrency: [],
    }

    // Must return empty array, NEVER fall back to labelling 1500 as AFN
    expect(getStatementTotals(mixedSummary, null)).toEqual([])
    expect(getStatementTotals(null, null)).toEqual([])
    expect(getStatementTotals(undefined, undefined)).toEqual([])
  })

  it('retains multiple currencies when each has activity', () => {
    const summary = {
      bookCurrency: 'AFN',
      currencies: ['AFN', 'USD'],
      byCurrency: [
        {
          currency: 'AFN',
          totalSales: 1000,
          totalPurchases: 0,
          totalReceived: 1000,
          totalPaid: 0,
          openingBalance: 0,
          netBalance: 0,
        },
        {
          currency: 'USD',
          totalSales: 200,
          totalPurchases: 0,
          totalReceived: 0,
          totalPaid: 0,
          openingBalance: 0,
          netBalance: 200,
        },
      ],
    }

    const totals = getStatementTotals(summary, null)
    expect(totals).toHaveLength(2)
    expect(totals.map((t) => t.currency)).toEqual(['AFN', 'USD'])
    expect(totals[0]?.totalSales).toBe(1000)
    expect(totals[1]?.totalSales).toBe(200)
  })
})
