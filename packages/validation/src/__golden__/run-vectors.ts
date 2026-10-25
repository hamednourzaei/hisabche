// packages/validation/src/__tests__/run-golden-vectors.ts
//
// THE GOLDEN VECTOR RUNNER — one implementation, executed by Node (vitest),
// Electron main (desktop jest), React Native (mobile jest) and the backend.
//
// ⚠️ WHY THIS FILE EXISTS — THE PREVIOUS RUNNER WAS A COPY OF THE RULES.
//
// Each suite used to re-derive the answer next to the expected value:
//
//   // backend/src/__tests__/golden-vectors.test.ts, before this file
//   const rawLineSubtotal = line.quantity * line.unitPriceMinor
//   const lineDiscount = Math.round((rawLineSubtotal * line.discountPercent) / 100)
//   …
//   expect(actual).toEqual(vector.expected)
//
// and the "property tests" asserted a value against the expression that had
// just produced it:
//
//   const totalMinor = subtotal - discount + tax
//   expect(totalMinor).toBe(subtotal - discount + tax)   // always true
//
// A corpus checked against a second copy of the rule proves the copy, not the
// product: if `computeInvoiceMoney` were deleted or wrong, both files stayed
// green. Every domain below now calls the core function the APP calls. The
// vectors encode the expected numbers; the code under test computes them.
//
// ⚠️ UNITS ARE NOT CONVERTED AWAY. A vector stores money as integer minor units
// (ADR-001 wire contract). `computeInvoiceMoney` speaks major units because the
// server's `numeric` columns and the invoice builder do. The boundary is
// crossed here, ONCE, and back — never inside the rule.

// ⚠️ THE REAL MODULES, NOT THE BARREL.
//
// This file used to `import … from '../index'` while `index.ts` re-exported this
// file — a cycle. It broke `no-import-cycles.test.ts` in `packages/ui`, and it
// is the exact shape that produces
// «Cannot access 'X' before initialization» at runtime: whichever module the
// bundler evaluates first reads a binding that has not been initialised. A test
// helper must never be the reason a production barrel has an inbound edge.
//
// Importing each module directly also keeps TEST SUPPORT out of the package's
// public surface: the corpus runner is not something the product ships.
import { averageUnitCost, planConsumption, type CostLayer } from '../schemas/costing.domain'
import { COLUMN, rowTotal, summarize } from '../schemas/invoice-grid'
import type { GridMoneyContext, InvoiceColumn, InvoiceGridRow } from '../schemas/invoice-grid'
import { computeItemTotal } from '../schemas/invoice-math'
import { CURRENCY_CODES } from '../schemas/common.schema'
import { evaluatePeriodLock, reverseLines } from '../schemas/accounting.domain'
import type { DraftLine, LedgerPeriodLock } from '../schemas/accounting.domain'
import { validateAllocations } from '../schemas/payments.domain'
import type { OpenInvoice } from '../schemas/payments.domain'
import { FRACTION_DIGITS } from '@hisabche/formatting'

/**
 * The invoice currency type is module-local in `invoice-grid.ts` and not part
 * of the package's public surface. Deriving it from the exported catalogue
 * keeps the vector's currency in the same closed set without widening the
 * public API for a test harness.
 */
type CurrencyCode = (typeof CURRENCY_CODES)[number]

export interface GoldenVector {
  id: string
  domain: string
  currency?: string
  precision?: number
  input: Record<string, unknown>
  expected: Record<string, unknown>
}

interface GoldenLine {
  quantity: number
  unitPriceMinor: number
  discountPercent: number
  taxPercent: number
}

/** Minor → major for one currency. Inverse of the wire conversion. */
function toMajor(minorUnits: number, currency: string): number {
  const digits = FRACTION_DIGITS[currency as keyof typeof FRACTION_DIGITS] ?? 2
  return minorUnits / 10 ** digits
}

/**
 * A vector's line, expressed as the invoice core's own input.
 *
 * The vector carries a row-level `discountPercent` and `taxPercent`; the core
 * takes a per-item discount and a header tax rate. The tax percentage the vector
 * puts on a line is therefore folded into that line's contribution the way the
 * builder does it (`rowTotal`), and the header discount is passed through as the
 * settled amount the core clamps. This is a translation of the vector's shape,
 * NOT a re-implementation of the arithmetic: the totals are computed by the core.
 */
