// ============================================
// backend/src/__tests__/cycle-count-guard.test.ts
//
// L2 — a count is a financial event, not a correction.
//
// ---------------------------------------------------------------------------
// THE IMPLEMENTATION THIS FORBIDS
//
//     UPDATE products SET quantity = counted
//
// Tempting, one line, and wrong twice over — the reasons are the stock-count
// domain's own:
//
//   1. Ten missing bottles are money that left the business. Overwriting the
//      quantity makes the balance sheet disagree with the shelves in the
//      OPPOSITE direction.
//   2. It destroys the evidence. Next month's figures show a quantity that
//      changed with no record of why.
//
// It is also forbidden mechanically: since Phase C, `products.quantity` is a
// projection maintained by trigger from `stock_movements`, and writing it from
// application code is what the whole phase existed to stop.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SERVICE = readFileSync(
  join(__dirname, '..', 'services', 'inventory', 'cycle-count.service.ts'),
  'utf8',
)

/** Comments stripped — the file discusses the forbidden write at length. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const code = stripComments(SERVICE)

/** The movement shape lives in the domain (`countAdjustmentMovements`), which the service calls. */
const domain = stripComments(
  readFileSync(
    join(__dirname, '..', 'services', 'inventory-costing', 'stock-count.domain.ts'),
    'utf8',
  ),
)

describe('the count never writes the quantity directly', () => {
  it('does not update products at all', () => {
    // Not «does not set quantity» — does not touch the table. Any update to
    // `products` from a counting path is a second writer on a projection.
    expect(code).not.toMatch(/from\('products'\)[\s\S]{0,120}\.update\(/)
  })

  it('writes an ADJUSTMENT movement instead', () => {
    expect(domain).toContain("type: 'adjustment'")
    expect(code).toContain('countAdjustmentMovements')
    expect(code).toContain("from('stock_movements')")
  })

  it('names the count on every movement, so the adjustment is explicable', () => {
    // An adjustment with no reference is stock written off with nothing to
    // show for it — H4's `reference_id` lesson, applied here from the start.
    expect(domain).toContain("reference_type: 'cycle_count'")
    expect(domain).toContain('reference_id: input.countId')
  })

  it('names the warehouse that was counted, so the stock lands where it was counted', () => {
    expect(domain).toContain('to_warehouse_id: input.warehouseId')
    expect(code).toContain('warehouseId: String(count.warehouse_id)')
  })

  it('does not write the same adjustment twice', () => {
    // It first reads the movements this count already wrote, and treats a
    // unique-violation from a simultaneous completion as «already applied».
    expect(code).toContain('alreadyAppliedProductIds')
    expect(code).toContain("movementError.code !== '23505'")
  })

  it('completes in ONE database transaction when the function exists', () => {
    // movements + frozen figures + status change together, under a row lock.
    // Splitting them back into separate requests would bring back «stock moved,
    // count still open».
    expect(code).toContain("supabase.rpc('cycle_count_complete'")
    expect(code).toContain('p_lines')
    // Only «the function is missing» may fall back; every other failure throws.
    expect(code).toContain("error.code === '42883' || error.code === 'PGRST202'")
    expect(code).toMatch(/atomic === 'not_open'[\s\S]{0,80}CYCLE_COUNT_NOT_OPEN/)
  })

  it('does not report a completion that did not close the count', () => {
    // The close is a compare-and-swap; zero rows closed means somebody else
    // got there first.
    expect(code).toMatch(/\.select\('id'\)[\s\S]{0,260}CYCLE_COUNT_NOT_OPEN/)
  })

  it('refuses to complete when the movements fail', () => {
    // Swallowing this would mark the count completed while the stock never
    // moved — a document claiming an effect it does not have.
    expect(code).toContain('Failed to write count adjustments')
  })
})

describe('variance is priced by the domain, not re-derived', () => {
  it('calls the stock-count domain', () => {
    // `stock-count.domain.ts` values a shortage from the cost layers
    // oldest-first and a surplus at the current average. Re-deriving either
    // here would be a second valuation model (G2).
    expect(code).toContain('priceLine')
    expect(code).toContain('summariseCount')
  })

  it('reads layers through the costing port, not with its own query', () => {
    expect(code).toContain('costing.getLayers')
    expect(code).not.toContain("from('cost_layers')")
  })
})

describe('what it refuses', () => {
  it('an uncounted line is skipped, not treated as zero', () => {
    // «Not yet counted» and «counted zero» are different facts. Treating them
    // the same writes off every product nobody reached — which on a partial
    // count is most of the warehouse.
    expect(code).toContain('row.counted_qty !== null')
  })

  it('a completed count cannot be cancelled', () => {
    // The adjustments are already in the movement log; «cancelled» would deny
    // an effect that exists.
    expect(code).toContain('CYCLE_COUNT_NOT_CANCELLABLE')
  })

  it('re-checks the status in the WHERE clause when completing', () => {
    // Two concurrent completions would both read `counting` and both write
    // adjustments — the shelf corrected twice.
    expect(code).toMatch(/\.eq\('status', 'counting'\)/)
  })
})
