// ============================================
// «نقشه قفسه‌ها» (owner, 18 Oct 2026): a hub section beside «انبارها، کالاها،
// پیشنهاد سفارش، کالای راکد»; aisles read from shelf codes; a shelf opens as a
// table with the catalogue's pager, «جابه‌جایی» and «انتقال به انبار دیگر».
// ============================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  fillBand,
  groupIntoAisles,
  pageOf,
  readShelfCode,
} from '../components/ui/warehouse/shelves/shelf-map'
import { STOCK_SECTIONS } from '../components/ui/warehouse/containers/warehouse-tabs-container'

const src = (path: string) =>
  readFileSync(resolve(__dirname, '../components/ui/warehouse', path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    .split(/\s+/)
    .join(' ')

describe('reading a shelf code', () => {
  it('letters + number, in any digits, with or without a dash', () => {
    expect(readShelfCode('A-1')).toEqual({ aisle: 'A', bay: 1 })
    expect(readShelfCode('a02')).toEqual({ aisle: 'A', bay: 2 })
    expect(readShelfCode('R02-S04')).toEqual({ aisle: 'R', bay: 2 })
    expect(readShelfCode('ب-۳')).toEqual({ aisle: 'ب', bay: 3 })
    expect(readShelfCode('روغن')).toBeNull()
  })

  it('groups into aisles: odd bays on one side, even on the other', () => {
    const shelf = (code: string) => ({ id: code, code, capacityUsed: null })
    const aisles = groupIntoAisles(['B-2', 'A-2', 'A-1', 'A-3', 'روغن', 'B-1'].map(shelf))
    expect(aisles.map((a) => a.aisle)).toEqual(['A', 'B', ''])
    expect(aisles[0]!.odd.map((s) => s.code)).toEqual(['A-1', 'A-3'])
    expect(aisles[0]!.even.map((s) => s.code)).toEqual(['A-2'])
    expect(aisles[2]!.odd.map((s) => s.code)).toEqual(['روغن'])
  })
})

describe('fill and pages', () => {
  it('no capacity is «not recorded», never «empty»', () => {
    expect(fillBand(null, 0)).toBe('none')
    expect(fillBand(0, 0)).toBe('empty')
    expect(fillBand(0.3, 2)).toBe('low')
    expect(fillBand(0.95, 2)).toBe('full')
    expect(fillBand(1.2, 2)).toBe('over')
  })

  it('pages of ten, clamped', () => {
    const rows = Array.from({ length: 23 }, (_, i) => i)
    expect(pageOf(rows, 1, 10)).toMatchObject({ page: 1, pageCount: 3 })
    expect(pageOf(rows, 9, 10).rows).toEqual([20, 21, 22])
    expect(pageOf([], 1, 10)).toMatchObject({ page: 1, pageCount: 1 })
  })
})

describe('wiring', () => {
  it('is a section of the hub switch, after «کالاها»', () => {
    expect([...STOCK_SECTIONS].slice(0, 3)).toEqual(['warehouses', 'products', 'shelfMap'])
    expect(src('containers/warehouse-tabs-container.tsx')).toContain(
      "section === 'shelfMap' ? ( <WarehouseShelfMapSection />",
    )
  })

  it('a shelf is in the address and its table uses the shared DataTable and pager', () => {
    expect(src('shelves/warehouse-products-section.tsx')).toContain(
      "`/warehouse?view=shelfMap&stockWarehouse=${warehouseId}${shelf ? `&shelf=${shelf}` : ''}`",
    )
    const view = src('shelves/warehouse-shelf-map.tsx')
    expect(view).toContain('<DataTable tableId="shelf-products"')
    expect(view).toContain("plainT('common.previous', 'قبلی')")
    expect(view).toContain("t('warehouseShelves.table.transfer')")
  })

  it('a transfer from a shelf also takes it off that shelf', () => {
    expect(src('shelves/warehouse-products-section.tsx')).toContain(
      'quantity: Math.max(0, onShelf - input.quantity),',
    )
  })
})
