// ============================================
// The direction rule — the part of a party statement that can be wrong
// without producing an error.
//
// A sale DEBITS a customer; a purchase CREDITS a supplier. Swap those and the
// statement still balances, still looks reasonable, and is wrong by twice the
// amount. Every case is named here rather than trusted to a reading of the
// code.
// ============================================

import { describe, expect, it } from 'vitest'

import { directionFor, summarise, type LedgerTxn } from '../services/accounting/party-ledger.domain'

const txn = (type: LedgerTxn['type'], amountMinor: number): LedgerTxn => ({
  type,
  amountMinor,
  at: '2026-01-01T00:00:00.000Z',
})

describe('direction, from the shop point of view', () => {
  it.each([
    ['customer', 'sale', 'debit'],
    ['customer', 'receipt', 'credit'],
    ['customer', 'payment', 'credit'],
    ['customer', 'return', 'credit'],
    ['supplier', 'purchase', 'credit'],
    ['supplier', 'payment', 'debit'],
    ['supplier', 'receipt', 'debit'],
    ['supplier', 'return', 'debit'],
  ] as const)('%s · %s → %s', (side, type, expected) => {
    expect(directionFor(side, type)).toBe(expected)
  })

  it('never gives a sale and a purchase the same direction on one side', () => {
    // The single most consequential pair. If these ever agree, a receivable
    // and a payable are being added together.
    expect(directionFor('customer', 'sale')).not.toBe(directionFor('customer', 'purchase'))
    expect(directionFor('supplier', 'sale')).not.toBe(directionFor('supplier', 'purchase'))
  })
})

describe('a customer statement', () => {
  it('carries the opening balance into the close', () => {
    const summary = summarise('customer', 50_000, [])
    expect(summary.closingBalanceMinor).toBe(50_000)
  })

  it('adds what they bought and subtracts what they paid', () => {
    const summary = summarise('customer', 0, [
      txn('sale', 120_000),
      txn('sale', 30_000),
      txn('receipt', 100_000),
    ])

    expect(summary.totalDebitMinor).toBe(150_000)
    expect(summary.totalCreditMinor).toBe(100_000)
    expect(summary.closingBalanceMinor).toBe(50_000)
  })

  it('goes negative when they have overpaid, rather than clamping at zero', () => {
    // A credit balance is a real thing — the shop owes them. Clamping would
    // hide money.
    expect(summarise('customer', 0, [txn('receipt', 20_000)]).closingBalanceMinor).toBe(-20_000)
  })
})

describe('a supplier statement', () => {
  it('treats a purchase as increasing what WE owe', () => {
    const summary = summarise('supplier', 0, [txn('purchase', 80_000)])
    expect(summary.totalCreditMinor).toBe(80_000)
    expect(summary.closingBalanceMinor).toBe(-80_000)
  })

  it('reduces the debt when we pay', () => {
    const summary = summarise('supplier', 0, [txn('purchase', 80_000), txn('payment', 30_000)])
    expect(summary.closingBalanceMinor).toBe(-50_000)
  })

  it('does not flip the sign convention a second time', () => {
    // The direction mapping already did that work. Flipping again is how a
    // payable reads as a receivable — and it would look perfectly plausible.
    const summary = summarise('supplier', 0, [txn('purchase', 100_000)])
    expect(summary.closingBalanceMinor).toBeLessThan(0)
  })
})

describe('bad rows are skipped, not absorbed', () => {
  it('ignores a negative amount instead of taking its absolute value', () => {
    // A negative amount is a data error, not a direction. Making it positive
    // silently turns a bad row into a plausible one.
    const summary = summarise('customer', 0, [txn('sale', -5_000), txn('sale', 10_000)])
    expect(summary.totalDebitMinor).toBe(10_000)
  })

  it('ignores a non-finite amount', () => {
    const summary = summarise('customer', 0, [txn('sale', Number.NaN), txn('sale', 1_000)])
    expect(summary.totalDebitMinor).toBe(1_000)
  })
})

describe('integer arithmetic', () => {
  it('does not drift over many rows', () => {
    // 300 rows of 10.01 — in floats this lands on 3002.9999999999995 and a
    // statement disagrees with the invoices by a cent, which is a phone call.
    const rows = Array.from({ length: 300 }, () => txn('sale', 1_001))
    expect(summarise('customer', 0, rows).totalDebitMinor).toBe(300_300)
  })
})
