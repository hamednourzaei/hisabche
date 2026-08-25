// ============================================
// Local cache workspace switching.
//
// The desktop cache holds no workspace column. Its tables are filled from REST
// endpoints already scoped to the caller's authorized workspace, so every row
// is correct for whichever workspace was active at pull time — and stays on
// disk when the user switches to another one.
//
// Two properties matter here, and they pull in opposite directions:
//
//   * switching workspace must DISCARD the previous business's cached rows, or
//     the app shows the wrong books with no network involved at all;
//   * switching must NOT discard queued offline mutations, which exist nowhere
//     but this device and are the one thing here that cannot be refetched.
//
// The second is why this is not simply "delete everything".
//
// ---------------------------------------------------------------------------
// WHY node:sqlite AND NOT better-sqlite3
//
// better-sqlite3 is a native module compiled against ELECTRON's Node ABI
// (NODE_MODULE_VERSION 125); jest runs on the system Node (127), so requiring
// it here throws. The first version of this file guarded every test with
// `if (!available) return` — which reported seven green tests that asserted
// nothing whatsoever. A silent no-op suite is worse than no suite.
//
// Node ships SQLite built in, so the module is driven through its
// `initDatabaseWith` seam against a REAL in-memory database. The SQL, the
// transaction and the DELETEs are genuinely executed; only the binding
// differs. `node:sqlite` has no `.pragma()` or `.transaction()`, so the small
// adapter below supplies them.
// ============================================

import { DatabaseSync } from 'node:sqlite'

jest.mock('electron', () => ({
  app: { getPath: () => '/tmp', isPackaged: false },
}))

import {
  closeDatabase,
  enqueue,
  getCachedWorkspace,
  getCursor,
  initDatabaseWith,
  isReady,
  query,
  readQueue,
  resolveQueue,
  setCachedWorkspace,
  setCursor,
  upsertMany,
} from '../database'

/** better-sqlite3's surface, over Node's built-in SQLite. */
class TestDriver {
  private db: DatabaseSync

  constructor(path: string) {
    this.db = new DatabaseSync(path)
  }

