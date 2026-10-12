// ============================================
// «مشتری / تأمین‌کننده» filters the whole list, then a page is cut — over real
// HTTP (buildServer + app.inject).
//
// The role is declared_role merged with what the invoices say; it is not a
// column. It was applied to the ONE page the database had already cut: with
// 250 parties and the newest first, a supplier among the oldest 150 was not in
// the suppliers tab at all, the page held fewer rows than asked for, and the
// «total» was the number of all parties.
//
// The fixture is 250 parties so that the old code and the new one give
// different answers. Both ways of learning the roles are run: the grouped
// function of customer-declared-role-01, and the invoices themselves (a
// database that has not had that script).
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId, type Row } from './helpers/fake-supabase'

const db = new FakeDatabase()

const OWNER = { id: '11111111-1111-4111-8111-111111111111', token: 'token-owner' }
const SHOP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const users = new Map<string, { id: string }>([[OWNER.token, { id: OWNER.id }]])

vi.mock('../db', () => createFakeDb(db, users))

let app: FastifyInstance

const PARTIES = 250
const partyId = (n: number) => `cccccccc-0000-4000-8000-${String(n).padStart(12, '0')}`
const name = (n: number) => `P${String(n).padStart(3, '0')}`
// Created one minute apart, P001 first: «newest first» is P250 … P001.
const createdAt = (n: number) => new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString()

// ── who is what, by hand ──────────────────────────────────────────────────
// Declared suppliers: every tenth party                    → 25  (P010 … P250)
// Suppliers by a purchase invoice only: P007, P205, P215   →  3
//                                                   sellers = 28
// Buyers: a sale invoice for P001–P005 and P007 (which also sold to us), and
// P009 declared a customer with no invoice yet     buyers  =  7
const DECLARED_SELLERS = Array.from({ length: 25 }, (_, i) => (i + 1) * 10)
const PURCHASE_ONLY = [7, 205, 215]
const SELLERS = [...DECLARED_SELLERS, ...PURCHASE_ONLY].sort((a, b) => b - a)
const BUYERS = [9, 7, 5, 4, 3, 2, 1]

function seed(withFunction: boolean) {
  db.tables.clear()
  db.failures.clear()
  db.rpcs.clear()
  db.queries.length = 0

  db.seed('workspaces', [
    { id: SHOP, name: 'Shop', base_currency: 'AFN' },
    { id: OTHER, name: 'Other', base_currency: 'AFN' },
  ])
  db.seed('workspace_members', [
    {
      id: fakeId('member'),
      workspace_id: SHOP,
      user_id: OWNER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
      joined_at: '2026-01-01T00:00:00Z',
    },
  ])

  const party = (n: number, workspace = SHOP, declared: string | null = null): Row => ({
    id: workspace === SHOP ? partyId(n) : fakeId('theirs'),
    workspace_id: workspace,
    full_name: name(n),
    phone: '',
    email: '',
    opening_balance: 0,
    is_active: true,
    type: 'cash',
    declared_role: declared,
    created_at: createdAt(n),
  })
  db.seed(
    'customers',
    Array.from({ length: PARTIES }, (_, i) => {
      const n = i + 1
      return party(n, SHOP, DECLARED_SELLERS.includes(n) ? 'seller' : n === 9 ? 'buyer' : null)
    }),
  )
  // Another business's supplier must never be counted in ours.
  db.seed('customers', [party(1, OTHER, 'seller')])

  const invoice = (n: number, type: string | null, workspace = SHOP): Row => ({
    id: fakeId('inv'),
    workspace_id: workspace,
    customer_id: partyId(n),
    type,
  })
  db.seed('invoices', [
    ...[1, 2, 3, 4, 5, 7].map((n) => invoice(n, 'sale')),
    // An invoice from before the type existed was always a sale.
    invoice(5, null),
    ...PURCHASE_ONLY.map((n) => invoice(n, 'purchase')),
    // The same party id on the other business's purchase is not our supplier.
    invoice(1, 'purchase', OTHER),
  ])

  if (withFunction) {
    db.rpc('customer_invoice_roles', (args: Row) => {
      const byParty = new Map<string, { has_sale: boolean; has_purchase: boolean }>()
      for (const row of db.rows('invoices')) {
        if (row.workspace_id !== args.p_workspace || !row.customer_id) continue
        const seen = byParty.get(row.customer_id) ?? { has_sale: false, has_purchase: false }
        if (row.type === 'purchase') seen.has_purchase = true
        else seen.has_sale = true
        byParty.set(row.customer_id, seen)
      }
      return [...byParty.entries()]
        .map(([customer_id, flags]) => ({ customer_id, ...flags }))
        .sort((a, b) => (a.customer_id < b.customer_id ? -1 : 1))
        .filter((row) => !args.p_after || row.customer_id > args.p_after)
        .slice(0, args.p_limit)
    })
  }
}

