// ============================================
// backend/src/__tests__/http-migration.test.ts
//
// A whole migration over real HTTP: scan → map → dry run → commit → reconcile.
//
// The domain suite proves the parser reads `1.234,50` correctly. This file
// proves the things a pure test cannot see:
//
//   · does the guard actually run, and does a seller get refused?
//   · does the dry run really write nothing?
//   · does a second commit of the same job create a second set of customers?
//   · does re-importing the SAME file twice create twins?
//   · does a second workspace's data stay invisible?
//   · does swapping the file between preview and commit get caught?
//
// The store is a fake, not Postgres. RLS, foreign keys and real transactions
// are proven against a real database by `docs/_verify-rls.sql`, never here.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()

const OWNER = { id: fakeId('owner'), token: 'mig-token-owner' }
const SELLER = { id: fakeId('seller'), token: 'mig-token-seller' }
const OUTSIDER = { id: fakeId('outsider'), token: 'mig-token-outsider' }

const SHOP = fakeId('shop')
const OTHER_SHOP = fakeId('other')

const users = new Map<string, { id: string }>([
  [OWNER.token, { id: OWNER.id }],
  [SELLER.token, { id: SELLER.id }],
  [OUTSIDER.token, { id: OUTSIDER.id }],
])

vi.mock('../db', async () => (globalThis as any).__migrationFakeDb)

/** A small, realistic customer export: a comma inside a quoted name, one
 *  European-format balance, and one duplicate phone written differently. */
const CUSTOMERS_CSV = [
  'name,phone,balance',
  '"Ahmadi, Karim",0700123456,"1.234,50"',
  'Zahra,+93700999888,0',
].join('\n')

function member(workspaceId: string, userId: string, role: string) {
  return {
    id: fakeId('member'),
    workspace_id: workspaceId,
    user_id: userId,
    role,
    has_access: true,
    suspended_at: null,
    joined_at: '2026-01-01T00:00:00Z',
  }
}

function resetWorld() {
  db.tables.clear()
  db.queries.length = 0

  db.seed('workspace_members', [
    member(SHOP, OWNER.id, 'owner'),
    member(SHOP, SELLER.id, 'seller'),
    member(OTHER_SHOP, OUTSIDER.id, 'owner'),
  ])

  db.seed('customers', [])
  db.seed('products', [])
  db.seed('migration_jobs', [])
  db.seed('migration_records', [])
}

let app: FastifyInstance

beforeAll(async () => {
  const fake = createFakeDb(db, users)
  ;(globalThis as any).__migrationFakeDb = fake

  // Mirrors the unique index the migration creates. Without it the fake would
  // let the identity ledger hold two rows for one source identity, and the
  // idempotency test would pass while production duplicated.
  db.unique('migration_records', ['workspace_id', 'source_entity_type', 'source_identity'])

  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
})

afterAll(async () => {
  await app?.close()
})

beforeEach(() => {
  resetWorld()
})

const auth = (token: string) => ({ authorization: `Bearer ${token}`, 'x-workspace-id': '' })

async function scan(token: string, body: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: '/api/migrations',
    headers: auth(token),
    payload: {
      entity: 'customer',
      sourceType: 'csv',
      filename: 'customers.csv',
      content: CUSTOMERS_CSV,
      ...body,
    },
  })
}

describe('the guard is real', () => {
  it('refuses an anonymous request', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/migrations' })
    expect(response.statusCode).toBeGreaterThanOrEqual(400)
  })

  it('refuses a seller — importing is not a counter operation', async () => {
    const response = await scan(SELLER.token, {})
    expect(response.statusCode).toBeGreaterThanOrEqual(400)
    expect(db.tables.get('customers')).toHaveLength(0)
  })

  it('lets an owner through', async () => {
    const response = await scan(OWNER.token, {})
    expect(response.statusCode).toBe(201)
  })
})

