// ============================================
// Customer portal — links a business sends a customer to see their account.
//
//   1. The public route on a real Fastify: a malformed token is 400, an
//      unknown/revoked/expired/orphaned one is the SAME 404, and the answer
//      carries nothing but the customer's own account.
//   2. The member routes are guarded by customer capabilities.
//   3. The service reads as the link's maker, re-resolved on every visit,
//      and takes the balance from the one balance function.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Fastify from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { buildCustomerPortalRoutes } from '../routes/customer-portal.routes'

const SRC = join(__dirname, '..')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (...p: string[]) => strip(readFileSync(join(SRC, ...p), 'utf8'))

const GOOD = 'a'.repeat(64)
const VIEW = {
  businessName: 'فروشگاه',
  customerName: 'مریم',
  balance: 1200,
  isDebtor: true,
  invoices: [],
  invoiceCount: 0,
  payments: [],
  paymentCount: 0,
  orders: [],
}

describe('the public portal route', () => {
  const view = vi.fn(async (token: string) => (token === GOOD ? VIEW : null))
  const app = Fastify()
  app.register(
    buildCustomerPortalRoutes({
      view,
      createLink: vi.fn(),
      listLinks: vi.fn(),
      revokeLink: vi.fn(),
    } as never),
  )
  beforeAll(() => app.ready())
  afterAll(() => app.close())

  it('a malformed token never reaches the service', async () => {
    const res = await app.inject({ url: '/api/public/portal/not-a-token' })
    expect(res.statusCode).toBe(400)
    expect(view).not.toHaveBeenCalledWith('not-a-token')
  })

  it('unknown, revoked, expired and orphaned links are one indistinguishable 404', async () => {
    const res = await app.inject({ url: `/api/public/portal/${'b'.repeat(64)}` })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ error: 'PORTAL_NOT_FOUND', code: 'PORTAL_NOT_FOUND' })
  })

  it('a live link answers the customer’s own account', async () => {
    const res = await app.inject({ url: `/api/public/portal/${GOOD}` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ customerName: 'مریم', balance: 1200 })
  })
})

describe('the service', () => {
  const service = read('services', 'customer-portal', 'customer-portal.service.ts')

  it('reads as the link’s maker, re-resolved on every visit — a removed maker kills the link', () => {
    expect(service).toContain(
      'ctx = await resolveWorkspaceAccess(row.created_by, row.workspace_id)',
    )
    const afterResolve = service.slice(service.indexOf('resolveWorkspaceAccess(row.created_by'))
    expect(afterResolve.indexOf('return null')).toBeLessThan(
      afterResolve.indexOf('customerName(ctx.workspaceId'),
    )
  })

  it('the balance is the one the business sees — CustomerService.getBalance, not a second formula', () => {
    expect(service).toContain('customers.getBalance(row.customer_id, ctx)')
    expect(service).not.toMatch(/total\s*-\s*.*paid_amount/)
  })

  it('revoked and expired links do not open', () => {
    expect(service).toContain(".is('revoked_at', null)")
    expect(service).toContain('new Date(row.expires_at).getTime() <= Date.now()')
  })

  it('every list is scoped by the workspace AND the customer', () => {
    for (const table of ['invoices', 'payments', 'sales_orders']) {
      const from = service.indexOf(`.from('${table}')`)
      const block = service.slice(from, from + 400)
      expect(block).toContain(".eq('workspace_id', ctx.workspaceId)")
      expect(block).toMatch(/customer_id|party_id/)
    }
  })
})

describe('the member routes', () => {
  const routes = read('routes', 'customer-portal.routes.ts')

  it('making and revoking need customer.write; listing needs customer.read', () => {
    expect(routes).toContain(
      "const write = [authenticate, requireWorkspaceContext, requireCapability('customer.write')]",
    )
    expect(routes).toContain(
      "const read = [authenticate, requireWorkspaceContext, requireCapability('customer.read')]",
    )
    expect(routes).toMatch(/'\/api\/customers\/:id\/portal-links',\s*\{ preHandler: write \}/)
    expect(routes).toMatch(/'\/api\/customer-portal-links\/:id',\s*\{ preHandler: write \}/)
  })

  it('are not open to API keys', async () => {
    const { API_ROUTE_SCOPES } = await import('../services/developer/developer.domain')
    expect(Object.keys(API_ROUTE_SCOPES).some((k) => k.includes('portal'))).toBe(false)
  })
})