const as = () => ({ authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP })

async function list(query: string) {
  const res = await app.inject({ method: 'GET', url: `/api/customers?${query}`, headers: as() })
  expect(res.statusCode, res.payload.slice(0, 200)).toBe(200)
  return res.json() as {
    customers: Array<{ fullName: string; role: string }>
    total?: number
    hasMore: boolean
    nextCursor: string | null
  }
}
const numbers = (rows: Array<{ fullName: string }>) =>
  rows.map((row) => Number(row.fullName.slice(1)))

beforeAll(async () => {
  seed(true)
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
}, 60_000)

afterAll(async () => {
  await app?.close()
})

describe.each([
  ['with customer_invoice_roles (the migration has run)', true],
  ['from the invoices themselves (before the migration)', false],
])('the suppliers tab — %s', (_label, withFunction) => {
  beforeEach(async () => {
    seed(withFunction)
    const { memoryCache } = await import('../utils/pagination')
    await memoryCache.clear()
    const { clearCache } = await import('../middleware/cache.middleware')
    await clearCache('*')
  })

  it('the fixture is what the comment says', () => {
    expect(SELLERS.length).toBe(28)
    expect(new Set(SELLERS).size).toBe(28)
  })

  it('⚠️ every supplier is listed, page by page — including the ones the first database page never held', async () => {
    const first = await list('role=seller&limit=10')
    expect(first.total).toBe(28)
    expect(first.hasMore).toBe(true)
    // A full page: ten suppliers, the ten newest.
    expect(numbers(first.customers)).toEqual(SELLERS.slice(0, 10))

    const second = await list('role=seller&limit=10&page=2')
    const third = await list('role=seller&limit=10&page=3')
    expect(numbers(second.customers)).toEqual(SELLERS.slice(10, 20))
    expect(numbers(third.customers)).toEqual(SELLERS.slice(20))
    expect(third.customers.length).toBe(8)
    expect(third.hasMore).toBe(false)
    expect(third.total).toBe(28)

    // P010 is the 241st newest party and P007 the 244th: with «cut a page of
    // 100, then filter» neither could ever be reached.
    const everyone = numbers([...first.customers, ...second.customers, ...third.customers])
    expect(everyone).toContain(10)
    expect(everyone).toContain(7)
    expect(new Set(everyone).size).toBe(28)
    // Nobody who is not a supplier, and nothing from the other business.
    for (const row of [...first.customers, ...second.customers, ...third.customers]) {
      expect(['seller', 'both'], row.fullName).toContain(row.role)
    }
  })

  it('one request for the whole tab holds all 28 — the page the hub asks for', async () => {
    const all = await list('role=seller&limit=100')
    expect(all.customers.length).toBe(28)
    expect(all.total).toBe(28)
    expect(all.hasMore).toBe(false)
  })

  it('the customers tab: sale invoices, an untyped old invoice, and a declared customer with none', async () => {
    const buyers = await list('role=buyer&limit=100')
    expect(numbers(buyers.customers)).toEqual(BUYERS)
    expect(buyers.total).toBe(7)
    // P007 bought from us AND sold to us: in both tabs, as «both».
    expect(buyers.customers.find((row) => row.fullName === 'P007')?.role).toBe('both')
    const sellers = await list('role=seller&limit=100')
    expect(sellers.customers.find((row) => row.fullName === 'P007')?.role).toBe('both')
  })

  it('a search narrows first, and the total is of what matched', async () => {
    // «P21» matches P210 … P219: of those, P210 is declared and P215 has a purchase.
    const found = await list('role=seller&limit=100&search=P21')
    expect(numbers(found.customers)).toEqual([215, 210])
    expect(found.total).toBe(2)
  })

  it('without a role nothing changed: a page of everybody, each with their role', async () => {
    const all = await list('limit=10')
    expect(numbers(all.customers)).toEqual([250, 249, 248, 247, 246, 245, 244, 243, 242, 241])
    // (The total of this path is the database's own count; the in-memory
    // database here counts after the limit, so it is not asserted.)
    expect(all.customers[0]?.role).toBe('seller')
    expect(all.customers[1]?.role).toBe('none')
  })

  it('a failed read of the invoices is a failure — not «nobody is a supplier»', async () => {
    db.rpcs.clear()
    db.fail('invoices', { code: '57014', message: 'canceling statement due to statement timeout' })
    const res = await app.inject({
      method: 'GET',
      url: '/api/customers?role=seller&limit=10',
      headers: as(),
    })
    expect(res.statusCode).toBe(500)
    // The plain list shows roles too, so it cannot pretend either.
    const plain = await app.inject({ method: 'GET', url: '/api/customers?limit=10', headers: as() })
    expect(plain.statusCode).toBe(500)
  })
})
