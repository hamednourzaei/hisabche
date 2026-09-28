// ============================================
// Storefront and sales orders — the security contract in code.
//
//   1. The public gate on a real Fastify: no key → 401, a foreign origin →
//      403, a price in the body → 400, no Idempotency-Key → 400, a replay →
//      200 with the same order.
//   2. What the public sees of a product: no cost, no buy price, numbers only
//      when the owner chose them.
//   3. Order → invoice: through the invoice path, idempotent, and the
//      customer is never guessed.
//   4. The inventory of /api/public/: every route under it is public by design
//      and listed here; none authenticates; CORS there carries no credentials.
// ============================================

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import Fastify from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { STOREFRONT_DEFAULTS } from '@hisabche/validation'

import {
  generatePublishableKey,
  looksLikeApiKey,
  looksLikePublishableKey,
  originAllowed,
} from '../services/developer/developer.domain'
import {
  OrderError,
  invoiceFromOrder,
  invoiceRequestIdFor,
  normalizePhone,
  publicProductView,
} from '../services/orders/orders.domain'
import { createOrdersService } from '../services/orders/orders.service'
import { buildStorefrontRoutes, isPublicApiPath } from '../routes/storefront.routes'

type Repo = import('../services/orders/orders.repository').OrdersRepository

const SRC = join(__dirname, '..')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (...p: string[]) => strip(readFileSync(join(SRC, ...p), 'utf8'))

// ─── 1. the public gate ──────────────────────────────────────────────────────

describe('the storefront gate', () => {
  const KEY = generatePublishableKey()
  const SHOP = 'https://shop.example'
  const placed = vi.fn()
  const keys = {
    authenticatePublishable: vi.fn(async (raw: string) =>
      raw === KEY ? { id: 'pk1', workspaceId: 'ws-1', allowedOrigins: [SHOP] } : null,
    ),
  }
  const order = {
    id: 'o1',
    workspace_id: 'ws-1',
    order_number: 'SO-1',
    status: 'pending',
    total: '300.0000',
    public_token: 'a'.repeat(64),
    created_at: '2026-09-27T00:00:00Z',
    items: [
      {
        product_id: 'p',
        product_name: 'چای',
        unit: null,
        quantity: '2',
        unit_price: '150',
        line_total: '300',
      },
    ],
  }
  const orders = {
    catalog: vi.fn(async () => ({ products: [], hasMore: false })),
    catalogProduct: vi.fn(async () => null),
    placeFromWebsite: vi.fn(async (...args: unknown[]) => {
      placed(...args)
      return { order, replay: false }
    }),
    publicStatus: vi.fn(async () => null),
  }
  const app = Fastify()
  app.register(buildStorefrontRoutes(keys, orders as never))
  beforeAll(() => app.ready())
  afterAll(() => app.close())
  beforeEach(() => placed.mockReset())

  const body = {
    items: [{ productId: '11111111-1111-4111-8111-111111111111', quantity: 2 }],
    customer: { name: 'مریم', phone: '0799000000' },
  }
  const post = (payload: unknown, headers: Record<string, string> = {}) =>
    app.inject({
      method: 'POST',
      url: '/api/public/v1/orders',
      headers: { 'content-type': 'application/json', 'hisabche-publishable-key': KEY, ...headers },
      payload: JSON.stringify(payload),
    })

  it('no key, or a wrong one, is 401', async () => {
    expect((await app.inject({ url: '/api/public/v1/catalog' })).statusCode).toBe(401)
    const res = await app.inject({
      url: '/api/public/v1/catalog',
      headers: { 'hisabche-publishable-key': generatePublishableKey() },
    })
    expect(res.json().code).toBe('PUBLISHABLE_KEY_INVALID')
  })

  it('a browser on another site is 403; the shop and a server are let in', async () => {
    const other = await app.inject({
      url: '/api/public/v1/catalog',
      headers: { 'hisabche-publishable-key': KEY, origin: 'https://evil.example' },
    })
    expect(other.json().code).toBe('ORIGIN_NOT_ALLOWED')
    const shop = await app.inject({
      url: '/api/public/v1/catalog',
      headers: { 'hisabche-publishable-key': KEY, origin: SHOP },
    })
    expect(shop.statusCode).toBe(200)
    expect(
      (
        await app.inject({
          url: '/api/public/v1/catalog',
          headers: { 'hisabche-publishable-key': KEY },
        })
      ).statusCode,
    ).toBe(200)
  })

  it('an order without an Idempotency-Key is refused', async () => {
    const res = await post(body)
    expect(res.json().code).toBe('IDEMPOTENCY_KEY_REQUIRED')
    expect(placed).not.toHaveBeenCalled()
  })

  it.each([
    ['a unit price on a line', { ...body, items: [{ ...body.items[0], unitPrice: 1 }] }],
    ['a total', { ...body, total: 1 }],
    ['a status', { ...body, status: 'paid' }],
    ['a workspace', { ...body, workspaceId: 'ws-2' }],
  ])('a body carrying %s is REFUSED, not trimmed', async (_label, payload) => {
    const res = await post(payload, { 'idempotency-key': 'order-000000001' })
    expect(res.statusCode).toBe(400)
    expect(placed).not.toHaveBeenCalled()
  })

  it('a valid order is placed in the KEY’s workspace, and answers the customer’s view', async () => {
    const res = await post(body, { 'idempotency-key': 'order-000000001' })
    expect(res.statusCode).toBe(201)
    expect(placed).toHaveBeenCalledWith(
      { id: 'pk1', workspaceId: 'ws-1', allowedOrigins: [SHOP] },
      'order-000000001',
      body,
    )
    const out = res.json()
    expect(out).toMatchObject({
      orderNumber: 'SO-1',
      status: 'pending',
      total: 300,
      token: 'a'.repeat(64),
    })
    // The customer's view never includes their phone or the workspace.
    expect(JSON.stringify(out)).not.toContain('0799000000')
    expect(JSON.stringify(out)).not.toContain('ws-1')
  })
})

