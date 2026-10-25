// ============================================
// packages/validation/src/schemas/units-seed.ts
//
// The built-in units of measure — gram, kilogram, tonne, metre, litre, piece…
//
// ONE LIST, TWO READERS. The server falls back to it when the `units` table is
// absent; the offline engine answers `GET /units` from it (a gram is a gram on
// every device, and the table carries no workspace to scope by). A guard in the
// backend (units-parity.test.ts) keeps it identical to the migration's INSERT.
// ============================================

export interface UnitRecord {
  /**
   * ⚠️ Needed by `product_units.unit_id`, which is a FOREIGN KEY to
   * `units(id)`. It was absent at first and the product-units form had no way
   * to name a unit the write endpoint would accept — every save would have
   * been a 400 on a uuid that was actually a code.
   *
   * Null only in the seeded fallback, where no row exists to have an id.
   */
  id: string | null
  code: string
  name: string
  nameFa: string | null
  symbol: string | null
  dimension: 'weight' | 'length' | 'volume' | 'count'
  /** Base units of this dimension per one of these. See the migration. */
  conversionFactor: number
  isBase: boolean
}

/**
 * ⚠️ MUST STAY IDENTICAL TO THE `INSERT INTO units` IN
 * `docs/phase-l-01-units-migration.sql`. A guard test compares them.
 *
 * `custom` is deliberately absent here for the same reason it is absent from
 * the seed: it means «the user typed their own word», it has no dimension and
 * no conversion factor, and giving it one would let L1 convert by it.
 */
export const SEEDED_UNITS: readonly UnitRecord[] = [
  {
    // No id: the seed is a fallback for a database where the table
    // does not exist, so there is no row to have one. `product_units`
    // cannot be written in that state anyway.
    id: null,
    code: 'gram',
    name: 'Gram',
    nameFa: 'گرم',
    symbol: 'g',
    dimension: 'weight',
    conversionFactor: 1,
    isBase: true,
  },
  {
    id: null,
    code: 'kg',
    name: 'Kilogram',
    nameFa: 'کیلوگرم',
    symbol: 'kg',
    dimension: 'weight',
    conversionFactor: 1000,
    isBase: false,
  },
  {
    id: null,
    code: 'ton',
    name: 'Tonne',
    nameFa: 'تن',
    symbol: 't',
    dimension: 'weight',
    conversionFactor: 1000000,
    isBase: false,
  },
  {
    id: null,
    code: 'mg',
    name: 'Milligram',
    nameFa: 'میلی‌گرم',
    symbol: 'mg',
    dimension: 'weight',
    conversionFactor: 0.001,
    isBase: false,
  },

  {
    id: null,
    code: 'meter',
    name: 'Metre',
    nameFa: 'متر',
    symbol: 'm',
    dimension: 'length',
    conversionFactor: 1,
    isBase: true,
  },
  {
    id: null,
    code: 'cm',
    name: 'Centimetre',
    nameFa: 'سانتی‌متر',
    symbol: 'cm',
    dimension: 'length',
    conversionFactor: 0.01,
    isBase: false,
  },
  {
    id: null,
    code: 'km',
    name: 'Kilometre',
    nameFa: 'کیلومتر',
    symbol: 'km',
    dimension: 'length',
    conversionFactor: 1000,
    isBase: false,
  },

  {
    id: null,
    code: 'liter',
    name: 'Litre',
    nameFa: 'لیتر',
    symbol: 'L',
    dimension: 'volume',
    conversionFactor: 1,
    isBase: true,
  },
  {
    id: null,
    code: 'ml',
    name: 'Millilitre',
    nameFa: 'میلی‌لیتر',
    symbol: 'mL',
    dimension: 'volume',
    conversionFactor: 0.001,
    isBase: false,
  },

  {
    id: null,
    code: 'piece',
    name: 'Piece',
    nameFa: 'عدد',
    symbol: null,
    dimension: 'count',
    conversionFactor: 1,
    isBase: true,
  },
  {
    id: null,
    code: 'box',
    name: 'Box',
    nameFa: 'جعبه',
    symbol: null,
    dimension: 'count',
    conversionFactor: 1,
    isBase: false,
  },
  {
    id: null,
    code: 'pack',
    name: 'Pack',
    nameFa: 'بسته',
    symbol: null,
    dimension: 'count',
    conversionFactor: 1,
    isBase: false,
  },
  {
    id: null,
    code: 'carton',
    name: 'Carton',
    nameFa: 'کارتن',
    symbol: null,
    dimension: 'count',
    conversionFactor: 1,
    isBase: false,
  },
  {
    id: null,
    code: 'dozen',
    name: 'Dozen',
    nameFa: 'دوجین',
    symbol: null,
    dimension: 'count',
    conversionFactor: 1,
    isBase: false,
  },
]
