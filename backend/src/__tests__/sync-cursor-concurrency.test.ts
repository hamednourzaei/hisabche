// ============================================
// backend/src/__tests__/sync-cursor-concurrency.test.ts
//
// Unit tests for Sync Pull Contract & Commit Horizon behavior (N-36):
// Verifies:
// 1. Next cursor advances to highest version of pulled page.
// 2. hasMore is true ONLY when more rows exist AND nextCursor > cursor.
// 3. Gaps between versions do not stall pull progress.
// 4. Cursor behind pruning horizon triggers mustRehydrate.
// 5. Fake RPC returning [] produces changes: [], nextCursor unchanged, and NO direct query.
// 6. RPC "function missing" -> loud error; other error -> thrown.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Row {
  [key: string]: unknown
}

const tables = new Map<string, Row[]>()
let syncChangeLogFallbackQueries = 0
let rpcHandler:
  | ((name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)
  | null = null

function reset(): void {
  tables.clear()
  tables.set('sync_change_log', [])
  tables.set('customers', [])
  syncChangeLogFallbackQueries = 0
  rpcHandler = null
}

function matches(row: Row, filters: Array<[string, unknown]>): boolean {
  return filters.every(([column, value]) => row[column] === value)
}

function makeQuery(table: string) {
  const eqs: Array<[string, unknown]> = []
  let gtFilter: [string, number] | null = null
  let limitCount: number | null = null

  const getRows = () => tables.get(table) ?? (tables.set(table, []), tables.get(table)!)

  const builder: any = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      eqs.push([column, value])
      return builder
    },
    gt: (column: string, value: number) => {
      gtFilter = [column, value]
      if (table === 'sync_change_log') {
        syncChangeLogFallbackQueries++
      }
      return builder
    },
    in: () => builder,
    order: () => builder,
    limit: (n: number) => {
      limitCount = n
      return builder
    },
    maybeSingle: async () => {
      const current = getRows()
      const found = current.find((r) => matches(r, eqs))
      return { data: found ? { ...found } : null, error: null }
    },
    then: (resolve: (result: { data: Row[] | null; error: unknown }) => void) => {
      let current = getRows().filter((r) => matches(r, eqs))
      if (gtFilter) {
        const [col, val] = gtFilter
        current = current.filter((r) => Number(r[col]) > val)
      }
      current.sort((a, b) => Number(a.sync_version ?? 0) - Number(b.sync_version ?? 0))
      if (limitCount !== null) {
        current = current.slice(0, limitCount)
      }
      resolve({ data: current.map((r) => ({ ...r })), error: null })
    },
  }

  return builder
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => makeQuery(table),
    rpc: async (name: string, params: Record<string, unknown>) => {
      if (rpcHandler) return rpcHandler(name, params)
      // Default fake RPC simulates sync_pull_changes using in-memory sync_change_log
      const pLimit = Number(params.p_limit ?? 10)
      const pCursor = Number(params.p_cursor ?? 0)
      const pWs = String(params.p_workspace_id ?? '')
      const rows = (tables.get('sync_change_log') ?? [])
        .filter((r) => r.workspace_id === pWs && Number(r.sync_version) > pCursor)
        .sort((a, b) => Number(a.sync_version) - Number(b.sync_version))
        .slice(0, pLimit)
      return { data: rows, error: null }
    },
  },
}))

