// ============================================
// REGRESSION — dashboard KPIs must never add money in different currencies.
//
// `getDashboardKpis` summed `inv.total` across every invoice with no regard
// for `invoices.currency`. A 100 USD invoice and a 100 AFN invoice were
// reported as "200" — a figure in no currency at all, shown to a shopkeeper as
// their sales, their debt and their payables.
//
// The fix decomposes rather than converts. There is no working exchange-rate
// source in this repo (`fetchRates` in packages/store/src/slices/
// currency.slice.ts is a stub), and converting at invented rates would replace
// an obviously odd number with a confidently wrong one.
// ============================================

import { describe, expect, it } from 'vitest'

import { bucketKpisByCurrency, type KpiInvoiceRow } from '../services/analytics.service'

const TODAY = new Date('2026-08-19T00:00:00.000Z')
const todayStart = TODAY.toISOString()
const firstOfThisMonth = new Date('2026-08-01T00:00:00.000Z')

const bucket = (rows: readonly KpiInvoiceRow[]) =>
  bucketKpisByCurrency(rows, todayStart, firstOfThisMonth)

describe('money in different currencies is never added together', () => {
  it('keeps 100 USD and 100 AFN apart instead of reporting 200', () => {
    const result = bucket([
      { total: 100, currency: 'USD', status: 'pending' },
      { total: 100, currency: 'AFN', status: 'pending' },
    ])

    expect(result.USD?.totalSales).toBe(100)
    expect(result.AFN?.totalSales).toBe(100)
    expect(Object.keys(result).sort()).toEqual(['AFN', 'USD'])
  })

  it('keeps customer debt per currency — the figure that was most wrong', () => {
    const result = bucket([
      { total: 100, paid_amount: 20, currency: 'USD', status: 'pending' },
      { total: 500, paid_amount: 0, currency: 'AFN', status: 'pending' },
    ])

    expect(result.USD?.customerDebt).toBe(80)
    expect(result.AFN?.customerDebt).toBe(500)
  })

  it('does NOT convert — no bucket borrows another currency’s amount', () => {
    const result = bucket([{ total: 100, currency: 'USD', status: 'pending' }])
    // If a rate were ever applied, an AFN bucket would appear from a USD-only
    // workspace. It must not.
    expect(result.AFN).toBeUndefined()
  })
})

describe('sale and purchase stay on their own side, per currency', () => {
  it('a purchase never counts as sales revenue', () => {
    const result = bucket([
      { total: 400, currency: 'AFN', type: 'purchase', status: 'pending' },
      { total: 100, currency: 'AFN', type: 'sale', status: 'pending' },
    ])

    expect(result.AFN?.totalSales).toBe(100)
    expect(result.AFN?.totalPurchases).toBe(400)
  })

  it('a purchase produces supplier payable, never customer debt', () => {
    const result = bucket([
      { total: 400, paid_amount: 100, currency: 'AFN', type: 'purchase', status: 'pending' },
    ])

    expect(result.AFN?.supplierPayable).toBe(300)
    expect(result.AFN?.customerDebt).toBe(0)
  })

  it('an invoice with no type reads as a sale — the product-wide convention', () => {
    const result = bucket([{ total: 100, currency: 'AFN', status: 'pending' }])
    expect(result.AFN?.totalSales).toBe(100)
    expect(result.AFN?.totalPurchases).toBe(0)
  })
})

describe('a row with no currency means the column default, not a new currency', () => {
  it('folds an untyped currency into AFN rather than creating an empty key', () => {
    const result = bucket([
      { total: 50, currency: null, status: 'pending' },
      { total: 50, currency: 'AFN', status: 'pending' },
    ])

    expect(Object.keys(result)).toEqual(['AFN'])
    expect(result.AFN?.totalSales).toBe(100)
  })
})

describe('the mixed-currency signal', () => {
  it('a single-currency workspace yields exactly one bucket', () => {
    const result = bucket([
      { total: 1, currency: 'PKR', status: 'pending' },
      { total: 2, currency: 'PKR', status: 'pending' },
    ])
    expect(Object.keys(result)).toHaveLength(1)
  })

  it('a mixed workspace yields more than one, so the UI can stop showing one figure', () => {
    const result = bucket([
      { total: 1, currency: 'PKR', status: 'pending' },
      { total: 2, currency: 'IRR', status: 'pending' },
    ])
    expect(Object.keys(result).length).toBeGreaterThan(1)
  })
})
