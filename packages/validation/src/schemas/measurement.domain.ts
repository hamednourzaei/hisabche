// ============================================
// packages/validation/src/schemas/measurement.domain.ts
//
// MEASUREMENT — the first real capability, shared by every weight/length/
// volume trade. It is not a jewellery package and it owns no money rule.
//
// The model is deliberately the simplest one the product already uses:
//
//   a line's quantity is expressed in the LINE'S unit, and the unit price is
//   per that same unit. 15 grams × 33,000,000 per gram = 495,000,000.
//
// A product's inventory unit and its price unit are therefore the same unit.
// Multiplying by an optional «net weight» column is a separate, deliberate
// user choice for «one piece, priced from its weight» — never an inference.
//
// ⚠️ PIECES AND GRAMS ARE NOT INTERCHANGEABLE. Only units the product model
// defines a conversion for (kg ↔ gram) may be converted. Everything else is a
// visible mismatch, never a silent reinterpretation.
// ============================================

import { unitSchema } from './common.schema'
import { SEEDED_UNITS } from './units-seed'

export type UnitCode = (typeof unitSchema.options)[number]

export type UnitDimension = 'weight' | 'length' | 'volume' | 'count' | 'custom'

/** Every unit the invoice UI may offer. `custom` is typed, not chosen. */
export const INVOICE_UNIT_CHOICES: readonly UnitCode[] = unitSchema.options.filter(
  (unit) => unit !== 'custom',
)

const UNIT_RECORD = new Map(SEEDED_UNITS.map((record) => [record.code, record]))

export function unitDimension(unit: string | null | undefined): UnitDimension {
  if (!unit) return 'custom'
  if (unit === 'custom') return 'custom'
  return UNIT_RECORD.get(unit)?.dimension ?? 'custom'
}

/** A unit counted one by one. Only these may default a line to «1». */
export function isCountUnit(unit: string | null | undefined): boolean {
  return unitDimension(unit) === 'count'
}

export function isMeasurementUnit(unit: string | null | undefined): boolean {
  const dimension = unitDimension(unit)
  return dimension === 'weight' || dimension === 'length' || dimension === 'volume'
}

/**
 * What an empty quantity cell becomes when a product is picked.
 *
 * Count products keep the familiar «1 piece». A measured product gets an EMPTY
 * cell: «1 gram» is a real quantity the user did not ask for, and seeding it is
 * exactly how a 15-gram necklace was once sold as one gram.
 */
export function seedQuantityForUnit(unit: string | null | undefined): string {
  return isCountUnit(unit) ? '1' : ''
}

/**
 * Base units per one `unit`, or null for an unknown/custom unit.
 * Uses the one seeded table the server and offline engine already share.
 */
export function unitFactor(unit: string | null | undefined): number | null {
  if (!unit) return null
  const record = UNIT_RECORD.get(unit)
  return record ? record.conversionFactor : null
}

/**
 * Convert a quantity between two units of the SAME dimension.
 * Returns null when no defined conversion exists — never guesses.
 */
export function convertQuantity(
  quantity: number,
  from: string | null | undefined,
  to: string | null | undefined,
): number | null {
  if (!Number.isFinite(quantity)) return null
  if (!from || !to) return null
  if (from === to) return quantity
  const fromRecord = UNIT_RECORD.get(from)
  const toRecord = UNIT_RECORD.get(to)
  if (!fromRecord || !toRecord) return null
  if (fromRecord.dimension !== toRecord.dimension) return null
  return (quantity * fromRecord.conversionFactor) / toRecord.conversionFactor
}

/* ═══════════════════════════════════════════════════════════════════════════
   CUT LOSS — «پرت برش»

   A fabric roll is 50 m, the customer buys 12.5 m, and the shop cuts 12.5 m off
   it — sometimes with a torn edge, a millimetre of frayed selvedge, a crooked
   cut that has to be trimmed away. That trimmed piece left the shelf with this
   sale and nobody paid for it. Before this rule the figure existed nowhere, so
   the shelf read 12.5 m short and the cost of the offcut landed in no report.

   THE MODEL, and nothing more than this:

     quantity        what the customer bought and pays for
     cutLossQuantity what left the shelf beside it and was not sold

   So the STOCK a line moves is `quantity + cutLossQuantity` (`stockQuantityOfLine`),
   while the MONEY stays on `quantity` alone — the same split the invoice already
   makes for a line discount. The cost of the offcut is therefore part of what
   this sale consumed, which is where a shopkeeper looks for it.

   ⚠️ IT IS NEVER INFERRED. A roll's short end is not a percentage of the sale
   and is not the difference between two numbers somebody typed; it is a figure
   the person enters or leaves empty. An absent value means «no loss was
   recorded», and the line moves exactly what it sells — every invoice written
   before this field existed keeps its exact behaviour.
   ═══════════════════════════════════════════════════════════════════════════ */

export type CutLossIssue = 'CUT_LOSS_NEGATIVE' | 'CUT_LOSS_ON_COUNT_UNIT' | 'CUT_LOSS_ON_PURCHASE'

/**
 * Why this cut loss cannot be recorded, or null when it can.
 *
 * `unit` is the LINE's unit, because that is the unit the loss was measured in.
 * A count unit is refused: «2 pieces, 1 of them cut away» is not a cut, it is a
 * stock adjustment with its own document — recording it here would take stock
 * off the shelf through a sale that never mentioned it.
 */
export function cutLossIssue(
  cutLoss: number | null | undefined,
  unit: string | null | undefined,
): CutLossIssue | null {
  if (cutLoss === null || cutLoss === undefined) return null
  if (!Number.isFinite(cutLoss) || cutLoss < 0) return 'CUT_LOSS_NEGATIVE'
  if (cutLoss === 0) return null
  if (unitDimension(unit) === 'count') return 'CUT_LOSS_ON_COUNT_UNIT'
  return null
}

/**
 * The quantity this line takes OFF THE SHELF: what was sold plus what was cut
 * away. Money, cost of goods sold and stock all read the same figure from here.
 */
export function stockQuantityOfLine(line: {
  quantity: number
  cutLossQuantity?: number | null | undefined
}): number {
  const quantity = Number(line.quantity) || 0
  const cutLoss = Number(line.cutLossQuantity) || 0
  return quantity + cutLoss
}

export type LineUnitIssue = 'unit-mismatch'

/**
 * Is the line's unit a silent reinterpretation of the product's unit?
 *
 * Null when they agree, when one side is unknown/custom, or when a defined
 * conversion exists (kg ↔ gram). Only a genuinely incompatible pair — a
 * product priced per gram being sold as «pieces» — reports a mismatch.
 */
export function lineUnitIssue(
  productUnit: string | null | undefined,
  lineUnit: string | null | undefined,
): LineUnitIssue | null {
  if (!productUnit || !lineUnit) return null
  if (productUnit === lineUnit) return null
  if (productUnit === 'custom' || lineUnit === 'custom') return null
  if (convertQuantity(1, productUnit, lineUnit) !== null) return null
  return 'unit-mismatch'
}
