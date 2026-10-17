// ============================================
// packages/ui/src/__tests__/warehouse-map-filtering.test.ts
//
// The map's decisions, without a browser: what survives a filter, what a search
// points at, what the header adds up, and which shelf is holding the money.
//
// ---------------------------------------------------------------------------
// WHAT IS ASSERTED HERE, AND WHAT IS NOT
//
// NOT «the bands are right»: the band of a location is computed by the server
// (backend/src/services/inventory/warehouse-map.domain.ts) and is a fixture
// here. What this file proves is the part that lives in the UI — that a filter
// narrows the rows, that a search reaches into the products on a shelf, that
// redacted money stays null instead of turning into 0, and that «سرمایه راکد»
// ranks by value when the reader can see it and by units when they cannot.
// ============================================

import { describe, expect, it } from 'vitest'
import type { HeatBand, MapLocation, MapLocationProduct } from '@hisabche/api'

import {
  availableMetrics,
  bandReason,
  deadCapital,
  descendantIds,
  filtersActive,
  foldQuery,
  matchesQuery,
  NO_FILTERS,
  productBand,
  selectLocations,
  suggestPosition,
  summarizeLocations,
} from '../components/ui/warehouse/map/map-filtering'

// ─── Fixtures ───────────────────────────────────────────────────────────────
//
// One small warehouse, laid out so every number below can be added by hand:
//
//   Z01 zone   (root, 0,0 20×2)
//     R01 rack (0,2 10×1)          empty itself
//       S01    (0,2 1×1)          برنج  10 units × 5 000 = 50 000   sold 5 days ago
//       S02    (1,2 1×1)          چای   12 units, NO purchase price  never sold
//     R02 rack (0,5 10×1)          شکر 7 units × 2 000 = 14 000 (120 days), نمک 3 units (never sold)
//   A09        (0,8 2×1)           retired, empty
//
//   quantity 10+12+10 = 32 · value 50 000+0+14 000 = 64 000 · 4 distinct products
//   2 of them without a purchase price (چای, نمک) → the 64 000 is a lower bound.

function product(input: {
  id: string
  name: string
  sku?: string | null
  quantity: number
  unitCost?: number | null
  value?: number | null
  daysSinceSale?: number | null
  neverSold?: boolean
  soldInWindow?: number
  stagnant?: boolean
}): MapLocationProduct {
  return {
    productId: input.id,
    name: input.name,
    sku: input.sku ?? null,
    unit: 'عدد',
    quantity: input.quantity,
    unitCost: input.unitCost ?? null,
    value: input.value ?? null,
    lastSoldAt: null,
    daysSinceSale: input.daysSinceSale ?? null,
    neverSold: input.neverSold ?? false,
    soldInWindow: input.soldInWindow ?? 0,
    avgDailySales: 0,
    stagnant: input.stagnant ?? false,
    exceedsStock: false,
  }
}

function location(input: {
  id: string
  code: string
  kind?: string
  parentId?: string | null
  x?: number
  y?: number
  width?: number
  height?: number
  isActive?: boolean
  products?: MapLocationProduct[]
  quantity: number
  value?: number | null
  productsWithoutCost?: number
  band?: HeatBand
  neverSold?: boolean
  daysSinceSale?: number | null
  stagnantQuantity?: number
  stagnantValue?: number | null
  quantityClass?: number
  valueClass?: number | null
}): MapLocation {
  return {
    id: input.id,
    code: input.code,
    name: null,
    kind: input.kind ?? 'shelf',
    parentId: input.parentId ?? null,
    depth: input.parentId ? 1 : 0,
    path: input.code,
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.width ?? 1,
    height: input.height ?? 1,
    capacity: null,
    isActive: input.isActive ?? true,
    products: input.products ?? [],
    productCount: (input.products ?? []).length,
    quantity: input.quantity,
    value: input.value ?? null,
    productsWithoutCost: input.productsWithoutCost ?? 0,
    lastSoldAt: null,
    daysSinceSale: input.daysSinceSale ?? null,
    neverSold: input.neverSold ?? false,
    band: input.band ?? 'empty',
    stagnantProductCount: (input.products ?? []).filter((row) => row.stagnant).length,
    stagnantQuantity: input.stagnantQuantity ?? 0,
    stagnantValue: input.stagnantValue ?? null,
    quantityClass: input.quantityClass ?? 0,
    valueClass: input.valueClass ?? null,
    capacityUsed: null,
  }
}

