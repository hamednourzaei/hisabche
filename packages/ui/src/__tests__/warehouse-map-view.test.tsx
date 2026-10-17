// ============================================
// packages/ui/src/__tests__/warehouse-map-view.test.tsx
//
// The states of «نقشه انبار», and the one rule that ties the screen together:
// the header describes the floor that is actually on screen.
//
// ---------------------------------------------------------------------------
// ⚠️ THE REAL CATALOG, NOT `t('key') → 'key'`
//
// A translator that returns the key proves a label exists and nothing else. The
// assertions below read the PERSIAN a shopkeeper sees — «راکد», the number in
// «{count} موقعیت», the name of the migration script — so a key that renders but
// says nothing useful fails here.
//
// ---------------------------------------------------------------------------
// ⚠️ AND A FAILED READ IS NOT AN EMPTY WAREHOUSE
//
// Four of these tests are about telling those apart: not migrated, failed,
// nothing recorded, and nothing matching the filter are four different screens
// which send a person to do four different things.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HeatBand, MapLocation, MapLocationProduct, WarehouseMap } from '@hisabche/api'

import {
  WarehouseMapView,
  type WarehouseMapViewProps,
} from '../components/ui/warehouse/map/warehouse-map-view'
import type { MapTranslator } from '../components/ui/warehouse/map/map-filtering'

afterEach(cleanup)

// ─── next-intl ──────────────────────────────────────────────────────────────
//
// ⚠️ MOCKED BECAUSE OF ONE DEPENDENCY, NOT BECAUSE OF THIS SCREEN. The shared
// `SelectField` → `select.tsx` calls `useTranslations()` for its own labels and
// there is no provider in a bare jsdom render. The mock reads the SAME Persian
// catalog the app ships, so nothing here is a stub dictionary.
vi.mock('next-intl', async () => {
  const { readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const catalog = JSON.parse(
    readFileSync(
      join(__dirname, '..', '..', '..', '..', 'packages', 'i18n', 'messages', 'fa', 'common.json'),
      'utf8',
    ),
  ) as Record<string, unknown>

  const read = (key: string): string => {
    let node: unknown = catalog
    for (const part of key.split('.')) {
      if (typeof node !== 'object' || node === null) return key
      node = (node as Record<string, unknown>)[part]
    }
    return typeof node === 'string' ? node : key
  }

  return { useTranslations: () => read, useLocale: () => 'fa' }
})

// ─── The catalogue the app actually ships ───────────────────────────────────

const ROOT = join(__dirname, '..', '..', '..', '..')
const catalog = JSON.parse(
  readFileSync(join(ROOT, 'packages', 'i18n', 'messages', 'fa', 'common.json'), 'utf8'),
) as Record<string, unknown>

function message(key: string): string {
  let node: unknown = catalog
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return key
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : key
}

/** The real Persian text, with the values the call site passed interpolated. */
const t: MapTranslator = (key, values) => {
  const text = message(key)
  if (!values) return text
  return Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    text,
  )
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

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
  band: HeatBand
  quantity: number
  value?: number | null
  products?: MapLocationProduct[]
  productsWithoutCost?: number
  neverSold?: boolean
  daysSinceSale?: number | null
  stagnantQuantity?: number
  stagnantValue?: number | null
}): MapLocation {
  return {
    id: input.id,
    code: input.code,
    name: null,
    kind: 'shelf',
    parentId: null,
    depth: 0,
    path: input.code,
    x: 0,
    y: 0,
    width: 4,
    height: 2,
    capacity: null,
    isActive: true,
    products: input.products ?? [],
    productCount: (input.products ?? []).length,
    quantity: input.quantity,
    value: input.value ?? null,
    productsWithoutCost: input.productsWithoutCost ?? 0,
    lastSoldAt: null,
    daysSinceSale: input.daysSinceSale ?? null,
    neverSold: input.neverSold ?? false,
    band: input.band,
    stagnantProductCount: (input.products ?? []).filter((row) => row.stagnant).length,
    stagnantQuantity: input.stagnantQuantity ?? 0,
    stagnantValue: input.stagnantValue ?? null,
    quantityClass: 0,
    valueClass: null,
    capacityUsed: null,
  }
}

const MOVING = location({
  id: 's1',
  code: 'S01',
  band: 'moving',
  quantity: 10,
  value: 50000,
  daysSinceSale: 5,
  products: [
    product({
      id: 'p-rice',
      name: 'برنج',
      sku: 'R-100',
      quantity: 10,
      unitCost: 5000,
      value: 50000,
      daysSinceSale: 5,
      soldInWindow: 6,
    }),
  ],
})
// ⚠️ چای has no purchase price: it adds 0 to the money and is COUNTED, so the
// value on screen is a lower bound and the screen has to say so.
const DEAD = location({
  id: 's2',
  code: 'S02',
  band: 'stagnant',
  quantity: 12,
  value: 0,
  productsWithoutCost: 1,
  neverSold: true,
  stagnantQuantity: 12,
  stagnantValue: 0,
  products: [
    product({
      id: 'p-tea',
      name: 'چای',
      sku: 'T-200',
      quantity: 12,
      neverSold: true,
      stagnant: true,
    }),
  ],
})
const EMPTY = location({ id: 'a09', code: 'A09', band: 'empty', quantity: 0 })

