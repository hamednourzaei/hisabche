// ============================================
// price-list.service — and the quote that reads it.
//
// What can go wrong HERE: a price for another workspace's product, a customer
// put on a retired list, a removal that deletes instead of retiring, a list in
// dollars pricing an afghani invoice, a retired or out-of-date list still
// pricing a line, a missing table answered as «no lists», and a product that is
// not on the list becoming free.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}
const state: { error: { table: string; code: string; message: string } | null } = { error: null }
let nextId = 1

function from(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let range: [number, number] | null = null
  let mode: 'select' | 'insert' | 'update' | 'upsert' = 'select'
  let payload: Row | Row[] = {}
  let conflict: string[] = []
  const run = () => {
    if (state.error?.table === table) return { data: null, error: state.error }
    const rows = (tables[table] ??= [])
    if (mode === 'insert') {
      const row = {
        id: `list-${nextId++}`,
        is_active: true,
        created_at: '2026-10-04T00:00:00Z',
        ...(payload as Row),
      }
      rows.push(row)
      return { data: [row], error: null }
    }
    if (mode === 'upsert') {
      for (const next of payload as Row[]) {
        const hit = rows.find((row) => conflict.every((column) => row[column] === next[column]))
        if (hit) Object.assign(hit, next)
        else rows.push({ ...next })
      }
      return { data: null, error: null }
    }
    const hit = rows.filter((row) => filters.every((f) => f(row)))
    if (mode === 'update') for (const row of hit) Object.assign(row, payload)
    return { data: range ? hit.slice(range[0], range[1] + 1) : hit, error: null }
  }
  const builder: Record<string, unknown> = {
    select: () => builder,
    order: () => builder,
    eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), builder),
    not: (column: string) => (filters.push((row) => row[column] != null), builder),
    in: (column: string, values: unknown[]) => (
      filters.push((row) => values.includes(row[column])),
      builder
    ),
    range: (start: number, end: number) => ((range = [start, end]), builder),
    insert: (row: Row) => ((mode = 'insert'), (payload = row), builder),
    update: (row: Row) => ((mode = 'update'), (payload = row), builder),
    upsert: (rows: Row[], options: { onConflict: string }) => (
      (mode = 'upsert'),
      (payload = rows),
      (conflict = options.onConflict.split(',')),
      builder
    ),
    single: async () => {
      const result = run()
      return { data: result.data?.[0] ?? null, error: result.error }
    },
    maybeSingle: async () => {
      const result = run()
      return { data: result.data?.[0] ?? null, error: result.error }
    },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(run()).then(resolve),
  }
  return builder
}

vi.mock('../db', () => ({ supabase: { from: (table: string) => from(table) } }))

import { PriceListService } from '../services/commerce/price-list.service'
import { PromotionService } from '../services/commerce/promotion.service'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const P1 = '11111111-1111-4111-8111-111111111111'
const P2 = '44444444-4444-4444-8444-444444444444'
const P_THEIRS = '22222222-2222-4222-8222-222222222222'
const C1 = '33333333-3333-4333-8333-333333333333'
const C2 = '55555555-5555-4555-8555-555555555555'
const ctx = { workspaceId: WS, userId: 'u1', role: 'manager' } as never
const theirs = { workspaceId: OTHER, userId: 'u2', role: 'manager' } as never

const TODAY = new Date().toISOString().slice(0, 10)
const shifted = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

let service: PriceListService
let promotions: PromotionService

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  state.error = null
  nextId = 1
  tables.products = [
    { id: P1, workspace_id: WS, name: 'برنج', unit: 'kg', sell_price: 200 },
    { id: P2, workspace_id: WS, name: 'روغن', unit: 'liter', sell_price: 90 },
    { id: P_THEIRS, workspace_id: OTHER, name: 'x', unit: 'piece', sell_price: 999 },
  ]
  tables.customers = [
    { id: C1, workspace_id: WS, full_name: 'احمد', price_list_id: null },
    { id: C2, workspace_id: WS, full_name: 'محمود', price_list_id: null },
  ]
  tables.price_lists = []
  tables.price_list_items = []
  tables.promotions = []
  service = new PriceListService()
  promotions = new PromotionService()
})

