// Barcode scanner support (27 Sep 2026): normalisation shared with the client,
// an exact lookup with three distinct answers, and a duplicate named as a
// field error. Real HTTP for the route (Fastify inject).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Fastify from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeBarcode } from '@hisabche/validation'

const WS = '22222222-2222-4222-8222-222222222222'

vi.mock('../middleware/auth.middleware', () => ({ authenticate: async () => undefined }))
vi.mock('../middleware/workspace.middleware', () => ({
  requireWorkspaceContext: async (request: { tenancy: unknown }) => {
    request.tenancy = { workspaceId: WS, userId: 'u', role: 'owner' }
  },
}))
vi.mock('../middleware/cache.middleware', () => ({
  cacheMiddleware: () => async () => undefined,
  clearCache: async () => undefined,
}))

/** products table rows the fake query answers from. */
const state = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  fail: false,
  filters: [] as Array<[string, unknown]>,
}))

vi.mock('../db', () => {
  const chain = () => {
    const eqs: Array<[string, unknown]> = []
    const api = {
      select: () => api,
      eq: (k: string, v: unknown) => {
        eqs.push([k, v])
        state.filters.push([k, v])
        return api
      },
      limit: async () =>
        state.fail
          ? { data: null, error: { message: 'timeout' } }
          : { data: state.rows.filter((r) => eqs.every(([k, v]) => r[k] === v)), error: null },
    }
    return api
  }
  return { supabase: { from: () => chain() } }
})
vi.mock('../utils/pagination', () => ({
  memoryCache: { get: vi.fn(), set: vi.fn(), invalidate: vi.fn() },
}))

const { productRoutes } = await import('../routes/product.routes')

const app = Fastify()
beforeAll(async () => {
  await app.register(productRoutes)
  await app.ready()
})
afterAll(() => app.close())

const row = (id: string, name: string, barcode: string) => ({
  id,
  name,
  barcode,
  workspace_id: WS,
  is_active: true,
  sell_price: 60000,
  buy_price: 45000,
  quantity: 10,
  unit: 'piece',
})

beforeEach(() => {
  state.rows = []
  state.fail = false
  state.filters = []
})

describe('normalizeBarcode (shared with the scanner)', () => {
  it.each([
    ['0123456789012', '0123456789012'], // leading zero kept: always a string
    ['  6261234567890\r\n', '6261234567890'], // scanner suffix / stray spaces
    ['۶۲۶۱۲۳۴۵۶۷۸۹۰', '6261234567890'], // Persian layout digits
    ['٦٢٦١٢٣', '626123'], // Arabic-Indic digits
    ['ABC-12.5_x', 'ABC-12.5_x'],
  ])('%j → %j', (input, expected) => {
    expect(normalizeBarcode(input)).toBe(expected)
  })
})

describe('GET /api/products/by-barcode/:code', () => {
  it('found → 200 with the product, looked up in THIS workspace, active only', async () => {
    state.rows = [row('p1', 'چای', '6261234567890')]
    const res = await app.inject({ method: 'GET', url: '/api/products/by-barcode/6261234567890' })
    expect(res.statusCode).toBe(200)
    expect(res.json().product).toMatchObject({ id: 'p1', name: 'چای' })
    expect(state.filters).toEqual(
      expect.arrayContaining([
        ['workspace_id', WS],
        ['barcode', '6261234567890'],
        ['is_active', true],
      ]),
    )
  })

  it('a Persian-digit scan finds the ASCII barcode', async () => {
    state.rows = [row('p1', 'چای', '6261234567890')]
    const res = await app.inject({
      method: 'GET',
      url: `/api/products/by-barcode/${encodeURIComponent('۶۲۶۱۲۳۴۵۶۷۸۹۰')}`,
    })
    expect(res.statusCode).toBe(200)
  })

  it('⚠️ two products share it → 409 with both, never silently the first', async () => {
    state.rows = [row('p1', 'الف', '111'), row('p2', 'ب', '111')]
    const res = await app.inject({ method: 'GET', url: '/api/products/by-barcode/111' })
    expect(res.statusCode).toBe(409)
    expect(res.json().products.map((p: { id: string }) => p.id)).toEqual(['p1', 'p2'])
  })

  it('unknown → 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/products/by-barcode/999' })
    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe('BARCODE_NOT_FOUND')
  })

  it('⚠️ a failed query is a 500, never «unknown» (which invites a duplicate product)', async () => {
    state.fail = true
    const res = await app.inject({ method: 'GET', url: '/api/products/by-barcode/111' })
    expect(res.statusCode).toBe(500)
  })
})

describe('a duplicate barcode is refused by name, on the field', () => {
  it('create and update map the unique violation to 409 BARCODE_TAKEN with details.path', () => {
    const routes = readFileSync(join(__dirname, '..', 'routes', 'product.routes.ts'), 'utf8')
    expect(routes.split("err.message === 'BARCODE_TAKEN'").length - 1).toBe(2)
    expect(routes).toContain("details: [{ path: ['barcode'], message: 'BARCODE_TAKEN' }]")
    const service = readFileSync(join(__dirname, '..', 'services', 'product.service.ts'), 'utf8')
    expect(service).toContain("includes('products_workspace_barcode_key')")
    const migration = readFileSync(
      join(__dirname, '..', '..', '..', 'docs', 'product-barcode-unique-migration.sql'),
      'utf8',
    )
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS products_workspace_barcode_key')
  })
})