function payload(input: {
  locations: MapLocation[]
  migrated?: boolean
  unplacedQuantity?: number
}): WarehouseMap {
  const locations = input.locations
  return {
    warehouse: { id: 'w1', name: 'انبار مرکزی', branchId: null, branchName: null },
    currency: 'AFN',
    costVisible: true,
    days: 90,
    demandWindowDays: 30,
    asOf: '2026-10-16T09:00:00.000Z',
    migrated: input.migrated ?? true,
    locations,
    totals: {
      locationCount: locations.length,
      activeLocationCount: locations.length,
      retiredLocationCount: 0,
      emptyLocationCount: locations.filter((row) => row.band === 'empty').length,
      locationProductCount: locations.reduce((total, row) => total + row.productCount, 0),
      placedQuantity: locations.reduce((total, row) => total + row.quantity, 0),
      placedValue: null,
      stagnantLocationCount: locations.filter((row) => row.band === 'stagnant').length,
      stagnantValue: null,
      stagnantQuantity: 0,
      productsWithoutCost: 0,
      capacityTotal: null,
      capacityRecordedCount: 0,
    },
    unplaced: { productCount: 0, quantity: input.unplacedQuantity ?? 0, value: null },
    drift: { productCount: 0, quantity: 0, value: null },
  }
}

/** Every prop, spelled out — `Partial` + spread loses required-ness under `exactOptionalPropertyTypes`. */
function makeProps(over: Partial<WarehouseMapViewProps> = {}): WarehouseMapViewProps {
  return {
    t: over.t ?? t,
    fmt: over.fmt ?? ((value) => String(value)),
    formatDate: over.formatDate ?? ((value) => value),
    warehouses: over.warehouses ?? [{ id: 'w1', name: 'انبار مرکزی' }],
    warehouseId: over.warehouseId ?? 'w1',
    onPickWarehouse: over.onPickWarehouse ?? (() => undefined),
    map: over.map ?? payload({ locations: [MOVING, DEAD, EMPTY] }),
    isLoading: over.isLoading ?? false,
    errorMessage: over.errorMessage ?? null,
    onRetry: over.onRetry ?? (() => undefined),
    schemaRequired: over.schemaRequired ?? false,
    days: over.days ?? 90,
    onPickDays: over.onPickDays ?? (() => undefined),
    warehouseProducts: over.warehouseProducts ?? [
      { id: 'p-tea', name: 'چای', quantity: 12, category: null },
    ],
    canConfigure: over.canConfigure ?? false,
    canPlace: over.canPlace ?? false,
    isPlacing: over.isPlacing ?? false,
    placeError: over.placeError ?? null,
    placedResult: over.placedResult ?? null,
    onPlace: over.onPlace ?? (() => undefined),
    layoutPending: over.layoutPending ?? false,
    layoutError: over.layoutError ?? null,
    onCreateLocation: over.onCreateLocation ?? (async () => ({ id: 'new-location' })),
    onUpdateLocation: over.onUpdateLocation ?? (async () => undefined),
    onNavigate: over.onNavigate,
  }
}

/** The number inside one KPI card, read the way a person reads it: under its label. */
const statValue = (label: string) =>
  within(screen.getByLabelText('خلاصه نقشه')).getByText(label).nextElementSibling?.textContent

// ─── The four states that must not be confused ──────────────────────────────

