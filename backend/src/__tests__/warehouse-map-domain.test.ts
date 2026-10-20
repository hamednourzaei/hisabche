// ============================================
// The map of a warehouse, without a database
// (services/inventory/warehouse-map.domain).
//
// What can go wrong, and what each assertion is here for:
//
//   · a location's colour meaning something nobody can explain — every band is
//     asserted with the SENTENCE behind it («۹۴ روز بدون فروش»)
//   · «nothing recorded here» collapsing into «zero value»
//   · a product with no purchase price making the shelf look cheaper than it is
//   · the stock that no location records disappearing instead of being counted
//   · a placement outgrowing the stock and being reported as fine
//   · the value rule disagreeing with the warehouse cards
// ============================================

import { describe, expect, it } from 'vitest'

import {
  buildWarehouseMap,
  intensityClass,
  locationPath,
  movementBand,
  stockValueAtBuyPrice,
  type BuildMapInput,
  type RawLocation,
} from '../services/inventory/warehouse-map.domain'

const AS_OF = new Date('2026-10-16T00:00:00.000Z')
const day = (n: number) => new Date(AS_OF.getTime() - n * 86_400_000).toISOString()

const location = (over: Partial<RawLocation> & Pick<RawLocation, 'id' | 'code'>): RawLocation => ({
  warehouseId: 'w1',
  parentId: null,
  name: null,
  kind: 'bin',
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  capacity: null,
  isActive: true,
  ...over,
})

describe('movementBand — the colour says a sentence', () => {
  const base = { quantity: 6, stagnantProductCount: 0, productCount: 1, days: 90, asOf: AS_OF }

  it('nothing recorded in it is EMPTY — not «zero value»', () => {
    expect(movementBand({ ...base, quantity: 0, lastSoldAt: null, productCount: 0 })).toBe('empty')
    // A location whose products are all removed is empty even if the row stays.
    expect(movementBand({ ...base, quantity: 0, lastSoldAt: null })).toBe('empty')
  })

  it('⚠️ «بدون فروش در ۹۴ روز» is stagnant — the boundary is the existing 90 days', () => {
    expect(movementBand({ ...base, lastSoldAt: day(94) })).toBe('stagnant')
    // Exactly 90 days is already dead stock: `findDeadStock` uses `>=`.
    expect(movementBand({ ...base, lastSoldAt: day(90) })).toBe('stagnant')
    expect(movementBand({ ...base, lastSoldAt: day(89) })).toBe('slow')
  })

  it('inside the demand window it is moving; before it, slow', () => {
    expect(movementBand({ ...base, lastSoldAt: day(3) })).toBe('moving')
    expect(movementBand({ ...base, lastSoldAt: day(29) })).toBe('moving')
    expect(movementBand({ ...base, lastSoldAt: day(30) })).toBe('slow')
    expect(movementBand({ ...base, lastSoldAt: day(60) })).toBe('slow')
  })

  it('never sold is stagnant — and stays distinguishable from «sold long ago»', () => {
    expect(movementBand({ ...base, lastSoldAt: null })).toBe('stagnant')
  })

  it('a shelf is stagnant only when EVERYTHING on it is dead', () => {
    expect(
      movementBand({
        ...base,
        productCount: 3,
        stagnantProductCount: 3,
        lastSoldAt: day(400),
      }),
    ).toBe('stagnant')
    // Two dead products out of three, and the third sold a week ago: the rack
    // was worked, so it is not painted dead — the dead VALUE is reported
    // separately, per location, and the drawer names the products.
    expect(
      movementBand({
        ...base,
        productCount: 3,
        stagnantProductCount: 2,
        lastSoldAt: day(7),
      }),
    ).toBe('moving')
  })
})

