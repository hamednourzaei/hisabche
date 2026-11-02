// ============================================
// packages/validation/src/schemas/universal-core/returns-settlement.domain.ts
//
// WHAT A RETURN COSTS THE CUSTOMER, AND WHAT IS OWED BACK — pure rules.
//
// `returns.domain.ts` answers «which goods, how many, what is reversed».
// This file answers the three questions the goods do not:
//   · what does the shop keep (deductions: restocking fee, damage, agreed …)?
//   · what does the tax on the returned goods come to?
//   · how much of the credit can actually be paid back in cash, and how far has it got?
//
// ⚠️ THE SAME RULES RUN IN `invoice_return_create` (plpgsql). The browser uses
// them only to PREVIEW; the server and the database are the authority. Every
// amount here is an integer in minor units (CLAUDE.md §1.3) — a percentage is
// applied once, to the net base, and rounded once.
//
// ⚠️ NO CATEGORY GRANTS OR REFUSES ANYTHING. `returnPolicyFor` only chooses the
// DEFAULT destination of goods in a given condition (a bakery's opened bread is
// not shelved again; a hardware shop's opened box is). The person can change it.
// ============================================

import type { RestockChoice } from './returns.domain'

// ─── Condition of the returned goods ─────────────────────────────────────────

export const RETURN_CONDITIONS = [
  'sealed',
  'opened',
  'used',
  'damaged',
  'defective',
  'incomplete',
] as const

export type ReturnCondition = (typeof RETURN_CONDITIONS)[number]

export function isReturnCondition(value: unknown): value is ReturnCondition {
  return typeof value === 'string' && (RETURN_CONDITIONS as readonly string[]).includes(value)
}

// ─── Deductions ──────────────────────────────────────────────────────────────

export const DEDUCTION_REASONS = [
  'return_fee',
  'repackaging',
  'damage',
  'usage',
  'missing_parts',
  'agreed',
  'other',
] as const

export type DeductionReason = (typeof DEDUCTION_REASONS)[number]

export interface ReturnDeductionRequest {
  readonly reason: DeductionReason
  readonly mode: 'percent' | 'fixed'
  /** 0 < percent <= 100, of the NET base (goods minus discount, before tax). */
  readonly percent?: number | undefined
  /** MAJOR units of the invoice currency. */
  readonly amount?: number | undefined
  readonly note?: string | undefined
}

export interface ReturnDeduction {
  readonly reason: DeductionReason
  readonly mode: 'percent' | 'fixed'
  readonly percent: number | null
  readonly amountMinor: number
  readonly note: string
}

export interface ReturnDeductionResult {
  readonly rows: readonly ReturnDeduction[]
  readonly totalMinor: number
}

export type ReturnSettlementErrorCode =
  | 'RETURN_DEDUCTION_REASON_INVALID'
  | 'RETURN_DEDUCTION_MODE_INVALID'
  | 'RETURN_DEDUCTION_PERCENT_INVALID'
  | 'RETURN_DEDUCTION_AMOUNT_INVALID'
  | 'RETURN_DEDUCTION_NOTE_REQUIRED'
  | 'RETURN_DEDUCTION_EXCEEDS_BASE'

function fail(code: ReturnSettlementErrorCode): never {
  throw new Error(code)
}

export function isDeductionReason(value: unknown): value is DeductionReason {
  return typeof value === 'string' && (DEDUCTION_REASONS as readonly string[]).includes(value)
}

/**
 * The deductions of one return, in minor units.
 *
 * A percentage is taken of the NET base once — never of the base after an earlier
 * deduction, so the order the person lists them in does not change the money.
 * «Other» needs a note: a deduction nobody can explain later is a deduction that
 * gets argued about.
 */
export function computeReturnDeductions(
  netBaseMinor: number,
  requests: readonly ReturnDeductionRequest[] | undefined,
  fractionDigits: number,
): ReturnDeductionResult {
  const factor = 10 ** fractionDigits
  const rows: ReturnDeduction[] = []
  let total = 0

  for (const request of requests ?? []) {
    if (!isDeductionReason(request.reason)) fail('RETURN_DEDUCTION_REASON_INVALID')
    if (request.mode !== 'percent' && request.mode !== 'fixed')
      fail('RETURN_DEDUCTION_MODE_INVALID')
    const note = (request.note ?? '').trim()
    if (request.reason === 'other' && note === '') fail('RETURN_DEDUCTION_NOTE_REQUIRED')

    let amountMinor: number
    let percent: number | null = null
    if (request.mode === 'percent') {
      const value = Number(request.percent)
      if (!Number.isFinite(value) || value <= 0 || value > 100) {
        fail('RETURN_DEDUCTION_PERCENT_INVALID')
      }
      percent = value
      amountMinor = Math.round((netBaseMinor * value) / 100)
    } else {
      const value = Number(request.amount)
      if (!Number.isFinite(value) || value <= 0) fail('RETURN_DEDUCTION_AMOUNT_INVALID')
      amountMinor = Math.round(value * factor)
    }
    if (amountMinor <= 0) fail('RETURN_DEDUCTION_AMOUNT_INVALID')

    total += amountMinor
    rows.push({ reason: request.reason, mode: request.mode, percent, amountMinor, note })
  }

  if (total > netBaseMinor) fail('RETURN_DEDUCTION_EXCEEDS_BASE')
  return { rows, totalMinor: total }
}

