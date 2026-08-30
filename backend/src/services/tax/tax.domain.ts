// ============================================
// backend/src/services/tax/tax.domain.ts
//
// What tax is owed on a document, computed exactly.
//
// ---------------------------------------------------------------------------
// EVERYTHING HERE IS IN MINOR UNITS
//
// Tax is the place where floating point stops being a theoretical problem. A
// 15% rate on 33.33 is 4.9995, and whether that becomes 5.00 or 4.99 decides
// whether a hundred-line invoice foots. Worse, `0.1 + 0.2 !== 0.3` means the
// same document can total differently depending on the order its lines were
// summed.
//
// So every function below takes and returns INTEGER minor units (afghani ×100)
// and the boundary converts once, at the edge. There is no float arithmetic in
// this file and there must never be.
//
// ---------------------------------------------------------------------------
// THE INVARIANT THIS FILE EXISTS TO GUARANTEE
//
//   Σ(line net) + Σ(tax) − Σ(withholding) === document total
//
// Exactly. Not to within a rounding tolerance. When per-line rounding and a
// document-level rate disagree — and they will — the difference is not
// absorbed silently: it is carried as a named, visible residual and assigned
// under a stated policy. A rounding difference nobody can see is a rounding
// difference nobody can reconcile.
//
// ---------------------------------------------------------------------------
// ZERO-RATED IS NOT EXEMPT IS NOT NOT-APPLICABLE
//
// All three produce no tax, and all three report differently: a zero-rated
// supply appears on a return as taxable at 0%, an exempt one appears as exempt,
// and a not-applicable one does not appear at all. Collapsing them into "0"
// makes the return wrong while the invoice looks right.
// ============================================

export type TaxTreatment =
  /** Taxable at the stated rate. */
  | 'standard'
  /** Taxable, at zero percent. Appears on the return as a taxable supply. */
  | 'zero_rated'
  /** Outside the tax, but reportable as exempt. */
  | 'exempt'
  /** This component does not apply to this item at all. Not reported. */
  | 'not_applicable'

export type TaxComputation =
  /** A percentage of the line's net amount. */
  | 'percent'
  /** A fixed amount per UNIT, not per line. */
  | 'fixed_per_unit'
  /** A fixed amount per line, whatever the quantity. */
  | 'fixed_per_line'

export interface TaxComponent {
  id: string
  /** A key the client translates; never a rendered sentence. */
  labelKey: string
  computation: TaxComputation
  treatment: TaxTreatment
  /** Percent (e.g. 15 for 15%) or minor units for the fixed computations. */
  rate: number
  /**
   * The stated price already contains this tax, so it is EXTRACTED from the
   * line rather than added to it. Retail pricing in Afghanistan is normally
   * quoted this way.
   */
  includedInPrice: boolean
  /**
   * Applies on top of the net PLUS the components listed here — tax on tax.
   * Named explicitly rather than inferred from ordering, because "the next one
   * compounds" is a rule somebody has to be able to read.
   */
  compoundsOn?: string[] | undefined
  /**
   * Deducted from what is PAID rather than added to what is owed: withholding.
   * The supplier is still owed the gross; the buyer remits this part directly.
   */
  isWithholding?: boolean | undefined
  /** The ledger account this component posts to, by role or by id. */
  accountId?: string | null | undefined
}

export interface TaxableLine {
  lineId: string
  quantity: number
  /** Unit price in MINOR UNITS. */
  unitPriceMinor: number
  /** Line discount in MINOR UNITS, already computed. */
  discountMinor?: number | undefined
  /** Components that apply to THIS line, already resolved. */
  components: TaxComponent[]
}

export interface ComputedComponent {
  componentId: string
  labelKey: string
  treatment: TaxTreatment
  /** What the rate was applied to, in minor units. */
  baseMinor: number
  rate: number
  computation: TaxComputation
  /** The tax itself, in minor units. Zero for every non-standard treatment. */
  amountMinor: number
  includedInPrice: boolean
  isWithholding: boolean
}

export interface ComputedLine {
  lineId: string
  /** Price × quantity − discount, BEFORE any included tax is extracted. */
  grossMinor: number
  /** What the rate applies to: gross less any tax already inside the price. */
  netMinor: number
  components: ComputedComponent[]
  taxMinor: number
  withholdingMinor: number
  /** net + tax. What the customer is billed for this line. */
  totalMinor: number
}

// ─── Integer helpers ─────────────────────────────────────────────────────────

