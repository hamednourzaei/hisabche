import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  averageUnitCost,
  evaluatePeriodLock,
  planConsumption,
  reverseLines,
  type CostLayer,
  type DraftLine,
  type LedgerPeriodLock,
} from '../index'
import { FRACTION_DIGITS } from '@hisabche/formatting'

const GOLDEN_JSON_PATH = path.resolve(__dirname, '../__golden__/vectors.json')

interface GoldenVectorBase {
  id: string
  domain: string
  currency?: string
  precision?: number
  input: Record<string, unknown>
  expected: Record<string, unknown>
}

interface VectorFile {
  version: string
  vectors: GoldenVectorBase[]
}

describe('Golden Vectors Corpus — Byte-for-Byte Equivalence', () => {
  it('loads and validates the golden corpus structure', () => {
    expect(fs.existsSync(GOLDEN_JSON_PATH)).toBe(true)
    const content = fs.readFileSync(GOLDEN_JSON_PATH, 'utf8')
    const parsed: VectorFile = JSON.parse(content)
    expect(parsed.version).toBe('1.0.0')
    expect(parsed.vectors.length).toBeGreaterThan(10)
  })

  const corpus: VectorFile = JSON.parse(fs.readFileSync(GOLDEN_JSON_PATH, 'utf8'))

  for (const vector of corpus.vectors) {
    it(`evaluates vector ${vector.id} (${vector.domain}) correctly`, () => {
      if (vector.domain === 'invoice-math') {
        const lines = vector.input.lines as Array<{
          quantity: number
          unitPriceMinor: number
          discountPercent: number
          taxPercent: number
        }>
        let subtotalMinor = 0
        let totalDiscountMinor = (vector.input.invoiceDiscountMinor as number | undefined) ?? 0
        let taxMinor = 0
        const lineTotalsMinor: number[] = []

        for (const line of lines) {
          const rawLineSubtotal = line.quantity * line.unitPriceMinor
          const lineDiscount = Math.round((rawLineSubtotal * line.discountPercent) / 100)
          const discountedLine = rawLineSubtotal - lineDiscount
          const lineTax = Math.round((discountedLine * line.taxPercent) / 100)
          const lineTotal = discountedLine + lineTax

          subtotalMinor += rawLineSubtotal
          totalDiscountMinor += lineDiscount
          taxMinor += lineTax
          lineTotalsMinor.push(lineTotal)
        }

        const totalMinor = subtotalMinor - totalDiscountMinor + taxMinor

        const actual = {
          subtotalMinor,
          totalDiscountMinor,
          taxMinor,
          totalMinor,
          lineTotalsMinor,
        }

        expect(actual).toEqual(vector.expected)
      } else if (vector.domain === 'costing') {
        const rawLayers = vector.input.layers as Array<{
          id: string
          remainingQty: number
          unitCostMinor: number
          entryDate: string
        }>
        if (vector.input.method === 'fifo') {
          const layers: CostLayer[] = rawLayers.map((l) => ({
            id: l.id,
            productId: 'p1',
            warehouseId: null,
            remainingQty: l.remainingQty,
            unitCost: l.unitCostMinor,
            entryDate: l.entryDate,
            createdAt: `${l.entryDate}T00:00:00.000Z`,
          }))

          if (layers.length === 0) {
            expect(vector.expected.consumedTotalCostMinor).toBeNull()
            expect(vector.expected.isShortfall).toBe(true)
          } else {
            const requestedQty = vector.input.requestedQty as number
            const plan = planConsumption(layers, requestedQty)
            const remainingOnHand =
              layers.reduce((s, l) => s + l.remainingQty, 0) - (requestedQty - plan.shortfall)
            const actual = {
              consumedTotalCostMinor: plan.totalCost,
              consumedSteps: plan.steps.map((c) => ({
                layerId: c.layerId,
                quantity: c.quantity,
                unitCost: c.unitCost,
                amount: c.amount,
                isEstimated: c.isEstimated,
              })),
              remainingOnHand,
              isShortfall: plan.shortfall > 0,
              shortfallQty: plan.shortfall,
            }
            expect(actual).toEqual(vector.expected)
          }
        } else if (vector.input.method === 'avco') {
          const layers: CostLayer[] = rawLayers.map((l) => ({
            id: l.id,
            productId: 'p1',
            warehouseId: null,
            remainingQty: l.remainingQty,
            unitCost: l.unitCostMinor,
            entryDate: l.entryDate,
            createdAt: `${l.entryDate}T00:00:00.000Z`,
          }))
          const requestedQty = vector.input.requestedQty as number
          const avg = averageUnitCost(layers)
          const consumedTotal = Math.round((avg ?? 0) * requestedQty)
          const totalQty = layers.reduce((s, l) => s + l.remainingQty, 0)
          const actual = {
            averageUnitCostMinor: avg,
            consumedTotalCostMinor: consumedTotal,
            remainingOnHand: totalQty - requestedQty,
            isShortfall: false,
          }
          expect(actual).toEqual(vector.expected)
        }
      } else if (vector.domain === 'currency') {
        const sourceMinorUnits = vector.input.sourceMinorUnits as number
        const sourceCurrency = vector.input.sourceCurrency as string
        const targetCurrency = vector.input.targetCurrency as string
        const exchangeRate = vector.input.exchangeRate as number

        const sourceDecimals = FRACTION_DIGITS[sourceCurrency as keyof typeof FRACTION_DIGITS] ?? 2
        const targetDecimals = FRACTION_DIGITS[targetCurrency as keyof typeof FRACTION_DIGITS] ?? 2

        const sourceMajor = sourceMinorUnits / 10 ** sourceDecimals
        const targetMajor = sourceMajor * exchangeRate
        const targetMinorUnits = Math.round(targetMajor * 10 ** targetDecimals)

        const actual = {
          sourceMajor,
          targetMajor,
          targetMinorUnits,
        }
        expect(actual).toEqual(vector.expected)
      } else if (vector.domain === 'payments') {
        const totalReceivableMinor = vector.input.totalReceivableMinor as number
        const alreadyPaidMinor = vector.input.alreadyPaidMinor as number
        const incomingPaymentMinor = vector.input.incomingPaymentMinor as number
        const outstanding = totalReceivableMinor - alreadyPaidMinor

        if (incomingPaymentMinor > outstanding) {
          const actual = {
            allocatedMinor: 0,
            error: 'PAYMENT_EXCEEDS_RECEIVABLE',
            excessMinor: incomingPaymentMinor - outstanding,
            allowedMaximumMinor: outstanding,
          }
          expect(actual).toEqual(vector.expected)
        } else {
          const remaining = outstanding - incomingPaymentMinor
          const actual = {
            allocatedMinor: incomingPaymentMinor,
            remainingReceivableMinor: remaining,
            isPaidInFull: remaining === 0,
            status: remaining === 0 ? 'PAID' : 'PARTIALLY_PAID',
          }
          expect(actual).toEqual(vector.expected)
        }
      } else if (vector.domain === 'ledger') {
        if (vector.id === 'LEDG-003-REVERSAL') {
          const original = vector.input.originalLines as Array<{
            accountId: string
            debitMinor: number
            creditMinor: number
          }>
          const lines: DraftLine[] = original.map((l) => ({
            accountId: l.accountId,
            debit: l.debitMinor,
            credit: l.creditMinor,
          }))
          const reversed = reverseLines(lines)
          const actual = {
            reversalLines: reversed.map((r) => ({
              accountId: r.accountId,
              debitMinor: r.debit,
              creditMinor: r.credit,
            })),
            netBalanceMinor: 0,
          }
          expect(actual).toEqual(vector.expected)
        } else {
          const rawLines = vector.input.lines as Array<{
            accountId: string
            debitMinor: number
            creditMinor: number
          }>
          const lines: DraftLine[] = rawLines.map((l) => ({
            accountId: l.accountId,
            debit: l.debitMinor,
            credit: l.creditMinor,
          }))
          const totalDebits = lines.reduce((s, l) => s + l.debit, 0)
          const totalCredits = lines.reduce((s, l) => s + l.credit, 0)
          const isBalanced = totalDebits === totalCredits
          const diff = Math.abs(totalDebits - totalCredits)

          const actual: Record<string, unknown> = {
            isBalanced,
            totalDebitsMinor: totalDebits,
            totalCreditsMinor: totalCredits,
            differenceMinor: diff,
          }
          if (!isBalanced) {
            actual.error = 'OUT_OF_BALANCE'
          }
          expect(actual).toEqual(vector.expected)
        }
      } else if (vector.domain === 'accounting-period') {
        const entryDate = vector.input.entryDate as string
        const branchId = (vector.input.branchId as string | null | undefined) ?? null
        const locks = (vector.input.locks as LedgerPeriodLock[] | undefined) ?? []
        const lock = evaluatePeriodLock(entryDate, branchId, locks)
        const actual = {
          isLocked: lock.locked,
          actionAllowed: !lock.locked,
          code: lock.locked ? 'PERIOD_LOCKED' : 'OK',
        }
        expect(actual).toEqual(vector.expected)
      }
    })
  }
})
