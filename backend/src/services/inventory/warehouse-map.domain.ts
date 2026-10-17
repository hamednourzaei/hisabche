// ============================================
// backend/src/services/inventory/warehouse-map.domain.ts
//
// THE MAP OF A WAREHOUSE — pure. Input rows in, one payload out. No database,
// no clock of its own, no rounding of a decision it did not make.
//
// ---------------------------------------------------------------------------
// WHERE THE NUMBERS COME FROM (and why nothing here is a new inventory engine)
//
//   stock in a warehouse   `warehouse_stock` — the projection Phase C's trigger
//                          maintains from `stock_movements`. Untouched.
//   what is in a location  `storage_location_placements` — what a PERSON
//                          recorded as sitting there, capped on write by what
//                          the warehouse actually holds.
//   value                  quantity × `products.buy_price` — the SAME rule as
//                          `summarizeStock` («what the stock COST»), so the
//                          map can never disagree with the warehouse cards.
//   movement and staleness  `findDeadStock` — the EXISTING 90-day rule from
//                          `reorder.domain.ts`, called here, not copied.
//
// ⚠️ THE STATES THAT MUST NOT COLLAPSE INTO EACH OTHER
//
//   · A location with nothing recorded in it is EMPTY, not «unknown» and not
//     «zero value». Its grey says «nothing is recorded here».
//   · A product that never sold FROM THIS WAREHOUSE is `neverSold`, with
//     `daysSinceSale: null` — never «idle for 0 days» and never «idle forever».
//   · A product whose `buy_price` is missing makes its location's value a
//     LOWER BOUND. `productsWithoutCost` counts them and the screen says so;
//     the figure is not silently inflated.
//   · A placement the stock has since outgrown is DRIFT: the difference is
//     reported, never clamped and never repaired behind the reader's back.
// ============================================

import { STORAGE_LOCATION_KINDS, type StorageLocationKind } from '@hisabche/validation'

import {
  DEAD_STOCK_DEFAULT_DAYS,
  DEMAND_WINDOW_DAYS,
  averageDailySales,
  findDeadStock,
} from './reorder.domain'

export { STORAGE_LOCATION_KINDS }
export type { StorageLocationKind }

/**
 * What a location's colour means. Four states, and each one is a FACT about
 * the last sale of what is inside it — the legend says the sentence, not the
 * colour name.
 */
export const HEAT_BANDS = ['empty', 'moving', 'slow', 'stagnant'] as const
export type HeatBand = (typeof HEAT_BANDS)[number]

// ⚠️ THERE IS NO «metrics» LIST HERE. What the floor is coloured BY is a screen
// decision (`MapMetric` in packages/api → map-filtering.ts): the server always
// sends the band and both classes, so a reader can switch colour without a
// round trip. Capacity utilisation is not a metric either — it is only known
// where a person typed a capacity, so it lives in the drawer beside the one
// location it belongs to rather than as a colour over the whole floor.

/** The number of steps in the quantity and value ladders (0 = nothing). */
export const INTENSITY_STEPS = 3

// ─── The raw rows the service hands in ──────────────────────────────────────

export interface RawLocation {
  id: string
  warehouseId: string
  parentId: string | null
  code: string
  name: string | null
  kind: string
  x: number
  y: number
  width: number
  height: number
  capacity: number | null
  isActive: boolean
}

export interface RawProduct {
  id: string
  name: string
  sku: string | null
  unit: string | null
  /** `null` = never recorded. NOT zero. */
  buyPrice: number | null
}

export interface RawPlacement {
  locationId: string
  productId: string
  quantity: number
}

export interface RawWarehouseStock {
  productId: string
  quantity: number
}

export interface RawSales {
  /** The most recent sale FROM THIS WAREHOUSE per product. */
  lastSoldAt: ReadonlyMap<string, string>
  /** Units sold FROM THIS WAREHOUSE inside the window. */
  unitsInWindow: ReadonlyMap<string, number>
}

// ─── What the payload holds ─────────────────────────────────────────────────

export interface MapLocationProduct {
  productId: string
  name: string
  sku: string | null
  unit: string | null
  quantity: number
  /** `null` = no purchase price recorded — or no permission to read it. */
  unitCost: number | null
  /** `null` = the reader may not see what the stock cost (`inventory.cost.read`). */
  value: number | null
  lastSoldAt: string | null
  daysSinceSale: number | null
  neverSold: boolean
  soldInWindow: number
  avgDailySales: number
  stagnant: boolean
  /** The placements for this product in this warehouse claim more than it holds. */
  exceedsStock: boolean
}

