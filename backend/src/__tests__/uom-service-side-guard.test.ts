// ============================================
// backend/src/__tests__/uom-service-side-guard.test.ts
//
// L1 — «never enforce the conversion only in the UI».
//
// ---------------------------------------------------------------------------
// WHY THIS IS THE ONE GUARD L1 NEEDS
//
// The spec states it as an absolute: the SERVICE must produce the base
// quantity. A conversion that lives on screen is absent from
//
//   • the REST API, which every integration and script uses
//   • the CSV importer
//   • the mobile app
//   • every offline write that syncs in later
//
// and each of those then writes a raw display quantity into `stock_movements`
// — the source of truth for inventory since Phase C. The symptom would be
// stock that is wrong by exactly the conversion factor, on some rows and not
// others, with nothing anywhere reporting an error.
//
// So the check is not «is there a conversion function» but «does the code that
// writes movements call it».
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SERVICES = join(__dirname, '..', 'services')
const read = (rel: string) => readFileSync(join(SERVICES, rel), 'utf8')

/** Comments stripped — a guard that reads prose reports a mention as the fact. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('the base quantity is produced by the service', () => {
  const invoice = code(read('invoice.service.ts'))

  it('batchUpdateStock converts before writing a movement', () => {
    expect(invoice).toContain('toBaseQuantity')
  })

  it('the movement’s quantity comes from the CONVERSION, not the raw line', () => {
    // The regression in one assertion. `quantity: direction * item.quantity`
    // is what this looked like before L1, and it is what a careless edit
    // would restore.
    expect(invoice).toContain('quantity: direction * converted.baseQuantity')
    expect(invoice).not.toMatch(/quantity:\s*direction\s*\*\s*\(Number\(item\.quantity\)/)
  })

  it('refuses an undeclared unit instead of passing it through', () => {
    // Silently treating an unknown unit as the base stores a carton count as
    // a piece count — a wrong quantity nothing would ever flag.
    expect(invoice).toContain('if (!converted.ok)')
  })
})

describe('the conversion rule is driven by product_units, not by units', () => {
  const domain = code(read('inventory/unit-conversion.domain.ts'))

  it('uses the PER-PRODUCT factor', () => {
    expect(domain).toContain('conversionFactorToBase')
  })

  it('never reads the dimension factor', () => {
    // ⚠️ THE CORRUPTION HAZARD. `units.conversion_factor` says a kilogram is
    // 1000 grams. Applying it to a historical «5 kg» line re-reads it as 5000
    // — every weighed product's stock wrong by three orders of magnitude,
    // permanently, in the source of truth.
    expect(domain).not.toContain('conversion_factor')
    expect(domain).not.toContain('dimensionFactor')
  })

  it('treats an empty option set as factor 1', () => {
    // This is what keeps every pre-L1 product behaving exactly as before.
    expect(domain).toContain('options.length === 0')
  })
})

describe('a database without the L1 tables still sells', () => {
  const invoice = code(read('invoice.service.ts'))

  it('a missing product_unit_options table returns no options, not an error', () => {
    // Refusing to record an invoice because a units table is absent would be
    // a far worse failure than not converting — and phase-l-02 may not have
    // been run yet.
    // A fixed window rather than a brace match: the method contains nested
    // blocks, and a non-greedy `\n  }` stops at the first inner one — which
    // is what the first version of this test did, and it failed on code that
    // was correct.
    // The DEFINITION, not the call site — plain indexOf finds the call first.
    const start = invoice.indexOf('private async loadProductUnits')
    expect(start).toBeGreaterThan(-1)
    const loader = invoice.slice(start, start + 1600)

    expect(loader).toContain("'42P01'")
    expect(loader).toContain('return byProduct')
  })
})
