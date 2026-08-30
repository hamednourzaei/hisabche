// ============================================
// The tax engine.
//
// Organised around the invariants rather than the API, because the failures
// this core exists to prevent are all arithmetic:
//
//   * a hundred-line invoice that does not foot
//   * a tax-inclusive price taxed as though it were exclusive
//   * a credit note that does not exactly reverse its invoice
//   * a rounding difference that disappears instead of being reported
//   * a return that cannot tell zero-rated from exempt
//   * an offline invoice silently re-rated at sync
// ============================================

import { describe, expect, it } from 'vitest'

import {
  computeDocument,
  computeLine,
  detectDrift,
  footingError,
  recomputeFromSnapshot,
  resolveRule,
  roundHalfAwayFromZero,
  toMinor,
  validateComponents,
  verifyAgainstSnapshot,
  type TaxComponent,
  type TaxRule,
  type TaxSnapshot,
  type TaxableLine,
} from '../services/tax'

const vat = (over: Partial<TaxComponent> = {}): TaxComponent => ({
  id: 'vat',
  labelKey: 'tax.vat',
  computation: 'percent',
  treatment: 'standard',
  rate: 15,
  includedInPrice: false,
  ...over,
})

const line = (over: Partial<TaxableLine> = {}): TaxableLine => ({
  lineId: 'l1',
  quantity: 1,
  unitPriceMinor: toMinor(100),
  components: [vat()],
  ...over,
})

describe('everything is integers', () => {
  it('converts a price to minor units exactly', () => {
    expect(toMinor(33.33)).toBe(3333)
    expect(toMinor(0.1 + 0.2)).toBe(30)
  })

  it('ROUNDS SYMMETRICALLY, so a reversal returns to the original', () => {
    // Math.round(-0.5) is -0, which makes a credit note round differently from
    // the invoice it reverses.
    expect(roundHalfAwayFromZero(2.5)).toBe(3)
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3)
    expect(roundHalfAwayFromZero(-2.5)).toBe(-roundHalfAwayFromZero(2.5))
  })
})

describe('a single line', () => {
  it('adds an exclusive tax to the net', () => {
    const result = computeLine(line())
    expect(result.netMinor).toBe(10_000)
    expect(result.taxMinor).toBe(1500)
    expect(result.totalMinor).toBe(11_500)
  })

  it('EXTRACTS an inclusive tax from the stated price', () => {
    // 115 inclusive of 15% is 100 + 15, NOT 115 + 17.25. The wrong formula
    // (gross × rate / 100) overstates the tax on every retail line.
    const result = computeLine(
      line({ unitPriceMinor: toMinor(115), components: [vat({ includedInPrice: true })] }),
    )
    expect(result.netMinor).toBe(10_000)
    expect(result.taxMinor).toBe(1500)
    expect(result.totalMinor).toBe(11_500)
  })

  it('applies the rate after the discount, not before', () => {
    const result = computeLine(line({ discountMinor: toMinor(20) }))
    expect(result.netMinor).toBe(8000)
    expect(result.taxMinor).toBe(1200)
  })

  it('multiplies by quantity', () => {
    const result = computeLine(line({ quantity: 3 }))
    expect(result.netMinor).toBe(30_000)
    expect(result.taxMinor).toBe(4500)
  })

  it('charges a fixed amount per unit', () => {
    const result = computeLine(
      line({
        quantity: 4,
        components: [vat({ id: 'levy', computation: 'fixed_per_unit', rate: 50 })],
      }),
    )
    expect(result.taxMinor).toBe(200)
  })

  it('charges a fixed amount per line regardless of quantity', () => {
    const result = computeLine(
      line({
        quantity: 40,
        components: [vat({ id: 'stamp', computation: 'fixed_per_line', rate: 500 })],
      }),
    )
    expect(result.taxMinor).toBe(500)
  })
})