  prepare(sql: string) {
    const statement = this.db.prepare(sql)
    return {
      all: (...params: unknown[]) => statement.all(...(params as never[])),
      get: (...params: unknown[]) => statement.get(...(params as never[])),
      run: (...params: unknown[]) => statement.run(...(params as never[])),
    }
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  pragma(sql: string): unknown {
    // WAL is meaningless for :memory: and journal_mode is not settable there;
    // running it as a statement keeps the call site unchanged either way.
    try {
      this.db.exec(`PRAGMA ${sql}`)
    } catch {
      /* ignore — pragmas are tuning, not behaviour under test */
    }
    return null
  }

  /** Real BEGIN/COMMIT, so a failure mid-purge genuinely rolls back. */
  transaction<T extends (...args: never[]) => unknown>(fn: T): T {
    return ((...args: never[]) => {
      this.db.exec('BEGIN')
      try {
        const result = fn(...args)
        this.db.exec('COMMIT')
        return result
      } catch (error) {
        this.db.exec('ROLLBACK')
        throw error
      }
    }) as T
  }

  close(): void {
    this.db.close()
  }
}

const WS_A = 'workspace-a'
const WS_B = 'workspace-b'

beforeEach(() => {
  closeDatabase()
  const opened = initDatabaseWith(TestDriver as never, ':memory:')

  // No silent skip. If the database cannot open, these tests must fail rather
  // than pass while asserting nothing.
  expect(opened).toBe(true)
  expect(isReady()).toBe(true)

  setCachedWorkspace(WS_A)
})

afterEach(() => {
  closeDatabase()
})

function seedCustomer(id: string, name: string): void {
  upsertMany('customer', [
    {
      id,
      full_name: name,
      phone: '',
      email: '',
      // NOT NULL in the schema. The first version of this fixture omitted it
      // and every seed threw — which is how we know the writes are real.
      updated_at: '2025-01-01T00:00:00.000Z',
    },
  ])
}

function customerCount(): number {
  // `limit` and `offset` are bound as SQL parameters and have no defaults
  // inside query() — the Zod schema supplies them at the IPC boundary, which
  // this test calls past. Omitting `offset` binds undefined and throws.
  return query({ table: 'customer', limit: 100, offset: 0, direction: 'desc' } as never).length
}

/* ═══════════════════════════════════════════════════════════════════════════
   The purge
   ═══════════════════════════════════════════════════════════════════════════ */

describe('switching workspace clears the previous workspace cache', () => {
  it('records which workspace the cache belongs to', () => {
    expect(getCachedWorkspace()).toBe(WS_A)
  })

  it('seeds a row that the later assertions depend on', () => {
    // Proves the fixture actually writes, so "0 rows after a purge" cannot be
    // satisfied by a seed that never worked.
    seedCustomer('c1', 'مشتری الف')
    expect(customerCount()).toBe(1)
  })

  it('is a no-op when the workspace has not changed', () => {
    seedCustomer('c1', 'مشتری الف')

    const result = setCachedWorkspace(WS_A)

    expect(result.purged).toBe(false)
    // Re-pointing at the same workspace must not throw away a valid cache —
    // that would refetch everything on every app start.
    expect(customerCount()).toBe(1)
  })

  it('discards the previous workspace rows on a real switch', () => {
    seedCustomer('c1', 'مشتری الف')

    const result = setCachedWorkspace(WS_B)

    expect(result.purged).toBe(true)
    expect(getCachedWorkspace()).toBe(WS_B)
    // The leak this closes: workspace B's user opens the app offline and reads
    // workspace A's customers.
    expect(customerCount()).toBe(0)
  })

  it('resets the pull cursors so the new workspace refetches from scratch', () => {
    setCursor('customer', '2025-01-01T00:00:00.000Z')
    expect(getCursor('customer')).toBe('2025-01-01T00:00:00.000Z')

    setCachedWorkspace(WS_B)

    // A surviving cursor would make the new workspace skip everything older
    // than the other workspace's last pull — a permanent, silent hole.
    expect(getCursor('customer')).toBeNull()
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Unsynced work
   ═══════════════════════════════════════════════════════════════════════════ */

describe('unsynced offline work is never destroyed by a switch', () => {
  function queueOne(): void {
    enqueue({
      entity: 'customer',
      operation: 'create',
      clientId: 'pending-1',
      payload: { id: 'c1', full_name: 'مشتری الف' },
    })
  }

  it('refuses to switch while mutations are queued', () => {
    queueOne()

    const result = setCachedWorkspace(WS_B)

    expect(result).toEqual({ purged: false, blockedByPendingMutations: 1 })
  })

  it('leaves the cache and the queue exactly as they were when it refuses', () => {
    seedCustomer('c1', 'مشتری الف')
    queueOne()

    setCachedWorkspace(WS_B)

    // A shopkeeper who wrote invoices on a plane must not lose them by tapping
    // a workspace switcher on landing.
    expect(getCachedWorkspace()).toBe(WS_A)
    expect(customerCount()).toBe(1)
    expect(readQueue()).toHaveLength(1)
  })

  it('allows the switch once the queue is drained', () => {
    queueOne()
    resolveQueue('pending-1', 'done')

    expect(setCachedWorkspace(WS_B)).toEqual({ purged: true, blockedByPendingMutations: 0 })
  })

  it('does not block the very first workspace claim', () => {
    // A fresh install has no previous workspace, so there is nothing to purge
    // and nothing to protect — queued work here belongs to the workspace being
    // claimed, not to a different one.
    closeDatabase()
    initDatabaseWith(TestDriver as never, ':memory:')
    queueOne()

    expect(setCachedWorkspace(WS_A)).toEqual({ purged: false, blockedByPendingMutations: 0 })
    expect(readQueue()).toHaveLength(1)
  })
})
