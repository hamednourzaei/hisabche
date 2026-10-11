// ============================================
// The currency a business keeps its books in — read, set, and locked.
//
// Over real HTTP: the routes, the membership check and the capability guard
// are the product's own; only the database is the in-memory stand-in.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()
const OWNER = { id: fakeId('owner'), token: 'basecur-token-owner' }
const SELLER = { id: fakeId('seller'), token: 'basecur-token-seller' }
const SHOP = fakeId('shop')
const OTHER = fakeId('shop')
const users = new Map<string, { id: string }>([
  [OWNER.token, { id: OWNER.id }],
  [SELLER.token, { id: SELLER.id }],
])

vi.mock('../db', async () => (globalThis as any).__baseCurFakeDb)

const member = (user: string, role: string) => ({
  id: fakeId('member'),
  workspace_id: SHOP,
  user_id: user,
  role,
  has_access: true,
  suspended_at: null,
  joined_at: '2026-01-01T00:00:00Z',
})

function resetWorld() {
  db.tables.clear()
  db.failures.clear()
  db.seed('workspace_members', [member(OWNER.id, 'owner'), member(SELLER.id, 'seller')])
  db.seed('workspaces', [
    { id: SHOP, base_currency: 'AFN' },
    { id: OTHER, base_currency: 'USD' },
  ])
  for (const table of ['invoices', 'payments', 'journal_entries', 'transactions']) {
    db.seed(table, [])
  }
}

let app: FastifyInstance
let base: typeof import('../services/base-currency')

beforeAll(async () => {
  ;(globalThis as any).__baseCurFakeDb = createFakeDb(db, users)
  resetWorld()
  base = await import('../services/base-currency')
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
}, 60_000)

afterAll(async () => {
  await app?.close()
})

beforeEach(() => resetWorld())

const as = (who: { token: string }) => ({
  authorization: `Bearer ${who.token}`,
  'x-workspace-id': SHOP,
})
const read = (who = OWNER) =>
  app.inject({ method: 'GET', url: '/api/finance/currency/base', headers: as(who) })
const set = (currency: string, who = OWNER) =>
  app.inject({
    method: 'PUT',
    url: '/api/finance/currency/base',
    headers: as(who),
    payload: { currency },
  })

describe('the base currency of a business', () => {
  it('is the stored value, and can be changed while the books are empty', async () => {
    expect(JSON.parse((await read()).body)).toEqual({
      currency: 'AFN',
      configurable: true,
      changeable: true,
    })

    const changed = await set('IRT')
    expect(changed.statusCode, changed.body).toBe(200)
    expect(await base.baseCurrencyOf(SHOP)).toBe('IRT')
    // Another business's is its own.
    expect(await base.baseCurrencyOf(OTHER)).toBe('USD')
  })

  it('⚠️ is LOCKED once one financial document exists — renaming would relabel every amount', async () => {
    db.seed('invoices', [{ id: fakeId('invoice'), workspace_id: SHOP, total: 100 }])

    expect(JSON.parse((await read()).body)).toMatchObject({ currency: 'AFN', changeable: false })
    const refused = await set('USD')
    expect(refused.statusCode).toBe(409)
    expect(refused.body).toContain('BASE_CURRENCY_LOCKED')
    expect(await base.baseCurrencyOf(SHOP)).toBe('AFN')
  })

  it('the documents of ANOTHER business do not lock this one', async () => {
    db.seed('invoices', [{ id: fakeId('invoice'), workspace_id: OTHER, total: 100 }])
    expect((await set('IRT')).statusCode).toBe(200)
  })

  it('a code the product does not support is refused', async () => {
    const refused = await set('ZZZ')
    expect(refused.statusCode).toBeGreaterThanOrEqual(400)
    expect(await base.baseCurrencyOf(SHOP)).toBe('AFN')
  })

  it('a seller may read it and may not set it', async () => {
    expect((await read(SELLER)).statusCode).toBe(200)
    expect((await set('IRT', SELLER)).statusCode).toBe(403)
    expect(await base.baseCurrencyOf(SHOP)).toBe('AFN')
  })

  it('⚠️ a database without the column answers AFN; a read that FAILS does not', async () => {
    db.fail('workspaces', {
      code: '42703',
      message: 'column workspaces.base_currency does not exist',
    })
    expect(await base.baseCurrencyOf(SHOP)).toBe('AFN')
    expect(JSON.parse((await read()).body)).toMatchObject({
      configurable: false,
      changeable: false,
    })
    expect((await set('IRT')).body).toContain('BASE_CURRENCY_SCHEMA_REQUIRED')

    db.fail('workspaces', { code: '57014', message: 'statement timeout' })
    await expect(base.baseCurrencyOf(SHOP)).rejects.toThrow()
  })
})
