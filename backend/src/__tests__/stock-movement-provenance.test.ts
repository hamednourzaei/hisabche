// ============================================
// backend/src/__tests__/stock-movement-provenance.test.ts
//
// H4 — every stock movement must name the document that caused it.
//
// ---------------------------------------------------------------------------
// THE BUG THIS GUARDS
//
// `invoice.service.batchUpdateStock` wrote `reference_type: 'invoice'` and NO
// `reference_id`. Every sale movement said it came from an invoice and could
// not say which one. `purchasing.service` and `manufacturing.service` both
// wrote their reference id, so the gap was exactly where sales are — the
// majority of movements in any shop.
//
// It type-checked, it inserted, nothing errored. The only symptom was a stock
// history whose rows could not be opened, which nobody could see because
// nothing rendered a stock history at all.
//
// That matters more since Phase C: `stock_movements` IS the quantity now
// (`products.quantity` is a trigger-maintained projection), so these rows are
// the only record of why an on-hand figure is what it is.
//
// ---------------------------------------------------------------------------
// WHY STATIC, AND WHY PAIRED
//
// The database is mocked in this suite, so no test here proves an insert. What
// CAN be proven is that every writer names both halves — which is the defect
// that actually occurred. A `reference_type` with no `reference_id` beside it
// is unusable, and that pairing is visible in the source.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SERVICES = join(__dirname, '..', 'services')

const read = (relative: string) => readFileSync(join(SERVICES, relative), 'utf8')

/**
 * The file with its comments removed.
 *
 * ⚠️ NOT COSMETIC. The first version of this guard counted `reference_type:`
 * across the raw file and failed — on the comment ABOVE the fix, which quotes
 * the very defect being guarded. A guard that reads prose reports the mention
 * of a bug as the bug.
 *
 * The same trap caught the analytics predicate guard in H1. Strings can still
 * contain `//`, but none of these files build SQL with one, and a guard that
 * over-reports is at least loud rather than silently permissive.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/**
 * Every `stock_movements` insert in a file, as the object literal passed to it.
 *
 * Matched from the `.map(` or `.push(` that builds the row rather than from the
 * `.insert(` call, because all three writers build the rows first and insert an
 * array — the shape is decided where the object is written.
 */
const WRITERS: { file: string; label: string }[] = [
  { file: 'invoice.service.ts', label: 'invoice' },
  { file: 'purchasing.service.ts', label: 'purchase order' },
  { file: 'manufacturing.service.ts', label: 'work order' },
]

describe('a stock movement names the document that caused it', () => {
  it.each(WRITERS)('$label writes reference_id beside reference_type', ({ file }) => {
    const source = code(read(file))

    const types = (source.match(/reference_type:/g) ?? []).length
    const ids = (source.match(/reference_id:/g) ?? []).length

    // Not «both appear somewhere» — the COUNTS must match. A file with two
    // movement shapes and one reference_id is the exact half-wired state
    // invoice.service was in.
    expect(types).toBeGreaterThan(0)
    expect(ids).toBe(types)
  })

  it('invoice movements carry the invoice id, not just the word', () => {
    // The specific regression: `reference_type: 'invoice'` with nothing after
    // it. Anchored to the value so a future edit that drops the id is caught
    // even if some other `reference_id` exists elsewhere in the file.
    const source = code(read('invoice.service.ts'))
    const block = /reference_type: 'invoice',[\s\S]{0,600}?reference_id:/.exec(source)
    expect(block).not.toBeNull()
  })
})

describe('the stock history is reachable and workspace-scoped', () => {
  const history = read('inventory/stock-history.service.ts')

  it('proves the product belongs to the workspace before reading movements', () => {
    // `stock_movements` is reached BY product id. Reading it before confirming
    // the product is this workspace's would let a caller learn whether another
    // workspace's product id exists, from which error came back —
    // `product.service.delete` carries the same note.
    const productCheck = history.indexOf("from('products')")
    const movementRead = history.indexOf("from('stock_movements')")

    expect(productCheck).toBeGreaterThan(-1)
    expect(movementRead).toBeGreaterThan(-1)
    expect(productCheck).toBeLessThan(movementRead)
  })

  it('filters the movements by workspace too, not only by product', () => {
    const movementQuery = history.slice(history.indexOf("from('stock_movements')"))
    expect(movementQuery).toContain("eq('workspace_id', ctx.workspaceId)")
  })

  it('builds the running balance oldest-first', () => {
    // Computed in the other direction, every balance is wrong by the whole
    // history — and each row still looks individually plausible.
    const movementQuery = history.slice(history.indexOf("from('stock_movements')"))
    expect(movementQuery).toContain('ascending: true')
  })

  it('returns the stored quantity beside the computed total', () => {
    // Phase C says the projection is trigger-maintained. Returning both lets
    // the caller SHOW a disagreement instead of picking a side — §13: report
    // unhealthy data, never silently repair it.
    expect(history).toContain('storedQuantity')
    expect(history).toContain('movementTotal')
  })
})
