// ============================================
// packages/ui/src/__tests__/warehouse-shelves.test.tsx
//
// «قفسه‌ها» — the floor map was «too much» (owner, 17 Oct 2026). What replaced it:
//   · «کالاها» has one tab per warehouse (with its branch); under a warehouse,
//     its shelves, each listing the products recorded on it;
//   · «بدون قفسه» = what the warehouse holds minus what its shelves hold;
//   · a shelf is a code (+ description, capacity) — no x/y/width/height;
//   · the warehouse form has a «مدیریت قفسه‌ها» switch; off, nothing is asked.
// The texts are read from the REAL Persian catalogue.
// ============================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MapLocation, MapLocationProduct } from '@hisabche/api'
import { createStorageLocationSchema } from '@hisabche/validation'

import { searchKey } from '../components/ui/select-field'
import {
  PlaceDialog,
  placeLimits,
  ShelfDialog,
  type ShelfT,
  type ShelfValues,
} from '../components/ui/warehouse/shelves/shelf-dialogs'
import {
  stockOptions,
  WarehouseShelvesView,
  type WarehouseShelvesViewProps,
} from '../components/ui/warehouse/shelves/warehouse-shelves-view'
import {
  ShelfMapView,
  ShelfProductsView,
} from '../components/ui/warehouse/shelves/warehouse-shelf-map'
import { repeatedShelfCodes } from '../components/ui/warehouse/warehouse-dialogs'

afterEach(cleanup)

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

const ROOT = join(__dirname, '..', '..', '..', '..')
const catalogs = Object.fromEntries(
  (['fa', 'af', 'en'] as const).map((lang) => [
    lang,
    JSON.parse(
      readFileSync(join(ROOT, 'packages', 'i18n', 'messages', lang, 'common.json'), 'utf8'),
    ) as Record<string, unknown>,
  ]),
)
function message(key: string, lang: 'fa' | 'af' | 'en' = 'fa'): string | undefined {
  let node: unknown = catalogs[lang]
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : undefined
}
const t: ShelfT = (key, values) => {
  const text = message(key) ?? key
  return values
    ? Object.entries(values).reduce(
        (out, [name, value]) => out.replaceAll(`{${name}}`, String(value)),
        text,
      )
    : text
}

function row(id: string, name: string, quantity: number): MapLocationProduct {
  return {
    productId: id,
    name,
    sku: null,
    unit: 'piece',
    quantity,
    unitCost: null,
    value: null,
    lastSoldAt: null,
    daysSinceSale: null,
    neverSold: false,
    soldInWindow: 0,
    avgDailySales: 0,
    stagnant: false,
    exceedsStock: false,
  }
}
function shelf(id: string, code: string, products: MapLocationProduct[]): MapLocation {
  return {
    id,
    code,
    name: null,
    kind: 'shelf',
    parentId: null,
    depth: 0,
    path: code,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    capacity: null,
    isActive: true,
    products,
    productCount: products.length,
    quantity: products.reduce((s, p) => s + p.quantity, 0),
    value: null,
    productsWithoutCost: 0,
    lastSoldAt: null,
    daysSinceSale: null,
    neverSold: false,
    band: 'moving',
    stagnantProductCount: 0,
    stagnantQuantity: 0,
    stagnantValue: null,
    quantityClass: 0,
    valueClass: null,
    capacityUsed: null,
  }
}

const OIL = '11111111-1111-4111-8111-111111111111'
const RICE = '22222222-2222-4222-8222-222222222222'
const shelves = [shelf('s1', 'A-01', [row(OIL, 'روغن آشپزی', 12)]), shelf('s2', 'B-04', [])]
const products = [
  { id: OIL, name: 'روغن آشپزی', sku: 'OIL-16', unit: 'piece', quantity: 20 },
  { id: RICE, name: 'برنج', sku: null, unit: 'piece', quantity: 5 },
]

function view(over: Partial<WarehouseShelvesViewProps> = {}) {
  const props: WarehouseShelvesViewProps = {
    t,
    state: 'ready',
    errorMessage: null,
    onRetry: () => undefined,
    shelves,
    canConfigure: true,
    onAddShelf: vi.fn(),
    ...over,
  }
  render(<WarehouseShelvesView {...props} />)
  return props
}

