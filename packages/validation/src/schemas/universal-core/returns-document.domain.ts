// ============================================
// packages/validation/src/schemas/universal-core/returns-document.domain.ts
//
// THE RETURN DOCUMENT — ONE COMPOSITION OF THE RULES, PURE.
//
// What a sale or purchase return IS, in minor units: per-line subtotal / discount / tax, what the shop
// keeps, and what the return credits the customer. It is the reference the other two places that
// must agree with are measured against:
//
//   · plpgsql `invoice_return_create` (docs/invoice-return-05-core-migration.sql) — the server's atomic
//     write; SQL cannot call TypeScript, so it carries the same arithmetic. The golden vectors in
//     `__golden__/returns-vectors.json` are run against the SQL on a real Postgres engine.
//   · the offline route of the local engine — it calls THIS function; it has no second copy.
//
// ⚠️ NOTHING HERE MOVES STOCK, COST OR MONEY. A document is numbers and refusals. The device records the
// document and queues it; the server applies it (stock, cost layers, journal entry) in one transaction.
// ⚠️ A refusal is a THROWN Error whose message is the code (`RETURN_QUANTITY_EXCEEDS_ORIGINAL` …), the same
// codes the server answers with.
// ============================================

import {
  computeReturnDeductions,
  isReturnCondition,
  proportionalReturnTaxMinor,
  returnNetCreditMinor,
  type ReturnCondition,
  type ReturnDeduction,
  type ReturnDeductionRequest,
} from './returns-settlement.domain'
import type { RestockChoice, ReturnReason, ReturnType } from './returns.domain'

export type ReturnDocumentErrorCode =
  | 'INVOICE_ALREADY_RETURNED'
  | 'RETURN_LINES_REQUIRED'
  | 'RETURN_LINE_DUPLICATE'
  | 'RETURN_QUANTITY_INVALID'
  | 'INVOICE_LINE_NOT_FOUND'
  | 'RETURN_QUANTITY_EXCEEDS_ORIGINAL'
  | 'PACKAGE_RETURNS_NOT_SUPPORTED'
  | 'INVALID_RETURN_CONDITION'
  | 'RETURN_DEDUCTION_NOT_ALLOWED'
  | 'RETURN_DEDUCTION_REASON_INVALID'
  | 'RETURN_DEDUCTION_MODE_INVALID'
  | 'RETURN_DEDUCTION_PERCENT_INVALID'
  | 'RETURN_DEDUCTION_AMOUNT_INVALID'
  | 'RETURN_DEDUCTION_NOTE_REQUIRED'
  | 'RETURN_DEDUCTION_EXCEEDS_BASE'

/** One line of the invoice being returned, in MINOR units of the invoice currency. */
export interface ReturnSourceLine {
  readonly id: string
  readonly productId: string | null
  readonly offeringType?: string | null | undefined
  readonly quantity: number
  /** Price of ONE unit, minor units. */
  readonly unitPriceMinor: number
  /** The line's WHOLE discount, minor units. */
  readonly discountMinor: number
}

export interface ReturnRequestLine {
  readonly originalLineId: string
  readonly quantity: number
  readonly restockChoice: RestockChoice
  readonly reasonCode: ReturnReason
  readonly conditionCode?: ReturnCondition | undefined
}

export interface BuildReturnInput {
  readonly returnType: ReturnType
  readonly sourceLines: readonly ReturnSourceLine[]
  /** The invoice's whole tax, minor units. A purchase return carries none (its tax sits inside inventory). */
  readonly invoiceTaxMinor: number
  /** originalLineId → quantity already returned by EARLIER returns of this invoice. */
  readonly priorReturnedByLine: Readonly<Record<string, number>>
  /** How many returns this invoice already has. One return per invoice. */
  readonly existingReturnCount: number
  readonly lines: readonly ReturnRequestLine[]
  readonly deductions?: readonly ReturnDeductionRequest[] | undefined
  readonly fractionDigits: number
}