export interface MapLocation {
  id: string
  code: string
  name: string | null
  kind: string
  parentId: string | null
  /** 0 for a zone. Parents are drawn before their children. */
  depth: number
  /** `Z01 › R02 › S04` — the codes from the root down, for a tooltip. */
  path: string
  x: number
  y: number
  width: number
  height: number
  capacity: number | null
  isActive: boolean
  products: MapLocationProduct[]
  productCount: number
  quantity: number
  /** `null` = no permission to read cost. NEVER 0, which would read «worth nothing». */
  value: number | null
  /** Products here whose purchase price was never entered — not valued above. */
  productsWithoutCost: number
  lastSoldAt: string | null
  daysSinceSale: number | null
  neverSold: boolean
  band: HeatBand
  stagnantProductCount: number
  stagnantQuantity: number
  stagnantValue: number | null
  /** 0–3 within this warehouse. 0 = nothing there. */
  quantityClass: number
  /** `null` when the reader may not see cost. */
  valueClass: number | null
  /** `null` until a capacity is recorded for this location. */
  capacityUsed: number | null
}

export interface WarehouseMapTotals {
  locationCount: number
  activeLocationCount: number
  retiredLocationCount: number
  emptyLocationCount: number
  locationProductCount: number
  placedQuantity: number
  /** `null` when the reader may not see cost. */
  placedValue: number | null
  stagnantLocationCount: number
  stagnantValue: number | null
  stagnantQuantity: number
  /**
   * Distinct products of this warehouse — on a shelf or in no location — whose
   * purchase price was never entered. Their units are inside the quantities
   * above but NOT inside any value above, so every money figure here is a lower
   * bound while this is not 0, and the screen says so.
   */
  productsWithoutCost: number
  /** `null` when no location of this warehouse records a capacity. */
  capacityTotal: number | null
  capacityRecordedCount: number
}

export interface WarehouseMapUnplaced {
  /** Products with at least one unit that no location records. */
  productCount: number
  quantity: number
  /** `null` when the reader may not see cost. */
  value: number | null
}

export interface WarehouseMapDrift {
  /** Products whose placements claim more units than the warehouse holds. */
  productCount: number
  quantity: number
  /** `null` when the reader may not see cost. */
  value: number | null
}

export interface WarehouseMap {
  warehouse: { id: string; name: string; branchId: string | null; branchName: string | null }
  currency: string
  /**
   * ⚠️ Whether money figures are included at all.
   *
   * The value of stock is what it COST, and the purchase price is the shop's
   * margin — `inventory.cost.read` (manager and above) is the capability that
   * exists for it. A reader without it gets the map, the quantities and the
   * movement, and `null` wherever a cost would have been. Never 0: «you may not
   * see this» and «this is worth nothing» are different sentences.
   */
  costVisible: boolean
  /** The staleness threshold this map was built with. */
  days: number
  demandWindowDays: number
  asOf: string
  /**
   * False until `docs/warehouse-map-01-migration.sql` has run. The screen says
   * so and names the script — it does NOT draw an empty warehouse.
   */
  migrated: boolean
  locations: MapLocation[]
  totals: WarehouseMapTotals
  unplaced: WarehouseMapUnplaced
  drift: WarehouseMapDrift
}

export interface BuildMapInput {
  warehouse: WarehouseMap['warehouse']
  currency: string
  asOf: Date
  costVisible: boolean
  days?: number | undefined
  locations: readonly RawLocation[]
  placements: readonly RawPlacement[]
  products: readonly RawProduct[]
  warehouseStock: readonly RawWarehouseStock[]
  sales: RawSales
}

// ─── The pieces ─────────────────────────────────────────────────────────────

/**
 * What the stock there COST.
 *
 * ⚠️ The price is REQUIRED, and the caller decides whether it exists. `products`
 * stores «never entered» as 0 (`buy_price numeric DEFAULT 0`) and the product's
 * own unvalued-stock rule is `buyPrice > 0` — so a 0 reaching this function
 * would turn «nobody priced this» into «worth nothing», which is the one
 * sentence this map must never say.
 */
