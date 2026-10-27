// ============================================
// backend/src/__tests__/sync-delete-authority.test.ts
//
// Regression tests for N-30: POST /api/sync/push with operation: "delete"
//
// Verifies that:
// 1. Finalized invoices cannot be deleted via sync push.
// 2. Customers, products (with stock), and warehouses (with stock) cannot be deleted.
// 3. Regular/seller tokens cannot bypass domain delete authorization.
// 4. Cross-tenant: Workspace A cannot delete Workspace B entities.
// 5. Rejected delete leaves ledger, stock movements, balances, and sync_change_log untouched.
// 6. Rejection is recorded in sync_mutations idempotently (replay gives same outcome).
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Row {
  [key: string]: unknown
}

const tables = new Map<string, Row[]>()
let sequence = 0

function reset(): void {
  tables.clear()
  for (const name of [
    'invoices',
    'customers',
    'products',
    'warehouses',
    'warehouse_stock',
    'stock_movements',
    'journal_entries',
    'transactions',
    'sync_change_log',
    'sync_mutations',
  ]) {
    tables.set(name, [])
  }
  sequence = 0
}

function matches(row: Row, filters: Array<[string, unknown]>): boolean {
  return filters.every(([column, value]) => row[column] === value)
}

function makeQuery(table: string) {
  const eqs: Array<[string, unknown]> = []
  let pending: { kind: 'insert' | 'update' | 'delete'; values?: Row | Row[] } | null = null

  const rows = () => tables.get(table) ?? (tables.set(table, []), tables.get(table)!)

  const api = {
    select: () => api,
    eq: (column: string, value: unknown) => {
      eqs.push([column, value])
      return api
    },
    gt: () => api,
    in: () => api,
    order: () => api,
    limit: () => api,
    insert: (values: Row | Row[]) => {
      pending = { kind: 'insert', values }
      return api
    },
    update: (values: Row) => {
      pending = { kind: 'update', values }
      return api
    },
    delete: () => {
      pending = { kind: 'delete' }
      return api
    },
    maybeSingle: async () => {
      const found = rows().filter((r) => matches(r, eqs))
      return { data: found[0] ?? null, error: null }
    },
    single: async () => {
      const outcome = await api.commit()
      const list = Array.isArray(outcome.data) ? outcome.data : [outcome.data]
      return outcome.error ? outcome : { data: list[0] ?? null, error: null }
    },
    then: (resolve: (v: { data: unknown; error: unknown }) => unknown) =>
      api.commit().then(resolve),
    commit: async (): Promise<{
      data: unknown
      error: { code?: string; message: string } | null
    }> => {
      if (!pending) {
        return { data: rows().filter((r) => matches(r, eqs)), error: null }
      }

      if (pending.kind === 'insert') {
        const incoming = Array.isArray(pending.values) ? pending.values : [pending.values!]
        const inserted: Row[] = []
        for (const value of incoming) {
          const keyColumn = table === 'sync_mutations' ? 'mutation_id' : 'id'
          const key = value[keyColumn]
          if (key !== undefined && rows().some((r) => r[keyColumn] === key)) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } }
          }
          const row: Row = { version: 1, ...value }
          rows().push(row)
          inserted.push(row)
        }
        return { data: inserted, error: null }
      }

      if (pending.kind === 'delete') {
        const doomed = rows().filter((r) => matches(r, eqs))
        for (const row of doomed) {
          rows().splice(rows().indexOf(row), 1)
        }
        return { data: doomed, error: null }
      }

      return { data: null, error: null }
    },
  }

  return api
}

vi.mock('../db', () => ({
  supabase: { from: (table: string) => makeQuery(table) },
}))

const { syncService } = await import('../services/sync.service')

const WORKSPACE_A = '11111111-1111-4111-8111-111111111111'
const WORKSPACE_B = '22222222-2222-4222-8222-222222222222'

const ACTOR_A = {
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  workspaceId: WORKSPACE_A,
  deviceId: 'device-a',
}

const SELLER_ACTOR_A = {
  userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  workspaceId: WORKSPACE_A,
  deviceId: 'device-seller',
}

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

beforeEach(reset)