export interface BuiltReturnLine {
  readonly originalLineId: string
  readonly productId: string | null
  readonly quantity: number
  readonly restockChoice: RestockChoice
  readonly reasonCode: ReturnReason
  readonly conditionCode: ReturnCondition | null
  readonly subtotalMinor: number
  readonly discountMinor: number
  readonly taxMinor: number
  readonly totalMinor: number
}

export interface BuiltReturnDocument {
  readonly lines: readonly BuiltReturnLine[]
  readonly subtotalMinor: number
  readonly discountMinor: number
  readonly taxMinor: number
  readonly deductions: readonly ReturnDeduction[]
  readonly deductionMinor: number
  /** goods - discount + tax: what the goods are worth back, before the shop keeps anything. */
  readonly grossMinor: number
  /** goods - discount + tax - deductions: what the return CREDITS the customer. Stored as `grand_total_minor`. */
  readonly netCreditMinor: number
}

function refuse(code: ReturnDocumentErrorCode): never {
  throw new Error(code)
}

export function buildReturnDocument(input: BuildReturnInput): BuiltReturnDocument {
  if (input.existingReturnCount > 0) refuse('INVOICE_ALREADY_RETURNED')
  if (input.lines.length === 0) refuse('RETURN_LINES_REQUIRED')

  const source = new Map(input.sourceLines.map((line) => [line.id, line]))
  // The tax of the invoice is spread over its goods by NET value, exactly as the server does.
  const netBaseMinor = input.sourceLines.reduce(
    (sum, line) => sum + (line.quantity * line.unitPriceMinor - line.discountMinor),
    0,
  )
  const taxable = input.returnType === 'sale_return'

  const seen = new Set<string>()
  const built: BuiltReturnLine[] = []
  for (const request of input.lines) {
    if (seen.has(request.originalLineId)) refuse('RETURN_LINE_DUPLICATE')
    seen.add(request.originalLineId)
    if (!(request.quantity > 0) || !Number.isFinite(request.quantity))
      refuse('RETURN_QUANTITY_INVALID')
    if (request.conditionCode !== undefined && !isReturnCondition(request.conditionCode)) {
      refuse('INVALID_RETURN_CONDITION')
    }

    const line = source.get(request.originalLineId)
    if (!line) refuse('INVOICE_LINE_NOT_FOUND')
    if (line.offeringType === 'package') refuse('PACKAGE_RETURNS_NOT_SUPPORTED')
    const already = input.priorReturnedByLine[request.originalLineId] ?? 0
    if (already + request.quantity > line.quantity) refuse('RETURN_QUANTITY_EXCEEDS_ORIGINAL')

    const grossOfLine = line.quantity * line.unitPriceMinor
    const subtotalMinor = Math.round(request.quantity * line.unitPriceMinor)
    const discountMinor =
      grossOfLine > 0 ? Math.round(subtotalMinor * (line.discountMinor / grossOfLine)) : 0
    const taxMinor = taxable
      ? proportionalReturnTaxMinor(
          subtotalMinor - discountMinor,
          input.invoiceTaxMinor,
          netBaseMinor,
        )
      : 0

    built.push({
      originalLineId: request.originalLineId,
      productId: line.productId,
      quantity: request.quantity,
      restockChoice: request.restockChoice,
      reasonCode: request.reasonCode,
      conditionCode: request.conditionCode ?? null,
      subtotalMinor,
      discountMinor,
      taxMinor,
      totalMinor: subtotalMinor - discountMinor + taxMinor,
    })
  }

  const subtotalMinor = built.reduce((sum, line) => sum + line.subtotalMinor, 0)
  const discountMinor = built.reduce((sum, line) => sum + line.discountMinor, 0)
  const taxMinor = built.reduce((sum, line) => sum + line.taxMinor, 0)

  if ((input.deductions?.length ?? 0) > 0 && !taxable) refuse('RETURN_DEDUCTION_NOT_ALLOWED')
  // The deductions are taken of the NET goods (before tax); a refusal carries the deduction rule's own code.
  const deductions = computeReturnDeductions(
    subtotalMinor - discountMinor,
    input.deductions,
    input.fractionDigits,
  )

  return {
    lines: built,
    subtotalMinor,
    discountMinor,
    taxMinor,
    deductions: deductions.rows,
    deductionMinor: deductions.totalMinor,
    grossMinor: subtotalMinor - discountMinor + taxMinor,
    netCreditMinor: returnNetCreditMinor({
      subtotalMinor,
      discountMinor,
      taxMinor,
      deductionMinor: deductions.totalMinor,
    }),
  }
}