const RICE = product({
  id: 'p-rice',
  name: 'برنج',
  sku: 'R-100',
  quantity: 10,
  unitCost: 5000,
  value: 50000,
  daysSinceSale: 5,
  soldInWindow: 6,
})
// ⚠️ No purchase price: `unitCost` and `value` are null on the PRODUCT, exactly
// as the server sends them. The location still totals 0 and says how many
// products it could not price.
const TEA = product({
  id: 'p-tea',
  name: 'چای',
  sku: 'T-200',
  quantity: 12,
  neverSold: true,
  stagnant: true,
})
const SUGAR = product({
  id: 'p-sugar',
  name: 'شکر',
  sku: 'شکر-۳',
  quantity: 7,
  unitCost: 2000,
  value: 14000,
  daysSinceSale: 120,
  stagnant: true,
})
const SALT = product({ id: 'p-salt', name: 'نمک', quantity: 3, neverSold: true, stagnant: true })

const Z01 = location({
  id: 'z1',
  code: 'Z01',
  kind: 'zone',
  x: 0,
  y: 0,
  width: 20,
  height: 2,
  quantity: 0,
})
const R01 = location({
  id: 'r1',
  code: 'R01',
  kind: 'rack',
  parentId: 'z1',
  y: 2,
  width: 10,
  quantity: 0,
})
const S01 = location({
  id: 's1',
  code: 'S01',
  parentId: 'r1',
  y: 2,
  products: [RICE],
  quantity: 10,
  value: 50000,
  band: 'moving',
  daysSinceSale: 5,
  quantityClass: 1,
  valueClass: 3,
})
const S02 = location({
  id: 's2',
  code: 'S02',
  parentId: 'r1',
  x: 1,
  y: 2,
  products: [TEA],
  quantity: 12,
  value: 0,
  productsWithoutCost: 1,
  band: 'stagnant',
  neverSold: true,
  stagnantQuantity: 12,
  stagnantValue: 0,
  quantityClass: 2,
  valueClass: 0,
})
const R02 = location({
  id: 'r2',
  code: 'R02',
  kind: 'rack',
  parentId: 'z1',
  y: 5,
  width: 10,
  products: [SUGAR, SALT],
  quantity: 10,
  value: 14000,
  productsWithoutCost: 1,
  band: 'stagnant',
  daysSinceSale: 120,
  stagnantQuantity: 10,
  stagnantValue: 14000,
  quantityClass: 1,
  valueClass: 2,
})
const A09 = location({ id: 'a09', code: 'A09', y: 8, width: 2, isActive: false, quantity: 0 })

const ALL: MapLocation[] = [Z01, R01, S01, S02, R02, A09]

/** Which category each product is filed under — the same lookup the view builds. */
const CATEGORY: Record<string, string> = {
  'p-rice': 'food',
  'p-sugar': 'food',
  'p-tea': 'drink',
  'p-salt': 'food',
}
const categoryOf = (productId: string): string | null => CATEGORY[productId] ?? null

const ids = (rows: readonly MapLocation[]) => rows.map((row) => row.id)

// ─── The search box ─────────────────────────────────────────────────────────

