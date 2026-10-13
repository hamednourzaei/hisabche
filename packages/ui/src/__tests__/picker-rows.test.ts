// ============================================
// What the invoice's product picker lists (lib/invoices/picker-rows).
//
// The complaint it answers: every product was listed under the chosen
// warehouse's name with «۰», including goods that had never been in it.
//
// Two warehouses and two branches throughout — a one-warehouse fixture keeps
// every one of these rules green by accident.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { StockPlacement } from '@hisabche/api'

import { pickerRows, warehousesForBranch } from '../lib/invoices/picker-rows'

const HOY = 'w-hoy'
const HAJI = 'w-haji'
const SAADAT = 'b-saadat'
const KABUL = 'b-kabul'

const products = [
  { id: 'gold', name: 'طلا', quantity: 20 },
  { id: 'bottle', name: 'شیشه بطری', quantity: 724 },
  { id: 'leas', name: 'leas', quantity: 100 },
  { id: 'kartoon', name: 'kartoon', quantity: 0 },
]

const placement: StockPlacement = {
  branchesConfigured: true,
  restricted: false,
  warehouses: [
    { id: HOY, name: 'hoy', branchId: SAADAT, branchName: 'سعادت آباد' },
    { id: HAJI, name: 'haji joon', branchId: KABUL, branchName: 'کابل' },
  ],
  stock: [
    { productId: 'gold', warehouseId: HOY, quantity: 20 },
    { productId: 'gold', warehouseId: HAJI, quantity: 0 },
    { productId: 'leas', warehouseId: HOY, quantity: 100 },
    { productId: 'bottle', warehouseId: HAJI, quantity: 724 },
  ],
}

const names = (rows: ReturnType<typeof pickerRows>) =>
  rows.map(
    (row) => `${row.product.id}@${row.warehouseName}=${row.stock}${row.exhausted ? '!' : ''}`,
  )

describe('a sale from one warehouse', () => {
  it('⚠️ lists only what that warehouse has a record of — not every product under its name', () => {
    expect(
      names(pickerRows({ products, placement, warehouseId: HOY, branchId: null, mode: 'sale' })),
    ).toEqual(['gold@hoy=20', 'leas@hoy=100'])
    // The same business, the other warehouse: other goods, and the gold it has
    // run out of stays — marked, and not pickable.
    expect(
      names(pickerRows({ products, placement, warehouseId: HAJI, branchId: null, mode: 'sale' })),
    ).toEqual(['gold@haji joon=0!', 'bottle@haji joon=724'])
  })

  it('a product that was never in any warehouse is not offered from one', () => {
    const rows = pickerRows({ products, placement, warehouseId: HOY, branchId: null, mode: 'sale' })
    expect(rows.some((row) => row.product.id === 'kartoon')).toBe(false)
  })
})

describe('«all warehouses»', () => {
  it('⚠️ one line per product and warehouse that holds some — each with its own number', () => {
    const rows = pickerRows({
      products,
      placement,
      warehouseId: null,
      branchId: null,
      mode: 'sale',
    })
    expect(names(rows)).toEqual(['gold@hoy=20', 'bottle@haji joon=724', 'leas@hoy=100'])
    // Every line knows which warehouse it would sell from, and its key is its own.
    expect(rows.map((row) => row.warehouseId)).toEqual([HOY, HAJI, HOY])
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length)
  })

  it('a product in two warehouses is two lines, never one sum', () => {
    const both: StockPlacement = {
      ...placement,
      stock: [
        { productId: 'gold', warehouseId: HOY, quantity: 12 },
        { productId: 'gold', warehouseId: HAJI, quantity: 8 },
      ],
    }
    expect(
      names(
        pickerRows({ products, placement: both, warehouseId: null, branchId: null, mode: 'sale' }),
      ),
    ).toEqual(['gold@hoy=12', 'gold@haji joon=8'])
  })
})

describe('a branch', () => {
  it('⚠️ narrows the warehouses, and with them the goods', () => {
    expect(warehousesForBranch(placement, SAADAT).map((warehouse) => warehouse.name)).toEqual([
      'hoy',
    ])
    expect(
      names(pickerRows({ products, placement, warehouseId: null, branchId: SAADAT, mode: 'sale' })),
    ).toEqual(['gold@hoy=20', 'leas@hoy=100'])
    // A warehouse of another branch is not a choice inside this one, even when
    // the draft still remembers it.
    expect(
      names(pickerRows({ products, placement, warehouseId: HAJI, branchId: SAADAT, mode: 'sale' })),
    ).toEqual(['gold@hoy=20', 'leas@hoy=100'])
  })

  it('a database that cannot place warehouses in branches does not filter by one', () => {
    const unplaced: StockPlacement = { ...placement, branchesConfigured: false }
    expect(warehousesForBranch(unplaced, SAADAT)).toHaveLength(2)
  })
})

