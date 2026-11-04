// ============================================
// backend/src/__tests__/v53-financial-invariants.test.ts
//
// V53 Phase H — ONE place that states the financial invariants of the universal core and proves each
// one with an assertion, instead of leaving them scattered as comments in a dozen services.
//
// WHAT LIVES HERE, AND WHAT CANNOT
//   These are the RULES that must hold before a database is involved: the arithmetic of a deposit
//   balance, the shape of a balanced journal, the precision of a currency, the credit-limit decision and
//   the variant-binding decision. They are the SAME functions the server and the local engine call, so a
//   green test here is a statement about both paths.
//
//   The ATOMICITY of each money write (two refunds racing the same deposit, a rollback when posting
//   fails) cannot be proved without a real PostgreSQL connection. Those are proved by:
//     · backend/src/__tests__/order-deposit-apply-refund-01.pg.test.ts        (SKIPPED here: no PG binary)
//     · backend/src/__tests__/helpers/order-deposit-apply-refund-01-scenarios.ts (PGlite, logic only)
//     · packages/local-engine/src/__tests__/order-deposit-*.test.ts           (real SQLite)
//   and the cross-device/idempotency behaviour by:
//     · packages/app-shell/src/features/sync/__tests__/deposit-pull.test.ts
//     · packages/local-engine/src/__tests__/order-deposit-backup-restore.test.ts
// ============================================

import { describe, expect, it } from 'vitest'

import {
  canDrawFromDeposit,
  checkVariantBinding,
  depositBalanceOf,
  evaluateCreditLimit,
  ledgerAmountOf,
  ledgerFractionDigitsOf,
  reverseLines,
  validateApplyDeposit,
  validateEntryLines,
  validateRefundDeposit,
  type LedgerAccountFacts,
} from '@hisabche/validation'

const KEY = 'idem-key-0001'

const accounts = (): Map<string, LedgerAccountFacts> =>
  new Map<string, LedgerAccountFacts>([
    ['cash', { id: 'cash', type: 'asset', isGroup: false, isActive: true }],
    ['bank', { id: 'bank', type: 'asset', isGroup: false, isActive: true }],
    ['advances', { id: 'advances', type: 'liability', isGroup: false, isActive: true }],
    ['receivable', { id: 'receivable', type: 'asset', isGroup: false, isActive: true }],
  ])