describe('the pieces', () => {
  it('stockValueAtBuyPrice is what the stock COST — the rule summarizeStock uses', () => {
    expect(stockValueAtBuyPrice(6, 100)).toBe(600)
    expect(stockValueAtBuyPrice(-3, 100)).toBe(0)
    expect(stockValueAtBuyPrice(4.5, 2)).toBe(9)
  })

  it('intensity has a floor at zero and a top rung, and never divides by zero', () => {
    expect(intensityClass(0, 100)).toBe(0)
    expect(intensityClass(100, 0)).toBe(0)
    expect(intensityClass(25, 100)).toBe(1)
    expect(intensityClass(50, 100)).toBe(2)
    expect(intensityClass(51, 100)).toBe(3)
    expect(intensityClass(100, 100)).toBe(3)
  })

  it('the path is the codes from the root down, and a broken chain stops rather than looping', () => {
    const byId = new Map([
      ['a', { code: 'Z01', parentId: null }],
      ['b', { code: 'R01', parentId: 'a' }],
      ['c', { code: 'S01', parentId: 'b' }],
      ['x', { code: 'LOST', parentId: 'x' }],
    ])
    expect(locationPath('c', byId)).toBe('Z01 › R01 › S01')
    expect(locationPath('a', byId)).toBe('Z01')
    expect(locationPath('x', byId)).toBe('LOST')
  })
})

// ─── The full transform, computed by hand ───────────────────────────────────

function fixture(): BuildMapInput {
  return {
    warehouse: { id: 'w1', name: 'گدام مرکزی', branchId: 'b1', branchName: 'کابل' },
    currency: 'AFN',
    asOf: AS_OF,
    costVisible: true,
    days: 90,
    locations: [
      location({ id: 'l1', code: 'Z01', kind: 'zone', width: 10, height: 6, capacity: 100 }),
      location({
        id: 'l2',
        code: 'R01',
        kind: 'rack',
        parentId: 'l1',
        x: 1,
        y: 1,
        width: 2,
        height: 2,
      }),
      location({
        id: 'l3',
        code: 'S01',
        kind: 'bin',
        parentId: 'l2',
        x: 1,
        y: 1,
        capacity: 20,
      }),
    ],
    placements: [
      { locationId: 'l2', productId: 'p1', quantity: 6 },
      { locationId: 'l3', productId: 'p2', quantity: 4 },
      { locationId: 'l3', productId: 'p3', quantity: 2 },
    ],
    products: [
      { id: 'p1', name: 'برنج', sku: 'R1', unit: 'kg', buyPrice: 100 },
      { id: 'p2', name: 'چای', sku: null, unit: 'kg', buyPrice: null },
      { id: 'p3', name: 'روغن', sku: 'O1', unit: 'liter', buyPrice: 250 },
    ],
    warehouseStock: [
      { productId: 'p1', quantity: 10 },
      { productId: 'p2', quantity: 4 },
      { productId: 'p3', quantity: 2 },
    ],
    sales: {
      lastSoldAt: new Map([
        ['p1', day(94)],
        ['p2', day(3)],
      ]),
      unitsInWindow: new Map([['p2', 12]]),
    },
  }
}