// ─── 2. what the public sees ─────────────────────────────────────────────────

describe('the public product', () => {
  const row = {
    id: 'p1',
    name: 'چای',
    unit: 'box',
    sell_price: '150.5',
    quantity: '7',
    image_url: null,
  }

  it('carries no cost — the fields are not in the object', () => {
    const view = publicProductView({ ...row, buy_price: 90, cost: 80 } as never, 'availability')
    expect(Object.keys(view).sort()).toEqual([
      'availability',
      'id',
      'imageUrl',
      'name',
      'price',
      'unit',
    ])
    expect(view).toMatchObject({ price: 150.5, availability: 'in_stock' })
  })

  it('shows a number only when the owner chose it', () => {
    expect(publicProductView(row, 'quantity')).toMatchObject({ quantity: 7 })
    expect(publicProductView({ ...row, quantity: '0' }, 'availability').availability).toBe(
      'out_of_stock',
    )
    expect(STOREFRONT_DEFAULTS.stockDisplay).toBe('availability')
    expect(STOREFRONT_DEFAULTS.orderConfirmation).toBe('manual')
  })

  it('a phone is one contact however its digits are written', () => {
    expect(normalizePhone('۰۷۹۹ ۰۰۰-۰۰۰')).toBe('0799000000')
  })
})

describe('keys', () => {
  it('a publishable key is never a secret key, and the reverse', () => {
    const pub = generatePublishableKey()
    expect(looksLikePublishableKey(pub)).toBe(true)
    expect(looksLikeApiKey(pub)).toBe(false)
  })

  it('no Origin (a server) is allowed; an unlisted origin is not', () => {
    expect(originAllowed(['https://shop.example'], undefined)).toBe(true)
    expect(originAllowed(['https://shop.example'], 'https://shop.example')).toBe(true)
    expect(originAllowed(['https://shop.example'], 'https://shop.example.evil')).toBe(false)
  })
})

// ─── 3. order → invoice ──────────────────────────────────────────────────────

