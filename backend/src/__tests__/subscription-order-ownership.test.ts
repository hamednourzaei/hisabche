// Audit F-05 / L-01 (8 Nov 2026).
//  · A paid order with NO owner is claimed with its token — Path B by id refuses it.
//  · /api/billing/orders is reachable without a session (buy first), and a token
//    that is sent but does not verify is refused, never downgraded to anonymous.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { SubscriptionOrderService } from '../services/subscription-order.service'

function serviceWith(order: Record<string, unknown>) {
  const rpc = vi.fn()
  const db = {
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: order, error: null }) }) }),
    }),
    rpc,
  }
  return { service: new SubscriptionOrderService(db as never), rpc }
}

const paid = (createdBy: string | null) => ({
  id: 'ord-1',
  status: 'paid',
  created_by_user_id: createdBy,
  claimed_by_user_id: null,
  provisioned_workspace_id: null,
})

describe('provisioning by order id', () => {
  it('refuses an order without an owner, before touching the RPC', async () => {
    const { service, rpc } = serviceWith(paid(null))
    await expect(
      service.provisionFromOrder('someone-else', 'ord-1', 'Shop', 'AFN'),
    ).rejects.toMatchObject({ code: 'ORDER_REQUIRES_CLAIM_TOKEN', statusCode: 403 })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('refuses another user', async () => {
    const { service, rpc } = serviceWith(paid('owner-1'))
    await expect(
      service.provisionFromOrder('intruder', 'ord-1', 'Shop', 'AFN'),
    ).rejects.toMatchObject({ code: 'ORDER_FORBIDDEN' })
    expect(rpc).not.toHaveBeenCalled()
  })
})

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*\r?\n/gm, '')

describe('POST /api/billing/orders', () => {
  const index = strip(readFileSync(join(__dirname, '..', 'index.ts'), 'utf8'))
  const routes = strip(readFileSync(join(__dirname, '..', 'routes', 'billing.routes.ts'), 'utf8'))

  it('is an exact public path, so the anonymous branch is reachable', () => {
    const list = index.slice(
      index.indexOf('const exactPublicPaths'),
      index.indexOf(']', index.indexOf('const exactPublicPaths')),
    )
    expect(list).toContain("'/api/billing/orders'")
  })

  it('answers 401 to a token that does not verify', () => {
    const handler = routes.slice(
      routes.indexOf("'/api/billing/orders',"),
      routes.indexOf("'/api/billing/orders/:id/verify-payment'"),
    )
    expect(handler).toContain('reply.code(401)')
    expect(handler).not.toMatch(/catch\s*\{\s*\}/)
    expect(handler).toContain('rateLimit')
  })

  it('no order handler sends the raw error message on a 500', () => {
    expect(routes).not.toMatch(/code\(err\.statusCode \|\| 500\)/)
  })
})