describe('buildWarehouseMap', () => {
  const map = buildWarehouseMap(fixture())
  const by = (code: string) => map.locations.find((row) => row.code === code)!

  it('⚠️ parents are drawn before their children — depth first, then the code', () => {
    expect(map.locations.map((row) => row.code)).toEqual(['Z01', 'R01', 'S01'])
    expect(map.locations.map((row) => row.depth)).toEqual([0, 1, 2])
    expect(by('S01').path).toBe('Z01 › R01 › S01')
  })

  it('⚠️ «بدون فروش در ۹۴ روز»: the rack is stagnant, with the sentence behind it', () => {
    const rack = by('R01')
    expect(rack.band).toBe('stagnant')
    expect(rack.daysSinceSale).toBe(94)
    expect(rack.neverSold).toBe(false)
    expect(rack.products[0]).toMatchObject({
      productId: 'p1',
      quantity: 6,
      unitCost: 100,
      value: 600,
      stagnant: true,
      soldInWindow: 0,
    })
  })

  it('a shelf holding one live product and one dead one is MOVING, and still reports the dead value', () => {
    const bin = by('S01')
    expect(bin.band).toBe('moving')
    expect(bin.daysSinceSale).toBe(3)
    expect(bin.productCount).toBe(2)
    expect(bin.quantity).toBe(6)
    // چای has no price recorded: it counts, and it makes the value a LOWER
    // bound — the number is not silently padded.
    expect(bin.value).toBe(500)
    expect(bin.productsWithoutCost).toBe(1)
    // روغن never sold from this warehouse: `neverSold`, daysSinceSale null.
    const oil = bin.products.find((row) => row.productId === 'p3')!
    expect(oil.neverSold).toBe(true)
    expect(oil.daysSinceSale).toBeNull()
    expect(oil.stagnant).toBe(true)
    // ⚠️ The dead value is reported even though the shelf is not painted dead.
    expect(bin.stagnantProductCount).toBe(1)
    expect(bin.stagnantQuantity).toBe(2)
    expect(bin.stagnantValue).toBe(500)
    expect(bin.products.find((row) => row.productId === 'p2')!.avgDailySales).toBeCloseTo(
      12 / 90,
      4,
    )
  })

  it('a zone with nothing in it is empty, and its recorded capacity reads 0% — not «unknown»', () => {
    const zone = by('Z01')
    expect(zone.band).toBe('empty')
    expect(zone.productCount).toBe(0)
    expect(zone.value).toBe(0)
    // 0 of a recorded 100 is a fact. «Cannot be calculated» is for a location
    // that never got a capacity — that one stays null.
    expect(zone.capacityUsed).toBe(0)
    expect(by('R01').capacityUsed).toBeNull()
    expect(by('S01').capacityUsed).toBeCloseTo(6 / 20, 6)
  })

  it('the colour ladder is relative to this warehouse, and the top rung is the fullest shelf', () => {
    expect(by('Z01').quantityClass).toBe(0)
    expect(by('R01').quantityClass).toBe(3)
    expect(by('S01').quantityClass).toBe(3)
    expect(by('R01').valueClass).toBe(3)
    expect(by('S01').valueClass).toBe(3)
  })

  it('the totals are the sums a person reads, computed by hand', () => {
    expect(map.totals).toEqual({
      locationCount: 3,
      activeLocationCount: 3,
      retiredLocationCount: 0,
      emptyLocationCount: 1,
      locationProductCount: 3,
      placedQuantity: 12,
      placedValue: 1100,
      stagnantLocationCount: 1,
      stagnantValue: 1100,
      stagnantQuantity: 8,
      productsWithoutCost: 1,
      capacityTotal: 120,
      capacityRecordedCount: 2,
    })
  })

  it('⚠️ what the warehouse holds and no location records is COUNTED, never hidden', () => {
    // برنج: 10 on hand, 6 on the rack → 4 unaccounted for, at cost 100.
    expect(map.unplaced).toEqual({ productCount: 1, quantity: 4, value: 400 })
    expect(map.drift).toEqual({ productCount: 0, quantity: 0, value: 0 })
    expect(map.currency).toBe('AFN')
    expect(map.migrated).toBe(true)
    expect(map.demandWindowDays).toBe(30)
  })

  it('⚠️ a placement the stock has outgrown is DRIFT: reported, never clamped and never repaired', () => {
    const input = fixture()
    // A sale emptied the warehouse while the shelf labels stayed where they were.
    const drifted = buildWarehouseMap({
      ...input,
      warehouseStock: [
        { productId: 'p1', quantity: 1 },
        { productId: 'p2', quantity: 4 },
        { productId: 'p3', quantity: 2 },
      ],
    })
    expect(drifted.drift).toEqual({ productCount: 1, quantity: 5, value: 500 })
    expect(drifted.locations.find((row) => row.code === 'R01')!.products[0]!.exceedsStock).toBe(
      true,
    )
    // The shelf still reports what was RECORDED — the drift is beside it, not
    // subtracted from it.
    expect(drifted.locations.find((row) => row.code === 'R01')!.quantity).toBe(6)
    // and nothing is counted as unplaced for that product: there is no stock
    // left to place.
    expect(drifted.unplaced.productCount).toBe(0)
  })

  it('a retired location keeps its place in the map — the goods are still on it', () => {
    const input = fixture()
    const retired = buildWarehouseMap({
      ...input,
      locations: input.locations.map((row) =>
        row.id === 'l3' ? { ...row, isActive: false } : row,
      ),
    })
    expect(retired.locations.map((row) => row.code)).toContain('S01')
    // ⚠️ It keeps what is recorded in it: retiring a shelf does not unload it.
    expect(retired.locations.find((row) => row.code === 'S01')!.quantity).toBe(6)
    expect(retired.totals.retiredLocationCount).toBe(1)
    expect(retired.totals.activeLocationCount).toBe(2)
    // A retired shelf's capacity is not counted as usable space.
    expect(retired.totals.capacityRecordedCount).toBe(1)
    expect(retired.totals.capacityTotal).toBe(100)
  })

  it('scale: 200 shelves holding 5 each, and the sums still add up', () => {
    const locations: RawLocation[] = []
    const placements = []
    for (let i = 0; i < 200; i += 1) {
      const id = `loc-${String(i).padStart(4, '0')}`
      locations.push(
        location({ id, code: `S-${String(i).padStart(4, '0')}`, x: i % 20, y: Math.floor(i / 20) }),
      )
      placements.push({ locationId: id, productId: 'p1', quantity: 5 })
    }
    const large = buildWarehouseMap({
      ...fixture(),
      locations,
      placements,
      warehouseStock: [{ productId: 'p1', quantity: 1000 }],
    })
    expect(large.totals.locationCount).toBe(200)
    expect(large.totals.placedQuantity).toBe(1000)
    expect(large.totals.placedValue).toBe(100_000)
    expect(large.unplaced).toEqual({ productCount: 0, quantity: 0, value: 0 })
    expect(large.locations[0]!.quantityClass).toBe(3)
  })
})

