import { describe, expect, it } from 'vitest'
import {
  autoAllocate,
  averageUnitCost,
  computeInvoiceMoney,
  minor,
  planConsumption,
  reverseLines,
  type CostLayer,
  type DraftLine,
  type OpenInvoice,
} from '../index'

/**
 * GENERATIVE PROPERTY TESTS AGAINST THE REAL CORE.
 *
 * ⚠️ WHAT THESE REPLACED, AND WHY THAT MATTERED.
 *
 * The previous file asserted each "invariant" against the expression that had
 * just produced it:
 *
 *   const totalMinor = subtotalMinor - totalDiscountMinor + totalTaxMinor
 *   expect(totalMinor).toBe(subtotalMinor - totalDiscountMinor + totalTaxMinor)  // always true
 *
 * and Property 3 built `onHand` by adding movements, then asserted
 * `onHand === sumOfMovements`. Those pass when the product is broken, deleted or
 * entirely absent — they test a local variable against itself. Every property
 * below now generates INPUTS and asks a CORE FUNCTION for the answer, then
 * states a relationship the business relies on. If the core regresses, these go
 * red.
 *
 * `fast-check` is not a dependency of this package, so the generator is a seeded
 * PRNG (Mulberry32): deterministic, no new dependency, same ideas.
 */