export function stockValue(quantity: number, buyPrice: number): number {
  return Math.round(Math.max(quantity, 0) * buyPrice)
}

/**
 * 0–3 for a colour ladder: nothing, a quarter, half, all the way to the top.
 *
 * ⚠️ RELATIVE TO THIS WAREHOUSE, and the legend says so. There is no absolute
 * threshold anywhere in this product for «a lot of stock» — a number invented
 * here would colour a greengrocer's floor by a machine-parts dealer's scale.
 */
export function intensityClass(value: number, max: number): number {
  if (!(value > 0) || !(max > 0)) return 0
  const share = value / max
  if (share <= 0.25) return 1
  if (share <= 0.5) return 2
  return INTENSITY_STEPS
}

/**
 * The colour of one location, from what is inside it.
 *
 *   empty     nothing is recorded here
 *   stagnant  EVERY product in it is dead stock (the existing 90-day rule)
 *   moving    something in it sold inside the demand window (30 days)
 *   slow      it holds stock, it has sold before, but not in that window
 *
 * The two windows are `reorder.domain.ts`'s existing pair, not new ones.
 */
export function movementBand(input: {
  quantity: number
  lastSoldAt: string | null
  stagnantProductCount: number
  productCount: number
  days: number
  asOf: Date
}): HeatBand {
  if (!(input.quantity > 0) || input.productCount === 0) return 'empty'
  if (input.stagnantProductCount >= input.productCount) return 'stagnant'
  if (input.lastSoldAt === null) return 'stagnant'
  const days = daysSince(new Date(input.lastSoldAt), input.asOf)
  if (days < DEMAND_WINDOW_DAYS) return 'moving'
  if (days < input.days) return 'slow'
  return 'stagnant'
}