describe('scanning', () => {
  it('reports what the file contains without writing a single customer', async () => {
    const response = await scan(OWNER.token, {})
    const job = response.json()

    expect(job.discovery.rowCount).toBe(2)
    expect(job.discovery.headers).toEqual(['name', 'phone', 'balance'])
    expect(db.tables.get('customers')).toHaveLength(0)
  })

  it('pre-applies only the confident guesses', async () => {
    const job = (await scan(OWNER.token, {})).json()
    // `name` and `phone` are exact; `balance` is an exact alias too.
    expect(job.mapping).toMatchObject({ fullName: 0, phone: 1 })
  })

  it('refuses a zip renamed to .csv rather than parsing gibberish', async () => {
    const response = await scan(OWNER.token, { content: 'PKbinary' })
    expect(response.statusCode).toBeGreaterThanOrEqual(400)
  })
})

describe('mapping', () => {
  it('refuses a column index the file does not have', async () => {
    const job = (await scan(OWNER.token, {})).json()

    const response = await app.inject({
      method: 'PUT',
      url: `/api/migrations/${job.id}/mapping`,
      headers: auth(OWNER.token),
      payload: { mapping: { fullName: 99 } },
    })

    expect(response.statusCode).toBeGreaterThanOrEqual(400)
  })

  it('refuses one column feeding two fields', async () => {
    const job = (await scan(OWNER.token, {})).json()

    const response = await app.inject({
      method: 'PUT',
      url: `/api/migrations/${job.id}/mapping`,
      headers: auth(OWNER.token),
      payload: { mapping: { fullName: 0, notes: 0 } },
    })

    expect(response.statusCode).toBeGreaterThanOrEqual(400)
  })
})

describe('the dry run changes nothing', () => {
  it('reports what it WOULD do and writes no rows', async () => {
    const job = (await scan(OWNER.token, {})).json()

    const response = await app.inject({
      method: 'POST',
      url: `/api/migrations/${job.id}/dry-run`,
      headers: auth(OWNER.token),
      payload: { content: CUSTOMERS_CSV },
    })

    const result = response.json()
    expect(result.dryRun.toCreate).toBe(2)
    expect(result.dryRun.productionDataChanged).toBe(false)
    expect(db.tables.get('customers')).toHaveLength(0)
  })

  it('refuses a DIFFERENT file than the one that was scanned', async () => {
    const job = (await scan(OWNER.token, {})).json()

    const response = await app.inject({
      method: 'POST',
      url: `/api/migrations/${job.id}/dry-run`,
      headers: auth(OWNER.token),
      payload: { content: 'name,phone,balance\nSomebody else,0700000000,0' },
    })

    expect(response.statusCode).toBeGreaterThanOrEqual(400)
  })
})