const wholesale = (overrides: Record<string, unknown> = {}) =>
  service.create(ctx, { name: 'عمده', currency: 'AFN', ...overrides })

describe('lists and prices', () => {
  it('a list is saved for THIS workspace with its currency', async () => {
    const list = await wholesale()
    expect(list).toMatchObject({ name: 'عمده', currency: 'AFN', isActive: true, itemCount: 0 })
    expect(tables.price_lists![0]).toMatchObject({ workspace_id: WS, created_by: 'u1' })
    expect(await service.list(theirs)).toEqual([])
  })

  it('a list without a currency, or with its window backwards, is refused', async () => {
    await expect(service.create(ctx, { name: 'x' })).rejects.toThrow()
    await expect(wholesale({ validFrom: '2026-10-10', validTo: '2026-10-01' })).rejects.toThrow(
      'PRICE_LIST_WINDOW_INVERTED',
    )
    expect(tables.price_lists).toEqual([])
  })

  it('prices are stored as integer hundredths and read back as prices', async () => {
    const list = await wholesale()
    const detail = await service.setItems(ctx, list.id, {
      items: [
        { productId: P1, unitPrice: 180.5 },
        { productId: P2, unitPrice: 85 },
      ],
    })
    expect(tables.price_list_items!.map((row) => row.unit_price_minor)).toEqual([18_050, 8_500])
    expect(detail.items).toEqual([
      { productId: P1, name: 'برنج', unit: 'kg', ownPrice: 200, unitPrice: 180.5 },
      { productId: P2, name: 'روغن', unit: 'liter', ownPrice: 90, unitPrice: 85 },
    ])
    expect((await service.list(ctx))[0]!.itemCount).toBe(2)
  })

  it('a product of another workspace is refused and nothing is stored', async () => {
    const list = await wholesale()
    await expect(
      service.setItems(ctx, list.id, {
        items: [
          { productId: P1, unitPrice: 180 },
          { productId: P_THEIRS, unitPrice: 1 },
        ],
      }),
    ).rejects.toThrow('PRICE_LIST_PRODUCT_NOT_FOUND')
    expect(tables.price_list_items).toEqual([])
  })

  it('a price that rounds to nothing is refused — a free product is not a price', async () => {
    const list = await wholesale()
    await expect(
      service.setItems(ctx, list.id, { items: [{ productId: P1, unitPrice: 0.004 }] }),
    ).rejects.toThrow('PRICE_LIST_PRICE_TOO_SMALL')
    await expect(
      service.setItems(ctx, list.id, { items: [{ productId: P1, unitPrice: 0 }] }),
    ).rejects.toThrow()
  })

  it('taking a product off retires its row with the price it had; setting it again revives it', async () => {
    const list = await wholesale()
    await service.setItems(ctx, list.id, { items: [{ productId: P1, unitPrice: 180 }] })
    const after = await service.setItems(ctx, list.id, {
      items: [{ productId: P1, unitPrice: null }],
    })
    expect(after.items).toEqual([])
    expect(tables.price_list_items).toHaveLength(1)
    expect(tables.price_list_items![0]).toMatchObject({
      is_active: false,
      unit_price_minor: 18_000,
    })

    const again = await service.setItems(ctx, list.id, {
      items: [{ productId: P1, unitPrice: 170 }],
    })
    expect(again.items.map((item) => item.unitPrice)).toEqual([170])
    expect(tables.price_list_items).toHaveLength(1)
  })

  it('another workspace cannot read, price or retire the list', async () => {
    const list = await wholesale()
    await expect(service.detail(theirs, list.id)).rejects.toThrow('not found')
    await expect(
      service.setItems(theirs, list.id, { items: [{ productId: P_THEIRS, unitPrice: 5 }] }),
    ).rejects.toThrow('not found')
    await expect(service.setActive(theirs, list.id, false)).rejects.toThrow('not found')
    expect(tables.price_lists![0]!.is_active).toBe(true)
  })

  it('a missing table is «not set up», never «no lists»', async () => {
    state.error = { table: 'price_lists', code: '42P01', message: 'relation does not exist' }
    await expect(service.list(ctx)).rejects.toThrow('PRICE_LISTS_MIGRATION_PENDING')
  })
})