export function daysSince(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

/** `Z01 › R02 › S04` — the codes from the root down. */
export function locationPath(
  id: string,
  byId: ReadonlyMap<string, { code: string; parentId: string | null }>,
): string {
  const codes: string[] = []
  // ⚠️ A map that hangs is worse than a map that is short. The database refuses
  // a cycle (the shape trigger), so this only ever fires on a row that arrived
  // some other way — and then the path stops instead of looping forever.
  const seen = new Set<string>([id])
  let cursor = byId.get(id)
  while (cursor) {
    codes.unshift(cursor.code)
    const parent = cursor.parentId
    if (!parent || seen.has(parent)) break
    seen.add(parent)
    cursor = byId.get(parent)
  }
  return codes.join(' › ')
}

function depthOf(id: string, byId: ReadonlyMap<string, { parentId: string | null }>): number {
  let depth = 0
  const seen = new Set<string>([id])
  let cursor = byId.get(id)
  while (cursor?.parentId && !seen.has(cursor.parentId)) {
    depth += 1
    seen.add(cursor.parentId)
    cursor = byId.get(cursor.parentId)
  }
  return depth
}

// ─── The transform ──────────────────────────────────────────────────────────

export function buildWarehouseMap(input: BuildMapInput): WarehouseMap {
  const days = input.days ?? DEAD_STOCK_DEFAULT_DAYS
  const productById = new Map(input.products.map((row) => [row.id, row]))
  const byId = new Map(
    input.locations.map((row) => [row.id, { code: row.code, parentId: row.parentId }]),
  )

  // What the warehouse holds, per product — the authority a placement is
  // capped by. Negative on-hand stays negative: it is a recorded shortfall.
  const onHand = new Map<string, number>()
  for (const row of input.warehouseStock) onHand.set(row.productId, row.quantity)

  // Placements, grouped by location; the total per product is needed for drift.
  const placementsByLocation = new Map<string, RawPlacement[]>()
  const placedByProduct = new Map<string, number>()
  for (const row of input.placements) {
    if (!(row.quantity > 0)) continue
    const list = placementsByLocation.get(row.locationId)
    if (list) list.push(row)
    else placementsByLocation.set(row.locationId, [row])
    placedByProduct.set(row.productId, (placedByProduct.get(row.productId) ?? 0) + row.quantity)
  }

  // ⚠️ The products whose shelf labels claim more than the warehouse holds.
  const overClaimed = new Set<string>()
  for (const [productId, placed] of placedByProduct) {
    if (placed > Math.max(onHand.get(productId) ?? 0, 0) + 1e-6) overClaimed.add(productId)
  }

  const rows: Omit<MapLocation, 'quantityClass' | 'valueClass'>[] = []

  // ⚠️ MONEY CROSSES THIS LINE ONLY WHEN THE READER MAY SEE COST.
  // `null` is «not shown to you»; 0 would be «worth nothing», which is a
  // different — and false — sentence about a full shelf.
  const money = (value: number): number | null => (input.costVisible ? value : null)

  /**
   * The product's purchase price, or `null` when it was never entered.
   *
   * ⚠️ `> 0`, not `!== null`. The column is `numeric DEFAULT 0`, so the value a
   * shop that never typed a price has is 0 — and `findUnvaluedStock` already
   * calls that «no_buy_price». Valuing it at 0 would report a full shelf as
   * worthless and make the dead capital figure a lie in the safe direction.
   */
  const priceOf = (productId: string): number | null => {
    const price = productById.get(productId)?.buyPrice ?? 0
    return Number.isFinite(price) && price > 0 ? price : null
  }

  for (const location of input.locations) {
    const placed = placementsByLocation.get(location.id) ?? []

    const products: MapLocationProduct[] = placed
      .map((row) => {
        const product = productById.get(row.productId)
        const price = priceOf(row.productId)
        return {
          productId: row.productId,
          name: product?.name ?? '',
          sku: product?.sku ?? null,
          unit: product?.unit ?? null,
          quantity: row.quantity,
          unitCost: input.costVisible ? price : null,
          value: input.costVisible && price !== null ? stockValue(row.quantity, price) : null,
          soldInWindow: input.sales.unitsInWindow.get(row.productId) ?? 0,
          avgDailySales: averageDailySales({
            productId: row.productId,
            unitsSoldInWindow: input.sales.unitsInWindow.get(row.productId) ?? 0,
            windowDays: days,
          }),
          exceedsStock: overClaimed.has(row.productId),
          // Filled in below, from the one existing dead-stock rule.
          lastSoldAt: input.sales.lastSoldAt.get(row.productId) ?? null,
          daysSinceSale: null,
          neverSold: false,
          stagnant: false,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    // ⚠️ THE EXISTING RULE, CALLED. `findDeadStock` decides which of these
    // products count as dead stock; nothing here re-implements the 90 days.
    const dead = new Set(
      findDeadStock(
        products.map((product) => ({
          productId: product.productId,
          onHand: product.quantity,
          lastSoldAt: product.lastSoldAt,
        })),
        input.asOf,
        days,
      ).map((line) => line.productId),
    )
    for (const product of products) {
      const last = product.lastSoldAt
      product.neverSold = last === null
      product.daysSinceSale = last === null ? null : daysSince(new Date(last), input.asOf)
      product.stagnant = dead.has(product.productId)
    }

    const lastSoldAt = products.reduce<string | null>(
      (latest, product) =>
        product.lastSoldAt && (!latest || product.lastSoldAt > latest)
          ? product.lastSoldAt
          : latest,
      null,
    )
    const quantity = sum(products.map((product) => product.quantity))
    const stagnant = products.filter((product) => product.stagnant)

    const band = movementBand({
      quantity,
      lastSoldAt,
      stagnantProductCount: stagnant.length,
      productCount: products.length,
      days,
      asOf: input.asOf,
    })

    rows.push({
      id: location.id,
      code: location.code,
      name: location.name,
      kind: location.kind,
      parentId: location.parentId,
      depth: depthOf(location.id, byId),
      path: locationPath(location.id, byId),
      x: location.x,
      y: location.y,
      width: location.width,
      height: location.height,
      capacity: location.capacity,
      isActive: location.isActive,
      products,
      productCount: products.length,
      quantity,
      value: money(sum(products.map((product) => product.value ?? 0))),
      // A price nobody recorded is a fact about the DATA; a price this reader
      // may not see is not. Only the first is counted.
      productsWithoutCost: input.costVisible
        ? products.filter((product) => product.unitCost === null).length
        : 0,
      lastSoldAt,
      daysSinceSale: lastSoldAt === null ? null : daysSince(new Date(lastSoldAt), input.asOf),
      neverSold: lastSoldAt === null,
      band,
      stagnantProductCount: stagnant.length,
      stagnantQuantity: sum(stagnant.map((product) => product.quantity)),
      stagnantValue: money(sum(stagnant.map((product) => product.value ?? 0))),
      capacityUsed:
        location.capacity && location.capacity > 0 ? quantity / location.capacity : null,
    })
  }

  // Parents before children, then by code: the map is painted in this order, so
  // a bin drawn over its rack is deliberate rather than an accident of the
  // order the rows came back in.
  const locations: MapLocation[] = rows
    .map((row) => ({
      ...row,
      quantityClass: 0,
      valueClass: null,
    }))
    .sort((a, b) => a.depth - b.depth || a.code.localeCompare(b.code) || a.id.localeCompare(b.id))

  const maxQuantity = Math.max(0, ...locations.map((row) => row.quantity))
  const maxValue = Math.max(0, ...locations.map((row) => row.value ?? 0))
  for (const location of locations) {
    location.quantityClass = intensityClass(location.quantity, maxQuantity)
    location.valueClass =
      location.value === null || !input.costVisible
        ? null
        : intensityClass(location.value, maxValue)
  }

  // What the warehouse holds that no location records — the honest remainder,
  // never folded into a shelf to make the map look complete.
  let unplacedQuantity = 0
  let unplacedValue = 0
  let unplacedProductCount = 0
  for (const [productId, held] of onHand) {
    const missing = Math.max(held, 0) - (placedByProduct.get(productId) ?? 0)
    if (missing <= 0) continue
    unplacedProductCount += 1
    unplacedQuantity += missing
    // Unpriced units add quantity and no money: the value below is then a lower
    // bound, and `productsWithoutCost` is what tells the reader.
    const price = priceOf(productId)
    if (price !== null) unplacedValue += stockValue(missing, price)
  }

  let driftQuantity = 0
  let driftValue = 0
  for (const productId of overClaimed) {
    const claimed = placedByProduct.get(productId) ?? 0
    const excess = claimed - Math.max(onHand.get(productId) ?? 0, 0)
    driftQuantity += excess
    const price = priceOf(productId)
    if (price !== null) driftValue += stockValue(excess, price)
  }

  const capacities = locations
    .filter((row) => row.isActive && row.capacity !== null && row.capacity > 0)
    .map((row) => row.capacity as number)

  // Distinct products with units in this warehouse and no price entered —
  // whether a shelf carries them or not, because the number exists to tell the
  // reader that BOTH money figures below are lower bounds.
  const warehouseProducts = new Set<string>([...onHand.keys(), ...placedByProduct.keys()])
  const productsWithoutCost = input.costVisible
    ? [...warehouseProducts].filter((productId) => priceOf(productId) === null).length
    : 0

  return {
    warehouse: input.warehouse,
    currency: input.currency,
    costVisible: input.costVisible,
    days,
    demandWindowDays: DEMAND_WINDOW_DAYS,
    asOf: input.asOf.toISOString(),
    migrated: true,
    locations,
    totals: {
      locationCount: locations.length,
      activeLocationCount: locations.filter((row) => row.isActive).length,
      retiredLocationCount: locations.filter((row) => !row.isActive).length,
      emptyLocationCount: locations.filter((row) => row.band === 'empty').length,
      locationProductCount: locations.reduce((total, row) => total + row.productCount, 0),
      placedQuantity: sum(locations.map((row) => row.quantity)),
      placedValue: money(sum(locations.map((row) => row.value ?? 0))),
      stagnantLocationCount: locations.filter((row) => row.band === 'stagnant').length,
      stagnantValue: money(sum(locations.map((row) => row.stagnantValue ?? 0))),
      stagnantQuantity: sum(locations.map((row) => row.stagnantQuantity)),
      // Distinct products with units in this warehouse and no price entered —
      // whether a shelf carries them or not, because the number exists to tell
      // the reader that BOTH money figures next to it are lower bounds.
      productsWithoutCost,
      capacityTotal: capacities.length > 0 ? sum(capacities) : null,
      capacityRecordedCount: capacities.length,
    },
    unplaced: {
      productCount: unplacedProductCount,
      quantity: unplacedQuantity,
      value: money(unplacedValue),
    },
    drift: {
      productCount: overClaimed.size,
      quantity: driftQuantity,
      value: money(driftValue),
    },
  }
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
