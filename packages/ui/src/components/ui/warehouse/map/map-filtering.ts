// ============================================
// packages/ui/src/components/ui/warehouse/map/map-filtering.ts
//
// What the map draws and what the header says, as pure functions.
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT INSIDE THE COMPONENT
//
// Everything here decides what a person sees and what number they read:
// „which locations survive the filters«, „which one the search points at«,
// „how much capital is locked in this part of the warehouse«. That is business
// behaviour, and it is tested against fixtures without a browser.
//
// ⚠️ NOT ONE RULE ABOUT STOCK IS DECIDED HERE. The bands, the value of a shelf
// and the days since a sale all arrive from the server
// (backend/src/services/inventory/warehouse-map.domain.ts). This file only
// SELECTS rows and ADDS UP numbers the server already gave.
//
// ⚠️ AND A SUM OF `null` IS STILL `null`. When a reader may not see cost the
// money fields arrive as null; adding those up would print 0 and turn «you may
// not see this» into «worth nothing». Every money total here is
// `number | null` and stays null all the way to the screen.
// ============================================

import type { HeatBand, MapLocation, MapMetric } from '@hisabche/api'

/**
 * The translator these screens receive as a prop.
 *
 * ⚠️ A prop and not `useTranslations()` inside every file: the map is drawn,
 * clicked and keyboard-driven in tests that mount the component alone, with no
 * provider around it. The container owns the real translator.
 */
export type MapTranslator = (key: string, values?: Record<string, number | string>) => string

/** The bands a person can filter by, plus «all». */
export type BandFilter = 'all' | HeatBand

export interface MapFilters {
  /** A zone (or any parent location): keep what is it or below it. */
  zoneId: string | null
  band: BandFilter
  /** Products of this category only. `null` = every category. */
  category: string | null
  /** Only locations holding this product. `null` = every product. */
  productId: string | null
}

export const NO_FILTERS: MapFilters = {
  zoneId: null,
  band: 'all',
  category: null,
  productId: null,
}

/** True when the filters are not all open — the header says «بر اساس فیلترها». */
export function filtersActive(filters: MapFilters): boolean {
  return (
    filters.zoneId !== null ||
    filters.band !== 'all' ||
    filters.category !== null ||
    filters.productId !== null
  )
}

/**
 * The search text, folded to one form.
 *
 * ⚠️ PERSIAN AND ARABIC DIGITS ARE THE SAME DIGITS. A shelf labelled «طبقه ۳»
 * is typed «۳» on a Persian keyboard, «3» on a phone keypad, and searched for
 * as «3» by somebody reading the label. Normalising both sides is what makes a
 * search box useful here; case-folding is for the English SKUs beside them.
 * Separators go too, so `A-03` and `A03` find each other.
 */
export function foldQuery(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\s._-]+/g, '')
}

/** Does this location answer the search — by its own label, or by what is in it. */
export function matchesQuery(location: MapLocation, folded: string): boolean {
  if (!folded) return true
  const own = foldQuery(`${location.code} ${location.name ?? ''}`)
  if (own.includes(folded)) return true
  return location.products.some((product) =>
    foldQuery(`${product.name} ${product.sku ?? ''}`).includes(folded),
  )
}

/** Is this location the zone itself, or under it? */
function underZone(location: MapLocation, zoneId: string, byId: Map<string, MapLocation>): boolean {
  // Walk up to the root. The database refuses a cycle (the shape trigger), and
  // the set of visited ids stops a broken chain from hanging the screen.
  const seen = new Set<string>([location.id])
  let current: MapLocation | undefined = location
  while (current) {
    if (current.id === zoneId) return true
    const parentId: string | null = current.parentId
    if (!parentId || seen.has(parentId)) return false
    seen.add(parentId)
    current = byId.get(parentId)
  }
  return false
}

export interface MapSelection {
  /** What passes the filters (and, in hide mode, the search). */
  visible: MapLocation[]
  /** Location ids the search points at. Empty when nothing was typed. */
  matched: Set<string>
  /** True when the search only dims what it does not point at. */
  dimming: boolean
}

/**
 * The rows the map draws.
 *
 * `hideUnmatched` is the DIM/HIDE switch: with it off, everything that passes
 * the filters is drawn and the non-matches are dimmed — so a person can still
 * see the shelf they were standing in front of. With it on, the floor is only
 * what they searched for.
 *
 * ⚠️ Matches are computed over the FILTERED rows, not over everything: a
 * filter is a decision the person made, and a search result outside it would
 * point at a shelf the filters just took off the floor.
 */