describe('zero-rated is not exempt is not not-applicable', () => {
  it('charges nothing for all three', () => {
    for (const treatment of ['zero_rated', 'exempt', 'not_applicable'] as const) {
      const result = computeLine(line({ components: [vat({ treatment })] }))
      expect(result.taxMinor).toBe(0)
    }
  })

  it('KEEPS zero-rated and exempt on the document, so the return can tell them apart', () => {
    // A zero-rated supply is reported as taxable at 0%; an exempt one as
    // exempt. Dropping either makes the return wrong while the invoice looks
    // right.
    const zero = computeLine(line({ components: [vat({ treatment: 'zero_rated' })] }))
    const exempt = computeLine(line({ components: [vat({ treatment: 'exempt' })] }))

    expect(zero.components[0]!.treatment).toBe('zero_rated')
    expect(exempt.components[0]!.treatment).toBe('exempt')
    expect(zero.components[0]!.baseMinor).toBe(10_000)
  })

  it('drops not-applicable entirely — it is not reported at all', () => {
    const result = computeLine(line({ components: [vat({ treatment: 'not_applicable' })] }))
    expect(result.components).toEqual([])
  })
})

describe('compound tax', () => {
  const base = vat({ id: 'vat', rate: 10 })
  const surcharge = vat({ id: 'surcharge', rate: 5, compoundsOn: ['vat'] })

  it('applies the compounding component to net plus the named one', () => {
    // 100 → VAT 10 → surcharge on 110 = 5.50, not on 100 = 5.00
    const result = computeLine(line({ components: [base, surcharge] }))
    expect(result.components.find((c) => c.componentId === 'vat')!.amountMinor).toBe(1000)
    expect(result.components.find((c) => c.componentId === 'surcharge')!.amountMinor).toBe(550)
  })

  it('gives the same answer whatever order the template lists them in', () => {
    // Evaluating in declaration order would make the result depend on how
    // somebody happened to sort the rows.
    const forward = computeLine(line({ components: [base, surcharge] }))
    const backward = computeLine(line({ components: [surcharge, base] }))
    expect(backward.taxMinor).toBe(forward.taxMinor)
  })
})

describe('the document foots exactly', () => {
  it('sums the lines with no discrepancy', () => {
    const document = computeDocument([
      line({ lineId: 'a', unitPriceMinor: toMinor(33.33) }),
      line({ lineId: 'b', unitPriceMinor: toMinor(66.67) }),
      line({ lineId: 'c', unitPriceMinor: toMinor(0.01) }),
    ])
    expect(footingError(document)).toBe(0)
  })

  it('foots on a hundred awkward lines', () => {
    // The case that breaks float arithmetic and per-line rounding alike.
    const lines = Array.from({ length: 100 }, (_, i) =>
      line({ lineId: `l${i}`, unitPriceMinor: toMinor(0.07 * (i + 1)) }),
    )
    const document = computeDocument(lines)
    expect(footingError(document)).toBe(0)
  })

  it('REPORTS the rounding residual even when it is zero', () => {
    // Its absence must be a fact, not an omission.
    const document = computeDocument([line()])
    expect(document.roundingResidualMinor).toBe(0)
    expect(document).toHaveProperty('roundingResidualMinor')
  })

  it('still foots after assigning the residual under per_document', () => {
    const lines = Array.from({ length: 7 }, (_, i) =>
      line({ lineId: `l${i}`, unitPriceMinor: toMinor(3.33) }),
    )
    const document = computeDocument(lines, 'per_document')
    expect(footingError(document)).toBe(0)
    expect(document.netMinor + document.taxMinor).toBe(document.totalMinor)
  })
})

describe('withholding is deducted, not added', () => {
  const wht = vat({ id: 'wht', rate: 7, isWithholding: true })

  it('leaves the total alone and reduces what is payable', () => {
    // The supplier is still owed the gross; the buyer remits this part.
    const document = computeDocument([line({ components: [vat(), wht] })])
    expect(document.taxMinor).toBe(1500)
    expect(document.totalMinor).toBe(11_500)
    expect(document.withholdingMinor).toBe(700)
    expect(document.payableMinor).toBe(10_800)
  })

  it('refuses a withholding component that is also inclusive', () => {
    // The two say opposite things about the same money.
    expect(validateComponents([vat({ isWithholding: true, includedInPrice: true })])).toContain(
      'TAX_WITHHOLDING_INCLUSIVE',
    )
  })
})

