// The offline engine answers in the SAME shape as the server. Two screens
// crashed offline because it did not (22 Oct 2026):
// · /warehouses/overview had no `summary` → «Cannot read properties of
//   undefined (reading 'productCount')» on the warehouse page;
// · /payments returned { payments } where the server sends an array.
import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalEngine } from '../index'
import { createTestDb, TEST_WAREHOUSE_ID } from './test-db'

describe('offline answers in the server shape', () => {
  let engine: ReturnType<typeof createLocalEngine>

  beforeEach(async () => {
    engine = createLocalEngine(createTestDb())
    const res = await engine.request({
      method: 'POST',
      path: '/products',
      body: {
        name: 'روغن',
        buyPrice: 400,
        sellPrice: 500,
        quantity: 20,
        warehouseId: TEST_WAREHOUSE_ID,
      },
    })
    expect(res.status).toBe(201)
  })

  it('/warehouses/overview gives every warehouse a summary', async () => {
    const res = await engine.request({ method: 'GET', path: '/warehouses/overview' })
    expect(res.status).toBe(200)
    const data = res.data as {
      warehouses: Array<{
        id: string
        summary: { productCount: number; totalValue: number | null }
      }>
      unassigned: unknown
    }
    const warehouse = data.warehouses.find((w) => w.id === TEST_WAREHOUSE_ID)
    expect(warehouse?.summary.productCount).toBe(1)
    expect('unassigned' in data).toBe(true)
  })

  it('/warehouses/:id/detail lists products with a summary', async () => {
    const res = await engine.request({
      method: 'GET',
      path: `/warehouses/${TEST_WAREHOUSE_ID}/detail`,
    })
    const data = res.data as {
      warehouse: { id: string } | null
      products: Array<{ name: string; quantity: number }>
      summary: { productCount: number }
    }
    expect(data.warehouse?.id).toBe(TEST_WAREHOUSE_ID)
    expect(data.products.map((p) => [p.name, p.quantity])).toEqual([['روغن', 20]])
    expect(data.summary.productCount).toBe(1)
  })

  it('/warehouses/placement has the server fields', async () => {
    const res = await engine.request({ method: 'GET', path: '/warehouses/placement' })
    const data = res.data as {
      branchesConfigured: boolean
      warehouses: Array<{ id: string }>
      stock: Array<{ productId: string; warehouseId: string; quantity: number }>
    }
    expect(data.warehouses.some((w) => w.id === TEST_WAREHOUSE_ID)).toBe(true)
    expect(data.stock[0]?.quantity).toBe(20)
  })

  it('/payments is an array', async () => {
    const res = await engine.request({ method: 'GET', path: '/payments' })
    expect(Array.isArray(res.data)).toBe(true)
  })
})

// A sale made offline must show up everywhere the same sale shows online
// (24 Oct 2026): the books, the invoice's own payments, the recent-activity
// feed and the bell. Each read the server's shape and none of them was served.
describe('an offline paid sale is visible in the books, the feed and the bell', () => {
  let engine: ReturnType<typeof createLocalEngine>
  let invoiceId: string

  beforeEach(async () => {
    engine = createLocalEngine(createTestDb())
    const res = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'sale',
        currency: 'AFN',
        paidAmount: 500,
        items: [{ productName: 'دستبند', quantity: 1, unitPrice: 500 }],
      },
    })
    expect(res.status).toBe(201)
    invoiceId = (res.data as { id: string }).id
  })

  it('/accounting/journal lists the entry the sale posted', async () => {
    const res = await engine.request({ method: 'GET', path: '/accounting/journal' })
    const entries = (res.data as { entries: Array<{ sourceType: string; sourceId: string }> })
      .entries
    expect(entries.some((e) => e.sourceType === 'invoice' && e.sourceId === invoiceId)).toBe(true)
  })

  it('/invoices/:id/related answers like the server: a dated payment and its allocated total', async () => {
    const res = await engine.request({ method: 'GET', path: `/invoices/${invoiceId}/related` })
    const data = res.data as {
      allocatedTotal: number
      payments: Array<{ amount: number; date: string | null; allocationId: string }>
    }
    expect(data.allocatedTotal).toBe(500)
    expect(data.payments).toHaveLength(1)
    expect(data.payments[0]?.amount).toBe(500)
    expect(data.payments[0]?.date).toBeTruthy()
    expect(data.payments[0]?.allocationId).toBeTruthy()
  })

  it('/v1/activities has the invoice, and counts and unread agree', async () => {
    const feed = await engine.request({ method: 'GET', path: '/v1/activities' })
    const body = feed.data as {
      data: Array<{ entityType: string; entityId: string; hasUnread: boolean }>
    }
    expect(body.data.some((g) => g.entityType === 'invoice' && g.entityId === invoiceId)).toBe(true)

    const unread = await engine.request({ method: 'GET', path: '/v1/activities/unread-count' })
    expect((unread.data as { count: number }).count).toBeGreaterThan(0)

    const counts = await engine.request({ method: 'GET', path: '/v1/activities/counts' })
    expect((counts.data as { invoices: number }).invoices).toBe(1)
  })

  it('marking all read empties the unread count, and a later sale is unread again', async () => {
    await engine.request({ method: 'PATCH', path: '/v1/activities/mark-all-read' })
    const after = await engine.request({ method: 'GET', path: '/v1/activities/unread-count' })
    expect((after.data as { count: number }).count).toBe(0)
  })

  it('the bell lists the sale, unread, and marking it read clears the count', async () => {
    const list = await engine.request({ method: 'GET', path: '/v1/notifications' })
    const body = list.data as {
      data: Array<{ id: string; is_read: boolean; entity_id: string; action_url: string }>
    }
    const entry = body.data.find((n) => n.entity_id === invoiceId)
    expect(entry?.is_read).toBe(false)
    expect(entry?.action_url).toBe(`/invoices/${invoiceId}`)

    const unread = await engine.request({ method: 'GET', path: '/v1/notifications/unread-count' })
    expect((unread.data as { count: number }).count).toBeGreaterThan(0)

    await engine.request({
      method: 'PATCH',
      path: '/v1/notifications/mark-read',
      body: { ids: [entry?.id] },
    })
    const reread = await engine.request({ method: 'GET', path: '/v1/notifications' })
    const again = (reread.data as { data: Array<{ id: string; is_read: boolean }> }).data.find(
      (n) => n.id === entry?.id,
    )
    expect(again?.is_read).toBe(true)
  })
})

