// ============================================
// backend/src/__tests__/order-deposit-sync-pull.test.ts
//
// The server half of «a deposit taken at one counter is visible at the next».
//
// Three things are proved here, against the real `SyncService`:
//
//   1. `snapshot` walks each of the three deposit entities with the LEAN pull
//      columns and the caller's workspace — never '*' and never another
//      tenant's rows.
//   2. `pull` hydrates the movement rows into the same page as the receipt, so
//      a device that receives a deposit also receives what has been spent from
//      it (and the change is skipped for the device that produced it).
//   3. `/sync/push` refuses all three BY NAME. A movement is one locked
//      Postgres transaction; a row inserted through the generic road would be
//      a balance with no payment and no ledger entry behind it.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const tables = new Map<string, Row[]>()
/** Every table a select walked, with the columns it asked for. */
const selects: Array<{ table: string; columns: string; workspace: unknown }> = []
/** Every table an insert attempted. */
const inserts: string[] = []

function rowsOf(table: string): Row[] {
  const existing = tables.get(table)
  if (existing) return existing
  const made: Row[] = []
  tables.set(table, made)
  return made
}

class FakeQuery {
  private readonly filters: Array<(row: Row) => boolean> = []
  private sort: { column: string; ascending: boolean } | null = null
  private take: number | null = null
  private wantsSingle = false
  private columns = ''
  private written: Row[] | null = null

  constructor(private readonly table: string) {}

  select(columns: string): this {
    this.columns = columns
    return this
  }

  insert(values: unknown): this {
    const incoming = Array.isArray(values) ? (values as Row[]) : [values as Row]
    const target = rowsOf(this.table)
    const made: Row[] = []
    for (const value of incoming) {
      if (value.id !== undefined && target.some((row) => row.id === value.id)) {
        this.written = null
        throw Object.assign(new Error('duplicate key'), { code: '23505' })
      }
      const row = { version: 1, ...value }
      target.push(row)
      made.push(row)
    }
    inserts.push(this.table)
    this.written = made
    return this
  }

  update(values: unknown): this {
    const patch = values as Row
    for (const row of this.matching()) Object.assign(row, patch)
    this.written = this.matching()
    return this
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value)
    if (column === 'workspace_id') this.workspaceFilter = value
    return this
  }

  in(column: string, values: unknown[]): this {
    this.filters.push((row) => values.includes(row[column]))
    return this
  }

  gt(column: string, value: unknown): this {
    this.filters.push((row) => Number(row[column]) > Number(value))
    return this
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.sort = { column, ascending: options?.ascending !== false }
    return this
  }

  limit(count: number): this {
    this.take = count
    return this
  }

  maybeSingle(): this {
    this.wantsSingle = true
    return this
  }

  single(): this {
    this.wantsSingle = true
    return this
  }

  private workspaceFilter: unknown = null

  private matching(): Row[] {
    return rowsOf(this.table).filter((row) => this.filters.every((pass) => pass(row)))
  }

  private run(): { data: Row[] | Row | null; error: null } {
    if (this.written) {
      return { data: this.wantsSingle ? (this.written[0] ?? null) : this.written, error: null }
    }

    if (this.columns) {
      selects.push({ table: this.table, columns: this.columns, workspace: this.workspaceFilter })
    }

    let rows = this.matching()
    if (this.sort) {
      const { column, ascending } = this.sort
      rows = [...rows].sort((a, b) => {
        const left = String(a[column] ?? '')
        const right = String(b[column] ?? '')
        return ascending ? left.localeCompare(right) : right.localeCompare(left)
      })
    }
    if (this.take !== null) rows = rows.slice(0, this.take)
    // PostgREST sends only the named columns; the fake does the same, or a
    // test would «prove» a field travels when it does not.
    if (this.columns && this.columns !== '*') {
      const wanted = this.columns.split(',').map((name) => name.trim())
      rows = rows.map((row) => {
        const projected: Row = {}
        for (const name of wanted) projected[name] = row[name]
        return projected
      })
    }
    return { data: this.wantsSingle ? (rows[0] ?? null) : rows, error: null }
  }

  // `await query` needs a callable `then`; the service uses both `await` and
  // `.then`-free destructuring.
  then<T>(onFulfilled?: (value: { data: Row[] | Row | null; error: null }) => T): Promise<T> {
    return Promise.resolve(this.run()).then(onFulfilled as (value: unknown) => T)
  }
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => new FakeQuery(table),
    rpc: async (name: string, params: Record<string, unknown>) => {
      if (name === 'sync_pull_changes') {
        const cursor = Number(params.p_cursor ?? 0)
        const limit = Number(params.p_limit ?? 100)
        const workspace = String(params.p_workspace_id ?? '')
        const rows = rowsOf('sync_change_log')
          .filter((row) => row.workspace_id === workspace && Number(row.sync_version) > cursor)
          .sort((a, b) => Number(a.sync_version) - Number(b.sync_version))
          .slice(0, limit)
        return { data: rows, error: null }
      }
      return { data: null, error: null }
    },
  },
}))

