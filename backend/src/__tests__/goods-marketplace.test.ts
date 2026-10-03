// The goods marketplace's backend layer (goods-marketplace.pg.test.ts proves
// the tables). What this locks:
//   - nothing about cost can reach the public: the public select names its
//     columns and none of them is a cost, a buy price or an internal id;
//   - «public» is one rule, applied to every public read;
//   - OFF means off: public reads 404, seller writes 409, the sitemap is empty;
//   - a missing switch row is OFF, and a missing table is 503, not 500;
//   - a seller's write carries no `status` / `verified` — by schema and by row;
//   - seller routes need workspace.manage, admin routes the platform guard,
//     public routes nothing, and no key from the API allowlist reaches any.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Call = { table: string; method: string; args: unknown[] }
let calls: Call[] = []
let results: Record<string, { data: unknown; error: unknown; count?: number }> = {}

vi.mock('../db', () => {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {}
    const chain =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push({ table, method, args })
        return b
      }
    for (const m of [
      'select',
      'eq',
      'is',
      'order',
      'range',
      'ilike',
      'or',
      'limit',
      'upsert',
      'insert',
      'update',
      'delete',
    ]) {
      b[m] = chain(m)
    }
    const answer = () => results[table] ?? { data: null, error: null }
    b.maybeSingle = () => Promise.resolve(answer())
    b.single = () => Promise.resolve(answer())
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(answer()).then(resolve)
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})

const { marketService, marketFailure, MarketError, PUBLIC_LISTING_SELECT } =
  await import('../services/market/market.service')

const ctx = { workspaceId: 'ws-1', userId: 'u', role: 'owner' } as never
const on = () => (results.platform_settings = { data: { value: true }, error: null })
const off = () => (results.platform_settings = { data: { value: false }, error: null })

const listingInput = {
  productId: 'p',
  slug: 'tea',
  title: 'Tea',
  description: '',
  priceMinor: 1500,
  currency: 'USD',
  availability: 'in_stock' as const,
  quantity: null,
  isHidden: false,
  status: 'draft' as const,
  seoTitle: '',
  seoDescription: '',
}

beforeEach(() => {
  calls = []
  results = {}
})

describe('no cost reaches the public', () => {
  it('the public select names no cost, buy price, or internal id', () => {
    expect(PUBLIC_LISTING_SELECT).not.toMatch(/buy|cost|wholesale|margin|\*/i)
    expect(PUBLIC_LISTING_SELECT).not.toMatch(/workspace_id|\bid\b/)
    // The product is embedded for two facts only.
    expect(PUBLIC_LISTING_SELECT).toContain('product:products!inner(is_active, image_url)')
  })

  it('a public listing carries the seller price and no product id', async () => {
    on()
    results.marketplace_listings = {
      data: [
        {
          slug: 'tea',
          title: 'Tea',
          description: '',
          price_minor: 1500,
          currency: 'USD',
          availability: 'in_stock',
          quantity: null,
          seo_title: '',
          seo_description: '',
          updated_at: 't',
          product_id: 'p',
          seller: {
            slug: 's',
            name: 'S',
            city: '',
            country: '',
            contact: 'x',
            verified: false,
            status: 'active',
          },
          product: { is_active: true, image_url: 'https://cdn/x.webp' },
        },
      ],
      error: null,
      count: 1,
    }
    const { listings, total } = await marketService.listPublic({ limit: 24, offset: 0 })
    expect(total).toBe(1)
    expect(listings[0]).toMatchObject({
      priceMinor: 1500,
      currency: 'USD',
      imageUrl: 'https://cdn/x.webp',
    })
    expect(Object.keys(listings[0]!)).not.toContain('productId')
    // In a list, the seller's contact is not repeated on every card.
    expect(Object.keys(listings[0]!.seller)).toEqual([
      'slug',
      'name',
      'city',
      'country',
      'verified',
    ])
  })

  it('«public» is the same five conditions on every public read', async () => {
    on()
    results.marketplace_listings = { data: [], error: null, count: 0 }
    await marketService.listPublic({ limit: 24, offset: 0 })
    const filters = calls
      .filter((c) => c.table === 'marketplace_listings' && ['eq', 'is'].includes(c.method))
      .map((c) => `${c.method}:${String(c.args[0])}=${String(c.args[1])}`)
    expect(filters).toEqual(
      expect.arrayContaining([
        'eq:status=active',
        'eq:is_hidden=false',
        'is:suspended_at=null',
        'eq:seller.status=active',
        'eq:product.is_active=true',
      ]),
    )
  })
})