describe('the commit', () => {
  async function committedJob() {
    const job = (await scan(OWNER.token, {})).json()

    await app.inject({
      method: 'POST',
      url: `/api/migrations/${job.id}/dry-run`,
      headers: auth(OWNER.token),
      payload: { content: CUSTOMERS_CSV },
    })

    const response = await app.inject({
      method: 'POST',
      url: `/api/migrations/${job.id}/commit`,
      headers: auth(OWNER.token),
      payload: { content: CUSTOMERS_CSV },
    })

    return { id: job.id, response }
  }

  it('writes the customers, into the right workspace', async () => {
    const { response } = await committedJob()
    const job = response.json()

    expect(job.status).toBe('completed')
    expect(job.rowsCreated).toBe(2)

    const customers = db.tables.get('customers') ?? []
    expect(customers).toHaveLength(2)
    expect(customers.every((row) => row['workspace_id'] === SHOP)).toBe(true)
  })

  it('keeps the comma that lived inside a quoted name', async () => {
    await committedJob()
    const names = (db.tables.get('customers') ?? []).map((row) => row['full_name'])
    expect(names).toContain('Ahmadi, Karim')
  })

  it('converts 1.234,50 to 1234.5 and not to 1.234', async () => {
    // The whole reason the parser works in minor units. A float parse here
    // would store one and a bit afghani as an opening balance.
    await committedJob()
    const karim = (db.tables.get('customers') ?? []).find(
      (row) => row['full_name'] === 'Ahmadi, Karim',
    )
    expect(karim?.['opening_balance']).toBe(1234.5)
  })

  it('does not turn an opening balance into a debt on its own', async () => {
    // `type: credit` is what makes a balance owed. Guessing it would invent a
    // receivable nobody agreed to.
    await committedJob()
    expect((db.tables.get('customers') ?? []).every((row) => row['type'] === 'cash')).toBe(true)
  })

  it('refuses a SECOND commit of the same job', async () => {
    const { id } = await committedJob()

    const second = await app.inject({
      method: 'POST',
      url: `/api/migrations/${id}/commit`,
      headers: auth(OWNER.token),
      payload: { content: CUSTOMERS_CSV },
    })

    expect(second.statusCode).toBeGreaterThanOrEqual(400)
    expect(db.tables.get('customers')).toHaveLength(2)
  })

  it('records every written row in the identity ledger', async () => {
    await committedJob()

    const ledger = db.tables.get('migration_records') ?? []
    expect(ledger).toHaveLength(2)
    expect(ledger.every((row) => row['workspace_id'] === SHOP)).toBe(true)
    expect(ledger.every((row) => row['outcome'] === 'created')).toBe(true)
  })

  it('reconciles the ledger against the dry run', async () => {
    const { response } = await committedJob()
    const job = response.json()

    expect(job.reconciliation.matched).toBe(true)
    expect(job.reconciliation.lines.find((line: any) => line.measure === 'created')).toMatchObject({
      sourceValue: 2,
      hisabcheValue: 2,
      differenceValue: 0,
    })
  })
})

describe('importing the same file twice', () => {
  it('updates rather than creating twins', async () => {
    // The case a real shopkeeper hits: they import, notice a mistake in the
    // spreadsheet, fix an unrelated column, and import again. Four customers
    // where there should be two is the failure this prevents.
    const run = async () => {
      const job = (await scan(OWNER.token, {})).json()
      await app.inject({
        method: 'POST',
        url: `/api/migrations/${job.id}/dry-run`,
        headers: auth(OWNER.token),
        payload: { content: CUSTOMERS_CSV },
      })
      return app.inject({
        method: 'POST',
        url: `/api/migrations/${job.id}/commit`,
        headers: auth(OWNER.token),
        payload: { content: CUSTOMERS_CSV },
      })
    }

    await run()
    const second = (await run()).json()

    expect(db.tables.get('customers')).toHaveLength(2)
    expect(second.rowsCreated).toBe(0)
    expect(second.rowsUpdated).toBe(2)
  })
})

describe('tenancy', () => {
  it('hides one workspace migration from another', async () => {
    await scan(OWNER.token, {})

    const response = await app.inject({
      method: 'GET',
      url: '/api/migrations',
      headers: auth(OUTSIDER.token),
    })

    expect(response.json()).toEqual([])
  })

  it('refuses to open another workspace job by id', async () => {
    const job = (await scan(OWNER.token, {})).json()

    const response = await app.inject({
      method: 'GET',
      url: `/api/migrations/${job.id}`,
      headers: auth(OUTSIDER.token),
    })

    expect(response.statusCode).toBeGreaterThanOrEqual(400)
  })

  it('never filters by the creator instead of the workspace', async () => {
    // A manager must see a migration a colleague started. Scoping by
    // `user_id` would make the history lie about what happened in the shop.
    await scan(OWNER.token, {})
    db.queries.length = 0

    await app.inject({ method: 'GET', url: '/api/migrations', headers: auth(OWNER.token) })

    const jobQueries = db.queries.filter((query) => query.table === 'migration_jobs')
    expect(jobQueries.length).toBeGreaterThan(0)
    for (const query of jobQueries) {
      // The harness records a filter as `eq:column`.
      expect(query.filters).toContain('eq:workspace_id')
      expect(query.filters.some((filter) => filter.endsWith(':user_id'))).toBe(false)
    }
  })
})
