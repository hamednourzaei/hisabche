/** @jest-environment node */
// ============================================
// Offline Sync Crash Matrix over Real Local SQLite + Real Desktop Sync Engine
// ============================================

import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { TestDriver } from '../../electron/main/db/__tests__/test-driver'

jest.mock('electron', () => ({
  app: { getPath: () => tmpdir(), isPackaged: false },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (v: string) => Buffer.from(v, 'utf8'),
    decryptString: (b: Buffer) => b.toString('utf8'),
  },
}))

import * as db from '../../electron/main/db/database'

jest.mock('@/shared/lib/bridge', () => ({
  bridge: () => ({
    db: {
      queue: async () => db.readQueue(),
      resolveQueue: async (id: string, status: 'done' | 'failed', err?: string) =>
        db.resolveQueue(id, status, err),
      enqueue: async (entry: Parameters<typeof db.enqueue>[0]) => db.enqueue(entry),
      upsertMany: async (
        table: Parameters<typeof db.upsertMany>[0],
        rows: Array<Record<string, unknown>>,
      ) => db.upsertMany(table, rows),
      removeMany: async (table: Parameters<typeof db.removeMany>[0], ids: string[]) =>
        db.removeMany(table, ids),
      query: async (q: Parameters<typeof db.query>[0]) => db.query(q),
      getCursor: async (entity: Parameters<typeof db.getCursor>[0]) => db.getCursor(entity),
      setCursor: async (entity: Parameters<typeof db.setCursor>[0], value: string) =>
        db.setCursor(entity, value),
      claimQueueItem: async (clientId: string, owner: string, leaseMs: number) =>
        db.claimQueue(clientId, owner, leaseMs),
      markTableSynced: async (ws: string, table: string, at: string) =>
        db.markTableSynced(ws, table, at),
      syncedTables: async (ws: string) => db.syncedTables(ws),
      getCachedWorkspace: async () => db.getCachedWorkspace(),
      setCachedWorkspace: async (ws: string) => db.setCachedWorkspace(ws),
    },
  }),
}))

type PostHandler = (
  url: string,
  body?: unknown,
  config?: Record<string, unknown>,
) => Promise<unknown>
type GetHandler = (url?: string, config?: Record<string, unknown>) => Promise<unknown>

let postHandler: PostHandler = async () => ({ data: { id: 'ok', version: 1 } })
let getHandler: GetHandler = async () => ({
  data: new TextEncoder().encode(JSON.stringify({ cursor: '10', hasMore: false, changes: [] }))
    .buffer,
  headers: { 'content-type': 'application/json' },
})

jest.mock('@/shared/lib/api', () => ({
  API_BASE_URL: 'https://api.test/api',
  apiClient: {
    get: (url: string, config?: Record<string, unknown>) => getHandler(url, config),
    post: (url: string, body?: unknown, config?: Record<string, unknown>) =>
      postHandler(url, body, config),
    put: (url: string, body?: unknown, config?: Record<string, unknown>) =>
      postHandler(url, body, config),
    patch: (url: string, body?: unknown, config?: Record<string, unknown>) =>
      postHandler(url, body, config),
    delete: (url: string, config?: Record<string, unknown>) => postHandler(url, undefined, config),
  },
}))

jest.mock('@hisabche/api', () => ({
  invoiceKeys: { all: ['invoices'] },
  customerKeys: { all: ['customers'] },
  productKeys: { all: ['products'] },
  dashboardKeys: { all: ['dashboard'] },
  getToken: () => 'valid-token',
  getAppEdition: () => 'online',
  WORKSPACE_HEADER: 'x-workspace-id',
  localRequest: jest.fn(),
}))

jest.mock('@hisabche/store', () => ({
  useWorkspaceStore: { getState: () => ({ workspaceId: 'ws-crash-1' }) },
  useCurrencyStore: { getState: () => ({ primaryCurrency: 'AFN' }) },
  useAuthStore: { getState: () => ({ user: { id: 'user-1' } }) },
  useSyncStore: { getState: () => ({ setLastSynced: () => undefined }) },
}))