describe('saying which kind of nothing it is', () => {
  it('names the script when the map has not been switched on yet', () => {
    render(
      <WarehouseMapView
        {...makeProps({
          schemaRequired: true,
          map: payload({ locations: [MOVING], migrated: false }),
        })}
      />,
    )
    expect(screen.getByText(/warehouse-map-01-migration\.sql/)).toBeTruthy()
    // NOT «this warehouse has no locations»: telling somebody their racks are
    // missing when the script was never run sends them to build them twice.
    expect(screen.queryByText(/هیچ موقعیتی ندارد/)).toBeNull()
    expect(screen.queryByRole('group')).toBeNull()
  })

  it('shows a failed read as a failure, with a way to try again', () => {
    const onRetry = vi.fn()
    render(<WarehouseMapView {...makeProps({ errorMessage: 'نقشه خوانده نشد.', onRetry })} />)
    expect(screen.getByRole('alert').textContent).toContain('نقشه خوانده نشد.')
    expect(screen.queryByText(/هیچ موقعیتی ندارد/)).toBeNull()
    fireEvent.click(screen.getByText('تلاش دوباره'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('says the warehouse has no locations yet, and how much stock is elsewhere', () => {
    render(
      <WarehouseMapView
        {...makeProps({ map: payload({ locations: [], unplacedQuantity: 40 }) })}
      />,
    )
    expect(screen.getByText(/این انبار هنوز هیچ موقعیتی ندارد/)).toBeTruthy()
    // Stock that no location records is not hidden by the empty map.
    expect(screen.getByText(/40 واحد در این انبار هیچ موقعیتی ندارد/)).toBeTruthy()
    expect(screen.queryByRole('group')).toBeNull()
  })

  it('says there is no warehouse at all rather than drawing an empty one', () => {
    render(<WarehouseMapView {...makeProps({ warehouses: [], warehouseId: null })} />)
    expect(screen.getByText(/هنوز انباری ثبت نشده/)).toBeTruthy()
  })

  it('says nothing matched the filter, and keeps the floor it filtered', () => {
    render(<WarehouseMapView {...makeProps()} />)
    fireEvent.change(screen.getByLabelText('جستجو'), { target: { value: 'R-100' } })
    // Hide what the search missed: the rice rack stays, the tea shelf goes.
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.queryByText(/چیزی با/)).toBeNull()
    expect(statValue('موقعیت‌ها')).toBe('1')

    fireEvent.change(screen.getByLabelText('جستجو'), { target: { value: 'چیزی که نیست' } })
    expect(screen.getByText(/چیزی با «چیزی که نیست» پیدا نشد/)).toBeTruthy()
    expect(screen.queryByRole('group')).toBeNull()
  })
})

// ─── The header follows the floor ───────────────────────────────────────────

describe('the header', () => {
  it('counts what is on the floor, and says when a filter is narrowing it', () => {
    render(<WarehouseMapView {...makeProps()} />)
    // 10 + 12 + 0 units across three locations.
    expect(statValue('موقعیت‌ها')).toBe('3')
    expect(statValue('مقدار')).toBe('22')
    expect(statValue('ارزش (به قیمت خرید)')).toBe('50000')
    expect(screen.queryByText(/این عددها بر اساس فیلترهای فعلی/)).toBeNull()
    // چای could not be priced, so the money above is a lower bound.
    expect(screen.getByText(/کالا قیمت خرید ندارد/)).toBeTruthy()
  })

  it('dims first and narrows the header only when the search HIDES rows', () => {
    render(<WarehouseMapView {...makeProps()} />)
    fireEvent.change(screen.getByLabelText('جستجو'), { target: { value: 'T-200' } })
    // Dim mode: everything is still standing on the floor, so the header still
    // describes the whole of it.
    expect(statValue('موقعیت‌ها')).toBe('3')
    expect(screen.queryByText(/این عددها بر اساس فیلترهای فعلی/)).toBeNull()

    fireEvent.click(screen.getByRole('checkbox'))
    expect(statValue('موقعیت‌ها')).toBe('1')
    expect(statValue('مقدار')).toBe('12')
    expect(screen.getByText(/این عددها بر اساس فیلترهای فعلی/)).toBeTruthy()
  })
})

// ─── Search, the dead-capital panel, and the two permissions ────────────────

describe('finding a shelf and looking at it', () => {
  it('lists what the search found and opens the one that was picked', () => {
    const onNavigate = vi.fn()
    render(<WarehouseMapView {...makeProps({ onNavigate, canPlace: true })} />)
    fireEvent.change(screen.getByLabelText('جستجو'), { target: { value: 'T-200' } })
    // The chip names the shelf; nothing opens until it is chosen.
    expect(screen.getByText(/1 موقعیت با «T-200»/)).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'S02' }))
    const drawer = screen.getByRole('dialog')
    // «راکد» in words, and a reason a person can check — the colour is not the
    // only carrier of the meaning.
    expect(within(drawer).getByText('راکد')).toBeTruthy()
    expect(within(drawer).getAllByText(/بدون فروش ثبت‌شده از این انبار/).length).toBeGreaterThan(0)
    // The products on the shelf are rows, and the row is a door into the
    // product screen that already exists.
    expect(within(drawer).getByText('چای')).toBeTruthy()
    fireEvent.click(within(drawer).getByText('مشاهده کالا'))
    expect(onNavigate).toHaveBeenCalledWith('/warehouse/p-tea')
  })

  it('answers «which part has my money locked up?» and points at it', () => {
    render(<WarehouseMapView {...makeProps()} />)
    expect(screen.getByText(/کدام قسمت انبار سرمایه‌ام را قفل کرده/)).toBeTruthy()
    // S02 is the only sleeping shelf, and its one product never sold.
    expect(screen.getByText(/1 کالا · 12 واحد · هیچ‌کالایی از این انبار فروش نرفته/)).toBeTruthy()
    fireEvent.click(screen.getAllByText('مشاهده روی نقشه')[0]!)
    expect(within(screen.getByRole('dialog')).getByText('راکد')).toBeTruthy()
  })

  it('offers the layout form to the owner and to nobody else', () => {
    const { unmount } = render(<WarehouseMapView {...makeProps()} />)
    expect(screen.queryByText('افزودن موقعیت')).toBeNull()
    unmount()
    render(<WarehouseMapView {...makeProps({ canConfigure: true })} />)
    expect(screen.getByText('افزودن موقعیت')).toBeTruthy()
  })
})