describe('off means off', () => {
  it('public reads answer 404 MARKET_DISABLED and read no listing', async () => {
    off()
    await expect(marketService.listPublic({ limit: 24, offset: 0 })).rejects.toMatchObject({
      message: 'MARKET_DISABLED',
      statusCode: 404,
    })
    await expect(marketService.sellerPublic('s')).rejects.toMatchObject({ statusCode: 404 })
    await expect(marketService.listingPublic('s', 'tea')).rejects.toMatchObject({ statusCode: 404 })
    expect(calls.some((c) => c.table === 'marketplace_listings')).toBe(false)
  })

  it('a missing switch row is OFF — the default is not «on unless said»', async () => {
    results.platform_settings = { data: null, error: null }
    expect(await marketService.isEnabled()).toBe(false)
  })

  it('the sitemap is empty, not an error', async () => {
    off()
    expect(await marketService.sitemap()).toEqual({ enabled: false, sellers: [], listings: [] })
  })

  it('a seller cannot write while off', async () => {
    off()
    await expect(marketService.createListing(ctx, listingInput)).rejects.toMatchObject({
      message: 'MARKET_DISABLED',
      statusCode: 409,
    })
    expect(calls.some((c) => c.method === 'insert')).toBe(false)
  })

  it('the migration not run → 503 MARKET_NOT_CONFIGURED', async () => {
    results.platform_settings = { data: null, error: { code: '42P01', message: 'no table' } }
    await expect(marketService.isEnabled()).rejects.toMatchObject({
      message: 'MARKET_NOT_CONFIGURED',
      statusCode: 503,
    })
  })
})

describe('the seller writes only what is theirs', () => {
  it('saveProfile sends no status, verified or suspension', async () => {
    on()
    results.seller_profiles = {
      data: { workspace_id: 'ws-1', slug: 's', name: 'S', status: 'active', verified: false },
      error: null,
    }
    await marketService.saveProfile(ctx, {
      slug: 's',
      name: 'S',
      description: '',
      city: '',
      country: '',
      contact: '',
    })
    const row = calls.find((c) => c.method === 'upsert')!.args[0] as Record<string, unknown>
    expect(row.workspace_id).toBe('ws-1')
    for (const key of ['status', 'verified', 'verified_at', 'verified_by', 'suspended_reason']) {
      expect(row).not.toHaveProperty(key)
    }
  })

  it("a listing is written into the caller's workspace, and updates are scoped to it", async () => {
    on()
    results.marketplace_listings = { data: { id: 'l', product_id: 'p', slug: 'tea' }, error: null }
    await marketService.createListing(ctx, listingInput)
    const inserted = calls.find((c) => c.method === 'insert')!.args[0] as Record<string, unknown>
    expect(inserted.workspace_id).toBe('ws-1')
    expect(inserted).not.toHaveProperty('suspended_at')

    calls = []
    await marketService.updateListing(ctx, 'l', listingInput)
    expect(calls).toContainEqual({
      table: 'marketplace_listings',
      method: 'eq',
      args: ['workspace_id', 'ws-1'],
    })
  })
})

describe('database refusals → HTTP', () => {
  it.each([
    [{ code: 'P0001', message: 'MARKET_PRODUCT_NOT_FOUND' }, 'MARKET_PRODUCT_NOT_FOUND', 404],
    [
      { code: '23505', message: 'x "marketplace_listings_slug_key"' },
      'MARKET_LISTING_SLUG_TAKEN',
      409,
    ],
    [
      { code: '23505', message: 'x "marketplace_listings_product_key"' },
      'MARKET_PRODUCT_ALREADY_LISTED',
      409,
    ],
    [{ code: '23505', message: 'x "seller_profiles_slug_key"' }, 'MARKET_SLUG_TAKEN', 409],
    [{ code: '23503', message: 'fk' }, 'MARKET_SELLER_REQUIRED', 409],
  ])('%j → %s', (error, code, status) => {
    const err = marketFailure(error, 'x')
    expect(err).toBeInstanceOf(MarketError)
    expect(err.message).toBe(code)
    expect((err as InstanceType<typeof MarketError>).statusCode).toBe(status)
  })

  it('anything else is a 500', () => {
    expect(marketFailure({ code: '57014', message: 'timeout' }, 'x')).not.toBeInstanceOf(
      MarketError,
    )
  })
})

describe('routes: who may do what', () => {
  const read = (file: string) => readFileSync(join(__dirname, '..', 'routes', file), 'utf8')
  const src = read('market.routes.ts')
  const routes = [
    ...src.matchAll(/fastify\.(get|post|put|delete)\(\s*'([^']+)',\s*\{\s*preHandler:\s*(\w+)/g),
  ]

  it('/api/market/* → workspace.manage; /api/admin/market/* → platform admin', () => {
    expect(routes.length).toBe(12)
    for (const [, , path, guard] of routes) {
      expect(guard, path).toBe(path!.startsWith('/api/admin/') ? 'admin' : 'manage')
    }
    expect(src).toContain(
      "const manage = [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')]",
    )
    expect(src).toContain('const admin = [authenticate, platformAdminGuard]')
  })

  it("the seller's bodies cannot carry the platform's fields", () => {
    const seller = src.slice(src.indexOf('const profileBody'), src.indexOf('const enabledBody'))
    expect(seller).not.toMatch(/verified|suspend|status: z\.enum\(\['active', 'suspended'\]\)/)
    // The price is an integer in minor units, in a currency from the one list.
    expect(seller).toContain('priceMinor: z.number().int().positive()')
    expect(seller).toContain('currency: currencyCodeSchema')
  })

  it('both route files are registered, and no API key reaches the marketplace', () => {
    const index = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8')
    expect(index).toContain('await server.register(marketRoutes)')
    expect(index).toContain('await server.register(marketPublicRoutes)')
    const allowlist = readFileSync(
      join(__dirname, '..', 'services', 'developer', 'developer.domain.ts'),
      'utf8',
    )
    expect(allowlist).not.toMatch(/\/api\/(admin\/|public\/)?market\//)
  })
})