describe('the summary a return is built from', () => {
  it('groups base and tax per component', () => {
    const document = computeDocument([
      line({ lineId: 'a' }),
      line({ lineId: 'b', unitPriceMinor: toMinor(200) }),
    ])
    const row = document.summary.find((r) => r.componentId === 'vat')!
    expect(row.baseMinor).toBe(30_000)
    expect(row.amountMinor).toBe(4500)
  })

  it('carries the treatment through, so exempt turnover is reportable', () => {
    const document = computeDocument([line({ components: [vat({ treatment: 'exempt' })] })])
    expect(document.summary[0]!.treatment).toBe('exempt')
    expect(document.summary[0]!.baseMinor).toBe(10_000)
  })
})

describe('resolving which rule applies', () => {
  const rules: TaxRule[] = [
    { id: 'default', componentIds: ['vat'], priority: 100 },
    { id: 'product', componentIds: ['reduced'], productId: 'p1', priority: 100 },
    { id: 'category', componentIds: ['cat'], categoryId: 'c1', priority: 100 },
    {
      id: 'export',
      componentIds: ['zero'],
      partyTaxCategory: 'export',
      priority: 100,
    },
  ]

  it('prefers the product rule over the category and the default', () => {
    const rule = resolveRule(rules, { productId: 'p1', categoryId: 'c1', onDate: '2026-06-01' })
    expect(rule?.id).toBe('product')
  })

  it('falls back to the category, then the default', () => {
    expect(resolveRule(rules, { categoryId: 'c1', onDate: '2026-06-01' })?.id).toBe('category')
    expect(resolveRule(rules, { onDate: '2026-06-01' })?.id).toBe('default')
  })

  it("honours the party's tax category", () => {
    expect(resolveRule(rules, { partyTaxCategory: 'export', onDate: '2026-06-01' })?.id).toBe(
      'export',
    )
  })

  it('USES THE DOCUMENT DATE, so a backdated invoice keeps the old rate', () => {
    const dated: TaxRule[] = [
      { id: 'old', componentIds: ['v10'], validTo: '2026-03-31', priority: 100 },
      { id: 'new', componentIds: ['v15'], validFrom: '2026-04-01', priority: 100 },
    ]
    expect(resolveRule(dated, { onDate: '2026-02-15' })?.id).toBe('old')
    expect(resolveRule(dated, { onDate: '2026-05-15' })?.id).toBe('new')
  })

  it('returns nothing rather than guessing when no rule matches', () => {
    expect(resolveRule([], { onDate: '2026-06-01' })).toBeNull()
  })

  it('resolves the same way whatever order the rules arrive in', () => {
    const forward = resolveRule(rules, { productId: 'p1', onDate: '2026-06-01' })
    const backward = resolveRule([...rules].reverse(), { productId: 'p1', onDate: '2026-06-01' })
    expect(backward?.id).toBe(forward?.id)
  })
})