const { syncService } = await import('../services/sync.service')
const { PULL_COLUMNS } = await import('../services/sync.service')

const WS_A = '11111111-1111-4111-8111-111111111111'
const WS_B = '99999999-9999-4999-8999-999999999999'
const ORDER = '22222222-2222-4222-8222-222222222222'
const CUSTOMER = '33333333-3333-4333-8333-333333333333'
const INVOICE = '44444444-4444-4444-8444-444444444444'

const DEPOSIT = '55555555-5555-4555-8555-555555555555'
const APPLICATION = '66666666-6666-4666-8666-666666666666'
const REFUND = '77777777-7777-4777-8777-777777777777'

const OWNER = {
  userId: '88888888-8888-4888-8888-888888888888',
  workspaceId: WS_A,
  deviceId: 'device-a',
  role: 'owner' as const,
}

function seed(): void {
  tables.clear()
  selects.length = 0
  inserts.length = 0

  rowsOf('order_deposits').push({
    id: DEPOSIT,
    workspace_id: WS_A,
    version: 1,
    order_id: ORDER,
    customer_id: CUSTOMER,
    amount_minor: 100_000,
    payment_method: 'cash',
    applied_invoice_id: INVOICE,
    currency: 'AFN',
    posting_status: 'posted',
    journal_entry_id: 'aaaaaaaa-0000-4000-8000-000000000001',
    created_at: '2026-11-01T08:00:00.000Z',
  })
  // Another tenant's deposit: same shape, must never leave this server.
  rowsOf('order_deposits').push({
    id: '55555555-5555-4555-8555-00000000000b',
    workspace_id: WS_B,
    version: 1,
    order_id: ORDER,
    customer_id: CUSTOMER,
    amount_minor: 999_999,
    payment_method: 'cash',
    applied_invoice_id: null,
    currency: 'USD',
    posting_status: 'posted',
    created_at: '2026-11-01T08:00:00.000Z',
  })

  rowsOf('order_deposit_applications').push({
    id: APPLICATION,
    workspace_id: WS_A,
    version: 1,
    deposit_id: DEPOSIT,
    invoice_id: INVOICE,
    amount_minor: 40_000,
    currency: 'AFN',
    idempotency_key: 'apply-key-0001',
    payment_id: 'bbbbbbbb-0000-4000-8000-000000000002',
    journal_entry_id: 'bbbbbbbb-0000-4000-8000-000000000003',
    created_by: OWNER.userId,
    created_at: '2026-11-02T08:00:00.000Z',
  })

  rowsOf('order_deposit_refunds').push({
    id: REFUND,
    workspace_id: WS_A,
    version: 1,
    deposit_id: DEPOSIT,
    amount_minor: 10_000,
    currency: 'AFN',
    method: 'cash',
    reason: 'بازگشت بخشی از بیعانه',
    idempotency_key: 'refund-key-0001',
    payment_id: 'cccccccc-0000-4000-8000-000000000004',
    journal_entry_id: 'cccccccc-0000-4000-8000-000000000005',
    created_by: OWNER.userId,
    created_at: '2026-11-03T08:00:00.000Z',
  })
}

beforeEach(() => {
  seed()
})

describe('snapshot: the lean pull columns, in this workspace', () => {
  it.each([
    ['order_deposits', 'order_deposits'],
    ['order_deposit_applications', 'order_deposit_applications'],
    ['order_deposit_refunds', 'order_deposit_refunds'],
  ] as const)('%s selects only the declared columns', async (entity, table) => {
    const page = await syncService.snapshot(WS_A, entity, null, 10)

    const columns = PULL_COLUMNS[entity]!.join(', ')
    const walk = selects.find((entry) => entry.table === table)
    expect(walk?.columns).toBe(columns)
    expect(walk?.workspace).toBe(WS_A)
    expect(columns).not.toBe('*')

    // The other workspace's deposit is not in the page.
    expect(page.rows.every((row) => row.workspace_id === WS_A)).toBe(true)
  })

  it('a deposit snapshot carries the fields a device needs, and not the ledger reference', async () => {
    const page = await syncService.snapshot(WS_A, 'order_deposits', null, 10)
    const row = page.rows[0]!

    expect(row.amount_minor).toBe(100_000)
    expect(row.currency).toBe('AFN')
    expect(row.posting_status).toBe('posted')
    expect(row.version).toBe(1)
    // The entry belongs to the books that wrote it; a device that received the
    // server's id would hold a reference to an entry it does not have.
    expect(PULL_COLUMNS.order_deposits).not.toContain('journal_entry_id')
    expect('journal_entry_id' in row).toBe(false)
  })

  it('a movement snapshot carries the idempotency key but no server payment id', async () => {
    const page = await syncService.snapshot(WS_A, 'order_deposit_applications', null, 10)
    const row = page.rows[0]!

    expect(row.idempotency_key).toBe('apply-key-0001')
    expect(row.deposit_id).toBe(DEPOSIT)
    expect(row.amount_minor).toBe(40_000)
    // A device has no such payment; filling it in would make the application
    // invisible to the balance rule (`payment_id IS NULL OR posted`).
    expect(PULL_COLUMNS.order_deposit_applications).not.toContain('payment_id')
    expect('payment_id' in row).toBe(false)
  })
})

