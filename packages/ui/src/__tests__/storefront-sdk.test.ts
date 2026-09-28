// ============================================
// apps/web/public/sdk/v1.js — the script a shop pastes into its website.
//
// Run as the browser runs it (evaluated against jsdom's window) with a fake
// fetch, so what is proved is what a shop gets:
//   · only the publishable key header, never credentials;
//   · an order body with ids, quantities and contact — no amount, ever;
//   · one Idempotency-Key per attempt, reused on the one network retry;
//   · catalogue text written as text, never as HTML.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const SOURCE = readFileSync(join(__dirname, '../../../../apps/web/public/sdk/v1.js'), 'utf8')
const KEY = `hk_pub_${'a'.repeat(43)}`

type Shop = {
  catalog: (q?: object) => Promise<unknown>
  product: (id: string) => Promise<unknown>
  createOrder: (order: object, opts?: object) => Promise<{ orderNumber: string }>
  orderStatus: (token: string) => Promise<unknown>
  mount: (container?: Element) => Promise<unknown>
}
type Sdk = {
  init: (o: object) => Shop
  renderPortal: (el: Element, token: string, opts?: object) => Promise<unknown>
  renderInvoice: (el: Element, token: string, opts?: object) => Promise<unknown>
}

function load(): Sdk {
  new Function(SOURCE).call(window)
  return (window as unknown as { Hisabche: Sdk }).Hisabche
}

function reply(status: number, body: unknown) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) })
}

describe('the storefront SDK', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let shop: Shop

  beforeEach(() => {
    fetchMock = vi.fn(() => reply(200, {}))
    shop = load().init({ key: KEY, apiBase: 'https://api.example/api/', fetch: fetchMock })
    document.body.innerHTML = ''
  })

  it('refuses anything but a publishable key — a secret key must never be pasted into a site', () => {
    expect(() => load().init({ key: `hk_live_${'a'.repeat(43)}` })).toThrow(
      'PUBLISHABLE_KEY_INVALID',
    )
  })

  it('sends the key header, never credentials', async () => {
    await shop.catalog({ search: 'چای', limit: 5 })
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ]
    expect(url).toBe(
      `https://api.example/api/public/v1/catalog?search=${encodeURIComponent('چای')}&limit=5`,
    )
    expect(init.headers['Hisabche-Publishable-Key']).toBe(KEY)
    expect(init.headers.Authorization).toBeUndefined()
    expect(init.credentials).toBe('omit')
  })

  it('an order carries ids, quantities and contact — whatever the page adds', async () => {
    fetchMock.mockImplementation(() => reply(201, { orderNumber: 'SO-1' }))
    await shop.createOrder({
      items: [{ productId: 'p1', quantity: 2, price: 1, total: 1 }],
      customer: { name: 'مریم', phone: '0799', address: 'x' },
      total: 1,
    })
    const [, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ]
    expect(JSON.parse(String(init.body))).toEqual({
      items: [{ productId: 'p1', quantity: 2 }],
      customer: { name: 'مریم', phone: '0799' },
    })
    expect(init.headers['Idempotency-Key']).toMatch(/^sdk-/)
  })

  it('a network failure is retried once, with the SAME key — never a second order', async () => {
    fetchMock
      .mockImplementationOnce(() => Promise.reject(new TypeError('network')))
      .mockImplementationOnce(() => reply(201, { orderNumber: 'SO-1' }))
    await shop.createOrder({
      items: [{ productId: 'p1', quantity: 1 }],
      customer: { name: 'a', phone: '07990' },
    })
    const keys = fetchMock.mock.calls.map(
      (c) => (c[1] as { headers: Record<string, string> }).headers['Idempotency-Key'],
    )
    expect(keys.length).toBe(2)
    expect(keys[0]).toBe(keys[1])
  })

  it('a refusal is not retried, and says the server’s code', async () => {
    fetchMock.mockImplementation(() => reply(409, { code: 'ORDER_INSUFFICIENT_STOCK' }))
    await expect(
      shop.createOrder({
        items: [{ productId: 'p1', quantity: 9 }],
        customer: { name: 'a', phone: '07990' },
      }),
    ).rejects.toMatchObject({ code: 'ORDER_INSUFFICIENT_STOCK' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('writes catalogue text as text — a product name cannot become markup', async () => {
    fetchMock.mockImplementation(() =>
      reply(200, { availability: 'in_stock', name: '<img src=x onerror=alert(1)>' }),
    )
    document.body.innerHTML =
      '<span data-hisabche-stock="p1"></span><div data-hisabche-buy="p1"></div>'
    await shop.mount()
    const badge = document.querySelector('[data-hisabche-stock]')!
    expect(badge.textContent).toBe('موجود')
    expect(badge.getAttribute('data-availability')).toBe('in_stock')
    expect(document.querySelector('img')).toBeNull()
    expect(document.querySelector('[data-hisabche-buy] button')).not.toBeNull()
  })

  it('shows a number only when the server sent one', async () => {
    fetchMock.mockImplementation(() => reply(200, { availability: 'in_stock', quantity: 7 }))
    document.body.innerHTML = '<span data-hisabche-stock="p1"></span>'
    await shop.mount()
    expect(document.querySelector('[data-hisabche-stock]')!.textContent).toBe('موجود (7)')
  })
})

describe('the token widgets', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchMock = vi.fn()
    document.body.innerHTML = '<div id="w"></div>'
  })

  it('renders a portal as text, without credentials and without a key', async () => {
    fetchMock.mockImplementation(() =>
      reply(200, {
        customerName: '<script>alert(1)</script>',
        balance: -500,
        invoices: [
          {
            invoiceNumber: 'INV-1',
            date: '2026-09-01',
            total: 100,
            paidAmount: 40,
            currency: 'AFN',
          },
        ],
        payments: [{ date: '2026-09-02', amount: 40, currency: 'AFN' }],
      }),
    )
    const el = document.getElementById('w')!
    await load().renderPortal(el, 'a'.repeat(64), {
      apiBase: 'https://api.example/api',
      fetch: fetchMock,
    })
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers?: Record<string, string> },
    ]
    expect(url).toBe(`https://api.example/api/public/portal/${'a'.repeat(64)}`)
    expect(init.credentials).toBe('omit')
    expect(init.headers).toBeUndefined()
    expect(el.querySelector('script')).toBeNull()
    expect(el.textContent).toContain('<script>alert(1)</script>')
    expect(el.querySelector('[data-hisabche-balance]')!.getAttribute('data-hisabche-balance')).toBe(
      '-500',
    )
    expect(el.textContent).toContain('INV-1')
  })

  it('a dead link rejects with the server’s code', async () => {
    fetchMock.mockImplementation(() => reply(404, { code: 'PORTAL_NOT_FOUND' }))
    await expect(
      load().renderPortal(document.getElementById('w')!, 'b'.repeat(64), { fetch: fetchMock }),
    ).rejects.toMatchObject({ code: 'PORTAL_NOT_FOUND' })
  })

  it('renders one invoice from its share token', async () => {
    fetchMock.mockImplementation(() =>
      reply(200, {
        invoiceNumber: 'INV-9',
        date: '2026-09-03',
        total: 250,
        currency: 'AFN',
        items: [{ product_name: 'چای', quantity: 2, total_price: 250 }],
      }),
    )
    const el = document.getElementById('w')!
    await load().renderInvoice(el, 'tok', { apiBase: 'https://api.example/api', fetch: fetchMock })
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.example/api/public/invoices/tok')
    expect(el.textContent).toContain('INV-9')
    expect(el.textContent).toContain('چای')
  })
})
