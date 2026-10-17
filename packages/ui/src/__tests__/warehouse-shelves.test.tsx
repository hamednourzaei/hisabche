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
  ShelfDialog,
  type ShelfT,
  type ShelfValues,
} from '../components/ui/warehouse/shelves/shelf-dialogs'
import {
  stockOptions,
  WarehouseShelvesView,
  type WarehouseShelvesViewProps,
} from '../components/ui/warehouse/shelves/warehouse-shelves-view'
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
    formatQuantity: (v) => String(v),
    unitLabel: (u) => u,
    state: 'ready',
    errorMessage: null,
    onRetry: () => undefined,
    shelves,
    stock: stockOptions(products, shelves),
    canConfigure: true,
    canPlace: true,
    onAddShelf: vi.fn(),
    onEditShelf: vi.fn(),
    onRequest: vi.fn(),
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

describe('the shelves of one warehouse', () => {
  it('lists every shelf with the products on it, and the unshelved card', () => {
    view()
    const a01 = document.querySelector('[data-shelf="A-01"]') as HTMLElement
    expect(within(a01).getByText('روغن آشپزی')).toBeTruthy()
    expect(within(a01).getByText('12 piece')).toBeTruthy()
    const unshelved = document.querySelector('[data-unshelved]') as HTMLElement
    expect(within(unshelved).getByText('برنج')).toBeTruthy()
    expect(within(unshelved).getByText('8 piece')).toBeTruthy()
  })

  it('search keeps only the shelves that hold a match', () => {
    view()
    fireEvent.change(screen.getByLabelText(message('warehouseShelves.search')!), {
      target: { value: 'روغن' },
    })
    expect(document.querySelector('[data-shelf="A-01"]')).toBeTruthy()
    expect(document.querySelector('[data-shelf="B-04"]')).toBeNull()
  })

  it('every action goes to the parent as a request — place on a shelf, move, put an unshelved product', () => {
    const props = view()
    const a01 = document.querySelector('[data-shelf="A-01"]') as HTMLElement
    fireEvent.click(within(a01).getByText(message('warehouseShelves.move')!))
    expect(props.onRequest).toHaveBeenCalledWith({
      mode: 'move',
      productId: OIL,
      fromShelfId: 's1',
    })
    fireEvent.click(within(a01).getByText(message('warehouseShelves.addProductHere')!))
    expect(props.onRequest).toHaveBeenCalledWith({ mode: 'place', shelfId: 's1' })
    const unshelved = document.querySelector('[data-unshelved]') as HTMLElement
    fireEvent.click(within(unshelved).getAllByText(message('warehouseShelves.putOnShelf')!)[0]!)
    expect(props.onRequest).toHaveBeenCalledWith({ mode: 'place', productId: OIL })
  })

  it('without product.write nothing is offered to change; without inventory.configure no shelf is added', () => {
    view({ canPlace: false, canConfigure: false })
    expect(screen.queryByText(message('warehouseShelves.move')!)).toBeNull()
    expect(screen.queryByText(message('warehouseShelves.addShelf')!)).toBeNull()
  })

  it('a warehouse with no shelves says it works without them, and offers to add one', () => {
    const props = view({ shelves: [], stock: stockOptions(products, []) })
    expect(screen.getByText(message('warehouseShelves.noShelvesTitle')!)).toBeTruthy()
    fireEvent.click(screen.getByText(message('warehouseShelves.addShelf')!))
    expect(props.onAddShelf).toHaveBeenCalled()
  })

  it('not migrated, failed and loading are three different screens — none of them is «empty»', () => {
    view({ state: 'not-migrated' })
    expect(screen.getByText(message('warehouseShelves.notMigrated')!)).toBeTruthy()
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

  it('from a shelf: the quantity starts at «on this shelf + on no shelf» and is what is sent', async () => {
    const onPlace = vi.fn(async () => undefined)
    render(
      <PlaceDialog
        t={t}
        formatQuantity={String}
        unitLabel={(u) => u}
        request={{ mode: 'place', shelfId: 's1', productId: OIL }}
        shelves={shelves.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
        products={stock}
        isPending={false}
        onPlace={onPlace}
        onMove={vi.fn()}
        onClose={() => undefined}
      />,
    )
    const input = screen.getByPlaceholderText(
      message('warehouseShelves.placeDialog.quantityPlaceholder')!,
    ) as HTMLInputElement
    expect(input.value).toBe('20') // 12 already there + 8 on no shelf
    fireEvent.click(screen.getByText(message('warehouseShelves.placeDialog.save')!))
    await Promise.resolve()
    expect(onPlace).toHaveBeenCalledWith({ shelfId: 's1', productId: OIL, quantity: 20 })
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
    expect(hub).not.toContain("'map'")
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
