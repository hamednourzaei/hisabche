// ============================================
// promotion.service — scope ownership, retiring, and the quote.
//
// The engine has its own tests (pricing-engine.test.ts). What can go wrong HERE:
// a promotion naming another workspace's product, a retired promotion still
// pricing a line, a dollar amount taken off an afghani price, a missing table
// answered as «no promotions».
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {}
const state: { promotionsError: { code: string; message: string } | null } = {
  promotionsError: null,
}
let nextId = 1

function from(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let range: [number, number] | null = null
  let mode: 'select' | 'insert' | 'update' = 'select'
  let payload: Row = {}
  const run = () => {
    if (table === 'promotions' && state.promotionsError)
      return { data: null, error: state.promotionsError }
    if (mode === 'insert') {
      const row = {
        id: `promo-${nextId++}`,
        is_active: true,
        created_at: '2026-10-04T00:00:00Z',
        ...payload,
      }
      ;(tables[table] ??= []).push(row)
      return { data: [row], error: null }
    }
    const hit = (tables[table] ?? []).filter((row) => filters.every((f) => f(row)))
    if (mode === 'update') for (const row of hit) Object.assign(row, payload)
    return { data: range ? hit.slice(range[0], range[1] + 1) : hit, error: null }
  }
  const builder: Record<string, unknown> = {
    select: () => builder,
    order: () => builder,
    eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), builder),
    in: (column: string, values: unknown[]) => (
      filters.push((row) => values.includes(row[column])),
      builder
    ),
    range: (start: number, end: number) => ((range = [start, end]), builder),
    insert: (row: Row) => ((mode = 'insert'), (payload = row), builder),
    update: (row: Row) => ((mode = 'update'), (payload = row), builder),
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

import { PromotionService } from '../services/commerce/promotion.service'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const P1 = '11111111-1111-4111-8111-111111111111'
const P_THEIRS = '22222222-2222-4222-8222-222222222222'
const C1 = '33333333-3333-4333-8333-333333333333'
const ctx = { workspaceId: WS, userId: 'u1', role: 'manager' } as never

const percent = (overrides: Record<string, unknown> = {}) => ({
  name: 'تخفیف پاییزه',
  kind: 'percentage',
  value: 10,
  ...overrides,
})

let service: PromotionService
beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  state.promotionsError = null
  nextId = 1
  tables.products = [
    { id: P1, workspace_id: WS, sell_price: 200 },
    { id: P_THEIRS, workspace_id: OTHER, sell_price: 999 },
  ]
  tables.customers = [{ id: C1, workspace_id: WS }]
  tables.promotions = []
  service = new PromotionService()
})

describe('saving', () => {
  it('stores a promotion for THIS workspace, by the person who saved it', async () => {
    const saved = await service.create(ctx, percent({ productIds: [P1] }))
    expect(saved).toMatchObject({ kind: 'percentage', value: 10, productIds: [P1], isActive: true })
    expect(tables.promotions![0]).toMatchObject({
      workspace_id: WS,
      created_by: 'u1',
      currency: null,
    })
  })

  it('a product of another workspace in the scope is refused, and nothing is stored', async () => {
    await expect(service.create(ctx, percent({ productIds: [P1, P_THEIRS] }))).rejects.toThrow(
      'PROMOTION_PRODUCT_NOT_FOUND',
    )
    expect(tables.promotions).toEqual([])
  })

  it('a fixed amount needs its currency; a percentage over 100 and a bundle are refused', async () => {
    await expect(
      service.create(ctx, { name: 'x', kind: 'fixed_amount', value: 50 }),
    ).rejects.toThrow()
    await expect(service.create(ctx, percent({ value: 150 }))).rejects.toThrow()
    await expect(service.create(ctx, percent({ kind: 'bundle' }))).rejects.toThrow()
    expect(tables.promotions).toEqual([])
  })

  it('a percentage never keeps a currency, whatever was sent', async () => {
    await service.create(ctx, percent({ currency: 'USD' }))
    expect(tables.promotions![0]!.currency).toBeNull()
  })

  it('retiring is a flag on the row — the row stays', async () => {
    const saved = await service.create(ctx, percent())
    const retired = await service.setActive(ctx, saved.id, false)
    expect(retired.isActive).toBe(false)
    expect(tables.promotions).toHaveLength(1)
  })

  it('another workspace’s promotion cannot be retired', async () => {
    tables.promotions!.push({
      id: 'theirs',
      workspace_id: OTHER,
      name: 'x',
      kind: 'percentage',
      value: 5,
      is_active: true,
    })
    await expect(service.setActive(ctx, 'theirs', false)).rejects.toThrow('not found')
    expect(tables.promotions![0]!.is_active).toBe(true)
  })

  it('a missing table is «not set up», not «no promotions»', async () => {
    state.promotionsError = { code: 'PGRST205', message: 'not in schema cache' }
    await expect(service.list(ctx)).rejects.toThrow('PROMOTIONS_MIGRATION_PENDING')
  })
})

describe('quoting one line', () => {
  const quote = (overrides: Record<string, unknown> = {}) =>
    service.quote(ctx, {
      productId: P1,
      customerId: null,
      quantity: 1,
      currency: 'AFN',
      ...overrides,
    } as never)

  it('takes the live promotion off the product’s own sell price', async () => {
    await service.create(ctx, percent())
    const result = await quote()
    expect(result).toMatchObject({
      baseUnitPriceMinor: 20_000,
      unitPriceMinor: 18_000,
      currency: 'AFN',
    })
    expect(result.applied).toHaveLength(1)
  })

  it('a retired promotion prices nothing', async () => {
    const saved = await service.create(ctx, percent())
    await service.setActive(ctx, saved.id, false)
    expect((await quote()).unitPriceMinor).toBe(20_000)
  })

  it('a fixed amount in dollars is NOT taken off an afghani price', async () => {
    await service.create(ctx, { name: 'x', kind: 'fixed_amount', value: 50, currency: 'USD' })
    expect((await quote()).unitPriceMinor).toBe(20_000)
    expect((await quote({ currency: 'USD' })).unitPriceMinor).toBe(15_000)
  })

  it('a promotion for named customers does not reach a walk-in sale', async () => {
    await service.create(ctx, percent({ customerIds: [C1] }))
    expect((await quote()).unitPriceMinor).toBe(20_000)
    expect((await quote({ customerId: C1 })).unitPriceMinor).toBe(18_000)
  })

  it('an expired or not-yet-started promotion is not applied', async () => {
    await service.create(ctx, percent({ validFrom: '2020-01-01', validTo: '2020-12-31' }))
    await service.create(ctx, percent({ validFrom: '2999-01-01' }))
    expect((await quote()).unitPriceMinor).toBe(20_000)
  })

  it('a product of another workspace is «not found»', async () => {
    await expect(quote({ productId: P_THEIRS })).rejects.toThrow('not found')
  })
})
