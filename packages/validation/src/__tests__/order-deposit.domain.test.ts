// ============================================
// packages/validation/src/__tests__/order-deposit.domain.test.ts
//
// The pure rules of an order-deposit APPLY / REFUND. No database is involved,
// so this file is what a screen or an offline device can check before asking
// the server anything — and it must agree with the SQL, which enforces the same
// codes.
//
// The two that have already gone wrong elsewhere in this codebase:
//   · a currency assumed to have two decimals (AFN has none);
//   · an UNKNOWN value read as zero (a remaining balance nobody computed).
// ============================================

import { describe, expect, it } from 'vitest'

import {
  canDrawFromDeposit,
  depositBalanceOf,
  ledgerAmountOf,
  ledgerFractionDigitsOf,
  refundOrderDepositSchema,
  applyOrderDepositSchema,
  validateApplyDeposit,
  validateRefundDeposit,
} from '../schemas/universal-core/order-deposit.domain'

describe('ledgerFractionDigitsOf — the currency decides, nothing is assumed', () => {
  it('AFN has ZERO decimals and USD has two', () => {
    expect(ledgerFractionDigitsOf('AFN')).toBe(0)
    expect(ledgerFractionDigitsOf('USD')).toBe(2)
  })

  it('a currency this build does not know is null, never 2', () => {
    expect(ledgerFractionDigitsOf('ZZZ')).toBeNull()
    expect(ledgerFractionDigitsOf(null)).toBeNull()
    expect(ledgerFractionDigitsOf('')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(ledgerFractionDigitsOf('usd')).toBe(2)
    expect(ledgerFractionDigitsOf('afn')).toBe(0)
  })
})

describe('ledgerAmountOf — minor units become the figure the ledger books', () => {
  it('0 decimals: 12,345 minor units are 12,345 major', () => {
    expect(ledgerAmountOf(12_345, 0)).toBe(12_345)
  })

  it('2 decimals: 12,345 minor units are 123.45 major', () => {
    expect(ledgerAmountOf(12_345, 2)).toBe(123.45)
  })

  it('refuses three decimals rather than rounding money away', () => {
    expect(ledgerAmountOf(12_345, 3)).toBeNull()
  })

  it('refuses zero, negative and fractional minor amounts', () => {
    expect(ledgerAmountOf(0, 0)).toBeNull()
    expect(ledgerAmountOf(-100, 0)).toBeNull()
    expect(ledgerAmountOf(10.5, 0)).toBeNull()
  })
})

describe('depositBalanceOf — what is left, and whether the rows disagree', () => {
  it('a partial apply leaves the rest as Customer Advance', () => {
    const balance = depositBalanceOf({
      amountMinor: 100_000,
      appliedMinor: 40_000,
      refundedMinor: 0,
    })
    expect(balance.remainingMinor).toBe(60_000)
    expect(balance.exhausted).toBe(false)
    expect(balance.overspent).toBe(false)
  })

  it('apply and refund together may use the whole deposit', () => {
    const balance = depositBalanceOf({
      amountMinor: 100_000,
      appliedMinor: 60_000,
      refundedMinor: 40_000,
    })
    expect(balance.remainingMinor).toBe(0)
    expect(balance.exhausted).toBe(true)
  })

  it('more out than in is a FAULT, not a zero balance', () => {
    const balance = depositBalanceOf({
      amountMinor: 100_000,
      appliedMinor: 110_000,
      refundedMinor: 0,
    })
    expect(balance.remainingMinor).toBe(-10_000)
    expect(balance.overspent).toBe(true)
    expect(balance.exhausted).toBe(false)
  })
})

describe('canDrawFromDeposit', () => {
  it('allows a partial draw and the exact remainder', () => {
    expect(canDrawFromDeposit(60_000, 40_000)).toBe(true)
    expect(canDrawFromDeposit(60_000, 60_000)).toBe(true)
  })

  it('refuses more than is left, zero and a non-integer', () => {
    expect(canDrawFromDeposit(60_000, 60_001)).toBe(false)
    expect(canDrawFromDeposit(60_000, 0)).toBe(false)
    expect(canDrawFromDeposit(60_000, 1.5)).toBe(false)
  })
})

describe('validateApplyDeposit', () => {
  const valid = {
    invoiceId: '30000000-0000-4000-8000-000000000001',
    amountMinor: 40_000,
    idempotencyKey: 'idem-key-apply-0001',
    fractionDigits: 0,
  }

  it('accepts a well-formed apply', () => {
    expect(validateApplyDeposit(valid)).toEqual([])
  })

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['fractional minor', 10.5],
  ])('refuses a %s amount', (_label, amountMinor) => {
    expect(validateApplyDeposit({ ...valid, amountMinor })).toContain('DEPOSIT_AMOUNT_INVALID')
  })

  it('refuses a key shorter than 8 characters', () => {
    expect(validateApplyDeposit({ ...valid, idempotencyKey: 'short' })).toEqual([
      'DEPOSIT_IDEMPOTENCY_KEY_INVALID',
    ])
  })

  it('refuses a precision the ledger cannot store', () => {
    expect(validateApplyDeposit({ ...valid, fractionDigits: 3 })).toEqual([
      'DEPOSIT_CURRENCY_PRECISION_UNSUPPORTED',
    ])
  })

  it('refuses an apply with no invoice', () => {
    expect(validateApplyDeposit({ ...valid, invoiceId: '' })).toEqual(['DEPOSIT_INVOICE_REQUIRED'])
  })
})