export function selectLocations(
  locations: readonly MapLocation[],
  filters: MapFilters,
  query: string,
  hideUnmatched: boolean,
  categoryOf: (productId: string) => string | null,
): MapSelection {
  const byId = new Map(locations.map((row) => [row.id, row]))
  const folded = foldQuery(query)

  const filtered = locations.filter((location) => {
    if (filters.zoneId && !underZone(location, filters.zoneId, byId)) return false
    if (filters.band !== 'all' && location.band !== filters.band) return false
    if (filters.category) {
      const inCategory = location.products.some(
        (product) => categoryOf(product.productId) === filters.category,
      )
      if (!inCategory) return false
    }
    if (filters.productId) {
      const holds = location.products.some((product) => product.productId === filters.productId)
      if (!holds) return false
    }
    return true
  })

  // Filtering by a product or a category already narrowed the rows to the ones
  // that hold it; the search box is a different question and is answered over
  // what is left.
  const matched = new Set(
    folded ? filtered.filter((row) => matchesQuery(row, folded)).map((row) => row.id) : [],
  )

  const visible =
    folded && hideUnmatched ? filtered.filter((row) => matched.has(row.id)) : [...filtered]

  return { visible, matched, dimming: folded !== '' && !hideUnmatched }
}

export interface MapKpi {
  locationCount: number
  activeLocationCount: number
  emptyLocationCount: number
  /** Distinct products standing in these locations. */
  productCount: number
  quantity: number
  /** `null` = this reader may not see cost. */
  value: number | null
  stagnantLocationCount: number
  stagnantQuantity: number
  stagnantValue: number | null
  productsWithoutCost: number
}

/**
 * The header, over the rows on the floor.
 *
 * ⚠️ `productsWithoutCost` IS NOT DECORATION. The money totals cover only the
 * products whose purchase price was entered, so while this is not 0 the value
 * beside it is a LOWER BOUND — and the screen has to say so, or the number
 * reads as the whole truth.
 */
export function summarizeLocations(
  locations: readonly MapLocation[],
  costVisible: boolean,
): MapKpi {
  const products = new Set<string>()
  const unpriced = new Set<string>()

  for (const location of locations) {
    for (const product of location.products) {
      products.add(product.productId)
      if (product.unitCost === null) unpriced.add(product.productId)
    }
  }

  const stagnant = locations.filter((row) => row.band === 'stagnant')
  const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0)

  return {
    locationCount: locations.length,
    activeLocationCount: locations.filter((row) => row.isActive).length,
    emptyLocationCount: locations.filter((row) => row.band === 'empty').length,
    productCount: products.size,
    quantity: sum(locations.map((row) => row.quantity)),
    value: costVisible ? sum(locations.map((row) => row.value ?? 0)) : null,
    stagnantLocationCount: stagnant.length,
    stagnantQuantity: sum(stagnant.map((row) => row.stagnantQuantity)),
    stagnantValue: costVisible ? sum(stagnant.map((row) => row.stagnantValue ?? 0)) : null,
    // A product standing in two shelves is one product with no price — and
    // under redaction EVERY product looks unpriced, so the count is reported as
    // 0 (as the server does) rather than as «all of them».
    productsWithoutCost: costVisible ? unpriced.size : 0,
  }
}

/** One line of «کدام قسمت انبار سرمایه‌ام را قفل کرده؟» */
export interface DeadCapitalRow {
  location: MapLocation
  /** `null` when this reader may not see cost — rank then uses quantity. */
  value: number | null
  quantity: number
  productCount: number
  /** How many of those products have no recorded sale at all. */
  neverSoldCount: number
  /**
   * Days since this location last sold anything — the MOST RECENT sale among
   * its dead products, i.e. the smallest `daysSinceSale`.
   *
   * ⚠️ THE SMALLEST, NOT THE LARGEST. «يک قفسه از چه زمانی فروش نداشته است؟»
   * is answered by its latest sale: a shelf that sold something 40 days ago and
   * something else 200 days ago has been quiet for 40 days. Taking the largest
   * would overstate the claim in a way the reader cannot check.
   *
   * `null` = nothing on this shelf has EVER sold from this warehouse.
   */
  quietDays: number | null
}

