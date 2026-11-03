// ============================================
// packages/validation/src/schemas/universal-core/order-deposit.domain.ts
//
// P1 (V53 owner decision, 3 Nov 2026) — APPLY and REFUND of an order deposit.
//
// The owner's table, and the only truth about it:
//
//   receipt            Dr cash | bank            Cr customer advances
//   applied to invoice Dr customer advances      Cr receivable
//   refund             Dr customer advances      Cr cash | bank
//
// This file holds the RULES that can be decided without a database: what a
// request must look like, what a balance means, and how many decimal places a
// currency has in the ledger. It does NOT decide whether an invoice is final,
// whether money is still available, or what gets posted — those need the row
// locks and live in docs/order-deposit-apply-refund-01-migration.sql, one
// transaction, where a second implementation cannot drift from them.
//
// REFUND REASON. A refund must say why. The rule lives here as well as in the
// database, with the same codes, so a screen refuses an empty explanation
// before the round trip and a direct call cannot bypass it.
//
// MONEY. `amountMinor` is an integer in the CURRENCY'S minor units — AFN 12,345
// is 12,345 afghani (0 digits), USD 12,345 is 123.45 dollars (2 digits). There
// is no `/ 100` here and none anywhere on this path. `ledgerAmountOf` refuses a
// figure the ledger's numeric(18,2) cannot hold rather than rounding it, and
// `ledgerFractionDigitsOf` answers `null` for a currency it does not know
// instead of assuming two decimals.
// ============================================

import { FRACTION_DIGITS } from '@hisabche/formatting'
import { z } from 'zod'

/** What `order_deposits.posting_status` may say, or null = written before it existed. */
export const ORDER_DEPOSIT_POSTING_STATUSES = ['posted', 'pending_posting'] as const
export type OrderDepositPostingStatus = (typeof ORDER_DEPOSIT_POSTING_STATUSES)[number]

/**
 * Every reason a deposit request can be refused before any SQL runs.
 *
 * ⚠️ These are the rules the database ALSO enforces (with the same codes), so a
 * request that reaches Postgres directly cannot bypass them. The list here is
 * what a screen or a device can check without a round trip.
 */
export const ORDER_DEPOSIT_RULE_CODES = [
  'DEPOSIT_AMOUNT_INVALID',
  'DEPOSIT_IDEMPOTENCY_KEY_INVALID',
  'DEPOSIT_IDEMPOTENCY_CONFLICT',
  'DEPOSIT_INVOICE_REQUIRED',
  'DEPOSIT_CURRENCY_UNKNOWN',
  'DEPOSIT_CURRENCY_PRECISION_UNSUPPORTED',
  'DEPOSIT_INSUFFICIENT_BALANCE',
  'DEPOSIT_APPLY_EXCEEDS_INVOICE',
  // A refund without a stated reason is not an auditable financial event.
  'DEPOSIT_REFUND_REASON_REQUIRED',
  'DEPOSIT_REFUND_REASON_TOO_LONG',
] as const
export type OrderDepositRuleCode = (typeof ORDER_DEPOSIT_RULE_CODES)[number]

/** The ledger keeps numeric(18,2): more than two decimal places would be rounded away. */
export const LEDGER_MAX_FRACTION_DIGITS = 2

/** A refund reason shorter than this says nothing; longer than the maximum is a pasted document. */
export const REFUND_REASON_MIN_LENGTH = 3
export const REFUND_REASON_MAX_LENGTH = 500

/**
 * How many decimal places `currency` counts in the LEDGER, or `null` when the
 * currency is not one this build knows.
 *
 * ⚠️ `null` is not 2. A deposit taken in a currency the build cannot convert
 * must be refused (`DEPOSIT_CURRENCY_UNKNOWN`), because guessing two decimals
 * would book a hundredth of the money or a hundred times it.
 */
export function ledgerFractionDigitsOf(currency: string | null | undefined): number | null {
  if (!currency) return null
  const digits = (FRACTION_DIGITS as Record<string, number>)[currency.toUpperCase()]
  return typeof digits === 'number' && Number.isInteger(digits) ? digits : null
}

/**
 * Integer minor units as the MAJOR amount the ledger books — or `null` when the
 * pair cannot be represented exactly.
 *
 *   AFN, 0 digits: 12345 → 12345
 *   USD, 2 digits: 12345 → 123.45
 *   KWD, 3 digits: refused (the ledger cannot hold 12.345)
 */
export function ledgerAmountOf(amountMinor: number, fractionDigits: number): number | null {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return null
  if (
    !Number.isInteger(fractionDigits) ||
    fractionDigits < 0 ||
    fractionDigits > LEDGER_MAX_FRACTION_DIGITS
  ) {
    return null
  }
  const scale = 10 ** fractionDigits
  const major = amountMinor / scale
  return Math.round(major * scale) === amountMinor ? major : null
}

// ─── Balance ────────────────────────────────────────────────────────────────

