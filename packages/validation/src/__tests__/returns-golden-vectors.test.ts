// ============================================
// The return document, against the golden vectors written by hand from the rule.
//
// This is the REFERENCE side: `buildReturnDocument` computes, the vector holds the expected numbers.
// The same file of vectors is then run against the real SQL function (backend) and the offline route of
// the local engine (local-engine) — three implementations measured against one hand-written truth.
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildReturnDocument, type ReturnRequestLine } from '../schemas/universal-core'
import type { ReturnDeductionRequest } from '../schemas/universal-core'
import type { ReturnCondition } from '../schemas/universal-core'

export interface ReturnVector {
  id: string
  title: string
  fractionDigits: number
  invoice: {
    taxMinor: number
    lines: Array<{ id: string; quantity: number; unitPriceMinor: number; discountMinor: number }>
  }
  request: {
    lines: Array<{ originalLineId: string; quantity: number; conditionCode?: string }>
    deductions?: ReturnDeductionRequest[]
  }
  expected?: {
    subtotalMinor: number
    discountMinor: number
    taxMinor: number
    deductionMinor: number
    netCreditMinor: number
    lines: Array<{
      originalLineId: string
      subtotalMinor: number
      discountMinor: number
      taxMinor: number
    }>
  }
  expectedError?: string
}

const corpus = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../__golden__/returns-vectors.json'), 'utf8'),
) as { version: string; vectors: ReturnVector[] }

function run(vector: ReturnVector) {
  return buildReturnDocument({
    returnType: 'sale_return',
    sourceLines: vector.invoice.lines.map((line) => ({ ...line, productId: 'p' })),
    invoiceTaxMinor: vector.invoice.taxMinor,
    priorReturnedByLine: {},
    existingReturnCount: 0,
    lines: vector.request.lines.map((line): ReturnRequestLine => ({
      originalLineId: line.originalLineId,
      quantity: line.quantity,
      restockChoice: 'restock',
      reasonCode: 'other',
      conditionCode: line.conditionCode as ReturnCondition | undefined,
    })),
    deductions: vector.request.deductions,
    fractionDigits: vector.fractionDigits,
  })
}

describe('return golden vectors — the reference implementation', () => {
  it('the corpus has accepted and refused cases', () => {
    expect(corpus.vectors.length).toBeGreaterThanOrEqual(11)
    expect(corpus.vectors.some((vector) => vector.expected)).toBe(true)
    expect(corpus.vectors.some((vector) => vector.expectedError)).toBe(true)
  })

  for (const vector of corpus.vectors) {
    it(`${vector.id}: ${vector.title}`, () => {
      if (vector.expectedError) {
        expect(() => run(vector)).toThrow(vector.expectedError)
        return
      }
      const document = run(vector)
      const expected = vector.expected!
      expect({
        subtotalMinor: document.subtotalMinor,
        discountMinor: document.discountMinor,
        taxMinor: document.taxMinor,
        deductionMinor: document.deductionMinor,
        netCreditMinor: document.netCreditMinor,
        lines: document.lines.map((line) => ({
          originalLineId: line.originalLineId,
          subtotalMinor: line.subtotalMinor,
          discountMinor: line.discountMinor,
          taxMinor: line.taxMinor,
        })),
      }).toEqual(expected)
    })
  }
})

describe('the rules the vectors cannot say in one case', () => {
  const base = {
    returnType: 'sale_return' as const,
    sourceLines: [{ id: 'a', productId: 'p', quantity: 5, unitPriceMinor: 1000, discountMinor: 0 }],
    invoiceTaxMinor: 0,
    priorReturnedByLine: {},
    existingReturnCount: 0,
    fractionDigits: 2,
  }
  const line = (quantity: number): ReturnRequestLine => ({
    originalLineId: 'a',
    quantity,
    restockChoice: 'restock',
    reasonCode: 'other',
  })

  it('one return per invoice', () => {
    expect(() =>
      buildReturnDocument({ ...base, existingReturnCount: 1, lines: [line(1)] }),
    ).toThrow('INVOICE_ALREADY_RETURNED')
  })

  it('the quantity already returned counts against the original', () => {
    expect(() =>
      buildReturnDocument({ ...base, priorReturnedByLine: { a: 4 }, lines: [line(2)] }),
    ).toThrow('RETURN_QUANTITY_EXCEEDS_ORIGINAL')
    expect(
      buildReturnDocument({ ...base, priorReturnedByLine: { a: 4 }, lines: [line(1)] })
        .subtotalMinor,
    ).toBe(1000)
  })

  it('an empty, duplicated, unknown or non-positive line is refused', () => {
    expect(() => buildReturnDocument({ ...base, lines: [] })).toThrow('RETURN_LINES_REQUIRED')
    expect(() => buildReturnDocument({ ...base, lines: [line(1), line(1)] })).toThrow(
      'RETURN_LINE_DUPLICATE',
    )
    expect(() =>
      buildReturnDocument({ ...base, lines: [{ ...line(1), originalLineId: 'zzz' }] }),
    ).toThrow('INVOICE_LINE_NOT_FOUND')
    expect(() => buildReturnDocument({ ...base, lines: [line(0)] })).toThrow(
      'RETURN_QUANTITY_INVALID',
    )
    expect(() => buildReturnDocument({ ...base, lines: [line(Number.NaN)] })).toThrow(
      'RETURN_QUANTITY_INVALID',
    )
  })

  it('a purchase return carries no tax and takes no deductions', () => {
    const purchase = { ...base, returnType: 'purchase_return' as const, invoiceTaxMinor: 500 }
    expect(buildReturnDocument({ ...purchase, lines: [line(2)] }).taxMinor).toBe(0)
    expect(() =>
      buildReturnDocument({
        ...purchase,
        lines: [line(2)],
        deductions: [{ reason: 'return_fee', mode: 'percent', percent: 10 }],
      }),
    ).toThrow('RETURN_DEDUCTION_NOT_ALLOWED')
  })

  it('the net credit is gross minus what the shop keeps, and never negative', () => {
    const document = buildReturnDocument({
      ...base,
      lines: [line(5)],
      deductions: [{ reason: 'agreed', mode: 'percent', percent: 100 }],
    })
    expect(document.grossMinor).toBe(5000)
    expect(document.netCreditMinor).toBe(0)
  })
})