describe('the search box', () => {
  it('folds Persian and Arabic digits, case and separators to one form', () => {
    expect(foldQuery('R-01')).toBe('r01')
    expect(foldQuery(' r 01 ')).toBe('r01')
    // ۱۲۳ on a Persian keyboard, ١٢٣ on an Arabic one, 123 on a phone keypad.
    expect(foldQuery('۱۲۳')).toBe('123')
    expect(foldQuery('١٢٣')).toBe('123')
    expect(foldQuery('شکر-۳')).toBe('شکر3')
  })

  it('finds a shelf by its code, by its name, and by what is standing on it', () => {
    // By code.
    expect(matchesQuery(S01, foldQuery('s01'))).toBe(true)
    expect(matchesQuery(S02, foldQuery('s01'))).toBe(false)
    // By the products INSIDE it — «چای کجاست؟» is the question people actually ask.
    expect(matchesQuery(S02, foldQuery('چای'))).toBe(true)
    expect(matchesQuery(S01, foldQuery('چای'))).toBe(false)
    // By SKU, with a Persian digit typed as an English one.
    expect(matchesQuery(R02, foldQuery('شکر3'))).toBe(true)
    // An empty box matches everything, so the filter bar alone can be used.
    expect(matchesQuery(S01, '')).toBe(true)
  })
})

// ─── Filters and the dim/hide switch ────────────────────────────────────────

describe('filters', () => {
  it('keeps a zone AND everything under it, at any depth', () => {
    const picked = selectLocations(ALL, { ...NO_FILTERS, zoneId: 'z1' }, '', false, categoryOf)
    // S01/S02 are grandchildren of Z01 — a filter that only kept direct
    // children would hide exactly the shelves people are looking for.
    expect(ids(picked.visible)).toEqual(['z1', 'r1', 's1', 's2', 'r2'])
  })

  it('narrows by band, by category and by product', () => {
    const stagnant = selectLocations(
      ALL,
      { ...NO_FILTERS, band: 'stagnant' },
      '',
      false,
      categoryOf,
    )
    expect(ids(stagnant.visible)).toEqual(['s2', 'r2'])

    const food = selectLocations(ALL, { ...NO_FILTERS, category: 'food' }, '', false, categoryOf)
    expect(ids(food.visible)).toEqual(['s1', 'r2'])

    const tea = selectLocations(ALL, { ...NO_FILTERS, productId: 'p-tea' }, '', false, categoryOf)
    expect(ids(tea.visible)).toEqual(['s2'])

    const both = selectLocations(
      ALL,
      { ...NO_FILTERS, zoneId: 'z1', band: 'stagnant' },
      '',
      false,
      categoryOf,
    )
    expect(ids(both.visible)).toEqual(['s2', 'r2'])
  })

  it('dims what the search missed, and hides it only when asked', () => {
    const dimmed = selectLocations(ALL, NO_FILTERS, 'چای', false, categoryOf)
    // Everything that passed the filters is still ON the floor…
    expect(ids(dimmed.visible)).toEqual(['z1', 'r1', 's1', 's2', 'r2', 'a09'])
    // …and only the match is pointed at.
    expect([...dimmed.matched]).toEqual(['s2'])
    expect(dimmed.dimming).toBe(true)

    const hidden = selectLocations(ALL, NO_FILTERS, 'چای', true, categoryOf)
    expect(ids(hidden.visible)).toEqual(['s2'])
    expect(hidden.dimming).toBe(false)
  })

  it('answers the search inside the filtered rows, not outside them', () => {
    // A filter is a decision the person made: a hit outside it would point at a
    // shelf the filter just took off the floor.
    const picked = selectLocations(
      ALL,
      { ...NO_FILTERS, productId: 'p-sugar' },
      'چای',
      true,
      categoryOf,
    )
    expect(picked.visible).toEqual([])
    expect(picked.matched.size).toBe(0)
  })

  it('an empty box dims nothing', () => {
    const picked = selectLocations(ALL, NO_FILTERS, '   ', false, categoryOf)
    expect(picked.matched.size).toBe(0)
    expect(picked.dimming).toBe(false)
    expect(picked.visible.length).toBe(ALL.length)
  })

  it('does not hang on a broken parent chain', () => {
    // The shape trigger refuses a cycle, so this cannot come from the database —
    // but a screen that spins forever on bad data is worse than a wrong answer.
    const x1 = location({ id: 'x1', code: 'X1', parentId: 'x2', quantity: 0 })
    const x2 = location({ id: 'x2', code: 'X2', parentId: 'x1', quantity: 0 })
    const picked = selectLocations([x1, x2], { ...NO_FILTERS, zoneId: 'x1' }, '', false, categoryOf)
    expect(ids(picked.visible)).toEqual(['x1', 'x2'])
    const stranger = selectLocations(
      [x1, x2],
      { ...NO_FILTERS, zoneId: 'zz' },
      '',
      false,
      categoryOf,
    )
    expect(stranger.visible).toEqual([])
  })

  it('knows whether it is showing the whole warehouse', () => {
    expect(filtersActive(NO_FILTERS)).toBe(false)
    expect(filtersActive({ ...NO_FILTERS, band: 'slow' })).toBe(true)
    expect(filtersActive({ ...NO_FILTERS, zoneId: 'z1' })).toBe(true)
    expect(filtersActive({ ...NO_FILTERS, productId: 'p-tea' })).toBe(true)
    expect(filtersActive({ ...NO_FILTERS, category: 'food' })).toBe(true)
  })
})