describe('pull: a deposit and its movements arrive in one page', () => {
  function log(): void {
    rowsOf('sync_change_log').push(
      {
        sync_version: 1,
        workspace_id: WS_A,
        entity_type: 'order_deposits',
        entity_id: DEPOSIT,
        operation: 'create',
        entity_version: 1,
        origin_device: 'device-a',
        created_at: '2026-11-01T08:00:00.000Z',
      },
      {
        sync_version: 2,
        workspace_id: WS_A,
        entity_type: 'order_deposit_applications',
        entity_id: APPLICATION,
        operation: 'create',
        entity_version: 1,
        origin_device: 'device-b',
        created_at: '2026-11-02T08:00:00.000Z',
      },
      {
        sync_version: 3,
        workspace_id: WS_A,
        entity_type: 'order_deposit_refunds',
        entity_id: REFUND,
        operation: 'create',
        entity_version: 1,
        origin_device: 'device-b',
        created_at: '2026-11-03T08:00:00.000Z',
      },
      // Another workspace's change sits after them: it must never surface.
      {
        sync_version: 4,
        workspace_id: WS_B,
        entity_type: 'order_deposits',
        entity_id: '55555555-5555-4555-8555-00000000000b',
        operation: 'create',
        entity_version: 1,
        origin_device: 'device-z',
        created_at: '2026-11-03T09:00:00.000Z',
      },
    )
  }

  it('device B receives the receipt, the application and the refund', async () => {
    log()

    const page = await syncService.pull(WS_A, 0, 100)

    expect(page.mustRehydrate).toBe(false)
    const byType = new Map(page.changes.map((change) => [change.entityType, change.data]))
    expect(byType.get('order_deposits')?.amount_minor).toBe(100_000)
    expect(byType.get('order_deposit_applications')?.amount_minor).toBe(40_000)
    expect(byType.get('order_deposit_refunds')?.reason).toBe('بازگشت بخشی از بیعانه')
    // The cursor advanced past the last change of THIS workspace.
    expect(page.nextCursor).toBe(3)
    // And nothing from WS_B travelled.
    expect(page.changes.every((change) => change.data?.workspace_id !== WS_B)).toBe(true)
  })

  it('the device that wrote a change does not receive it back', async () => {
    log()

    const page = await syncService.pull(WS_A, 0, 100, 'device-a')

    // Its own receipt is skipped; the two movements made elsewhere still arrive.
    expect(page.changes.map((change) => change.entityType).sort()).toEqual([
      'order_deposit_applications',
      'order_deposit_refunds',
    ])
  })

  it('a failed row read throws instead of arriving as «deleted»', async () => {
    log()
    // Delete the application row behind the log entry: the page must not turn
    // that into a delete instruction.
    tables.set(
      'order_deposit_applications',
      rowsOf('order_deposit_applications').filter((row) => row.id !== APPLICATION),
    )

    const page = await syncService.pull(WS_A, 0, 100)
    const application = page.changes.find(
      (change) => change.entityType === 'order_deposit_applications',
    )
    // The row is gone from the table, so there is no data — but the operation
    // stays `create`, not `delete`: a missing row is not a delete instruction.
    expect(application?.operation).toBe('create')
    expect(application?.data ?? null).toBeNull()
  })
})

describe('push: a movement is never a row write', () => {
  it.each(['order_deposits', 'order_deposit_applications', 'order_deposit_refunds'] as const)(
    'refuses %s by name',
    async (entityType) => {
      inserts.length = 0

      const { results } = await syncService.push(OWNER, [
        {
          mutationId: '99999999-9999-4999-8999-000000000001',
          entityType,
          entityId: DEPOSIT,
          operation: 'create',
          payload: { amount_minor: 100_000, currency: 'AFN' },
        },
      ])
      const result = results[0]

      expect(result?.status).toBe('rejected')
      expect(result?.errorCode).toBe('forbidden')
      expect(result?.errorMessage ?? '').toContain('cannot be written through /sync/push')
      expect(inserts).not.toContain(entityType)
    },
  )
})