describe('N-36: Sync Pull Contract & Horizon Invariants', () => {
  const WORKSPACE_ID = '11111111-1111-1111-1111-111111111111'
  let syncService: any

  beforeEach(async () => {
    reset()
    tables.get('sync_change_log')!.push({
      sync_version: 100,
      workspace_id: WORKSPACE_ID,
      entity_type: 'customer',
      entity_id: 'cust-0',
      operation: 'create',
      entity_version: 1,
      created_at: new Date(Date.now() - 60000).toISOString(),
    })
    const mod = await import('../services/sync.service')
    syncService = mod.syncService
  })

  it('fake RPC returning [] produces changes: [], nextCursor unchanged, and NO direct table query', async () => {
    rpcHandler = async () => ({ data: [], error: null })

    // Reset counter before pull
    syncChangeLogFallbackQueries = 0

    const res = await syncService.pull(WORKSPACE_ID, 100, 10)
    expect(res.changes).toHaveLength(0)
    expect(res.nextCursor).toBe(100)
    expect(res.hasMore).toBe(false)
    expect(res.mustRehydrate).toBe(false)

    // Critical assertion: NO direct table query on sync_change_log was made as a fallback
    expect(syncChangeLogFallbackQueries).toBe(0)
  })

  it('RPC "function missing" (PGRST202) produces loud SyncError instructing migration', async () => {
    rpcHandler = async () => ({
      data: null,
      error: { code: 'PGRST202', message: 'could not find the function public.sync_pull_changes' },
    })

    await expect(syncService.pull(WORKSPACE_ID, 100, 10)).rejects.toThrow(
      'sync_pull_changes missing — apply docs/sync-commit-horizon-migration.sql',
    )
  })

  it('RPC "function missing" (Postgres 42883) produces loud SyncError instructing migration', async () => {
    rpcHandler = async () => ({
      data: null,
      error: { code: '42883', message: 'function sync_pull_changes does not exist' },
    })

    await expect(syncService.pull(WORKSPACE_ID, 100, 10)).rejects.toThrow(
      'sync_pull_changes missing — apply docs/sync-commit-horizon-migration.sql',
    )
  })

  it('RPC other database error is thrown without swallowing or falling back', async () => {
    rpcHandler = async () => ({
      data: null,
      error: { code: '57014', message: 'canceling statement due to statement timeout' },
    })

    await expect(syncService.pull(WORKSPACE_ID, 100, 10)).rejects.toThrow(
      'canceling statement due to statement timeout',
    )
  })

  it('advances nextCursor strictly to highest version of pulled page', async () => {
    tables.get('sync_change_log')!.push(
      {
        sync_version: 101,
        workspace_id: WORKSPACE_ID,
        entity_type: 'customer',
        entity_id: 'cust-1',
        operation: 'create',
        entity_version: 1,
        created_at: new Date().toISOString(),
      },
      {
        sync_version: 102,
        workspace_id: WORKSPACE_ID,
        entity_type: 'customer',
        entity_id: 'cust-2',
        operation: 'create',
        entity_version: 1,
        created_at: new Date().toISOString(),
      },
    )
    tables
      .get('customers')!
      .push(
        { id: 'cust-1', workspace_id: WORKSPACE_ID, name: 'Alice', version: 1 },
        { id: 'cust-2', workspace_id: WORKSPACE_ID, name: 'Bob', version: 1 },
      )

    const res = await syncService.pull(WORKSPACE_ID, 100, 10)
    expect(res.changes).toHaveLength(2)
    expect(res.nextCursor).toBe(102)
    expect(res.hasMore).toBe(false)
    expect(res.mustRehydrate).toBe(false)
  })

  it('progresses over gaps without stalling or client spin', async () => {
    // Gap: version 101 was rolled back or for another tenant, version 102 exists
    tables.get('sync_change_log')!.push({
      sync_version: 102,
      workspace_id: WORKSPACE_ID,
      entity_type: 'customer',
      entity_id: 'cust-2',
      operation: 'create',
      entity_version: 1,
      created_at: new Date().toISOString(),
    })
    tables.get('customers')!.push({
      id: 'cust-2',
      workspace_id: WORKSPACE_ID,
      name: 'Bob',
      version: 1,
    })

    const res = await syncService.pull(WORKSPACE_ID, 100, 10)
    expect(res.changes).toHaveLength(1)
    expect(res.nextCursor).toBe(102)
    expect(res.hasMore).toBe(false)
  })

  it('sets hasMore true ONLY when more rows exist AND progress is possible', async () => {
    tables.get('sync_change_log')!.push(
      {
        sync_version: 101,
        workspace_id: WORKSPACE_ID,
        entity_type: 'customer',
        entity_id: 'cust-1',
        operation: 'create',
        entity_version: 1,
        created_at: new Date().toISOString(),
      },
      {
        sync_version: 102,
        workspace_id: WORKSPACE_ID,
        entity_type: 'customer',
        entity_id: 'cust-2',
        operation: 'create',
        entity_version: 1,
        created_at: new Date().toISOString(),
      },
    )
    tables
      .get('customers')!
      .push(
        { id: 'cust-1', workspace_id: WORKSPACE_ID, name: 'Alice', version: 1 },
        { id: 'cust-2', workspace_id: WORKSPACE_ID, name: 'Bob', version: 1 },
      )

    // Pull with limit 1
    const res = await syncService.pull(WORKSPACE_ID, 100, 1)
    expect(res.changes).toHaveLength(1)
    expect(res.nextCursor).toBe(101)
    expect(res.hasMore).toBe(true)
  })

  it('signals mustRehydrate when cursor is behind retention horizon', async () => {
    // Oldest version in table is 100. Requesting cursor 50 is behind horizon.
    const res = await syncService.pull(WORKSPACE_ID, 50, 10)
    expect(res.mustRehydrate).toBe(true)
    expect(res.changes).toHaveLength(0)
  })
})
