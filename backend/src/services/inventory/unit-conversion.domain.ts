// ============================================
// backend/src/services/inventory/unit-conversion.domain.ts
//
// L1 — «2 cartons» becomes «48 pieces», in the domain and nowhere else.
//
// ---------------------------------------------------------------------------
// THE CORE RULE
//
//   Stock movements are ALWAYS in the base unit.
//   Documents may DISPLAY another unit.
//
// The spec's own warning: «never enforce the conversion only in the UI». A
// conversion that lives on screen is absent from the API, the CSV importer,
// the mobile app, and every write that syncs in from offline — and each of
// those then writes a raw display quantity into `stock_movements`, which has
// been the source of truth for inventory since Phase C.
//
// ---------------------------------------------------------------------------
// ⚠️ ABSENCE MEANS FACTOR 1. THIS IS THE WHOLE BACKWARD-COMPATIBILITY STORY.
//
// Today `unit` is decorative: `batchUpdateStock` writes `item.quantity` raw,
// so `products.quantity` is already in the product's own unit and a line
// reading «5 kg» has already stored 5.
//
// If this module converted by `units.conversion_factor` — the dimension factor,
// where kg is 1000 grams — every historical kilogram line would be re-read as
// 5000 and every weighed product's stock would be wrong by three orders of
// magnitude.
//
// So conversion is driven ONLY by `product_units`, which is opt-in and empty
// for every product that existed before L1. No rows → factor 1 → identical
// behaviour. A product gains conversion when somebody deliberately declares
// it, and not before.
// ============================================

export interface ProductUnitOption {
  unitId: string
  unitCode: string
  /** Base units per one of THIS unit, for THIS product. */
  conversionFactorToBase: number
  isBaseUnit: boolean
  isPurchaseDefault: boolean
  isSaleDefault: boolean
}

export type ConversionRefusal =
  'UNIT_NOT_AVAILABLE_FOR_PRODUCT' | 'UNIT_NO_BASE_DEFINED' | 'UNIT_QUANTITY_INVALID'

export type ConversionResult =
  | { ok: true; baseQuantity: number; baseUnitCode: string | null }
  | { ok: false; code: ConversionRefusal }

/**
 * How many decimal places a base quantity keeps.
 *
 * `stock_movements.quantity` and `products.quantity` are numeric(18,4) since
 * Phase C. Rounding here rather than at the database means the number the
 * service decided is the number that is stored — otherwise the projection
 * trigger silently rounds and the movement no longer sums to the figure the
 * caller was shown.
 */
const BASE_SCALE = 4