describe('«بدون قفسه» is what the warehouse holds minus what its shelves hold', () => {
  it('20 oil held, 12 on A-01 → 8 free; rice on no shelf → 5 free; never below zero', () => {
    const options = stockOptions(products, shelves)
    expect(options.find((o) => o.id === OIL)).toMatchObject({
      total: 20,
      free: 8,
      onShelf: { s1: 12 },
    })
    expect(options.find((o) => o.id === RICE)).toMatchObject({ total: 5, free: 5, onShelf: {} })
    const over = stockOptions([{ ...products[0]!, quantity: 10 }], shelves)
    expect(over[0]!.free).toBe(0)
  })
})

// ⚠️ 18 Oct 2026 (owner, «دوتا یو ار ال میخوام چیکار»): the shelf CARDS are gone.
// Shelves are the map (`?view=shelfMap`), a shelf is its table; this view is
// only the screens that are not the map.
const plainT = (key: string, fallback?: string) => message(key) ?? fallback ?? key

describe('the shelves of one warehouse — the map, and one shelf', () => {
  it('with shelves, this view draws nothing: the map does', () => {
    view()
    expect(document.body.textContent).toBe('')
  })

  it('a tile opens its shelf', () => {
    const onOpenShelf = vi.fn()
    render(
      <ShelfMapView
        t={t}
        formatQuantity={(v) => String(v)}
        shelves={shelves}
        onOpenShelf={onOpenShelf}
      />,
    )
    fireEvent.click(document.querySelector('[data-map-shelf="A-01"]')!)
    expect(onOpenShelf).toHaveBeenCalledWith(shelves[0])
  })

  it('a shelf page: move, transfer, add here, edit — each a request to the parent', () => {
    const calls = { move: vi.fn(), transfer: vi.fn(), add: vi.fn(), edit: vi.fn() }
    render(
      <ShelfProductsView
        t={t}
        plainT={plainT}
        formatQuantity={(v) => String(v)}
        formatMoney={(v) => String(v)}
        unitLabel={(u) => u}
        shelf={shelves[0]!}
        warehouseName="halakoi"
        canPlace
        canMove
        canTransfer
        onBack={() => undefined}
        onAdd={calls.add}
        onMove={calls.move}
        onTransfer={calls.transfer}
        onEdit={calls.edit}
      />,
    )
    fireEvent.click(screen.getByText(message('warehouseShelves.move')!))
    expect(calls.move).toHaveBeenCalledWith(expect.objectContaining({ productId: OIL }))
    fireEvent.click(screen.getByText(message('warehouseShelves.table.transfer')!))
    expect(calls.transfer).toHaveBeenCalledWith(expect.objectContaining({ productId: OIL }))
    fireEvent.click(screen.getByText(message('warehouseShelves.addProductHere')!))
    expect(calls.add).toHaveBeenCalled()
    fireEvent.click(screen.getByText(message('warehouseShelves.editShelf')!))
    expect(calls.edit).toHaveBeenCalled()
  })

  it('without permission the shelf page offers no change', () => {
    render(
      <ShelfProductsView
        t={t}
        plainT={plainT}
        formatQuantity={(v) => String(v)}
        formatMoney={(v) => String(v)}
        unitLabel={(u) => u}
        shelf={shelves[0]!}
        warehouseName="halakoi"
        canPlace={false}
        canMove={false}
        canTransfer={false}
        onBack={() => undefined}
        onAdd={vi.fn()}
        onMove={vi.fn()}
        onTransfer={vi.fn()}
      />,
    )
    expect(screen.queryByText(message('warehouseShelves.move')!)).toBeNull()
    expect(screen.queryByText(message('warehouseShelves.editShelf')!)).toBeNull()
    expect(screen.queryByText(message('warehouseShelves.addProductHere')!)).toBeNull()
  })

  it('a warehouse with no shelves says it works without them, and offers to add one', () => {
    const props = view({ shelves: [] })
    expect(screen.getByText(message('warehouseShelves.noShelvesTitle')!)).toBeTruthy()
    fireEvent.click(screen.getByText(message('warehouseShelves.addShelf')!))
    expect(props.onAddShelf).toHaveBeenCalled()
  })

  it('not migrated, failed and loading are three different screens — none of them is «empty»', () => {
    view({ state: 'not-migrated' })
    expect(screen.getByText(message('warehouseShelves.notMigrated')!)).toBeTruthy()
    cleanup()
    // ⚠️ The device's engine keeps shelves but not the map. Offline, that is «not
    // available», never «run docs/warehouse-map-01-migration.sql on the database»
    // (owner, 26 Oct 2026) — an instruction for a server the person is not on.
    view({ state: 'offline-unavailable' })
    expect(screen.getByText(message('warehouseShelves.notAvailableOffline')!)).toBeTruthy()
    expect(screen.queryByText(message('warehouseShelves.notMigrated')!)).toBeNull()
    cleanup()
    view({ state: 'error' })
    expect(screen.getByRole('alert').textContent).toContain(message('warehouseShelves.loadFailed')!)
    cleanup()
    view({ state: 'loading' })
    expect(screen.queryByText(message('warehouseShelves.noShelvesTitle')!)).toBeNull()
  })
})