// ─── The header ─────────────────────────────────────────────────────────────

describe('the header', () => {
  it('adds up the rows it was given — 10 + 12 + 10 units, four products', () => {
    const kpi = summarizeLocations([S01, S02, R02], true)
    expect(kpi.locationCount).toBe(3)
    expect(kpi.productCount).toBe(4)
    expect(kpi.quantity).toBe(32)
    // 50 000 + (nothing priceable) + 14 000
    expect(kpi.value).toBe(64000)
    // چای and نمک have no purchase price, so 64 000 is a LOWER BOUND and the
    // header has to be able to say so.
    expect(kpi.productsWithoutCost).toBe(2)
  })

  it('counts a product standing on two shelves once', () => {
    const second = location({
      id: 's3',
      code: 'S03',
      parentId: 'r1',
      y: 2,
      products: [RICE],
      quantity: 1,
      value: 5000,
      band: 'moving',
    })
    const kpi = summarizeLocations([S01, second], true)
    expect(kpi.productCount).toBe(1)
    expect(kpi.quantity).toBe(11)
    expect(kpi.value).toBe(55000)
  })

  it('adds up the dead rows apart from the live ones', () => {
    const kpi = summarizeLocations([S01, S02, R02], true)
    expect(kpi.stagnantLocationCount).toBe(2)
    expect(kpi.stagnantQuantity).toBe(22)
    // چای has no price, so the dead capital that CAN be valued is شکر alone.
    expect(kpi.stagnantValue).toBe(14000)
  })

  it('reports retired and empty locations through the filter', () => {
    const kpi = summarizeLocations(ALL, true)
    expect(kpi.locationCount).toBe(6)
    expect(kpi.activeLocationCount).toBe(5)
    // Z01, R01 AND the retired A09 hold nothing.
    expect(kpi.emptyLocationCount).toBe(3)
  })

  it('leaves money null when the reader may not see cost — never 0', () => {
    const kpi = summarizeLocations([S01, S02, R02], false)
    expect(kpi.value).toBeNull()
    expect(kpi.stagnantValue).toBeNull()
    // The units are not a secret and are still counted.
    expect(kpi.quantity).toBe(32)
    // Under redaction every product LOOKS unpriced; the count is the server's
    // answer about the products, so it is 0 rather than «all of them».
    expect(kpi.productsWithoutCost).toBe(0)
  })
})

// ─── «سرمایه راکد» ──────────────────────────────────────────────────────────