function createRng(seed: number) {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const RUNS = 200

describe('Core invariants — generative, through the real core', () => {
  const rng = createRng(0xdeadbeef)

  it('invoice: the header the core derives always foots (Σ lines − discounts + tax = total)', () => {
    for (let run = 0; run < RUNS; run++) {
      const items = Array.from({ length: 1 + Math.floor(rng() * 8) }, () => ({
        quantity: 1 + Math.floor(rng() * 40),
        // Major units, 0–1000, the range a shop's line prices live in.
        unitPrice: Math.round(rng() * 100_000) / 100,
        discount: Math.floor(rng() * 30),
      }))
      const discountTotal = Math.round(rng() * 5000) / 100
      const taxRate = Math.floor(rng() * 15)

      const money = computeInvoiceMoney({ items, discountTotal, taxRate, currency: 'USD' })

      // Everything the core returns is a whole number of minor units.
      for (const amount of [money.subtotal, money.discountTotal, money.taxTotal, money.total]) {
        expect(Number.isInteger(Math.round(amount * 100))).toBe(true)
        expect(Math.abs(amount * 100 - Math.round(amount * 100))).toBeLessThan(1e-6)
      }

      // The core's OWN statement of the identity, in its own minor units.
      const subtotal = minor(money.subtotal)
      const discount = minor(money.discountTotal)
      const tax = minor(money.taxTotal)
      const total = minor(money.total)
      expect(total).toBe(subtotal - discount + tax)

      // Business bounds the core itself enforces.
      expect(discount).toBeGreaterThanOrEqual(0)
      expect(discount).toBeLessThanOrEqual(subtotal)
      expect(tax).toBeGreaterThanOrEqual(0)
      expect(total).toBeGreaterThanOrEqual(0)
    }
  })

  it('invoice: a discount larger than the invoice is clamped, never negative money', () => {
    for (let run = 0; run < RUNS; run++) {
      const unitPrice = Math.round(rng() * 100_000) / 100
      const subtotalMajor = unitPrice * (1 + Math.floor(rng() * 5))
      const money = computeInvoiceMoney({
        items: [{ quantity: 1 + Math.floor(rng() * 5), unitPrice, discount: 0 }],
        discountTotal: subtotalMajor * (1 + rng() * 5),
        currency: 'USD',
      })
      expect(minor(money.discountTotal)).toBeLessThanOrEqual(minor(money.subtotal))
      expect(minor(money.total)).toBeGreaterThanOrEqual(0)
    }
  })

  it('payments: the core never allocates more than is owed, and an advance is not an error', () => {
    for (let run = 0; run < RUNS; run++) {
      const invoiceCount = 1 + Math.floor(rng() * 4)
      const invoices: OpenInvoice[] = Array.from({ length: invoiceCount }, (_, i) => ({
        invoiceId: `inv-${i}`,
        invoiceNumber: `INV-${i}`,
        total: Math.round(rng() * 500_000) / 100,
        allocated: 0,
        dueDate: `2026-01-${String(1 + i).padStart(2, '0')}`,
        invoiceDate: `2026-01-${String(1 + i).padStart(2, '0')}`,
        currency: 'USD',
      }))
      const receivable = invoices.reduce((sum, inv) => sum + minor(inv.total), 0)
      const payment = Math.round(rng() * 900_000) / 100

      const result = autoAllocate(payment, invoices)
      const allocatedMinor = result.allocations.reduce((sum, a) => sum + minor(a.amount), 0)

      // The core's promise: it spends what is owed, and the rest is an advance.
      expect(allocatedMinor).toBeLessThanOrEqual(receivable)
      expect(allocatedMinor).toBeLessThanOrEqual(minor(payment))
      expect(minor(result.unallocated)).toBeGreaterThanOrEqual(0)
      // Money is conserved: allocated + unallocated = the payment.
      expect(allocatedMinor + minor(result.unallocated)).toBe(minor(payment))
      // No single invoice is overpaid.
      for (const allocation of result.allocations) {
        const invoice = invoices.find((i) => i.invoiceId === allocation.invoiceId)
        expect(invoice).toBeDefined()
        expect(minor(allocation.amount)).toBeLessThanOrEqual(minor(invoice!.total))
      }
    }
  })

  it('costing: consuming layers never costs more than the layers are worth (FIFO)', () => {
    for (let run = 0; run < RUNS; run++) {
      const layers: CostLayer[] = Array.from({ length: Math.floor(rng() * 5) }, (_, i) => ({
        id: `L${i}`,
        productId: 'p1',
        warehouseId: null,
        remainingQty: 1 + Math.floor(rng() * 20),
        unitCost: Math.round(rng() * 50_000) / 100,
        entryDate: `2026-01-${String(1 + i).padStart(2, '0')}`,
        createdAt: `2026-01-${String(1 + i).padStart(2, '0')}T00:00:00.000Z`,
      }))
      const requested = Math.floor(rng() * 40)

      const plan = planConsumption(layers, requested)
      const onHand = layers.reduce((sum, l) => sum + l.remainingQty, 0)
      const layerValue = averageUnitCost(layers) * onHand

      // A plan never covers more than was asked for, nor more than exists.
      const covered = plan.steps.reduce((sum, s) => sum + (s.isEstimated ? 0 : s.quantity), 0)
      expect(covered).toBeLessThanOrEqual(Math.min(requested, onHand) + 1e-9)
      // What it costs cannot exceed the value of the layers it drew from,
      // except for the estimated part, which uses a stated fallback price.
      if (!plan.steps.some((s) => s.isEstimated)) {
        expect(plan.totalCost).toBeLessThanOrEqual(layerValue + 0.01)
      }
      // The shortfall is exactly what the layers could not cover.
      expect(plan.shortfall).toBeGreaterThanOrEqual(0)
      expect(covered + plan.shortfall).toBeCloseTo(requested, 6)
    }
  })

  it('ledger: a reversed entry sums to zero and flips every leg', () => {
    for (let run = 0; run < RUNS; run++) {
      const amount = 100 + Math.floor(rng() * 50_000)
      const lines: DraftLine[] = [
        { accountId: 'acc-debit', debit: amount, credit: 0 },
        { accountId: 'acc-credit', debit: 0, credit: amount },
      ]

      // Precondition the rule assumes — and the core's own balance requirement.
      expect(lines.reduce((s, l) => s + l.debit, 0)).toBe(lines.reduce((s, l) => s + l.credit, 0))

      const reversed = reverseLines(lines)
      expect(reversed).toHaveLength(lines.length)

      const net = reversed.reduce((sum, l) => sum + l.debit - l.credit, 0)
      expect(net).toBe(0)

      // Debits and credits swap on every leg.
      const original = lines.find((l) => l.accountId === reversed[0]!.accountId)!
      expect(reversed[0]!.debit).toBe(original.credit)
      expect(reversed[0]!.credit).toBe(original.debit)
    }
  })
})
