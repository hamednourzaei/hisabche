// lookupByBarcode with EXTRA codes (27 Sep 2026): the main barcode and
// product_barcodes are read together. An extra code that names a unit answers
// with it; two products behind one code are ambiguous (never «the first»);
// before the migration the extra table reads as empty; any other failure is an
// error — never «not found», which invites creating a product that exists.
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Res = { data: unknown; error: { code?: string; message?: string } | null }
let mainRes: Res
let extraRes: Res

function builder(table: string) {
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'limit']) q[m] = () => q
  q.then = (resolve: (v: Res) => void) => resolve(table === 'products' ? mainRes : extraRes)
  return q
}

vi.mock('../db', () => ({ supabase: { from: (t: string) => builder(t) } }))
vi.mock('../utils/pagination', () => ({
  memoryCache: { get: vi.fn(async () => null), set: vi.fn(), invalidate: vi.fn() },
}))

const { ProductService } = await import('../services/product.service')

const ctx = { workspaceId: 'ws', userId: 'u', role: 'owner' } as never
const row = (id: string, name: string) => ({
  id,
  name,
  barcode: 'x',
  unit: 'piece',
  is_active: true,
})

beforeEach(() => {
  mainRes = { data: [], error: null }
  extraRes = { data: [], error: null }
})

describe('lookupByBarcode — main and extra codes', () => {
  it("the carton's extra code answers with the product AND its unit", async () => {
    extraRes = { data: [{ unit: 'carton', product: row('p1', 'شیر') }], error: null }
    const out = await new ProductService().lookupByBarcode(ctx, '6260000000999')
    expect(out).toMatchObject({ status: 'found', unit: 'carton', product: { id: 'p1' } })
  })

  it('a main-barcode hit carries no unit override', async () => {
    mainRes = { data: [row('p1', 'شیر')], error: null }
    const out = await new ProductService().lookupByBarcode(ctx, '6260000000011')
    expect(out).toEqual(expect.objectContaining({ status: 'found' }))
    expect((out as { unit?: string }).unit).toBeUndefined()
  })

  it('one code behind two DIFFERENT products → ambiguous, never the first', async () => {
    mainRes = { data: [row('p1', 'شیر')], error: null }
    extraRes = { data: [{ unit: null, product: row('p2', 'ماست') }], error: null }
    const out = await new ProductService().lookupByBarcode(ctx, '6260000000011')
    expect(out.status).toBe('ambiguous')
  })

  it('the same product by both routes is ONE hit', async () => {
    mainRes = { data: [row('p1', 'شیر')], error: null }
    extraRes = { data: [{ unit: null, product: row('p1', 'شیر') }], error: null }
    const out = await new ProductService().lookupByBarcode(ctx, '6260000000011')
    expect(out.status).toBe('found')
  })

  it('before the migration (no table): the main barcode still works', async () => {
    mainRes = { data: [row('p1', 'شیر')], error: null }
    extraRes = { data: null, error: { code: 'PGRST205', message: 'no table' } }
    const out = await new ProductService().lookupByBarcode(ctx, '6260000000011')
    expect(out.status).toBe('found')
  })

  it('⚠️ a failed extra read is an ERROR, not «not found»', async () => {
    extraRes = { data: null, error: { code: '57014', message: 'timeout' } }
    await expect(new ProductService().lookupByBarcode(ctx, '6260000000011')).rejects.toThrow(
      'Failed to look up extra barcodes',
    )
  })
})