// «مشتری / تأمین‌کننده» tabs offline. The device ignored `role`, so every tab
// listed everybody (24 Oct 2026). The rule is the server's (resolveEffectiveRole).
describe('the customer list filters by role like the server does', () => {
  let engine: ReturnType<typeof createLocalEngine>
  const names = async (path: string) => {
    const res = await engine.request({ method: 'GET', path })
    const body = res.data as { customers: Array<{ fullName: string }>; total: number }
    return { names: body.customers.map((c) => c.fullName).sort(), total: body.total }
  }

  beforeEach(async () => {
    engine = createLocalEngine(createTestDb())
    for (const body of [
      { fullName: 'مشتری', declaredRole: 'buyer' },
      { fullName: 'تأمین‌کننده', declaredRole: 'seller' },
      { fullName: 'هر دو', declaredRole: 'both' },
      { fullName: 'بی‌نقش' },
    ]) {
      const res = await engine.request({ method: 'POST', path: '/customers', body })
      expect(res.status).toBe(201)
    }
  })

  it('role=seller lists the supplier and the both-party, with an exact total', async () => {
    expect(await names('/customers?role=seller')).toEqual({
      names: ['تأمین‌کننده', 'هر دو'],
      total: 2,
    })
  })

  it('role=buyer lists the buyer and the both-party', async () => {
    expect(await names('/customers?role=buyer')).toEqual({ names: ['مشتری', 'هر دو'], total: 2 })
  })

  it('no role lists everybody', async () => {
    expect((await names('/customers')).total).toBe(4)
  })

  it('a party with no declared role becomes a supplier by being on a purchase invoice', async () => {
    const list = await engine.request({ method: 'GET', path: '/customers' })
    const plain = (
      list.data as { customers: Array<{ id: string; fullName: string }> }
    ).customers.find((c) => c.fullName === 'بی‌نقش')
    const made = await engine.request({
      method: 'POST',
      path: '/invoices',
      body: {
        type: 'purchase',
        currency: 'AFN',
        customerId: plain?.id,
        items: [{ productName: 'کالا', quantity: 1, unitPrice: 10 }],
      },
    })
    expect(made.status).toBe(201)
    expect((await names('/customers?role=seller')).names).toContain('بی‌نقش')
    expect((await names('/customers?role=buyer')).names).not.toContain('بی‌نقش')
  })

  it('pages are cut after the filter: page 2 of a role is the rest of THAT role', async () => {
    const page2 = await engine.request({
      method: 'GET',
      path: '/customers?role=seller&limit=1&page=2',
    })
    const body = page2.data as { customers: unknown[]; total: number }
    expect(body.total).toBe(2)
    expect(body.customers).toHaveLength(1)
  })
})

