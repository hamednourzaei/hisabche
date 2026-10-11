// ============================================
// backend/src/services/migration/bom-import.domain.ts
//
// A stock-item sheet that carries each item's bill of materials.
//
// Accounting packages export it as the item on one row and its components on
// that row and the rows UNDER it, with the item's own cells left empty:
//
//     Name            Units   Component     Quantity
//     Hamper Type 1   Nos     Pen           10
//                             Eraser        5
//                             Pencil        10
//     Hamper Kids     Nos     Toy           2
//
// The component columns used to have «nowhere to go» — while the product has a
// whole production screen that holds exactly this. Here the rows are read as
// what they are: three components of one formula, belonging to the item above.
//
// What this file does NOT decide: what a component costs. A formula needs a
// unit cost per component, and the sheet does not carry one. A component found
// in the catalogue takes its current buying price; one that is not is written
// as a line of text with no cost — and the finding says the cost has to be set
// by a person. A cost is never invented.
//
// Pure: candidates and a catalogue in, plans and findings out.
// ============================================

import { comparisonKey } from './migration.domain'
import type { CandidateRow, Finding } from './migration.validate'

export interface BomComponentPlan {
  row: number
  name: string
  quantity: number
  unit: string | null
  /** The catalogue product this component is, when exactly one has that name. */
  productId: string | null
  /** Its current buying price; null when unknown (never taken as zero silently). */
  unitCost: number | null
}

export interface BomPlan {
  /** The row of the finished product this formula belongs to. */
  row: number
  productName: string
  /** Filled when the finished product is already in the catalogue. */
  productId: string | null
  components: BomComponentPlan[]
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/** Whether a candidate row carries a component (on an item's own row, or under it). */
export const hasComponent = (candidate: CandidateRow): boolean =>
  text(candidate.values['bomComponent']) !== ''

/**
 * Read the formulas out of validated product rows.
 *
 * A component belongs to the nearest row above it that names a product. One
 * with no product above it at all (the sheet starts with a component) has
 * nothing to belong to and is reported.
 */
export function planBoms(candidates: readonly CandidateRow[]): {
  plans: BomPlan[]
  findings: Finding[]
} {
  const plans: BomPlan[] = []
  const findings: Finding[] = []
  let current: BomPlan | null = null

  for (const candidate of candidates) {
    const name = text(candidate.values['name'])
    if (name !== '') {
      // A product row that could not be imported cannot own a formula either.
      current = candidate.importable
        ? { row: candidate.row, productName: name, productId: null, components: [] }
        : null
      if (current) plans.push(current)
    }

    if (!hasComponent(candidate)) continue

    if (!current) {
      findings.push({
        severity: 'warning',
        row: candidate.row,
        column: null,
        code: 'BOM_COMPONENT_WITHOUT_PRODUCT',
        detail: text(candidate.values['bomComponent']),
      })
      continue
    }

    const quantity = candidate.values['bomQuantity']
    // ⚠️ No quantity is not «one». A formula that uses «some» of a material
    // would cost and consume the wrong amount on every production run.
    if (typeof quantity !== 'number' || !(quantity > 0)) {
      findings.push({
        severity: 'warning',
        row: candidate.row,
        column: null,
        code: 'BOM_COMPONENT_NO_QUANTITY',
        detail: text(candidate.values['bomComponent']),
      })
      continue
    }

    current.components.push({
      row: candidate.row,
      name: text(candidate.values['bomComponent']),
      quantity,
      unit: text(candidate.values['bomUnit']) || null,
      productId: null,
      unitCost: null,
    })
  }

  return { plans: plans.filter((plan) => plan.components.length > 0), findings }
}

export interface CatalogueProduct {
  id: string
  name: string
  buyPrice: number | null
}

/**
 * Tie each formula and each component to the catalogue.
 *
 * `known` is what is in the business now; `incoming` is the product names this
 * same file is about to create (a component may be a product two rows down).
 */
export function resolveBoms(
  plans: BomPlan[],
  known: readonly CatalogueProduct[],
  incoming: readonly string[] = [],
): Finding[] {
  const findings: Finding[] = []
  const byName = new Map<string, CatalogueProduct[]>()
  for (const product of known) {
    const key = comparisonKey(product.name)
    if (key !== '') byName.set(key, [...(byName.get(key) ?? []), product])
  }
  const arriving = new Set(incoming.map(comparisonKey))
  const one = (name: string): CatalogueProduct | null => {
    const hits = byName.get(comparisonKey(name))
    return hits?.length === 1 ? (hits[0] ?? null) : null
  }

  for (const plan of plans) {
    plan.productId = one(plan.productName)?.id ?? null

    for (const component of plan.components) {
      const product = one(component.name)
      if (product) {
        component.productId = product.id
        component.unitCost =
          product.buyPrice !== null && product.buyPrice > 0 ? product.buyPrice : null
      }

      if (component.productId && component.unitCost !== null) continue
      // Arriving in this same file: it will be matched when the formula is
      // written, after the products exist.
      if (!component.productId && arriving.has(comparisonKey(component.name))) continue

      findings.push({
        severity: 'warning',
        row: component.row,
        column: null,
        code: component.productId ? 'BOM_COMPONENT_NO_COST' : 'BOM_COMPONENT_UNMATCHED',
        detail: component.name,
      })
    }
  }

  return findings
}

/**
 * The rows of the production editor for one formula: what `saveDefinition`
 * takes, keyed by the editor's own column ids.
 */
export function toProductionRows(plan: BomPlan) {
  return plan.components.map((component, index) => ({
    id: `import-${plan.row}-${index + 1}`,
    ...(component.productId ? { productId: component.productId } : {}),
    values: {
      description: component.name,
      quantity: String(component.quantity),
      // Unknown stays 0 on the line — and is REPORTED, so the formula's cost is
      // known to be incomplete rather than believed.
      unitPrice: String(component.unitCost ?? 0),
      ...(component.unit ? { unit: component.unit } : {}),
    },
  }))
}
