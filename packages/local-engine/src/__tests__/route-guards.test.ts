// ============================================
// packages/local-engine/src/__tests__/route-guards.test.ts
//
// Every sensitive write on the device answers 403 to a seller and does not
// answer 403 to the owner. The earlier matrix test only called `requireRole`
// and `requireCapability` directly, which proves the function and not the
// route: a route that never calls it stays green.
// ============================================

import { describe, expect, it } from 'vitest'
import { requireCapability } from '../auth'
import { createLocalEngine } from '../index'
import type { LocalContext } from '../types'
import { createTestDb, TEST_USER_ID, TEST_WORKSPACE_ID } from './test-db'

const ID = '33333333-3333-4333-8333-333333333333'

const GUARDED: ReadonlyArray<{ method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string }> = [
  { method: 'POST', path: '/payrolls' },
  { method: 'PATCH', path: `/payrolls/${ID}` },
  { method: 'POST', path: '/leaves' },
  { method: 'PATCH', path: `/leaves/${ID}` },
  { method: 'POST', path: '/employees' },
  { method: 'PATCH', path: `/employees/${ID}` },
  { method: 'PATCH', path: `/workspaces/${ID}` },
  { method: 'POST', path: '/branches' },
  { method: 'PUT', path: `/operations/budgets/${ID}` },
  { method: 'POST', path: '/purchase-orders' },
  { method: 'POST', path: `/purchase-orders/${ID}/receive` },
  { method: 'PUT', path: `/invoices/${ID}/installments` },
  { method: 'POST', path: '/shifts' },
  { method: 'POST', path: `/warehouses/${ID}/locations` },
  { method: 'POST', path: `/products/${ID}/variants` },
  { method: 'PUT', path: '/settings/base-currency' },
  { method: 'PUT', path: '/currency/rates' },
  { method: 'POST', path: '/migrations/commit' },
  { method: 'POST', path: `/products/${ID}/fitments` },
  { method: 'POST', path: '/vehicles' },
  { method: 'POST', path: '/metal-rates' },
  { method: 'POST', path: '/exchange-rates' },
  { method: 'PUT', path: '/finance/currency/base' },
  { method: 'POST', path: `/invoices/${ID}/cancel` },
  { method: 'DELETE', path: `/invoices/${ID}` },
  { method: 'POST', path: `/pos/orders/${ID}/void` },
]

async function statusOf(role: 'seller' | 'owner', method: string, path: string) {
  const db = createTestDb()
  db.run(`UPDATE local_user SET role = ?`, [role])
  const engine = createLocalEngine(db)
  const res = await engine.request({
    method: method as 'POST',
    path,
    headers: { 'x-workspace-id': TEST_WORKSPACE_ID, 'x-user-id': TEST_USER_ID },
    body: {},
  })
  return res.status
}

describe('local engine: sensitive writes are guarded at the route', () => {
  for (const { method, path } of GUARDED) {
    it(`${method} ${path}: seller is refused, owner is not`, async () => {
      expect(await statusOf('seller', method, path)).toBe(403)
      expect(await statusOf('owner', method, path)).not.toBe(403)
    })
  }

  it('a brand-new device (no workspace, no user yet) can still create its first workspace', async () => {
    const empty = createTestDb()
    empty.run('DELETE FROM local_user')
    empty.run('DELETE FROM local_workspace')

    const res = await createLocalEngine(empty).request({
      method: 'POST',
      path: '/workspaces',
      body: { name: 'فروشگاه من', baseCurrency: 'AFN' },
    })

    expect(res.status).toBe(201)
  })

  it("on a shared device the role is the REQUESTING user's, not the first user's", async () => {
    // The owner is the first row; a seller signs in on the same device. The
    // seller's request names the seller and forges the owner role.
    const db = createTestDb()
    db.run(
      `INSERT INTO local_user (id, email, full_name, role, created_at, updated_at)
       VALUES ('seller-1', 's@x.local', 'فروشنده', 'seller', datetime('now'), datetime('now'))`,
    )
    const engine = createLocalEngine(db)

    const forged = await engine.request({
      method: 'POST',
      path: '/payrolls',
      headers: {
        'x-workspace-id': TEST_WORKSPACE_ID,
        'x-user-id': 'seller-1',
        'x-user-role': 'owner',
      },
      body: {},
    })
    expect(forged.status).toBe(403)

    const owner = await engine.request({
      method: 'POST',
      path: '/payrolls',
      headers: { 'x-workspace-id': TEST_WORKSPACE_ID, 'x-user-id': TEST_USER_ID },
      body: {},
    })
    expect(owner.status).not.toBe(403)
  })

  it('once a workspace exists, a seller cannot create another', async () => {
    expect(await statusOf('seller', 'POST', '/workspaces')).toBe(403)
  })

  it('refuses a capability nobody defined instead of letting everyone through', () => {
    const ctx: LocalContext = {
      workspaceId: TEST_WORKSPACE_ID,
      userId: ID,
      role: 'seller',
      baseCurrency: 'AFN',
      timeZone: 'Asia/Kabul',
    }
    expect(() => requireCapability(ctx, 'no.such.capability')).toThrow()
    expect(() => requireCapability({ ...ctx, role: 'owner' }, 'no.such.capability')).toThrow()
  })
})