describe('dead capital', () => {
  it('ranks by value when it can, by units when it cannot', () => {
    const byValue = deadCapital([S01, S02, R02], 5)
    expect(ids(byValue.map((row) => row.location))).toEqual(['r2', 's2'])
    expect(byValue[0]!.value).toBe(14000)
    expect(byValue[1]!.value).toBe(0)

    // Same shelves, no cost permission: the money is null on every row, so the
    // order has to come from something the reader can check — the units.
    const noCost = deadCapital(
      [
        { ...S02, stagnantValue: null },
        { ...R02, stagnantValue: null },
      ],
      5,
    )
    expect(ids(noCost.map((row) => row.location))).toEqual(['s2', 'r2'])
    expect(noCost.every((row) => row.value === null)).toBe(true)
  })

  it('says how long a shelf has been quiet, and how much of it never sold', () => {
    const rows = deadCapital([S02, R02], 5)
    const r02 = rows.find((row) => row.location.id === 'r2')!
    // شکر sold 120 days ago, نمک never: the shelf itself has been quiet for
    // 120 days (its LATEST sale), and one product on it has never sold.
    expect(r02.quietDays).toBe(120)
    expect(r02.neverSoldCount).toBe(1)
    expect(r02.productCount).toBe(2)
    expect(r02.quantity).toBe(10)

    const s02 = rows.find((row) => row.location.id === 's2')!
    // Nothing here has ever sold — not «0 days ago», which would read as today.
    expect(s02.quietDays).toBeNull()
    expect(s02.neverSoldCount).toBe(1)
  })

  it('lists only the sleeping part of the floor', () => {
    const rows = deadCapital(ALL, 5)
    expect(ids(rows.map((row) => row.location))).toEqual(['r2', 's2'])
    expect(deadCapital(ALL, 1)).toHaveLength(1)
  })
})

// ─── Wording, metrics and the layout helpers ────────────────────────────────

describe('saying it in words', () => {
  it('explains every band with a number a person can check', () => {
    expect(bandReason(S01, 30)).toEqual({ key: 'soldRecently', values: { days: 5 } })
    expect(bandReason(S02, 30)).toEqual({ key: 'neverSold', values: {} })
    expect(bandReason(R02, 30)).toEqual({ key: 'soldLongAgo', values: { days: 120, window: 30 } })
    expect(bandReason(Z01, 30)).toEqual({ key: 'empty', values: {} })
    // A band with no date is not a reason to invent one.
    expect(bandReason({ band: 'slow', neverSold: false, daysSinceSale: null }, 30)).toEqual({
      key: 'unknown',
      values: {},
    })
  })

  it('offers the value metric only to somebody who may see cost', () => {
    expect(availableMetrics(false)).toEqual(['band', 'quantity'])
    expect(availableMetrics(true)).toEqual(['band', 'quantity', 'value'])
  })

  it('labels one product by what it actually did', () => {
    expect(
      productBand({ soldInWindow: 3, daysSinceSale: 2, neverSold: false, stagnant: false }),
    ).toBe('moving')
    expect(
      productBand({ soldInWindow: 0, daysSinceSale: 40, neverSold: false, stagnant: false }),
    ).toBe('slow')
    expect(
      productBand({ soldInWindow: 0, daysSinceSale: null, neverSold: true, stagnant: true }),
    ).toBe('stagnant')
  })
})

describe('the layout helpers', () => {
  it('knows a shelf may not be moved under itself', () => {
    expect([...descendantIds(ALL, 'z1')].sort()).toEqual(['r1', 'r2', 's1', 's2'])
    expect([...descendantIds(ALL, 's1')]).toEqual([])
  })

  it('terminates on a broken chain instead of walking for ever', () => {
    const x1 = location({ id: 'x1', code: 'X1', parentId: 'x2', quantity: 0 })
    const x2 = location({ id: 'x2', code: 'X2', parentId: 'x1', quantity: 0 })
    expect(descendantIds([x1, x2], 'x1').size).toBe(2)
  })

  it('puts a new shelf below everything already drawn, at the left edge', () => {
    // The lowest edge is A09 at 8 + 1 = 9.
    expect(suggestPosition(ALL)).toEqual({ x: 0, y: 9 })
    // Nothing drawn yet: the first shelf starts at the origin.
    expect(suggestPosition([])).toEqual({ x: 0, y: 0 })
  })
})