describe('V53 financial invariants — money that must never be invented or duplicated', () => {
  // ─── Deposit balance ──────────────────────────────────────────────────────────────────────────

  it('deposit · a draw never exceeds what remains (apply and refund share ONE balance)', () => {
    // AFN has 0 fraction digits: 100 000 minor units = 100 000 afghani.
    expect(canDrawFromDeposit(100_000, 100_000)).toBe(true)
    expect(canDrawFromDeposit(100_000, 100_001)).toBe(false)
    expect(canDrawFromDeposit(100_000, 0)).toBe(false)
    expect(canDrawFromDeposit(100_000, -1)).toBe(false)
    // A fractional minor amount is a wrong request, not a rounding detail.
    expect(canDrawFromDeposit(100_000, 10.5)).toBe(false)
  })

  it('deposit · apply then refund cannot consume the same money twice', () => {
    const received = 100_000
    let applied = 0
    const refunded = 0

    // The customer applies 60 000 to a final invoice.
    expect(
      canDrawFromDeposit(
        depositBalanceOf({ amountMinor: received, appliedMinor: applied, refundedMinor: refunded })
          .remainingMinor,
        60_000,
      ),
    ).toBe(true)
    applied += 60_000

    // A refund of the SAME 60 000 is now refused: the money already paid the invoice.
    const afterApply = depositBalanceOf({
      amountMinor: received,
      appliedMinor: applied,
      refundedMinor: refunded,
    })
    expect(afterApply.remainingMinor).toBe(40_000)
    expect(canDrawFromDeposit(afterApply.remainingMinor, 60_000)).toBe(false)

    // The remaining 40 000 can still be applied — exactly once.
    expect(canDrawFromDeposit(afterApply.remainingMinor, 40_000)).toBe(true)
    applied += 40_000

    // Nothing is left for a refund, not even one unit.
    const exhausted = depositBalanceOf({
      amountMinor: received,
      appliedMinor: applied,
      refundedMinor: refunded,
    })
    expect(exhausted.remainingMinor).toBe(0)
    expect(exhausted.exhausted).toBe(true)
    expect(canDrawFromDeposit(exhausted.remainingMinor, 1)).toBe(false)

    // Scale: the same rule holds on a 100× larger deposit (no precision cliff).
    expect(canDrawFromDeposit(10_000_000, 9_999_999)).toBe(true)
    expect(canDrawFromDeposit(10_000_000, 10_000_001)).toBe(false)
  })

  it('deposit · rows that overdraw the deposit are a FAULT, never a zero balance', () => {
    const balance = depositBalanceOf({
      amountMinor: 100_000,
      appliedMinor: 70_000,
      refundedMinor: 40_000,
    })
    expect(balance.remainingMinor).toBe(-10_000)
    expect(balance.overspent).toBe(true)
    // Not «exhausted»: an exhausted deposit means exactly zero left, which is a normal end state.
    expect(balance.exhausted).toBe(false)
  })

  it('deposit · an over-sized or fractional request is refused before any SQL runs', () => {
    expect(
      validateApplyDeposit({
        invoiceId: 'inv-1',
        amountMinor: 10.5,
        idempotencyKey: KEY,
        fractionDigits: 0,
      }),
    ).toContain('DEPOSIT_AMOUNT_INVALID')
    expect(
      validateApplyDeposit({
        invoiceId: '',
        amountMinor: 10,
        idempotencyKey: KEY,
        fractionDigits: 0,
      }),
    ).toContain('DEPOSIT_INVOICE_REQUIRED')
    expect(
      validateApplyDeposit({
        invoiceId: 'inv-1',
        amountMinor: 10,
        idempotencyKey: 'short',
        fractionDigits: 0,
      }),
    ).toContain('DEPOSIT_IDEMPOTENCY_KEY_INVALID')
    expect(
      validateRefundDeposit({
        amountMinor: 0,
        idempotencyKey: KEY,
        fractionDigits: 0,
        reason: 'بازگشت',
      }),
    ).toContain('DEPOSIT_AMOUNT_INVALID')
    // A refund in a currency the ledger cannot hold is refused, not rounded.
    expect(
      validateRefundDeposit({
        amountMinor: 1_000,
        idempotencyKey: KEY,
        fractionDigits: 3,
        reason: 'بازگشت',
      }),
    ).toContain('DEPOSIT_CURRENCY_PRECISION_UNSUPPORTED')
  })

  it('deposit · a refund needs a TRIMMED reason of 3..500 characters', () => {
    const reason = (text: string) =>
      validateRefundDeposit({
        amountMinor: 1_000,
        idempotencyKey: KEY,
        fractionDigits: 0,
        reason: text,
      })
    expect(reason('')).toContain('DEPOSIT_REFUND_REASON_REQUIRED')
    expect(reason('   ')).toContain('DEPOSIT_REFUND_REASON_REQUIRED')
    expect(reason('  ab  ')).toContain('DEPOSIT_REFUND_REASON_REQUIRED')
    expect(reason('abc')).toEqual([])
    expect(reason('a'.repeat(500))).toEqual([])
    expect(reason('a'.repeat(501))).toContain('DEPOSIT_REFUND_REASON_TOO_LONG')
  })

  // ─── Currency precision ───────────────────────────────────────────────────────────────────────

  it('deposit · the number of decimals is read FROM the currency, never assumed to be two', () => {
    expect(ledgerFractionDigitsOf('AFN')).toBe(0)
    expect(ledgerFractionDigitsOf('usd')).toBe(2)
    expect(ledgerFractionDigitsOf('IQD')).toBe(3)
    // Unknown/absent is null — not 0, not 2.
    expect(ledgerFractionDigitsOf('ZZZ')).toBeNull()
    expect(ledgerFractionDigitsOf(null)).toBeNull()
    expect(ledgerFractionDigitsOf(undefined)).toBeNull()

    // AFN: 12 345 minor units are 12 345 afghani, NOT 123.45.
    expect(ledgerAmountOf(12_345, 0)).toBe(12_345)
    // USD: 12 345 minor units are 123.45 dollars.
    expect(ledgerAmountOf(12_345, 2)).toBe(123.45)
    // One cent, and a scale assertion beside the exact one.
    expect(ledgerAmountOf(1, 2)).toBe(0.01)
    expect(ledgerAmountOf(123_456_789, 2)).toBe(1_234_567.89)
    // numeric(18,2) cannot hold a third decimal: refused, never rounded silently.
    expect(ledgerAmountOf(12_345, 3)).toBeNull()
    // A non-positive or fractional minor amount is invalid on this path.
    expect(ledgerAmountOf(0, 2)).toBeNull()
    expect(ledgerAmountOf(-5, 2)).toBeNull()
    expect(ledgerAmountOf(1.5, 2)).toBeNull()
  })

  // ─── The ledger shapes ──────────────────────────────────────────────────────────────────────

  it('deposit · every deposit journal shape balances and its reversal nets to zero', () => {
    const receipt = [
      { accountId: 'cash', debit: 100_000, credit: 0 },
      { accountId: 'advances', debit: 0, credit: 100_000 },
    ]
    const apply = [
      { accountId: 'advances', debit: 60_000, credit: 0 },
      { accountId: 'receivable', debit: 0, credit: 60_000 },
    ]
    const refund = [
      { accountId: 'advances', debit: 40_000, credit: 0 },
      { accountId: 'cash', debit: 0, credit: 40_000 },
    ]

    for (const lines of [receipt, apply, refund]) {
      expect(validateEntryLines(lines, accounts())).toEqual([])
    }

    // A reversal flips both sides and still balances — the original is never edited.
    for (const lines of [receipt, apply, refund]) {
      const reversed = reverseLines(lines)
      expect(validateEntryLines(reversed, accounts())).toEqual([])
      const debit = reversed.reduce((sum, l) => sum + l.debit, 0)
      const credit = reversed.reduce((sum, l) => sum + l.credit, 0)
      expect(debit).toBe(credit)
    }

    // A one-sided or unbalanced entry is refused; this is what «no unbalanced journal» means.
    expect(
      validateEntryLines([{ accountId: 'cash', debit: 100, credit: 0 }], accounts()).map(
        (v) => v.code,
      ),
    ).toEqual(['JOURNAL_ENTRY_UNBALANCED'])
    // A line with both sides filled looks like data but nets to zero: refused.
    expect(
      validateEntryLines(
        [
          { accountId: 'cash', debit: 100, credit: 100 },
          { accountId: 'advances', debit: 100, credit: 100 },
        ],
        accounts(),
      ).map((v) => v.code),
    ).toContain('JOURNAL_LINE_TWO_SIDED')
  })

  // ─── Credit limit (OD-3 = C) ────────────────────────────────────────────────────────────────

  it('credit · an ordinary user cannot pass a BLOCKED limit, and the excess is exact', () => {
    const blocked = evaluateCreditLimit({
      mode: 'block',
      currentReceivableMinor: 80_000,
      newInvoiceAmountMinor: 30_000,
      creditLimitMinor: 100_000,
    })
    expect(blocked.allowed).toBe(false)
    if (!blocked.allowed) {
      expect(blocked.code).toBe('CREDIT_LIMIT_EXCEEDED')
      expect(blocked.overLimitMinor).toBe(10_000)
      expect(blocked.totalProjectedReceivableMinor).toBe(110_000)
    }

    // Warn mode lets the sale through but never hides the excess.
    const warned = evaluateCreditLimit({
      mode: 'warn',
      currentReceivableMinor: 80_000,
      newInvoiceAmountMinor: 30_000,
      creditLimitMinor: 100_000,
    })
    expect(warned.allowed).toBe(true)
    if (warned.allowed) {
      expect(warned.warning?.overLimitMinor).toBe(10_000)
    }

    // Exactly at the limit is allowed — the boundary is not off by one.
    expect(
      evaluateCreditLimit({
        mode: 'block',
        currentReceivableMinor: 80_000,
        newInvoiceAmountMinor: 20_000,
        creditLimitMinor: 100_000,
      }).allowed,
    ).toBe(true)
  })

  it('credit · a cash-only customer (limit 0) is not the same as an UNLIMITED one (null)', () => {
    const cashOnly = evaluateCreditLimit({
      mode: 'block',
      currentReceivableMinor: 0,
      newInvoiceAmountMinor: 1,
      creditLimitMinor: 0,
    })
    expect(cashOnly.allowed).toBe(false)
    if (!cashOnly.allowed) expect(cashOnly.code).toBe('CASH_ONLY_CUSTOMER')

    const unlimited = evaluateCreditLimit({
      mode: 'block',
      currentReceivableMinor: 9_000_000,
      newInvoiceAmountMinor: 1_000_000,
      creditLimitMinor: null,
    })
    expect(unlimited).toEqual({ allowed: true, warning: null })

    // «off» does not evaluate at all, whatever the numbers say.
    expect(
      evaluateCreditLimit({
        mode: 'off',
        currentReceivableMinor: 0,
        newInvoiceAmountMinor: 500,
        creditLimitMinor: 0,
      }),
    ).toEqual({ allowed: true, warning: null })
  })

  // ─── Variants (P2) ──────────────────────────────────────────────────────────────────────────

  const variant = {
    id: 'v-1',
    workspaceId: 'ws-1',
    templateProductId: 'p-1',
    isActive: true,
  }

  it('variant · a product WITH active variants cannot be sold as the parent (no double count)', () => {
    const result = checkVariantBinding({
      workspaceId: 'ws-1',
      productId: 'p-1',
      variantId: null,
      variantsOfProduct: [variant],
    })
    expect(result).toEqual({ ok: false, code: 'VARIANT_REQUIRED' })
  })

  it('variant · the chosen variant travels unchanged, and the wrong ones are named', () => {
    expect(
      checkVariantBinding({
        workspaceId: 'ws-1',
        productId: 'p-1',
        variantId: 'v-1',
        variantsOfProduct: [variant],
      }),
    ).toEqual({ ok: true, variantId: 'v-1' })

    // A product with NO variants behaves exactly as today.
    expect(
      checkVariantBinding({
        workspaceId: 'ws-1',
        productId: 'p-2',
        variantId: null,
        variantsOfProduct: [],
      }),
    ).toEqual({ ok: true, variantId: null })

    // An inactive variant is found, then refused with the reason that lets a screen explain it.
    expect(
      checkVariantBinding({
        workspaceId: 'ws-1',
        productId: 'p-1',
        variantId: 'v-2',
        variantsOfProduct: [{ ...variant, id: 'v-2', isActive: false }],
      }),
    ).toEqual({ ok: false, code: 'VARIANT_INACTIVE' })

    // Another workspace's variant and another product's variant are refused, never re-mapped.
    expect(
      checkVariantBinding({
        workspaceId: 'ws-1',
        productId: 'p-1',
        variantId: 'v-9',
        variantsOfProduct: [],
        requestedVariant: { ...variant, id: 'v-9', workspaceId: 'ws-2' },
      }),
    ).toEqual({ ok: false, code: 'VARIANT_WRONG_WORKSPACE' })
    expect(
      checkVariantBinding({
        workspaceId: 'ws-1',
        productId: 'p-1',
        variantId: 'v-9',
        variantsOfProduct: [],
        requestedVariant: { ...variant, id: 'v-9', templateProductId: 'p-2' },
      }),
    ).toEqual({ ok: false, code: 'VARIANT_WRONG_PRODUCT' })
    // A variant named on a product that has none is refused, never ignored.
    expect(
      checkVariantBinding({
        workspaceId: 'ws-1',
        productId: 'p-3',
        variantId: 'v-1',
        variantsOfProduct: [],
        requestedVariant: variant,
      }),
    ).toEqual({ ok: false, code: 'VARIANT_WRONG_PRODUCT' })
  })
})