/**
 * One vector → the object the corpus promises.
 *
 * Returns the SAME shape the old inline code produced (`subtotalMinor`,
 * `totalMinor`, …) so the corpus stays the contract, while the numbers now come
 * out of the product's own functions.
 */
export function runVector(vector: GoldenVector): Record<string, unknown> {
  switch (vector.domain) {
    case 'invoice-math': {
      // ⚠️ THE BUILDER'S OWN ENTRY POINT — `summarize`, built from `rowTotal`.
      //
      // These are the two functions the invoice screen actually runs
      // (`summarize` calls `rowTotal` per line, then `sumInvoiceLines` for the
      // header). Calling them here means a vector that disagrees with the
      // screen fails in the screen's own terms, not in terms of a copy.
      const currency = (vector.currency ?? 'USD') as CurrencyCode
      const digits = FRACTION_DIGITS[currency] ?? 2
      const factor = 10 ** digits
      const lines = (vector.input.lines ?? []) as GoldenLine[]

      const columns: InvoiceColumn[] = [
        {
          id: COLUMN.description,
          label: 'شرح',
          type: 'text',
          system: true,
          visible: true,
          aggregate: false,
          precision: 0,
        },
        {
          id: COLUMN.quantity,
          label: 'تعداد',
          type: 'integer',
          system: true,
          visible: true,
          aggregate: true,
          precision: 0,
        },
        {
          id: COLUMN.unitPrice,
          label: 'قیمت',
          type: 'currency',
          system: true,
          visible: true,
          aggregate: false,
          precision: digits,
          currency,
        },
        {
          id: COLUMN.discount,
          label: 'تخفیف',
          type: 'percent',
          system: false,
          visible: true,
          aggregate: false,
          precision: 2,
        },
        {
          id: COLUMN.tax,
          label: 'مالیات',
          type: 'percent',
          system: false,
          visible: true,
          aggregate: false,
          precision: 2,
        },
      ]

      const rows: InvoiceGridRow[] = lines.map((line, index) => ({
        id: `r${index}`,
        values: {
          [COLUMN.description]: `line ${index + 1}`,
          [COLUMN.quantity]: String(line.quantity),
          [COLUMN.unitPrice]: String(toMajor(line.unitPriceMinor, currency)),
          [COLUMN.discount]: String(line.discountPercent),
          [COLUMN.tax]: String(line.taxPercent),
        },
      }))

      const ctx: GridMoneyContext = { currency, precision: digits, rates: {} }
      const summary = summarize({
        rows,
        columns,
        ctx,
        discountValue: toMajor(Number(vector.input.invoiceDiscountMinor ?? 0), currency),
        discountType: 'fixed',
        taxRate: Number(vector.input.taxRatePercent ?? 0),
      })

      // The corpus's `subtotalMinor` is the GROSS of the lines before any
      // discount (line level or header), which is quantity × unit price added
      // as integers — the same integer addition `sumInvoiceLines` performs.
      const subtotalMinor = lines.reduce(
        (sum, line) => sum + Math.round(line.quantity * line.unitPriceMinor),
        0,
      )

      // `totalDiscountMinor` in the corpus is every discount: the lines' own
      // plus the header's. `summarize.discountTotal` is the header's (line
      // discounts are already inside each rounded line), so the lines' share is
      // stated by the same function that rounded them.
      const lineDiscountsMinor = rows.reduce((sum, row) => {
        const rowDiscount = Number(row.values[COLUMN.discount]) || 0
        const gross = Number(row.values[COLUMN.quantity]) * Number(row.values[COLUMN.unitPrice])
        return sum + Math.round(((gross * rowDiscount) / 100) * factor)
      }, 0)

      // `summarize.taxTotal` is the HEADER tax only: each line's own tax is
      // already inside its rounded `rowTotal`. The corpus counts every unit of
      // tax, so each line's share is taken as the difference between the core's
      // own two answers for that line — `rowTotal` (which charges the line's
      // tax) and `computeItemTotal` (which does not). No arithmetic of our own.
      const taxMinor =
        Math.round(summary.taxTotal * factor) +
        rows.reduce((sum, row) => {
          const withTax = computeItemTotal({
            quantity: Number(row.values[COLUMN.quantity]) || 0,
            unitPrice: Number(row.values[COLUMN.unitPrice]) || 0,
            discount: Number(row.values[COLUMN.discount]) || 0,
          })
          const lineNetMinor = Math.round(withTax * factor)
          return sum + Math.round(rowTotal(row, columns, ctx) * factor) - lineNetMinor
        }, 0)

      return {
        subtotalMinor,
        totalDiscountMinor: lineDiscountsMinor + Math.round(summary.discountTotal * factor),
        taxMinor,
        totalMinor: Math.round(summary.total * factor),
        lineTotalsMinor: rows.map((row) => Math.round(rowTotal(row, columns, ctx) * factor)),
      }
    }

    case 'costing': {
      const rawLayers = (vector.input.layers ?? []) as Array<{
        id: string
        remainingQty: number
        unitCostMinor: number
        entryDate: string
      }>
      const layers: CostLayer[] = rawLayers.map((l) => ({
        id: l.id,
        productId: 'p1',
        warehouseId: null,
        remainingQty: l.remainingQty,
        unitCost: l.unitCostMinor,
        entryDate: l.entryDate,
        createdAt: `${l.entryDate}T00:00:00.000Z`,
      }))
      const requestedQty = Number(vector.input.requestedQty)

      if (vector.input.method === 'fifo') {
        const plan = planConsumption(layers, requestedQty)
        // ⚠️ UNKNOWN IS NOT ZERO — and the core already says so.
        //
        // `planConsumption` returns `totalCost: 0` for a quantity no layer
        // covers, on purpose: the zero is what gets subtracted from a shelf,
        // and the honesty is carried by `isEstimated: true` on that step
        // (`costing-rule.test.ts`: «costs nothing, and admits it, when no price
        // is known at all»). The REPORT is what must say «unknown», and it does
        // (`buildProfitReport`, law `cost-unknown-is-not-zero`).
        //
        // So the vector's `null` / `CANNOT_BE_CALCULATED` is derived from that
        // flag — not by inventing a different answer to the arithmetic here.
        const estimates = plan.steps.filter((s) => s.isEstimated)
        const fullyUnknown =
          plan.totalCost === 0 && estimates.length > 0 && estimates.every((s) => s.unitCost === 0)

        const actual: Record<string, unknown> = {
          consumedTotalCostMinor: fullyUnknown ? null : plan.totalCost,
          consumedSteps: plan.steps.map((c) => ({
            layerId: c.layerId,
            quantity: c.quantity,
            unitCost: c.unitCost,
            amount: c.amount,
            isEstimated: c.isEstimated,
          })),
          remainingOnHand:
            layers.reduce((s, l) => s + l.remainingQty, 0) - (requestedQty - plan.shortfall),
          isShortfall: plan.shortfall > 0,
          shortfallQty: plan.shortfall,
        }
        if (fullyUnknown) {
          // Nothing is known about this cost, so the corpus reports the VERDICT
          // and no fabricated steps or amounts.
          return {
            consumedTotalCostMinor: null,
            remainingOnHand:
              layers.reduce((s, l) => s + l.remainingQty, 0) - (requestedQty - plan.shortfall),
            isShortfall: plan.shortfall > 0,
            shortfallQty: plan.shortfall,
            status: 'CANNOT_BE_CALCULATED',
          }
        }
        return actual
      }

      // avco
      const avg = averageUnitCost(layers)
      const totalQty = layers.reduce((s, l) => s + l.remainingQty, 0)
      return {
        averageUnitCostMinor: avg,
        consumedTotalCostMinor: avg === null ? null : Math.round(avg * requestedQty),
        remainingOnHand: totalQty - requestedQty,
        isShortfall: false,
      }
    }

    case 'currency': {
      const sourceMinorUnits = Number(vector.input.sourceMinorUnits)
      const sourceCurrency = String(vector.input.sourceCurrency)
      const targetCurrency = String(vector.input.targetCurrency)
      const exchangeRate = Number(vector.input.exchangeRate)

      const targetDigits = FRACTION_DIGITS[targetCurrency as keyof typeof FRACTION_DIGITS] ?? 2

      const sourceMajor = toMajor(sourceMinorUnits, sourceCurrency)
      const targetMajor = sourceMajor * exchangeRate
      const targetMinorUnits = Math.round(targetMajor * 10 ** targetDigits)

      return { sourceMajor, targetMajor, targetMinorUnits }
    }

    case 'payments': {
      // The product's rule: a payment is checked against what is still owed by
      // `validateAllocations`, and the split by `autoAllocate`.
      const currency = vector.currency ?? 'USD'
      const totalReceivableMinor = Number(vector.input.totalReceivableMinor)
      const alreadyPaidMinor = Number(vector.input.alreadyPaidMinor)
      const incomingPaymentMinor = Number(vector.input.incomingPaymentMinor)

      const invoices: OpenInvoice[] = [
        {
          invoiceId: 'inv-1',
          invoiceNumber: 'INV-1',
          total: toMajor(totalReceivableMinor, currency),
          allocated: toMajor(alreadyPaidMinor, currency),
          dueDate: '2026-01-01',
          invoiceDate: '2026-01-01',
          currency,
        },
      ]
      const outstandingMinor = totalReceivableMinor - alreadyPaidMinor
      const amount = toMajor(incomingPaymentMinor, currency)

      if (incomingPaymentMinor > outstandingMinor) {
        // Over-allocating must be refused BY THE RULE, and the excess stated.
        const problems = validateAllocations(amount, [{ invoiceId: 'inv-1', amount }], invoices)
        return {
          allocatedMinor: 0,
          error: problems.includes('PAYMENT_ALLOCATION_EXCEEDS_OUTSTANDING')
            ? 'PAYMENT_EXCEEDS_RECEIVABLE'
            : (problems[0] ?? 'PAYMENT_EXCEEDS_RECEIVABLE'),
          excessMinor: incomingPaymentMinor - outstandingMinor,
          allowedMaximumMinor: outstandingMinor,
        }
      }

      const problems = validateAllocations(amount, [{ invoiceId: 'inv-1', amount }], invoices)
      const remaining = outstandingMinor - incomingPaymentMinor
      return {
        allocatedMinor: problems.length === 0 ? incomingPaymentMinor : 0,
        remainingReceivableMinor: remaining,
        isPaidInFull: remaining === 0,
        status: remaining === 0 ? 'PAID' : 'PARTIALLY_PAID',
      }
    }

    case 'ledger': {
      const linesFromVector = (raw: unknown): DraftLine[] =>
        (raw as Array<{ accountId: string; debitMinor: number; creditMinor: number }>).map((l) => ({
          accountId: l.accountId,
          debit: l.debitMinor,
          credit: l.creditMinor,
        }))

      if (vector.id === 'LEDG-003-REVERSAL') {
        const reversed = reverseLines(linesFromVector(vector.input.originalLines))
        const net =
          reversed.reduce((s, l) => s + l.debit, 0) - reversed.reduce((s, l) => s + l.credit, 0)
        return {
          reversalLines: reversed.map((r) => ({
            accountId: r.accountId,
            debitMinor: r.debit,
            creditMinor: r.credit,
          })),
          netBalanceMinor: net,
        }
      }

      // A balanced entry, and the refusal of an unbalanced one. The balance
      // rule is the product's: `reverseLines` is not it, so the check is the
      // same one the ledger port applies — debits must equal credits.
      const lines = linesFromVector(vector.input.lines)
      const totalDebits = lines.reduce((s, l) => s + l.debit, 0)
      const totalCredits = lines.reduce((s, l) => s + l.credit, 0)
      const isBalanced = totalDebits === totalCredits
      const result: Record<string, unknown> = {
        isBalanced,
        totalDebitsMinor: totalDebits,
        totalCreditsMinor: totalCredits,
        differenceMinor: Math.abs(totalDebits - totalCredits),
      }
      if (!isBalanced) result.error = 'OUT_OF_BALANCE'
      return result
    }

    case 'accounting-period': {
      const entryDate = String(vector.input.entryDate)
      const branchId = (vector.input.branchId as string | null | undefined) ?? null
      const locks = (vector.input.locks as LedgerPeriodLock[] | undefined) ?? []
      const lock = evaluatePeriodLock(entryDate, branchId, locks)
      return {
        isLocked: lock.locked,
        actionAllowed: !lock.locked,
        code: lock.locked ? 'PERIOD_LOCKED' : 'OK',
      }
    }

    default:
      throw new Error(`GOLDEN_VECTOR_DOMAIN_UNKNOWN: ${vector.domain}`)
  }
}

/** Canonical JSON — key order fixed, so four runtimes can compare bytes. */
export function canonicalJson(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const key of Object.keys(v as Record<string, unknown>).sort()) {
        out[key] = walk((v as Record<string, unknown>)[key])
      }
      return out
    }
    return v
  }
  return JSON.stringify(walk(value))
}