describe('the offline snapshot', () => {
  const snapshot: TaxSnapshot = {
    configVersion: 4,
    resolvedOn: '2026-06-01',
    resolvedAt: '2026-06-01T09:00:00.000Z',
    ruleByLine: { l1: 'default' },
    components: [vat({ rate: 10 })],
    policy: 'per_line',
  }

  it('reproduces the identical figures from the snapshot alone', () => {
    // The property that makes an offline invoice trustworthy: the phone that
    // wrote it and the server that receives it must arrive at the same number.
    const first = recomputeFromSnapshot(snapshot, [
      { lineId: 'l1', quantity: 2, unitPriceMinor: toMinor(49.99) },
    ])
    const second = recomputeFromSnapshot(snapshot, [
      { lineId: 'l1', quantity: 2, unitPriceMinor: toMinor(49.99) },
    ])
    expect(second.totalMinor).toBe(first.totalMinor)
    expect(first.taxMinor).toBe(1000)
  })

  it('DOES NOT re-rate when the live rate has changed', () => {
    // The invoice in the customer's hand keeps the rate it was issued with.
    const recomputed = recomputeFromSnapshot(snapshot, [
      { lineId: 'l1', quantity: 1, unitPriceMinor: toMinor(100) },
    ])
    expect(recomputed.taxMinor).toBe(1000) // the frozen 10%, not today's 15%
  })

  it('detects that the configuration moved', () => {
    const drift = detectDrift(snapshot, { configVersion: 7, components: [vat({ rate: 15 })] })
    expect(drift.map((d) => d.kind)).toEqual(
      expect.arrayContaining(['config_version', 'rate_changed']),
    )
  })

  it('reports what the rate was and what it is now', () => {
    const drift = detectDrift(snapshot, { configVersion: 7, components: [vat({ rate: 15 })] })
    const rate = drift.find((d) => d.kind === 'rate_changed')!
    expect(rate.was).toBe(10)
    expect(rate.now).toBe(15)
  })

  it('detects a component that no longer exists', () => {
    const drift = detectDrift(snapshot, { configVersion: 4, components: [] })
    expect(drift.some((d) => d.kind === 'component_removed')).toBe(true)
  })

  it('detects a component that did not exist then', () => {
    const drift = detectDrift(snapshot, {
      configVersion: 4,
      components: [vat({ rate: 10 }), vat({ id: 'levy', labelKey: 'tax.levy' })],
    })
    expect(drift.some((d) => d.kind === 'component_added')).toBe(true)
  })

  it('reports NO drift when nothing changed', () => {
    // The common case, and worth being able to state.
    expect(detectDrift(snapshot, { configVersion: 4, components: [vat({ rate: 10 })] })).toEqual([])
  })

  it('catches a stored total that does not match its own snapshot', () => {
    const computed = recomputeFromSnapshot(snapshot, [
      { lineId: 'l1', quantity: 1, unitPriceMinor: toMinor(100) },
    ])
    const check = verifyAgainstSnapshot({ snapshot, computed }, 99_999)
    expect(check.matches).toBe(false)
    expect(check.differenceMinor).toBe(99_999 - computed.totalMinor)
  })

  it('passes a stored total that does match', () => {
    const computed = recomputeFromSnapshot(snapshot, [
      { lineId: 'l1', quantity: 1, unitPriceMinor: toMinor(100) },
    ])
    expect(verifyAgainstSnapshot({ snapshot, computed }, computed.totalMinor).matches).toBe(true)
  })
})

describe('configuration validation', () => {
  it('refuses a percentage outside 0–100', () => {
    expect(validateComponents([vat({ rate: 150 })])).toContain('TAX_RATE_INVALID')
  })

  it('refuses a component that compounds on one that does not exist', () => {
    expect(validateComponents([vat({ compoundsOn: ['ghost'] })])).toContain('TAX_COMPOUND_UNKNOWN')
  })

  it('refuses a compound cycle', () => {
    // A compounds on B compounds on A would loop forever at computation time.
    expect(
      validateComponents([
        vat({ id: 'a', compoundsOn: ['b'] }),
        vat({ id: 'b', compoundsOn: ['a'] }),
      ]),
    ).toContain('TAX_COMPOUND_CYCLE')
  })

  it('refuses to extract a compounding tax from an inclusive price', () => {
    // There is no single correct answer, so it is refused rather than guessed.
    expect(
      validateComponents([
        vat({ id: 'x' }),
        vat({ id: 'y', includedInPrice: true, compoundsOn: ['x'] }),
      ]),
    ).toContain('TAX_INCLUSIVE_COMPOUND_UNSUPPORTED')
  })

  it('accepts an ordinary configuration', () => {
    expect(validateComponents([vat()])).toEqual([])
  })
})

describe('a credit note exactly reverses its invoice', () => {
  it('negating the quantities returns every figure to zero', () => {
    const original = computeDocument([
      line({ lineId: 'a', quantity: 3, unitPriceMinor: toMinor(33.33) }),
      line({ lineId: 'b', quantity: 7, unitPriceMinor: toMinor(19.99) }),
    ])

    const reversal = computeDocument([
      line({ lineId: 'a', quantity: -3, unitPriceMinor: toMinor(33.33) }),
      line({ lineId: 'b', quantity: -7, unitPriceMinor: toMinor(19.99) }),
    ])

    expect(original.totalMinor + reversal.totalMinor).toBe(0)
    expect(original.taxMinor + reversal.taxMinor).toBe(0)
  })
})