import { runSync } from '@/features/sync/sync-engine'

describe('Offline Sync Crash Matrix (Real SQLite + Real Sync Engine)', () => {
  let dir: string
  let dbPath: string
  const qc = { invalidateQueries: jest.fn(async () => undefined) } as never

  beforeEach(() => {
    db.closeDatabase()
    dir = mkdtempSync(join(tmpdir(), 'hisabche-sync-crash-'))
    dbPath = join(dir, 'sync.db')
    expect(db.initDatabaseWith(TestDriver as never, dbPath)).toBe(true)
    db.setCachedWorkspace('ws-crash-1')
    getHandler = async () => ({
      data: new TextEncoder().encode(JSON.stringify({ cursor: '10', hasMore: false, changes: [] }))
        .buffer,
      headers: { 'content-type': 'application/json' },
    })
  })

  afterEach(() => {
    db.closeDatabase()
    rmSync(dir, { recursive: true, force: true })
  })

  it('1-5. Survives crash after outbox write, during network drop, and after server commit before local ACK with idempotency', async () => {
    const serverApplied = new Map<string, number>()

    // Write invoice to real SQLite outbox
    db.enqueue({
      clientId: 'inv-crash-1',
      entity: 'invoice',
      operation: 'create',
      payload: { id: 'inv-001', total: 1200, currency: 'AFN' },
      userId: 'user-1',
      workspaceId: 'ws-crash-1',
    })
    expect(db.readQueue()).toHaveLength(1)

    // Simulate process restart (close & reopen same SQLite file)
    db.closeDatabase()
    expect(db.initDatabaseWith(TestDriver as never, dbPath)).toBe(true)
    expect(db.readQueue()).toHaveLength(1)

    // Server commits the mutation, then network drops before client receives ACK
    postHandler = async (_url, body, config) => {
      const key = (config?.headers as Record<string, string>)['Idempotency-Key']!
      serverApplied.set(key, (serverApplied.get(key) ?? 0) + 1)
      throw new Error('ECONNRESET after server commit')
    }

    await runSync(qc)
    // Outbox entry stays intact on disk with attempts=1
    const afterDrop = db.readQueue()
    expect(afterDrop).toHaveLength(1)
    expect(afterDrop[0]?.status).toBe('failed')
    expect(afterDrop[0]?.attempts).toBe(1)

    // Reconnect: retry uses exact same Idempotency-Key; server deduplicates & returns 200
    postHandler = async (_url, _body, config) => {
      const key = (config?.headers as Record<string, string>)['Idempotency-Key']!
      expect(key).toBe('inv-crash-1')
      // Idempotent store: already committed once
      return { data: { id: 'inv-001', version: 1 } }
    }

    await runSync(qc)
    expect(db.readQueue()).toHaveLength(0)
    expect(serverApplied.get('inv-crash-1')).toBe(1)
  })

  it('6-7. Rejects stale financial update (409 conflict) without LWW overwrite and keeps visible rejected state', async () => {
    db.enqueue({
      clientId: 'inv-conflict-1',
      entity: 'invoice',
      operation: 'update',
      payload: { id: 'inv-final-1', total: 9999, expectedVersion: 1 },
      userId: 'user-1',
      workspaceId: 'ws-crash-1',
    })

    postHandler = async () => {
      const err = new Error(
        'VERSION_CONFLICT: finalized financial record cannot be overwritten',
      ) as Error & {
        status?: number
      }
      err.status = 409
      throw err
    }

    await runSync(qc)
    const remaining = db.readQueue()
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.lastError).toContain('REJECTED:')
  })

  it('8-9. Does not advance pull cursor if pull response fails mid-stream', async () => {
    db.setCursor('product', 'cursor-5')

    getHandler = async () => {
      throw new Error('503 Service Unavailable during pull')
    }

    await runSync(qc)
    expect(db.getCursor('product')).toBe('cursor-5')
  })
})
