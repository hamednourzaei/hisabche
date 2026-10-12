// ============================================
// backend/src/__tests__/customer-declared-role-http.test.ts
//
// HTTP integration tests for customer declaredRole and schema compatibility.
// Exercised end-to-end: real HTTP → route → guards → service → mapper.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId, type Row } from './helpers/fake-supabase'

const db = new FakeDatabase()

const OWNER = { id: fakeId('owner'), token: 'token-owner-declared-role' }
const SHOP = fakeId('shop')

const users = new Map<string, { id: string }>([[OWNER.token, { id: OWNER.id }]])

let missingColumnActive = false

const baseFrom = db.from.bind(db)
// Wrap from() to simulate 42703 when missingColumnActive is true and query names declared_role
const interceptingFrom = (table: string) => {
  const builder = baseFrom(table)
  if (!missingColumnActive || table !== 'customers') return builder

  const originalSelect = builder.select.bind(builder)
  const originalInsert = builder.insert.bind(builder)

  builder.select = (columns = '*', options?: { count?: 'exact' | 'planned' | 'estimated' }) => {
    if (columns.includes('declared_role')) {
      const errorResult = {
        data: null,
        error: { code: '42703', message: 'column declared_role does not exist' },
      }
      return {
        ...builder,
        eq: () => builder,
        order: () => builder,
        limit: () => builder,
        range: () => builder,
        single: () => Promise.resolve(errorResult),
        maybeSingle: () => Promise.resolve(errorResult),
        then: (
          onfulfilled?: ((value: unknown) => unknown) | null,
          onrejected?: ((reason: unknown) => unknown) | null,
        ) => Promise.resolve(errorResult).then(onfulfilled, onrejected),
      } as unknown as ReturnType<typeof originalSelect>
    }
    return originalSelect(columns, options)
  }

  builder.insert = (values: Row | Row[]) => {
    const list = Array.isArray(values) ? values : [values]
    return {
      ...builder,
      select: (columns = '*') => {
        if (columns.includes('declared_role') || list.some((v) => 'declared_role' in v)) {
          const errorResult = {
            data: null,
            error: { code: '42703', message: 'column declared_role does not exist' },
          }
          return {
            single: () => Promise.resolve(errorResult),
            maybeSingle: () => Promise.resolve(errorResult),
            then: (
              onfulfilled?: ((value: unknown) => unknown) | null,
              onrejected?: ((reason: unknown) => unknown) | null,
            ) => Promise.resolve(errorResult).then(onfulfilled, onrejected),
          } as unknown as ReturnType<typeof originalInsert>
        }
        return originalInsert(values).select(columns)
      },
    } as unknown as ReturnType<typeof originalInsert>
  }

  return builder
}

const fakeDbModule = createFakeDb(db, users)
fakeDbModule.supabase.from = interceptingFrom as unknown as typeof fakeDbModule.supabase.from

vi.mock('../db', () => fakeDbModule)

let app: FastifyInstance

function resetWorld() {
  db.tables.clear()
  db.failures.clear()
  db.queries.length = 0
  missingColumnActive = false

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
}

const as = (user: { token: string }, workspaceId = SHOP) => ({
  authorization: `Bearer ${user.token}`,
  'x-workspace-id': workspaceId,
})

beforeAll(async () => {
  resetWorld()
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
}, 60_000)

afterAll(async () => {
  await app?.close()
})

beforeEach(() => {
  resetWorld()
})