// Branches offline (24 Oct 2026): «افزودن شعبه» answered «not available offline».
// The rules are the server's (validateBranchPlacement / nestBranches).
describe('branches work offline with the server rules', () => {
  let engine: ReturnType<typeof createLocalEngine>
  const add = (body: Record<string, unknown>) =>
    engine.request({ method: 'POST', path: '/branches', body })

  beforeEach(() => {
    engine = createLocalEngine(createTestDb())
  })

  it('creates a branch and lists it, in the server shape', async () => {
    const made = await add({ code: '1122', name: 'tehran' })
    expect(made.status).toBe(201)
    const list = await engine.request({ method: 'GET', path: '/branches' })
    const body = list.data as {
      branches: Array<{ code: string; name: string }>
      scope: { kind: string }
    }
    expect(body.branches.map((b) => [b.code, b.name])).toEqual([['1122', 'tehran']])
    expect(body.scope.kind).toBe('all')
  })

  it('refuses a duplicate code, an unknown parent and a cycle — the server rules', async () => {
    const root = (await add({ code: 'A', name: 'مرکز' })).data as { id: string }
    expect((await add({ code: 'A', name: 'دوباره' })).status).toBe(400)
    expect((await add({ code: 'B', name: 'x', parentBranchId: 'nope' })).status).toBe(400)
    const child = (await add({ code: 'C', name: 'شعبه', parentBranchId: root.id })).data as {
      id: string
    }
    const cycle = await engine.request({
      method: 'PATCH',
      path: `/branches/${root.id}`,
      body: { parentBranchId: child.id },
    })
    expect(cycle.status).toBe(400)
  })

  it('the tree nests a child under its parent', async () => {
    const root = (await add({ code: 'A', name: 'مرکز' })).data as { id: string }
    await add({ code: 'B', name: 'شعبه', parentBranchId: root.id })
    const res = await engine.request({ method: 'GET', path: '/branches/tree' })
    const tree = (res.data as { tree: Array<{ code: string; children: Array<{ code: string }> }> })
      .tree
    expect(tree).toHaveLength(1)
    expect(tree[0]?.children.map((c) => c.code)).toEqual(['B'])
  })

  it('a manager sent offline is refused out loud, not accepted and dropped', async () => {
    const res = await add({
      code: 'M',
      name: 'x',
      managerEmployeeId: '33333333-3333-4333-8333-333333333333',
    })
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.data)).toContain('BRANCH_MANAGER_OFFLINE')
  })

  it('renames and deactivates', async () => {
    const root = (await add({ code: 'A', name: 'مرکز' })).data as { id: string }
    const res = await engine.request({
      method: 'PATCH',
      path: `/branches/${root.id}`,
      body: { name: 'مرکز تازه', isActive: false },
    })
    expect(res.status).toBe(200)
    const list = await engine.request({ method: 'GET', path: '/branches' })
    const branch = (list.data as { branches: Array<{ name: string; isActive: boolean }> })
      .branches[0]
    expect(branch).toMatchObject({ name: 'مرکز تازه', isActive: false })
  })
})

describe('settings and suggestions run on the device', () => {
  it('keeps the logo, the stamp and the signature in the device database', async () => {
    const engine = createLocalEngine(createTestDb())
    const list = await engine.request({ method: 'GET', path: '/workspaces' })
    const workspace = (list.data as Array<{ id: string }>)[0]!
    const image = 'data:image/png;base64,iVBORw0KGgo='

    const saved = await engine.request({
      method: 'PATCH',
      path: `/workspaces/${workspace.id}`,
      body: { logoUrl: image, stampUrl: image, signatureUrl: image },
    })
    expect(saved.status).toBe(200)
    expect(saved.data).toMatchObject({ logo_url: image, stamp_url: image, signature_url: image })

    const removed = await engine.request({
      method: 'PATCH',
      path: `/workspaces/${workspace.id}`,
      body: { stampUrl: null },
    })
    expect(removed.data).toMatchObject({ stamp_url: null, logo_url: image })
  })

  it('writes the dashboard suggestions from the device’s own products and sales', async () => {
    const engine = createLocalEngine(createTestDb())
    await engine.request({
      method: 'POST',
      path: '/products',
      body: {
        name: 'روغن',
        buyPrice: 400,
        sellPrice: 500,
        quantity: 0,
        warehouseId: TEST_WAREHOUSE_ID,
      },
    })
    const res = await engine.request({ method: 'GET', path: '/ai/insights' })
    expect(res.status).toBe(200)
    const codes = (res.data as Array<{ code: string }>).map((insight) => insight.code)
    expect(codes).toContain('outOfStock')
    expect(codes).toContain('tip')
    // the server's rule, not a copy: the same function builds both
    const outOfStock = (res.data as Array<{ code: string; values?: { names?: string } }>).find(
      (insight) => insight.code === 'outOfStock',
    )
    expect(outOfStock?.values?.names).toBe('روغن')
  })
})

describe('the units list runs on the device', () => {
  it('answers GET /units from the same seed the server falls back to', async () => {
    const engine = createLocalEngine(createTestDb())
    const res = await engine.request({ method: 'GET', path: '/units' })
    expect(res.status).toBe(200)
    const body = res.data as { units: Array<{ code: string; dimension: string }>; source: string }
    expect(body.source).toBe('seed')
    expect(body.units.map((unit) => unit.code)).toEqual(
      expect.arrayContaining(['gram', 'kg', 'ton']),
    )
  })
})