describe('a shelf is a code, not coordinates', () => {
  it('the payload passes the server create schema and carries no x/y/width/height', async () => {
    const onSubmit = vi.fn<(values: ShelfValues) => Promise<unknown>>(async () => undefined)
    render(
      <ShelfDialog
        t={t}
        open
        editing={null}
        isPending={false}
        onSubmit={onSubmit}
        onClose={() => undefined}
      />,
    )
    fireEvent.change(
      screen.getByPlaceholderText(message('warehouseShelves.shelfDialog.codePlaceholder')!),
      {
        target: { value: 'A-03' },
      },
    )
    fireEvent.click(screen.getByText(message('common.save')!))
    await Promise.resolve()
    const sent = onSubmit.mock.calls[0]![0]
    expect(Object.keys(sent).sort()).toEqual(['capacity', 'code'])
    expect(createStorageLocationSchema.safeParse({ kind: 'shelf', ...sent }).success).toBe(true)
  })

  it('a refused code names the reason in the form', async () => {
    const onSubmit = vi.fn(async () => {
      throw { response: { data: { code: 'STORAGE_LOCATION_CODE_TAKEN' } } }
    })
    render(
      <ShelfDialog
        t={t}
        open
        editing={null}
        isPending={false}
        onSubmit={onSubmit}
        onClose={() => undefined}
      />,
    )
    fireEvent.change(
      screen.getByPlaceholderText(message('warehouseShelves.shelfDialog.codePlaceholder')!),
      {
        target: { value: 'A-03' },
      },
    )
    fireEvent.click(screen.getByText(message('common.save')!))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe(message('warehouseShelves.errors.codeTaken'))
  })
})