export interface OrderDepositBalanceInput {
  /** What the customer actually handed over. */
  amountMinor: number
  /** Sum of applications whose payment is still live. */
  appliedMinor: number
  /** Sum of refunds whose payment is still live. */
  refundedMinor: number
}

export interface OrderDepositBalance {
  amountMinor: number
  appliedMinor: number
  refundedMinor: number
  /** amount − applied − refunded. Can be negative only if the rows disagree. */
  remainingMinor: number
  /** Nothing left to apply or refund. */
  exhausted: boolean
  /**
   * The rows claim more has left the deposit than was received. A screen must
   * show this as a fault to investigate, never as a zero balance.
   */
  overspent: boolean
}

export function depositBalanceOf(input: OrderDepositBalanceInput): OrderDepositBalance {
  const remainingMinor = input.amountMinor - input.appliedMinor - input.refundedMinor
  return {
    amountMinor: input.amountMinor,
    appliedMinor: input.appliedMinor,
    refundedMinor: input.refundedMinor,
    remainingMinor,
    exhausted: remainingMinor === 0,
    overspent: remainingMinor < 0,
  }
}

/**
 * Whether this much may still leave the deposit, by apply OR refund.
 *
 * A partial apply is normal: the unused part stays a Customer Advance.
 */
export function canDrawFromDeposit(remainingMinor: number, requestedMinor: number): boolean {
  return (
    Number.isSafeInteger(remainingMinor) &&
    Number.isSafeInteger(requestedMinor) &&
    requestedMinor > 0 &&
    requestedMinor <= remainingMinor
  )
}

// ─── Requests ───────────────────────────────────────────────────────────────

export interface ApplyDepositRequest {
  invoiceId: string
  amountMinor: number
  idempotencyKey: string
  fractionDigits: number
}

export interface RefundDepositRequest {
  amountMinor: number
  idempotencyKey: string
  fractionDigits: number
  /** WHY the money goes back. Mandatory; the same text lands in the audit trail. */
  reason: string
}

function keyProblems(idempotencyKey: string | null | undefined): OrderDepositRuleCode[] {
  const length = (idempotencyKey ?? '').trim().length
  return length >= 8 && length <= 128 ? [] : ['DEPOSIT_IDEMPOTENCY_KEY_INVALID']
}

function amountProblems(amountMinor: number): OrderDepositRuleCode[] {
  // A fractional or negative minor amount is a wrong request, not a rounding
  // detail: the ledger books whole minor units.
  return Number.isSafeInteger(amountMinor) && amountMinor > 0 ? [] : ['DEPOSIT_AMOUNT_INVALID']
}

function reasonProblems(reason: string | null | undefined): OrderDepositRuleCode[] {
  const trimmed = (reason ?? '').trim()
  if (trimmed.length < REFUND_REASON_MIN_LENGTH) return ['DEPOSIT_REFUND_REASON_REQUIRED']
  if (trimmed.length > REFUND_REASON_MAX_LENGTH) return ['DEPOSIT_REFUND_REASON_TOO_LONG']
  return []
}

function precisionProblems(fractionDigits: number): OrderDepositRuleCode[] {
  return Number.isInteger(fractionDigits) &&
    fractionDigits >= 0 &&
    fractionDigits <= LEDGER_MAX_FRACTION_DIGITS
    ? []
    : ['DEPOSIT_CURRENCY_PRECISION_UNSUPPORTED']
}

/** Every reason this apply may not be asked for. Empty = well formed. */
export function validateApplyDeposit(input: ApplyDepositRequest): OrderDepositRuleCode[] {
  return [
    ...amountProblems(input.amountMinor),
    ...keyProblems(input.idempotencyKey),
    ...precisionProblems(input.fractionDigits),
    ...((input.invoiceId ?? '').trim().length > 0 ? [] : (['DEPOSIT_INVOICE_REQUIRED'] as const)),
  ]
}

/** Every reason this refund may not be asked for. Empty = well formed. */
export function validateRefundDeposit(input: RefundDepositRequest): OrderDepositRuleCode[] {
  return [
    ...amountProblems(input.amountMinor),
    ...keyProblems(input.idempotencyKey),
    ...precisionProblems(input.fractionDigits),
    ...reasonProblems(input.reason),
  ]
}

// ─── Wire schemas ───────────────────────────────────────────────────────────

/**
 * `idempotencyKey` is a BODY field, not a header: the retry has to carry the
 * same key as the first attempt, and a key chosen by the server would make
 * every retry a new request.
 */
export const applyOrderDepositSchema = z.object({
  invoiceId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(128),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export const refundOrderDepositSchema = z.object({
  amountMinor: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(128),
  // Mandatory and trimmed: « » is not a reason. Same bounds as the column.
  reason: z.string().trim().min(REFUND_REASON_MIN_LENGTH).max(REFUND_REASON_MAX_LENGTH),
  method: z.string().trim().min(1).max(32).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export type ApplyOrderDepositInput = z.infer<typeof applyOrderDepositSchema>
export type RefundOrderDepositInput = z.infer<typeof refundOrderDepositSchema>