/**
 * Round half AWAY FROM ZERO, symmetrically.
 *
 * `Math.round` rounds −0.5 to −0, which makes a credit note round differently
 * from the invoice it reverses — so a refund of a refund does not return to
 * the original figure. Symmetry is what makes a reversal exact.
 */
export function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value)
}

export function toMinor(major: number): number {
  return roundHalfAwayFromZero(major * 100)
}

export function toMajor(minor: number): number {
  return minor / 100
}

/** Percent of an integer, in integers. `rate` is a percentage, e.g. 15. */
function percentOf(baseMinor: number, rate: number): number {
  // ×100 for the rate's own two decimals (a 7.25% rate is real), then one
  // division. Two divisions would round twice.
  return roundHalfAwayFromZero((baseMinor * rate) / 100)
}

/**
 * The tax hidden inside a tax-inclusive price.
 *
 *   included = gross × rate / (100 + rate)
 *
 * NOT `gross × rate / 100`, which is the mistake that overstates the tax on
 * every retail line and makes the net smaller than it should be.
 */
function extractIncluded(grossMinor: number, rate: number): number {
  if (rate <= -100) return 0
  return roundHalfAwayFromZero((grossMinor * rate) / (100 + rate))
}

// ─── One line ────────────────────────────────────────────────────────────────

/**
 * Compute one line's tax.
 *
 * The order is load-bearing:
 *   1. gross      price × quantity − discount
 *   2. extract    remove every tax already inside the price → net
 *   3. add        apply the exclusive components to the net
 *   4. compound   apply the compounding ones to net + their named components
 *
 * Getting 2 and 3 the wrong way round applies exclusive tax to a base that
 * still contains someone else's tax.
 */
export function computeLine(line: TaxableLine): ComputedLine {
  const grossMinor =
    roundHalfAwayFromZero(line.unitPriceMinor * line.quantity) - (line.discountMinor ?? 0)

  const applicable = line.components.filter((c) => c.treatment !== 'not_applicable')

  // ── 2. what is already inside the price ──
  let includedTotal = 0
  const includedByComponent = new Map<string, number>()

  for (const component of applicable) {
    if (!component.includedInPrice || component.treatment !== 'standard') continue
    if (component.computation !== 'percent') continue

    const amount = extractIncluded(grossMinor, component.rate)
    includedByComponent.set(component.id, amount)
    includedTotal += amount
  }

  const netMinor = grossMinor - includedTotal

  // ── 3 & 4. the exclusive ones, compounding last ──
  const computed: ComputedComponent[] = []
  const amountById = new Map<string, number>()

  const baseFor = (component: TaxComponent): number => {
    if (!component.compoundsOn || component.compoundsOn.length === 0) return netMinor
    // Tax on tax: the net plus only the components this one names.
    return component.compoundsOn.reduce((sum, id) => sum + (amountById.get(id) ?? 0), netMinor)
  }

  // Non-compounding first: a compounding component cannot see an amount that
  // has not been computed yet, and evaluating in declaration order would make
  // the result depend on how somebody happened to sort the template.
  const ordered = [
    ...applicable.filter((c) => !c.compoundsOn || c.compoundsOn.length === 0),
    ...applicable.filter((c) => c.compoundsOn && c.compoundsOn.length > 0),
  ]

  for (const component of ordered) {
    const included = includedByComponent.get(component.id)

    let amountMinor: number
    let baseMinor: number

    if (included !== undefined) {
      amountMinor = included
      baseMinor = netMinor
    } else if (component.treatment !== 'standard') {
      // zero_rated and exempt both compute to nothing — and are both KEPT, so
      // the return can tell them apart later.
      amountMinor = 0
      baseMinor = netMinor
    } else {
      baseMinor = baseFor(component)
      amountMinor =
        component.computation === 'percent'
          ? percentOf(baseMinor, component.rate)
          : component.computation === 'fixed_per_unit'
            ? roundHalfAwayFromZero(component.rate * line.quantity)
            : component.rate
    }

    amountById.set(component.id, amountMinor)

    computed.push({
      componentId: component.id,
      labelKey: component.labelKey,
      treatment: component.treatment,
      baseMinor,
      rate: component.rate,
      computation: component.computation,
      amountMinor,
      includedInPrice: component.includedInPrice,
      isWithholding: component.isWithholding === true,
    })
  }

  const taxMinor = computed
    .filter((c) => !c.isWithholding)
    .reduce((sum, c) => sum + c.amountMinor, 0)

  const withholdingMinor = computed
    .filter((c) => c.isWithholding)
    .reduce((sum, c) => sum + c.amountMinor, 0)

  return {
    lineId: line.lineId,
    grossMinor,
    netMinor,
    components: computed,
    taxMinor,
    withholdingMinor,
    totalMinor: netMinor + taxMinor,
  }
}