describe('placing on a shelf', () => {
  const stock = stockOptions(products, shelves)

  // ⚠️ Owner, 18 Oct 2026: re-placing 2 gearboxes asked for the TOTAL and
  // started at «8»; a product new to the shelf started at its whole stock.
  // The dialog now ADDS, at most min(on no shelf, room left on the shelf).
  const GEAR = '33333333-3333-4333-8333-333333333333'
  const HOSE = '44444444-4444-4444-8444-444444444444'
  const a3 = { id: 'a3', code: 'A-3', name: 'قفسه گیربوکس', capacity: 10, occupied: 2 }
  const gearStock = [
    {
      id: GEAR,
      name: 'گیربوکس اتوماتیک',
      sku: null,
      unit: 'custom',
      total: 8,
      free: 6,
      onShelf: { a3: 2 },
    },
    { id: HOSE, name: 'شلنگ رادیات', sku: null, unit: 'piece', total: 10, free: 10, onShelf: {} },
  ]
  const placeDialog = (over: Record<string, unknown> = {}) => {
    const onPlace = vi.fn(async () => undefined)
    const onSetAuto = vi.fn(async () => undefined)
    render(
      <PlaceDialog
        t={t}
        formatQuantity={String}
        unitLabel={(u) => u}
        request={{ mode: 'place', shelfId: 'a3', productId: GEAR }}
        shelves={[a3]}
        products={gearStock}
        isPending={false}
        onPlace={onPlace}
        onMove={vi.fn()}
        onClose={() => undefined}
        autoShelfOf={() => null}
        onSetAuto={onSetAuto}
        {...over}
      />,
    )
    const input = document.querySelector('input[name="quantity"]') as HTMLInputElement
    return { onPlace, onSetAuto, input }
  }

  it('shows the four numbers and asks how many to ADD; the box starts empty', () => {
    const { input } = placeDialog()
    const summary = document.querySelector('[data-place-summary]')!.textContent ?? ''
    expect(summary).toContain('8 custom') // in this warehouse
    expect(summary).toContain('2 custom') // on this shelf
    expect(summary).toContain('6 custom') // on no shelf
    expect(input.value).toBe('')
    expect(input.placeholder).toContain('6') // min(6 free, 8 room)
  })

  it('adding 4 sends 2 + 4 = 6 — the number the shelf holds', async () => {
    const { onPlace, input } = placeDialog()
    fireEvent.change(input, { target: { value: '۴' } })
    fireEvent.click(screen.getByText(message('warehouseShelves.placeDialog.save')!))
    await Promise.resolve()
    expect(onPlace).toHaveBeenCalledWith({ shelfId: 'a3', productId: GEAR, quantity: 6 })
  })

  it('more than the max is refused before sending: room 4 (capacity 4, 2 on it) → 3 is too many', () => {
    const { onPlace, input } = placeDialog({ shelves: [{ ...a3, capacity: 4 }] })
    expect(input.placeholder).toContain('2')
    fireEvent.change(input, { target: { value: '3' } })
    const save = screen.getByText(
      message('warehouseShelves.placeDialog.save')!,
    ) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    expect(onPlace).not.toHaveBeenCalled()
  })

  it('a product new to the shelf starts at 0 on it, its own stock on no shelf', () => {
    placeDialog({ request: { mode: 'place', shelfId: 'a3', productId: HOSE } })
    const summary = document.querySelector('[data-place-summary]')!.textContent ?? ''
    expect(summary).toContain('0 piece')
    expect(summary).toContain('10 piece')
  })

  it('a full shelf takes nothing and says so', () => {
    const { input } = placeDialog({ shelves: [{ ...a3, capacity: 2 }] })
    expect(input.disabled).toBe(true)
    expect(screen.getByText(message('warehouseShelves.placeDialog.shelfFull')!)).toBeTruthy()
  })

  it('the auto-shelf switch is saved on its own, without placing anything', async () => {
    const { onPlace, onSetAuto } = placeDialog()
    fireEvent.click(document.querySelector('[data-auto-shelf]')!)
    fireEvent.click(screen.getByText(message('warehouseShelves.placeDialog.save')!))
    await Promise.resolve()
    expect(onSetAuto).toHaveBeenCalledWith({ shelfId: 'a3', productId: GEAR, enabled: true })
    expect(onPlace).not.toHaveBeenCalled()
  })

  it('placeLimits: min(on no shelf, room); no capacity = only the stock', () => {
    expect(placeLimits({ free: 6, capacity: 10, occupied: 2 })).toEqual({ room: 8, max: 6 })
    expect(placeLimits({ free: 6, capacity: 4, occupied: 2 })).toEqual({ room: 2, max: 2 })
    expect(placeLimits({ free: 6, capacity: null, occupied: 2 })).toEqual({ room: null, max: 6 })
    expect(placeLimits({ free: 0, capacity: 10, occupied: 0 }).max).toBe(0)
  })

  it('the product choice is the ONE select with search, and the form says where a missing product comes from', () => {
    render(
      <PlaceDialog
        t={t}
        formatQuantity={String}
        unitLabel={(u) => u}
        request={{ mode: 'place', shelfId: 's1' }}
        shelves={shelves.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
        products={stock}
        isPending={false}
        onPlace={vi.fn()}
        onMove={vi.fn()}
        onClose={() => undefined}
      />,
    )
    expect(screen.getByText(message('warehouseShelves.placeDialog.notInList')!)).toBeTruthy()
    const source = readFileSync(
      join(
        ROOT,
        'packages',
        'ui',
        'src',
        'components',
        'ui',
        'warehouse',
        'shelves',
        'shelf-dialogs.tsx',
      ),
      'utf8',
    )
    expect(source).toContain('searchable')
    expect(source).not.toContain('ProductPicker')
  })
})

describe('the warehouse form', () => {
  it('a branch can be made right here, and the branch field shows even before the first one exists', () => {
    const source = readFileSync(
      join(ROOT, 'packages', 'ui', 'src', 'components', 'ui', 'warehouse', 'warehouse-dialogs.tsx'),
      'utf8',
    )
    expect(source).toContain('const canPlace = placement.data?.branchesConfigured === true')
    expect(source).not.toContain('branches.length > 0 && placement')
    expect(source).toContain('data-add-branch')
    expect(source).toContain("useMyCapabilities().can('workspace.manage') === true")
    for (const lang of ['fa', 'af', 'en'] as const) {
      for (const key of ['newBranch', 'newBranchName', 'newBranchCode', 'addBranch']) {
        expect(message(`warehouse.${key}`, lang), `${lang} ${key}`).toBeTruthy()
      }
    }
  })

  it('a repeated shelf code is caught before anything is sent', () => {
    expect(
      repeatedShelfCodes([{ code: 'A-01' }, { code: ' A-01 ' }, { code: 'B-02' }, { code: '' }]),
    ).toEqual(['A-01'])
  })

  it('has the «مدیریت قفسه‌ها» switch, and its rows send only code and description', () => {
    const source = readFileSync(
      join(ROOT, 'packages', 'ui', 'src', 'components', 'ui', 'warehouse', 'warehouse-dialogs.tsx'),
      'utf8',
    )
    expect(source).toContain('data-warehouse-shelves-switch')
    expect(source).toContain('<Switch')
    expect(source).not.toMatch(/\bx:\s|\by:\s|width:|height:/)
  })
})

describe('the floor map is gone from the product', () => {
  it('no map section, no map files, no map button', () => {
    const hub = readFileSync(
      join(
        ROOT,
        'packages',
        'ui',
        'src',
        'components',
        'ui',
        'warehouse',
        'containers',
        'warehouse-tabs-container.tsx',
      ),
      'utf8',
    )
    // 18 Oct: «نقشه قفسه‌ها» is a section (shelfMap); the old `?view=map` only redirects there.
    expect(hub).not.toMatch(/STOCK_SECTIONS = \[[^\]]*'map'/)
    expect(hub).toContain("params.get('view') === 'map'")
    expect(hub).toContain('<WarehouseProductsSection')
    expect(
      existsSync(join(ROOT, 'packages', 'ui', 'src', 'components', 'ui', 'warehouse', 'map')),
    ).toBe(false)
    const view = readFileSync(
      join(ROOT, 'packages', 'ui', 'src', 'components', 'ui', 'warehouse', 'warehouse-view.tsx'),
      'utf8',
    )
    expect(view).not.toContain('MapIcon')
    expect(view).toContain('data-warehouse-shelves-open')
  })

  it('the warehouse is a FILTER in the list toolbar, not a third row of tabs («خیلی شلوغ شد»)', () => {
    const section = readFileSync(
      join(
        ROOT,
        'packages',
        'ui',
        'src',
        'components',
        'ui',
        'warehouse',
        'shelves',
        'warehouse-products-section.tsx',
      ),
      'utf8',
    )
    expect(section).toContain('<TableFilterSelect')
    expect(section).not.toContain('<SegmentedControl')
    expect(section).not.toContain('<HubTabs')
    expect(section).toContain('<ProductListContainer actions={filter} />')
    expect(section).toContain('toolbar={filter}')
    // ONE address: the old `?view=products&stockWarehouse=` goes to the map.
    expect(section).toContain(
      'if (requested) replace(`/warehouse?view=shelfMap&stockWarehouse=${requested}`)',
    )
    expect(section).not.toContain('`/warehouse?view=products&stockWarehouse=')
  })

  it('search matches across ی/ي, ک/ك and the zero-width non-joiner', () => {
    expect(searchKey(`${String.fromCharCode(0x643)}الا`)).toBe(searchKey('کالا'))
    expect(searchKey(`روغن${String.fromCharCode(0x64a)}`)).toBe(searchKey('روغنی'))
    expect(searchKey(`می${String.fromCharCode(0x200c)}خرم`)).toBe(searchKey('میخرم'))
  })

  it('every shelves text exists in all three languages', () => {
    const fa = catalogs.fa!.warehouseShelves as Record<string, unknown>
    const walk = (node: Record<string, unknown>, prefix: string): string[] =>
      Object.entries(node).flatMap(([key, value]) =>
        typeof value === 'object' && value !== null
          ? walk(value as Record<string, unknown>, `${prefix}${key}.`)
          : [`${prefix}${key}`],
      )
    for (const key of walk(fa, 'warehouseShelves.')) {
      for (const lang of ['af', 'en'] as const)
        expect(message(key, lang), `${lang} ${key}`).toBeTruthy()
    }
    for (const lang of ['fa', 'af', 'en'] as const) {
      expect((catalogs[lang] as Record<string, unknown>).warehouseMap).toBeUndefined()
    }
  })
})