/** Round to the scale the inventory columns actually hold. */
export function roundToBaseScale(value: number): number {
  const factor = 10 ** BASE_SCALE
  // `Number.EPSILON` nudge: 1.0049999999999999 * 10000 is 10049.999999999998,
  // which floors to a different answer than the decimal 1.005 should give.
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/**
 * Turn a quantity expressed in some unit into the product's base quantity.
 *
 * @param options  The product's declared units. EMPTY means the product has
 *                 not opted in to multi-UOM, and the quantity is already base.
 * @param unitCode The unit the caller typed. `null`/`undefined` means «the
 *                 base», which is also what every pre-L1 caller means.
 */
export function toBaseQuantity(
  quantity: number,
  unitCode: string | null | undefined,
  options: ProductUnitOption[],
): ConversionResult {
  if (!Number.isFinite(quantity)) return { ok: false, code: 'UNIT_QUANTITY_INVALID' }

  // ─── The pre-L1 path, and the path for every product that never opts in ──
  //
  // No declared units means no conversion is defined, and the ONLY safe
  // reading is the one the system already used: the quantity is what it says.
  // Refusing here would break every existing product the moment L1 shipped.
  if (options.length === 0) {
    return { ok: true, baseQuantity: roundToBaseScale(quantity), baseUnitCode: null }
  }

  const base = options.find((option) => option.isBaseUnit)

  // A product WITH declared units but no base is a data defect, not a default.
  // Guessing which of them is the base would put a wrong factor into the
  // source of truth; the partial unique index makes two bases impossible but
  // cannot make one mandatory.
  if (!base) return { ok: false, code: 'UNIT_NO_BASE_DEFINED' }

  // No unit named — the caller means the base. This is what a pre-L1 client
  // sends, and it must keep working.
  if (!unitCode) {
    return { ok: true, baseQuantity: roundToBaseScale(quantity), baseUnitCode: base.unitCode }
  }

  const chosen = options.find((option) => option.unitCode === unitCode)

  // ⚠️ REFUSED, not silently treated as the base.
  //
  // A unit the product does not declare is either a typo or a client sending
  // something stale. Treating it as the base would store a carton count as a
  // piece count — a wrong quantity that nothing would ever flag.
  if (!chosen) return { ok: false, code: 'UNIT_NOT_AVAILABLE_FOR_PRODUCT' }

  return {
    ok: true,
    baseQuantity: roundToBaseScale(quantity * chosen.conversionFactorToBase),
    baseUnitCode: base.unitCode,
  }
}

/**
 * The reverse, for DISPLAY only.
 *
 * ⚠️ Never write the result of this to `stock_movements`. Converting out of
 * the base and back can lose precision — 1 piece shown as 0.0417 cartons and
 * stored again is no longer 1 piece — and the base figure is the one the books
 * and the projection trigger agree on.
 */
export function fromBaseQuantity(
  baseQuantity: number,
  unitCode: string | null | undefined,
  options: ProductUnitOption[],
): number | null {
  if (!unitCode || options.length === 0) return baseQuantity

  const chosen = options.find((option) => option.unitCode === unitCode)
  if (!chosen || chosen.conversionFactorToBase <= 0) return null

  return baseQuantity / chosen.conversionFactorToBase
}

/**
 * Which unit a document should offer by default.
 *
 * Falls back to the base rather than to «the first row», which would depend on
 * insertion order and change under the user for no reason.
 */
export function defaultUnitFor(
  kind: 'sale' | 'purchase',
  options: ProductUnitOption[],
): ProductUnitOption | null {
  if (options.length === 0) return null

  const preferred = options.find((option) =>
    kind === 'sale' ? option.isSaleDefault : option.isPurchaseDefault,
  )
  return preferred ?? options.find((option) => option.isBaseUnit) ?? null
}

export type UnitSetRefusal =
  | 'UNIT_SET_NO_BASE'
  | 'UNIT_SET_MULTIPLE_BASES'
  | 'UNIT_SET_DUPLICATE_UNIT'
  | 'UNIT_SET_FACTOR_INVALID'
  | 'UNIT_SET_BASE_FACTOR_NOT_ONE'

/**
 * Is this a coherent set of units for one product?
 *
 * The database enforces most of this with constraints and partial indexes. It
 * is checked here too so the caller gets ONE message naming every problem,
 * rather than discovering them one constraint violation at a time.
 */
export function validateUnitSet(options: ProductUnitOption[]): UnitSetRefusal[] {
  const problems: UnitSetRefusal[] = []
  if (options.length === 0) return problems

  const bases = options.filter((option) => option.isBaseUnit)
  if (bases.length === 0) problems.push('UNIT_SET_NO_BASE')
  if (bases.length > 1) problems.push('UNIT_SET_MULTIPLE_BASES')

  // The base converts to itself. Any other factor makes «convert to base»
  // lossy on the base unit, which is incoherent.
  if (bases.some((option) => option.conversionFactorToBase !== 1)) {
    problems.push('UNIT_SET_BASE_FACTOR_NOT_ONE')
  }

  if (options.some((option) => !(option.conversionFactorToBase > 0))) {
    problems.push('UNIT_SET_FACTOR_INVALID')
  }

  const codes = new Set<string>()
  for (const option of options) {
    if (codes.has(option.unitCode)) {
      problems.push('UNIT_SET_DUPLICATE_UNIT')
      break
    }
    codes.add(option.unitCode)
  }

  return problems
}