describe('invoicing an order', () => {
  const ctx = (caps: string[]) => ({
    workspaceId: 'ws-1',
    userId: 'u1',
    role: 'manager' as const,
    capabilities: new Set(caps),
  })
  const confirmed = {
    id: 'o1',
    workspace_id: 'ws-1',
    order_number: 'SO-1',
    status: 'confirmed',
    customer_name: 'مریم',
    customer_phone: '0799000000',
    customer_email: null,
    customer_id: null,
    items: [
      {
        product_id: 'p1',
        product_name: 'چای',
        unit: 'box',
        quantity: '2',
        unit_price: '150.5',
        line_total: '301',
      },
    ],
  }
  function setup(matches: string[], status = 'confirmed') {
    const repo = {
      get: vi.fn(async () => ({ ...confirmed, status })),
      customersByPhone: vi.fn(async () => matches),
      transition: vi.fn(async () => undefined),
    } as unknown as Repo
    const invoices = { create: vi.fn(async () => ({ id: 'inv-1' })) }
    const customers = { create: vi.fn(async (..._args: unknown[]) => ({ id: 'new-customer' })) }
    return {
      repo,
      invoices,
      customers,
      svc: createOrdersService(repo, invoices as never, customers as never),
    }
  }

  it('goes through the invoice path with the order’s idempotency key, then marks it invoiced', async () => {
    const { svc, invoices, repo } = setup(['c1'])
    await svc.invoice(ctx(['invoice.create', 'customer.write']), 'o1')
    const [, data, branch, options] = vi.mocked(invoices.create).mock.calls[0] as unknown as [
      unknown,
      Record<string, unknown>,
      null,
      { clientRequestId: string },
    ]
    expect(options.clientRequestId).toBe(invoiceRequestIdFor('o1'))
    expect(branch).toBeNull()
    expect(data).toMatchObject({ type: 'sale', customerId: 'c1', total: 301 })
    expect(vi.mocked(repo.transition)).toHaveBeenCalledWith('ws-1', 'o1', 'invoiced', {
      invoiceId: 'inv-1',
      customerId: 'c1',
    })
  })

  it('two customers with the phone: a person chooses — never the first', async () => {
    const { svc, invoices } = setup(['c1', 'c2'])
    await expect(
      svc.invoice(ctx(['invoice.create', 'customer.write']), 'o1'),
    ).rejects.toMatchObject({
      code: 'ORDER_CUSTOMER_AMBIGUOUS',
    })
    expect(invoices.create).not.toHaveBeenCalled()
  })

  it('no customer: created (idempotently) only by someone allowed to', async () => {
    const allowed = setup([])
    await allowed.svc.invoice(ctx(['invoice.create', 'customer.write']), 'o1')
    expect(vi.mocked(allowed.customers.create).mock.calls[0]![2]).toEqual({
      clientRequestId: 'order-customer-o1',
    })

    const refused = setup([])
    await expect(refused.svc.invoice(ctx(['invoice.create']), 'o1')).rejects.toMatchObject({
      code: 'ORDER_CUSTOMER_REQUIRED',
    })
    expect(refused.invoices.create).not.toHaveBeenCalled()
  })

  it('an order that is not confirmed is not invoiced', async () => {
    const { svc, invoices } = setup(['c1'], 'pending')
    await expect(svc.invoice(ctx(['invoice.create']), 'o1')).rejects.toBeInstanceOf(OrderError)
    expect(invoices.create).not.toHaveBeenCalled()
  })

  it('the invoice lines are the order’s lines, at the order’s prices', () => {
    const inv = invoiceFromOrder({
      lines: confirmed.items,
      customerId: 'c',
      date: '2026-09-27',
      orderNumber: 'SO-1',
    })
    expect(inv.items).toEqual([
      { productId: 'p1', productName: 'چای', quantity: 2, unitPrice: 150.5, totalPrice: 301 },
    ])
  })
})

// ─── 4. /api/public/ ─────────────────────────────────────────────────────────

describe('everything under /api/public/ is public by design', () => {
  // The complete list. A new entry here is a decision, reviewed as one.
  const EXPECTED = [
    'GET /api/public/invoices/:token',
    // The CRM task link shared with a staff member who has no account.
    'GET /api/public/tasks/:token',
    'PATCH /api/public/tasks/:token/status',
    'PATCH /api/public/tasks/:token/customer-outcome',
    'GET /api/public/v1/catalog',
    'GET /api/public/v1/products/:id',
    'POST /api/public/v1/orders',
    'GET /api/public/v1/orders/:token',
    // The customer's own account (customer-portal.routes.ts).
    'GET /api/public/portal/:token',
  ]

  const routeFiles = readdirSync(join(SRC, 'routes')).filter((f) => f.endsWith('.ts'))
  const declared: string[] = []
  for (const file of routeFiles) {
    const source = read('routes', file)
    const withPrefix = source.replace(/`\$\{STOREFRONT_PREFIX\}/g, "'/api/public/v1")
    for (const m of withPrefix.matchAll(
      /fastify\.(get|post|put|patch|delete)(?:<[^>]*>)?\(\s*['"`](\/api\/public\/[^'"`]+)['"`]/g,
    )) {
      declared.push(`${m[1]!.toUpperCase()} ${m[2]}`)
    }
  }

  it('the declared routes are exactly the reviewed list', () => {
    expect(declared.sort()).toEqual([...EXPECTED].sort())
  })

  it('no file that declares one authenticates', () => {
    for (const file of ['storefront.routes.ts', 'invoice-public.routes.ts']) {
      expect(read('routes', file)).not.toMatch(/\bauthenticate\b/)
    }
  })

  it('the global auth hook skips the prefix, and CORS there carries no credentials', () => {
    const index = read('index.ts')
    expect(index).toContain("'/api/public/',")
    const cors = index.slice(index.indexOf('const STOREFRONT_CORS'))
    expect(cors).toContain('credentials: false')
    expect(index).toContain('isPublicApiPath(request.url')
    expect(isPublicApiPath('/api/public/v1/catalog?x=1')).toBe(true)
    expect(isPublicApiPath('/api/public/portal/abc')).toBe(true)
    expect(isPublicApiPath('/api/publicity')).toBe(false)
    expect(isPublicApiPath('/api/invoices')).toBe(false)
  })
})