// ─── Tax of the returned goods ───────────────────────────────────────────────

/**
 * The part of the invoice's tax that belongs to a returned amount.
 *
 * `invoice_items` carries no tax column, so the tax of a line is its share of the
 * invoice's `tax_total` by net value. Returning every line returns the whole tax,
 * to the cent (the last unit of rounding never invents or loses tax).
 * Sale returns only: a purchase invoice books its tax inside inventory.
 */
export function proportionalReturnTaxMinor(
  returnedNetMinor: number,
  invoiceTaxMinor: number,
  invoiceNetBaseMinor: number,
): number {
  if (invoiceTaxMinor <= 0 || invoiceNetBaseMinor <= 0 || returnedNetMinor <= 0) return 0
  return Math.round((returnedNetMinor * invoiceTaxMinor) / invoiceNetBaseMinor)
}

// ─── What is owed back ───────────────────────────────────────────────────────

/**
 * What the return credits the customer: goods + tax − what the shop keeps.
 * This is `invoice_returns.grand_total_minor`, so every reader that already
 * subtracts a return from the customer's balance stays right without change.
 */
export function returnNetCreditMinor(input: {
  subtotalMinor: number
  discountMinor: number
  taxMinor: number
  deductionMinor: number
}): number {
  return input.subtotalMinor - input.discountMinor + input.taxMinor - input.deductionMinor
}

/**
 * How much of a return can be PAID BACK in cash or bank, minor units.
 *
 * Only the part of the credit that is money the customer really gave: the credit
 * on an unpaid invoice just lowers the debt, there is nothing to hand over.
 * `returnEffectOfInvoice` makes the same split in major units; this is its
 * minor-unit twin, and the two must agree.
 */
export function refundableMinor(input: {
  netCreditMinor: number
  invoiceTotalMinor: number
  invoicePaidMinor: number
  refundedMinor: number
  pendingMinor?: number | undefined
}): number {
  const owed = Math.max(0, input.invoiceTotalMinor - input.invoicePaidMinor)
  const applied = Math.min(Math.max(0, input.netCreditMinor), owed)
  const credit = Math.max(0, input.netCreditMinor) - applied
  return Math.max(0, credit - input.refundedMinor - (input.pendingMinor ?? 0))
}

export type ReturnRefundStatus = 'not_due' | 'pending' | 'partial' | 'refunded'

/**
 * Where the money side of a return stands.
 *  · not_due  — nothing to hand back (the credit only lowered the debt)
 *  · pending  — cash is owed back and none has been paid
 *  · partial  — some has been paid back
 *  · refunded — everything owed back has been paid
 */
export function returnRefundStatus(input: {
  netCreditMinor: number
  invoiceTotalMinor: number
  invoicePaidMinor: number
  refundedMinor: number
}): ReturnRefundStatus {
  const remaining = refundableMinor(input)
  if (input.refundedMinor > 0) return remaining > 0 ? 'partial' : 'refunded'
  return remaining > 0 ? 'pending' : 'not_due'
}

// ─── Per-industry defaults ───────────────────────────────────────────────────

/** Trades whose goods are eaten, applied or sealed for hygiene: opened = not for sale again. */
const HYGIENE_SENSITIVE = new Set([
  'bakery',
  'butcher',
  'restaurant',
  'cafe',
  'fruitVegetable',
  'dairy',
  'nuts',
  'spices',
  'pharmacy',
  'cosmetics',
  'clinic',
  'optician',
  'flowers',
  'seedsFertilizer',
  'livestock',
  'agriculture',
])

/** Trades that sell time or made-to-order work: there is no shelf to put it back on. */
const NO_SHELF = new Set([
  'tailoring',
  'printing',
  'photography',
  'education',
  'consulting',
  'itServices',
  'repairs',
  'laundry',
  'barber',
  'wedding',
  'security',
  'transport',
  'freightTransport',
  'passengerTransport',
  'courier',
  'travelAgency',
  'realEstate',
  'construction',
])

export interface ReturnPolicy {
  /** The destination offered first for goods in this condition. Never a restriction. */
  defaultDestination(condition: ReturnCondition): RestockChoice
  /** True when goods of this trade normally go back on a shelf at all. */
  readonly goodsGoBackOnShelf: boolean
  /** A hint for the form, stated once: which conditions are shelved by default. */
  readonly shelvedByDefault: readonly ReturnCondition[]
}

/**
 * The default destination of returned goods for the trades a business selected.
 *
 * Several trades → the MOST CAREFUL default among them (a shop that sells both
 * food and hardware does not re-shelve opened food by default). It is a default
 * for the form only; the server refuses nothing because of it, and the person
 * can always choose otherwise.
 */
export function returnPolicyFor(industryKeys: readonly string[] | undefined): ReturnPolicy {
  const keys = (industryKeys ?? []).filter((key) => key !== 'retail' && key !== 'wholesale')
  const hygiene = keys.some((key) => HYGIENE_SENSITIVE.has(key))
  const onlyServices = keys.length > 0 && keys.every((key) => NO_SHELF.has(key))

  const shelved: readonly ReturnCondition[] = onlyServices
    ? []
    : hygiene
      ? ['sealed']
      : ['sealed', 'opened']

  return {
    goodsGoBackOnShelf: !onlyServices,
    shelvedByDefault: shelved,
    defaultDestination: (condition) => (shelved.includes(condition) ? 'restock' : 'scrap'),
  }
}