describe('customers', () => {
  it('a customer is put on a list, counted on it, and taken off', async () => {
    const list = await wholesale()
    await service.assignCustomer(ctx, C1, list.id)
    expect((await service.detail(ctx, list.id)).customers).toEqual([{ id: C1, name: 'احمد' }])
    expect((await service.list(ctx))[0]!.customerCount).toBe(1)
    await service.assignCustomer(ctx, C1, null)
    expect((await service.detail(ctx, list.id)).customers).toEqual([])
  })

  it('a retired list, another workspace’s list and an unknown customer are refused', async () => {
    const list = await wholesale()
    await service.setActive(ctx, list.id, false)
    await expect(service.assignCustomer(ctx, C1, list.id)).rejects.toThrow('PRICE_LIST_RETIRED')

    tables.price_lists!.push({ id: 'theirs', workspace_id: OTHER, name: 'x', is_active: true })
    await expect(service.assignCustomer(ctx, C1, 'theirs')).rejects.toThrow('not found')

    const live = await wholesale({ name: 'همکار' })
    await expect(service.assignCustomer(ctx, P1, live.id)).rejects.toThrow('not found')
    expect(tables.customers!.every((row) => row.price_list_id === null)).toBe(true)
  })
})

describe('the quote reads the list', () => {
  const quote = (overrides: Record<string, unknown> = {}) =>
    promotions.quote(ctx, {
      productId: P1,
      customerId: C1,
      quantity: 1,
      currency: 'AFN',
      ...overrides,
    })

  const onList = async (overrides: Record<string, unknown> = {}) => {
    const list = await wholesale(overrides)
    await service.setItems(ctx, list.id, { items: [{ productId: P1, unitPrice: 180 }] })
    await service.assignCustomer(ctx, C1, list.id)
    return list
  }

  it('the customer on the list pays the list price; everyone else the product’s own', async () => {
    await onList()
    expect((await quote()).unitPriceMinor).toBe(18_000)
    expect((await quote({ customerId: C2 })).unitPriceMinor).toBe(20_000)
    expect((await quote({ customerId: null })).unitPriceMinor).toBe(20_000)
  })

  it('a product that is not on the list keeps its own price — it does not become free', async () => {
    await onList()
    expect((await quote({ productId: P2 })).unitPriceMinor).toBe(9_000)
  })

  it('a list in another currency is left out, not converted', async () => {
    await onList({ currency: 'USD' })
    expect((await quote()).unitPriceMinor).toBe(20_000)
    expect((await quote({ currency: 'USD' })).unitPriceMinor).toBe(18_000)
  })

  it('a list that has not started, has ended, or is retired prices nothing', async () => {
    const future = await onList({ validFrom: shifted(3) })
    expect((await quote()).unitPriceMinor).toBe(20_000)
    tables.price_lists![0]!.valid_from = null
    tables.price_lists![0]!.valid_to = shifted(-3)
    expect((await quote()).unitPriceMinor).toBe(20_000)
    tables.price_lists![0]!.valid_to = TODAY
    expect((await quote()).unitPriceMinor).toBe(18_000)
    tables.price_lists![0]!.is_active = false
    expect((await quote()).unitPriceMinor).toBe(20_000)
    expect(future.id).toBeDefined()
  })

  it('a promotion is taken off the LIST price, not the product’s own', async () => {
    await onList()
    await promotions.create(ctx, { name: 'پاییزه', kind: 'percentage', value: 10 })
    expect((await quote()).unitPriceMinor).toBe(16_200)
    expect((await quote({ customerId: C2 })).unitPriceMinor).toBe(18_000)
  })

  it('before the migration nobody is on a list: the quote is the product’s own price', async () => {
    state.error = { table: 'customers', code: '42703', message: 'column does not exist' }
    expect((await quote()).unitPriceMinor).toBe(20_000)
  })

  it('a list that cannot be read fails the quote — it is not priced as if there were none', async () => {
    await onList()
    state.error = { table: 'price_list_items', code: '57014', message: 'timeout' }
    await expect(quote()).rejects.toThrow('Failed to read the prices')
  })
})