describe('validateRefundDeposit', () => {
  const valid = {
    amountMinor: 25_000,
    idempotencyKey: 'idem-key-refund-1',
    fractionDigits: 2,
    reason: 'customer changed the order',
  }

  it('accepts a refund and never asks for an invoice', () => {
    expect(validateRefundDeposit(valid)).toEqual([])
  })

  it('refuses a zero amount and a malformed key together', () => {
    expect(validateRefundDeposit({ ...valid, amountMinor: 0, idempotencyKey: 'x' })).toEqual([
      'DEPOSIT_AMOUNT_INVALID',
      'DEPOSIT_IDEMPOTENCY_KEY_INVALID',
    ])
  })

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['blank', '   '],
    ['too short', 'no'],
  ])('refuses a %s reason: a refund must say why', (_label, reason) => {
    expect(validateRefundDeposit({ ...valid, reason: reason as string })).toEqual([
      'DEPOSIT_REFUND_REASON_REQUIRED',
    ])
  })

  it('refuses a reason longer than 500 characters', () => {
    expect(validateRefundDeposit({ ...valid, reason: 'x'.repeat(501) })).toEqual([
      'DEPOSIT_REFUND_REASON_TOO_LONG',
    ])
  })

  it('accepts the exact maximum (500) and trims before counting', () => {
    expect(validateRefundDeposit({ ...valid, reason: 'x'.repeat(500) })).toEqual([])
    expect(validateRefundDeposit({ ...valid, reason: '  ' + 'x'.repeat(500) + '  ' })).toEqual([])
  })
})

describe('the wire schemas', () => {
  it('accept an apply with a UUID invoice and reject a non-UUID', () => {
    expect(
      applyOrderDepositSchema.safeParse({
        invoiceId: '30000000-0000-4000-8000-000000000001',
        amountMinor: 40_000,
        idempotencyKey: 'idem-key-apply-0001',
      }).success,
    ).toBe(true)
    expect(
      applyOrderDepositSchema.safeParse({
        invoiceId: 'not-a-uuid',
        amountMinor: 40_000,
        idempotencyKey: 'idem-key-apply-0001',
      }).success,
    ).toBe(false)
  })

  it('accept a refund with an optional method and date', () => {
    expect(
      refundOrderDepositSchema.safeParse({
        amountMinor: 25_000,
        idempotencyKey: 'idem-key-refund-1',
        reason: 'customer changed the order',
        method: 'bank',
        date: '2026-11-03',
      }).success,
    ).toBe(true)
  })

  it('reject a fractional minor amount (zod int)', () => {
    expect(
      refundOrderDepositSchema.safeParse({
        amountMinor: 10.5,
        idempotencyKey: 'idem-key-refund-1',
        reason: 'customer changed the order',
      }).success,
    ).toBe(false)
  })

  it.each([
    ['missing', undefined],
    ['blank after trimming', '   '],
    ['shorter than the minimum', 'no'],
    ['longer than the maximum', 'x'.repeat(501)],
  ])('reject a refund with a %s reason', (_label, reason) => {
    expect(
      refundOrderDepositSchema.safeParse({
        amountMinor: 25_000,
        idempotencyKey: 'idem-key-refund-1',
        reason,
      }).success,
    ).toBe(false)
  })
})