describe('what is not a sale', () => {
  it('a purchase lists every product — buying is how one arrives — with what is there now', () => {
    expect(
      names(
        pickerRows({ products, placement, warehouseId: HOY, branchId: null, mode: 'purchase' }),
      ),
    ).toEqual(['gold@hoy=20', 'bottle@hoy=0', 'leas@hoy=100', 'kartoon@hoy=0'])
  })

  it('a component of a recipe is never «out»', () => {
    const rows = pickerRows({
      products,
      placement,
      warehouseId: HAJI,
      branchId: null,
      mode: 'component',
    })
    expect(rows).toHaveLength(4)
    expect(rows.some((row) => row.exhausted)).toBe(false)
  })
})

describe('no warehouses, or nothing read yet', () => {
  it('a business with no warehouse keeps the one total per product', () => {
    const none: StockPlacement = {
      branchesConfigured: true,
      restricted: false,
      warehouses: [],
      stock: [],
    }
    expect(
      names(
        pickerRows({ products, placement: none, warehouseId: null, branchId: null, mode: 'sale' }),
      ),
    ).toEqual(['gold@=20', 'bottle@=724', 'leas@=100', 'kartoon@=0!'])
    expect(
      pickerRows({
        products,
        placement: undefined,
        warehouseId: null,
        branchId: null,
        mode: 'sale',
      }),
    ).toHaveLength(4)
  })

  it('⚠️ a member whose branches include no warehouse is offered nothing to sell — not everything', () => {
    const locked: StockPlacement = {
      branchesConfigured: true,
      restricted: true,
      warehouses: [],
      stock: [],
    }
    expect(
      pickerRows({ products, placement: locked, warehouseId: null, branchId: null, mode: 'sale' }),
    ).toEqual([])
  })
})

describe('the screens that use it', () => {
  const read = (path: string) =>
    readFileSync(join(__dirname, '..', path), 'utf8')
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
      .join('\n')
      .split(/\s+/)
      .join(' ')
  const picker = read('components/ui/invoice-builder/grid/description-cell.tsx')
  const select = read('components/ui/invoice-builder/invoice-warehouse-select.tsx')

  it('picking a line from «all warehouses» makes its warehouse the warehouse of the invoice', () => {
    expect(picker).toContain(
      "if (row.warehouseId && !warehouseId) setField('warehouseId', row.warehouseId)",
    )
  })

  it('the select offers the warehouses of the chosen branch, and «all» only when there is more than one', () => {
    expect(select).toContain('const warehouses = warehousesForBranch(data, branchId)')
    expect(select).toContain('...(warehouses.length > 1 ? [')
    expect(select).toContain("t('invoiceBuilder.warehouseAll', 'تمام انبارها')")
    // A warehouse of another branch, or one this person may not use, is dropped.
    expect(select).toContain(
      'if (value && !warehouses.some((warehouse) => warehouse.id === value)) onChange(null)',
    )
  })

  it('the quantities a sale is decided on are never read from a cache', () => {
    const hook = readFileSync(join(__dirname, '../../../api/src/hooks/warehouses.ts'), 'utf8')
    const body = hook.slice(hook.indexOf('export function useStockPlacement'))
    expect(body.slice(0, body.indexOf('export function useCreateWarehouse'))).toContain(
      "refetchOnMount: 'always'",
    )
  })

  it.each(['fa', 'af', 'en'])('every new sentence exists in %s', (lang) => {
    const all = JSON.parse(
      readFileSync(join(__dirname, '../../../i18n/messages', lang, 'common.json'), 'utf8'),
    ) as Record<string, Record<string, unknown>>
    for (const key of [
      'warehouseAll',
      'warehouseAllHint',
      'warehouseNoneAllowed',
      'warehouseNoneInBranch',
    ]) {
      expect(typeof all.invoiceBuilder![key], key).toBe('string')
    }
    expect(typeof (all.invoiceBuilder!.grid as Record<string, unknown>).noProductsHere).toBe(
      'string',
    )
    for (const key of ['branch', 'branchNone', 'branchHint']) {
      expect(typeof all.warehouse![key], key).toBe('string')
    }
    for (const key of ['warehouses', 'branches', 'no_warehouse']) {
      expect(typeof all.products![key], key).toBe('string')
    }
  })
})