describe('⚠️ a reader who may not see cost gets no cost — and is not told «worth nothing»', () => {
  const hidden = buildWarehouseMap({ ...fixture(), costVisible: false })
  const by = (code: string) => hidden.locations.find((row) => row.code === code)!

  it('every money figure is null, not zero', () => {
    expect(hidden.costVisible).toBe(false)
    expect(by('R01').value).toBeNull()
    expect(by('R01').stagnantValue).toBeNull()
    expect(by('R01').valueClass).toBeNull()
    expect(by('R01').products[0]!.unitCost).toBeNull()
    expect(by('R01').products[0]!.value).toBeNull()
    expect(hidden.totals.placedValue).toBeNull()
    expect(hidden.totals.stagnantValue).toBeNull()
    expect(hidden.unplaced.value).toBeNull()
    expect(hidden.drift.value).toBeNull()
  })

  it('⚠️ «no price recorded» is NOT reported to someone who may not read prices', () => {
    // چای genuinely has no price; the manager's map says 1 product without a
    // cost. For the seller that count would be a claim about data they cannot
    // see — and it would be the same sentence as «the shop never typed it».
    const shown = buildWarehouseMap(fixture())
    expect(shown.locations.find((row) => row.code === 'S01')!.productsWithoutCost).toBe(1)
    expect(by('S01').productsWithoutCost).toBe(0)
    expect(hidden.totals.productsWithoutCost).toBe(0)
  })

  it('quantities, movement and the rest of the map are untouched', () => {
    expect(by('S01').quantity).toBe(6)
    expect(by('S01').band).toBe('moving')
    expect(by('R01').band).toBe('stagnant')
    expect(by('S01').capacityUsed).toBeCloseTo(6 / 20, 6)
    expect(by('R01').quantityClass).toBe(3)
    expect(hidden.totals.placedQuantity).toBe(12)
    expect(hidden.locations.map((row) => row.code)).toEqual(['Z01', 'R01', 'S01'])
  })
})