// ─── The document ────────────────────────────────────────────────────────────

export type RoundingPolicy =
  /** The sum of the rounded lines is the truth. Each line foots on its own. */
  | 'per_line'
  /**
   * The document-level figure is the truth; the difference from the summed
   * lines is assigned to the largest line so the document foots.
   */
  | 'per_document'

export interface TaxSummaryRow {
  componentId: string
  labelKey: string
  treatment: TaxTreatment
  rate: number
  /** What was taxed at this rate, across the document. */
  baseMinor: number
  amountMinor: number
}

export interface ComputedDocument {
  lines: ComputedLine[]
  netMinor: number
  taxMinor: number
  withholdingMinor: number
  totalMinor: number
  /** What is actually payable now: total less withholding. */
  payableMinor: number
  /** Base and tax per component — the shape a tax return needs. */
  summary: TaxSummaryRow[]
  /**
   * The difference between the summed lines and the document-level figure,
   * in minor units. Reported ALWAYS, even when zero, so its absence is a fact
   * rather than an omission.
   */
  roundingResidualMinor: number
  policy: RoundingPolicy
}

export function computeDocument(
  lines: TaxableLine[],
  policy: RoundingPolicy = 'per_line',
): ComputedDocument {
  const computed = lines.map(computeLine)

  const netMinor = computed.reduce((sum, l) => sum + l.netMinor, 0)
  let taxMinor = computed.reduce((sum, l) => sum + l.taxMinor, 0)
  const withholdingMinor = computed.reduce((sum, l) => sum + l.withholdingMinor, 0)

  // ── the summary a tax return is built from ──
  const summaryMap = new Map<string, TaxSummaryRow>()

  for (const line of computed) {
    for (const component of line.components) {
      const existing = summaryMap.get(component.componentId) ?? {
        componentId: component.componentId,
        labelKey: component.labelKey,
        treatment: component.treatment,
        rate: component.rate,
        baseMinor: 0,
        amountMinor: 0,
      }
      existing.baseMinor += component.baseMinor
      existing.amountMinor += component.amountMinor
      summaryMap.set(component.componentId, existing)
    }
  }

  const summary = [...summaryMap.values()]

  // ── the residual ──
  // What the tax WOULD be if each rate were applied once to the document's
  // whole base, rather than line by line. The two differ by at most a few
  // minor units, and that difference is exactly what goes missing when
  // nobody names it.
  let documentLevelTax = 0
  for (const row of summary) {
    if (row.treatment !== 'standard') continue
    const component = lines.flatMap((l) => l.components).find((c) => c.id === row.componentId)
    if (!component || component.computation !== 'percent' || component.isWithholding) {
      documentLevelTax += row.amountMinor
      continue
    }
    documentLevelTax += component.includedInPrice
      ? extractIncluded(row.baseMinor + row.amountMinor, component.rate)
      : percentOf(row.baseMinor, component.rate)
  }

  const roundingResidualMinor = documentLevelTax - taxMinor

  if (policy === 'per_document' && roundingResidualMinor !== 0 && computed.length > 0) {
    // Assigned to the LARGEST line, where a one-unit shift is least visible
    // and least surprising. Never spread across lines: that turns one
    // explainable difference into several unexplainable ones.
    const largest = computed.reduce((a, b) => (b.netMinor > a.netMinor ? b : a))
    largest.taxMinor += roundingResidualMinor
    largest.totalMinor += roundingResidualMinor
    taxMinor += roundingResidualMinor
  }

  const totalMinor = netMinor + taxMinor

  return {
    lines: computed,
    netMinor,
    taxMinor,
    withholdingMinor,
    totalMinor,
    payableMinor: totalMinor - withholdingMinor,
    summary,
    roundingResidualMinor,
    policy,
  }
}

/**
 * The invariant, as a function so callers can assert it too.
 *
 * Returns the discrepancy in minor units. Anything but 0 is a bug in this
 * file, not a figure to display.
 */