describe('N-30 — sync delete authority and entity immutability', () => {
  it('finalized invoice is not deletable through /sync/push', async () => {
    tables.get('invoices')!.push({
      id: uuid(101),
      workspace_id: WORKSPACE_A,
      number: 'INV-2026-001',
      total: 150000,
      finalized_at: '2026-10-26T10:00:00Z',
      version: 1,
    })

    const result = await syncService.push(ACTOR_A, [
      {
        mutationId: uuid(1),
        entityType: 'invoice',
        entityId: uuid(101),
        operation: 'delete',
        payload: {},
      },
    ])

    expect(result.results[0]?.status).toBe('rejected')
    expect(result.results[0]?.errorCode).toBe('forbidden')
    // Invoice must remain in database
    expect(tables.get('invoices')!.some((i) => i.id === uuid(101))).toBe(true)
  })

  it('customer, product with stock history, and warehouse with stock are not deletable through sync', async () => {
    // Seed customer
    tables.get('customers')!.push({
      id: uuid(201),
      workspace_id: WORKSPACE_A,
      name: 'مشتری الف',
      version: 1,
    })

    // Seed product with stock
    tables.get('products')!.push({
      id: uuid(202),
      workspace_id: WORKSPACE_A,
      name: 'کالای تست',
      version: 1,
    })
    tables.get('stock_movements')!.push({
      id: uuid(301),
      workspace_id: WORKSPACE_A,
      product_id: uuid(202),
      quantity: 50,
    })

    // Seed warehouse with stock
    tables.get('warehouses')!.push({
      id: uuid(203),
      workspace_id: WORKSPACE_A,
      name: 'انبار مرکزی',
      version: 1,
    })
    tables.get('warehouse_stock')!.push({
      id: uuid(302),
      workspace_id: WORKSPACE_A,
      warehouse_id: uuid(203),
      product_id: uuid(202),
      quantity: 50,
    })

    const result = await syncService.push(ACTOR_A, [
      {
        mutationId: uuid(2),
        entityType: 'customer',
        entityId: uuid(201),
        operation: 'delete',
        payload: {},
      },
      {
        mutationId: uuid(3),
        entityType: 'product',
        entityId: uuid(202),
        operation: 'delete',
        payload: {},
      },
      {
        mutationId: uuid(4),
        entityType: 'warehouse',
        entityId: uuid(203),
        operation: 'delete',
        payload: {},
      },
    ])

    expect(result.results[0]?.status).toBe('rejected')
    expect(result.results[1]?.status).toBe('rejected')
    expect(result.results[2]?.status).toBe('rejected')

    expect(tables.get('customers')!.some((c) => c.id === uuid(201))).toBe(true)
    expect(tables.get('products')!.some((p) => p.id === uuid(202))).toBe(true)
    expect(tables.get('warehouses')!.some((w) => w.id === uuid(203))).toBe(true)
  })

  it('seller token cannot delete any entity through sync push', async () => {
    tables.get('invoices')!.push({
      id: uuid(102),
      workspace_id: WORKSPACE_A,
      total: 5000,
      version: 1,
    })

    const result = await syncService.push(SELLER_ACTOR_A, [
      {
        mutationId: uuid(5),
        entityType: 'invoice',
        entityId: uuid(102),
        operation: 'delete',
        payload: {},
      },
    ])

    expect(result.results[0]?.status).toBe('rejected')
    expect(result.results[0]?.errorCode).toBe('forbidden')
    expect(tables.get('invoices')!.some((i) => i.id === uuid(102))).toBe(true)
  })

  it('workspace A cannot delete an entity belonging to workspace B', async () => {
    tables.get('invoices')!.push({
      id: uuid(999),
      workspace_id: WORKSPACE_B,
      total: 20000,
      version: 1,
    })

    const result = await syncService.push(ACTOR_A, [
      {
        mutationId: uuid(6),
        entityType: 'invoice',
        entityId: uuid(999),
        operation: 'delete',
        payload: {},
      },
    ])

    expect(result.results[0]?.status).toBe('rejected')
    expect(tables.get('invoices')!.some((i) => i.id === uuid(999))).toBe(true)
  })

  it('a rejected delete leaves ledger, stock movements, balances and sync_change_log untouched', async () => {
    tables.get('invoices')!.push({
      id: uuid(103),
      workspace_id: WORKSPACE_A,
      total: 75000,
      version: 1,
    })
    tables.get('journal_entries')!.push({
      id: uuid(501),
      workspace_id: WORKSPACE_A,
      source_id: uuid(103),
      amount: 75000,
    })
    tables.get('stock_movements')!.push({
      id: uuid(502),
      workspace_id: WORKSPACE_A,
      document_id: uuid(103),
      quantity: 10,
    })

    const initialLedgerCount = tables.get('journal_entries')!.length
    const initialMovementsCount = tables.get('stock_movements')!.length
    const initialChangeLogCount = tables.get('sync_change_log')!.length

    const result = await syncService.push(ACTOR_A, [
      {
        mutationId: uuid(7),
        entityType: 'invoice',
        entityId: uuid(103),
        operation: 'delete',
        payload: {},
      },
    ])

    expect(result.results[0]?.status).toBe('rejected')
    expect(tables.get('journal_entries')!.length).toBe(initialLedgerCount)
    expect(tables.get('stock_movements')!.length).toBe(initialMovementsCount)
    expect(tables.get('sync_change_log')!.length).toBe(initialChangeLogCount)
  })

  it('rejection is recorded in sync_mutations idempotently (same mutation_id replay → same rejection)', async () => {
    tables.get('customers')!.push({
      id: uuid(205),
      workspace_id: WORKSPACE_A,
      name: 'مشتری ثابت',
      version: 1,
    })

    const mutation = {
      mutationId: uuid(8),
      entityType: 'customer' as const,
      entityId: uuid(205),
      operation: 'delete' as const,
      payload: {},
    }

    const firstRun = await syncService.push(ACTOR_A, [mutation])
    expect(firstRun.results[0]?.status).toBe('rejected')
    expect(firstRun.results[0]?.errorCode).toBe('forbidden')

    // Replay with identical mutationId
    const replay = await syncService.push(ACTOR_A, [mutation])
    expect(replay.results[0]?.status).toBe('rejected')
    expect(replay.results[0]?.errorCode).toBe('forbidden')
    expect(replay.results[0]?.mutationId).toBe(uuid(8))

    // Confirm recorded in sync_mutations table
    const recorded = tables.get('sync_mutations')!.find((m) => m.mutation_id === uuid(8))
    expect(recorded).toBeDefined()
    expect(recorded?.status).toBe('rejected')
    expect(recorded?.error_code).toBe('forbidden')
  })
})