describe('customer declaredRole over HTTP', () => {
  it('POST with declaredRole:seller includes in ?role=seller and excludes from ?role=buyer', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/customers',
      headers: as(OWNER),
      payload: {
        fullName: 'Supplier Alpha',
        declaredRole: 'seller',
      },
    })

    expect(postRes.statusCode).toBe(201)
    const created = postRes.json()
    expect(created.fullName).toBe('Supplier Alpha')
    expect(created.declaredRole).toBe('seller')

    // GET ?role=seller -> includes
    const sellerRes = await app.inject({
      method: 'GET',
      url: '/api/customers?role=seller',
      headers: as(OWNER),
    })
    expect(sellerRes.statusCode).toBe(200)
    const sellerList = sellerRes.json().customers
    expect(sellerList.some((c: { fullName?: string }) => c.fullName === 'Supplier Alpha')).toBe(
      true,
    )

    // GET ?role=buyer -> excludes
    const buyerRes = await app.inject({
      method: 'GET',
      url: '/api/customers?role=buyer',
      headers: as(OWNER),
    })
    expect(buyerRes.statusCode).toBe(200)
    const buyerList = buyerRes.json().customers
    expect(buyerList.some((c: { fullName?: string }) => c.fullName === 'Supplier Alpha')).toBe(
      false,
    )
  })

  it('declared seller with a sale invoice promotes to both and appears in both filters', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/customers',
      headers: as(OWNER),
      payload: {
        fullName: 'Dual Role Party',
        declaredRole: 'seller',
      },
    })
    expect(postRes.statusCode).toBe(201)
    const party = postRes.json()

    // Seed a sale invoice for this party
    db.seed('invoices', [
      {
        id: fakeId('inv'),
        workspace_id: SHOP,
        customer_id: party.id,
        type: 'sale',
        status: 'posted',
        total: 250,
      },
    ])

    const sellerRes = await app.inject({
      method: 'GET',
      url: '/api/customers?role=seller',
      headers: as(OWNER),
    })
    expect(sellerRes.statusCode).toBe(200)
    expect(
      sellerRes
        .json()
        .customers.some((c: { fullName?: string }) => c.fullName === 'Dual Role Party'),
    ).toBe(true)

    const buyerRes = await app.inject({
      method: 'GET',
      url: '/api/customers?role=buyer',
      headers: as(OWNER),
    })
    expect(buyerRes.statusCode).toBe(200)
    expect(
      buyerRes
        .json()
        .customers.some((c: { fullName?: string }) => c.fullName === 'Dual Role Party'),
    ).toBe(true)
  })

  it('with fake DB returning 42703 for declared_role, GET answers 200, POST with declaredRole answers 400, POST without creates', async () => {
    missingColumnActive = true

    // GET answers 200 via fallback to legacy columns
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/customers',
      headers: as(OWNER),
    })
    expect(getRes.statusCode).toBe(200)

    // POST with declaredRole answers 400 CUSTOMER_DECLARED_ROLE_SCHEMA_REQUIRED
    const postWithRole = await app.inject({
      method: 'POST',
      url: '/api/customers',
      headers: as(OWNER),
      payload: {
        fullName: 'Blocked Supplier',
        declaredRole: 'seller',
      },
    })
    expect(postWithRole.statusCode).toBe(400)
    const errBody = postWithRole.json()
    expect(errBody.error).toBe('CUSTOMER_DECLARED_ROLE_SCHEMA_REQUIRED')
    expect(errBody.code).toBe('CUSTOMER_DECLARED_ROLE_SCHEMA_REQUIRED')

    // POST without declaredRole succeeds with 201
    const postWithoutRole = await app.inject({
      method: 'POST',
      url: '/api/customers',
      headers: as(OWNER),
      payload: {
        fullName: 'Plain Customer',
      },
    })
    expect(postWithoutRole.statusCode).toBe(201)
    expect(postWithoutRole.json().fullName).toBe('Plain Customer')
  })

  it('update with expectedUpdatedAt: null filters with is("updated_at", null)', async () => {
    // Seed a customer whose updated_at is null
    const custId = fakeId('cust')
    db.seed('customers', [
      {
        id: custId,
        workspace_id: SHOP,
        user_id: OWNER.id,
        full_name: 'Unedited Customer',
        phone: '0700000000',
        email: '',
        address: null,
        notes: 'Initial',
        opening_balance: 0,
        is_active: true,
        type: 'cash',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: null,
      },
    ])

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/customers/${custId}`,
      headers: as(OWNER),
      payload: {
        notes: 'Updated notes',
        expectedUpdatedAt: null,
      },
    })

    expect(patchRes.statusCode).toBe(200)

    // Verify a query with filter 'is:updated_at' was executed
    const updateQuery = db.queries.find(
      (q) => q.table === 'customers' && q.op === 'update' && q.filters.includes('is:updated_at'),
    )
    expect(updateQuery).toBeDefined()
  })
})