export function footingError(document: ComputedDocument): number {
  const lineSum = document.lines.reduce((sum, l) => sum + l.netMinor + l.taxMinor, 0)
  return lineSum - document.totalMinor
}

// ─── Resolving which components apply ────────────────────────────────────────

export interface TaxRule {
  id: string
  componentIds: string[]
  /** Narrower matches win. Null matches anything. */
  productId?: string | null | undefined
  categoryId?: string | null | undefined
  /** A customer/supplier classification — Odoo's fiscal position in effect. */
  partyTaxCategory?: string | null | undefined
  /** Applies to documents dated on or after this. */
  validFrom?: string | null | undefined
  validTo?: string | null | undefined
  priority: number
}

export interface ResolutionRequest {
  productId?: string | null | undefined
  categoryId?: string | null | undefined
  partyTaxCategory?: string | null | undefined
  /** The DOCUMENT's date, not today: a backdated invoice uses the old rate. */
  onDate: string
}

/**
 * Which rule decides this line's tax.
 *
 * Specificity order, most specific first: product + party category, product,
 * category + party category, category, party category, default. That mirrors
 * how both ERPNext and Odoo resolve, and more importantly it is the order a
 * shopkeeper expects — "this rule is about THIS item" beats "this rule is
 * about everything".
 *
 * Ties break on priority then id, so the answer never depends on fetch order.
 */
export function resolveRule(rules: TaxRule[], request: ResolutionRequest): TaxRule | null {
  const applicable = rules.filter((rule) => {
    if (rule.validFrom && request.onDate < rule.validFrom) return false
    if (rule.validTo && request.onDate > rule.validTo) return false

    if (rule.productId && rule.productId !== request.productId) return false
    if (rule.categoryId && rule.categoryId !== request.categoryId) return false
    if (rule.partyTaxCategory && rule.partyTaxCategory !== request.partyTaxCategory) return false

    return true
  })

  if (applicable.length === 0) return null

  const specificity = (rule: TaxRule) =>
    (rule.productId ? 4 : 0) + (rule.categoryId ? 2 : 0) + (rule.partyTaxCategory ? 1 : 0)

  return applicable.sort((a, b) => {
    const bySpecificity = specificity(b) - specificity(a)
    if (bySpecificity !== 0) return bySpecificity
    if (a.priority !== b.priority) return a.priority - b.priority
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })[0]!
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type TaxRuleCode =
  | 'TAX_RATE_INVALID'
  | 'TAX_LABEL_REQUIRED'
  | 'TAX_COMPOUND_UNKNOWN'
  | 'TAX_COMPOUND_CYCLE'
  | 'TAX_INCLUSIVE_COMPOUND_UNSUPPORTED'
  | 'TAX_WITHHOLDING_INCLUSIVE'

export function validateComponents(components: TaxComponent[]): TaxRuleCode[] {
  const problems: TaxRuleCode[] = []
  const byId = new Map(components.map((c) => [c.id, c]))

  for (const component of components) {
    if (!component.labelKey) problems.push('TAX_LABEL_REQUIRED')

    if (component.computation === 'percent' && (component.rate < 0 || component.rate > 100)) {
      problems.push('TAX_RATE_INVALID')
    }
    if (component.computation !== 'percent' && component.rate < 0) {
      problems.push('TAX_RATE_INVALID')
    }

    // Withholding is deducted from the payment, so it cannot also be baked
    // into the price — the two say opposite things about the same money.
    if (component.isWithholding && component.includedInPrice) {
      problems.push('TAX_WITHHOLDING_INCLUSIVE')
    }

    // Extracting a compounding tax out of an inclusive price has no single
    // correct answer, so it is refused rather than guessed.
    if (component.includedInPrice && component.compoundsOn?.length) {
      problems.push('TAX_INCLUSIVE_COMPOUND_UNSUPPORTED')
    }

    for (const dependency of component.compoundsOn ?? []) {
      if (!byId.has(dependency)) problems.push('TAX_COMPOUND_UNKNOWN')
    }
  }

  // A compounds on B compounds on A would loop forever at computation time.
  for (const component of components) {
    const seen = new Set<string>()
    const walk = (id: string): boolean => {
      if (seen.has(id)) return true
      seen.add(id)
      return (byId.get(id)?.compoundsOn ?? []).some(walk)
    }
    if ((component.compoundsOn ?? []).some(walk)) {
      problems.push('TAX_COMPOUND_CYCLE')
      break
    }
  }

  return [...new Set(problems)]
}