// ─── Preview — the browser's estimate (the server's answer is the one that is booked) ─────────

export interface ReturnPreviewItem {
  readonly id: string
  readonly quantity: number
  /** MAJOR units, the price of ONE unit. */
  readonly unitPrice: number
  /** MAJOR units, the line's whole discount. */
  readonly discount: number
}

export interface ReturnPreview {
  readonly subtotalMinor: number
  readonly discountMinor: number
  readonly taxMinor: number
  readonly deductionMinor: number
  /** goods - discount + tax - deductions: what the return would credit the customer. */
  readonly creditMinor: number
  /** Set when the document cannot be built as asked (the deductions, or a quantity). */
  readonly error: ReturnDocumentErrorCode | null
}

const EMPTY_PREVIEW: Omit<ReturnPreview, 'error'> = {
  subtotalMinor: 0,
  discountMinor: 0,
  taxMinor: 0,
  deductionMinor: 0,
  creditMinor: 0,
}

/**
 * The form's figure, from the SAME composition the device and the server's golden vectors use.
 * A refusal of the DEDUCTIONS leaves the goods figures standing (and names the refusal), so the person
 * sees what the return is worth while fixing the deduction; any other refusal shows nothing.
 */
export function previewReturn(input: {
  items: readonly ReturnPreviewItem[]
  /** originalLineId → quantity to return (absent or 0 = not returned) */
  picked: Readonly<Record<string, number>>
  /** The invoice's tax_total, MAJOR units. */
  invoiceTax: number
  deductions: readonly ReturnDeductionRequest[]
  fractionDigits: number
}): ReturnPreview {
  const factor = 10 ** input.fractionDigits
  const requested = Object.entries(input.picked).filter(([, quantity]) => quantity > 0)
  if (requested.length === 0) return { ...EMPTY_PREVIEW, error: null }

  const base = {
    returnType: 'sale_return' as const,
    sourceLines: input.items.map((item) => ({
      id: item.id,
      productId: null,
      quantity: item.quantity,
      unitPriceMinor: Math.round(item.unitPrice * factor),
      discountMinor: Math.round(item.discount * factor),
    })),
    invoiceTaxMinor: Math.round(input.invoiceTax * factor),
    priorReturnedByLine: {},
    existingReturnCount: 0,
    lines: requested.map(([originalLineId, quantity]) => ({
      originalLineId,
      quantity,
      restockChoice: 'restock' as const,
      reasonCode: 'other' as const,
    })),
    fractionDigits: input.fractionDigits,
  }

  const asPreview = (
    document: BuiltReturnDocument,
    error: ReturnDocumentErrorCode | null,
  ): ReturnPreview => ({
    subtotalMinor: document.subtotalMinor,
    discountMinor: document.discountMinor,
    taxMinor: document.taxMinor,
    deductionMinor: document.deductionMinor,
    creditMinor: document.netCreditMinor,
    error,
  })

  try {
    return asPreview(buildReturnDocument({ ...base, deductions: input.deductions }), null)
  } catch (cause) {
    const code = (
      cause instanceof Error ? cause.message : 'RETURN_DEDUCTION_AMOUNT_INVALID'
    ) as ReturnDocumentErrorCode
    if (!code.startsWith('RETURN_DEDUCTION_')) return { ...EMPTY_PREVIEW, error: code }
    try {
      return asPreview(buildReturnDocument({ ...base, deductions: [] }), code)
    } catch {
      return { ...EMPTY_PREVIEW, error: code }
    }
  }
}