/**
 * Where the sleeping capital is, biggest first.
 *
 * ⚠️ RANKED BY VALUE WHEN THE READER MAY SEE IT, BY UNITS WHEN THEY MAY NOT.
 * Without cost access, ranking by a field they cannot read would put the
 * shelves in an order nobody could explain. Quantity is a different question
 * with a different answer, and the panel says which one it is showing.
 */
export function deadCapital(locations: readonly MapLocation[], limit: number): DeadCapitalRow[] {
  const rows = locations
    .filter((location) => location.band === 'stagnant')
    .map((location) => {
      const dead = location.products.filter((product) => product.stagnant)
      const dates = dead
        .map((product) => product.daysSinceSale)
        .filter((days): days is number => days !== null)
      return {
        location,
        value: location.stagnantValue,
        quantity: location.stagnantQuantity,
        productCount: dead.length,
        neverSoldCount: dead.filter((product) => product.daysSinceSale === null).length,
        quietDays: dates.length > 0 ? Math.min(...dates) : null,
      }
    })

  rows.sort((a, b) => {
    if (a.value !== null && b.value !== null && a.value !== b.value) return b.value - a.value
    if (a.value === null && b.value === null && a.quantity !== b.quantity) {
      return b.quantity - a.quantity
    }
    return a.location.code.localeCompare(b.location.code)
  })

  return rows.slice(0, limit)
}

/**
 * The wording for one location's movement, in the reader's own terms.
 *
 * ⚠️ THE NUMBER AND THE REASON, not just a colour. «راکد» alone is an
 * assertion; «بدون فروش از این انبار در ۹۴ روز» is something a person can
 * check against what they know — and it is what makes the red mean something
 * to somebody who cannot see red.
 */
export function bandReason(
  location: Pick<MapLocation, 'band' | 'neverSold' | 'daysSinceSale'>,
  demandWindowDays: number,
): { key: string; values: Record<string, number | string> } {
  if (location.band === 'empty') return { key: 'empty', values: {} }
  if (location.neverSold) return { key: 'neverSold', values: {} }
  const days = location.daysSinceSale
  if (days === null) return { key: 'unknown', values: {} }
  if (location.band === 'moving') return { key: 'soldRecently', values: { days } }
  return { key: 'soldLongAgo', values: { days, window: demandWindowDays } }
}

/** Which metric a person may pick. Value is not offered without cost access. */
export function availableMetrics(costVisible: boolean): MapMetric[] {
  return costVisible ? ['band', 'quantity', 'value'] : ['band', 'quantity']
}
/** The per-product movement label inside the drawer. */
export function productBand(product: {
  soldInWindow: number
  daysSinceSale: number | null
  neverSold: boolean
  stagnant: boolean
}): 'moving' | 'slow' | 'stagnant' {
  if (product.soldInWindow > 0) return 'moving'
  return product.stagnant ? 'stagnant' : 'slow'
}

/**
 * Every location below this one — its children, their children, and so on.
 *
 * Used for two things: a location may not be moved under itself (the database
 * refuses the cycle too — the shape trigger), and the parent select must not
 * offer a choice that will be refused.
 */
export function descendantIds(locations: readonly MapLocation[], rootId: string): Set<string> {
  const children = new Map<string, string[]>()
  for (const location of locations) {
    if (!location.parentId) continue
    const list = children.get(location.parentId)
    if (list) list.push(location.id)
    else children.set(location.parentId, [location.id])
  }

  const found = new Set<string>()
  const queue = [...(children.get(rootId) ?? [])]
  while (queue.length > 0) {
    const id = queue.shift() as string
    if (found.has(id)) continue
    found.add(id)
    queue.push(...(children.get(id) ?? []))
  }
  return found
}

/**
 * Where a new location goes before anyone moves it: the first free row below
 * everything already drawn, at the left edge (x = 0).
 *
 * Deterministic on purpose — two people adding the same shelf must get the same
 * picture. It is a starting point, not a suggestion of where the shelf IS: only
 * the person standing in the building knows that, and the dialog lets them say.
 */
export function suggestPosition(locations: readonly MapLocation[]): { x: number; y: number } {
  const bottom = locations.reduce(
    (lowest, location) => Math.max(lowest, location.y + Math.max(location.height, 0)),
    0,
  )
  return { x: 0, y: bottom }
}
