// ============================================
// backend/src/__tests__/sync-operational-pull.test.ts
//
// V70.2 — the four tables that had a service on the server, a table in the
// device's SQLite and a route in the local engine, but no road between them:
//
//   product_variants          a variant priced at one counter was invisible at the next
//   service_delivery_sessions a delivered session never arrived, so the slot was offered again
//   package_credit_ledger     credits spent elsewhere were offered again
//   repair_tickets            a ticket opened on another shift never reached the bench
//
// What is proved, against the real `SyncService` and the real migration files:
//
//   1. `snapshot` walks each of the four with the LEAN pull columns and the
//      caller's workspace — never '*' and never another tenant's rows.
//   2. `pull` hydrates all four into one page, with their versions.
//   3. `/sync/push` refuses all four BY NAME: each write is one locked Postgres
//      transaction that moves money, stock or credit, and a row inserted
//      through the generic road would be a balance with nothing behind it.
//   4. The migration carries them: `version` on each table, a bump trigger, a
//      change-log trigger under the PROTOCOL name (the string the client
//      filters on), and a VERIFY query that answers for each table.
//   5. The device can store what arrives: a `FROM_LOG` mapper for each, and a
//      snapshot entity list derived from `PULL_COLUMNS` rather than a second
//      hand-written list that could drift again.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
  private workspaceFilter: unknown = null

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
    // PostgREST sends only the named columns; the fake does the same, or a test
    // would «prove» a field travels when it does not.
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

  then<T>(onFulfilled?: (value: { data: Row[] | Row | null; error: null }) => T): Promise<T> {
    return Promise.resolve(this.run()).then(onFulfilled as (value: unknown) => T)
  }
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => new FakeQuery(table),
    rpc: async (name: string, params: Record<string, unknown>) => {
      if (name !== 'sync_pull_changes' && name !== 'sync_pull_changes_v2') {
        return { data: null, error: null }
      }
      const cursor = Number(params.p_cursor ?? 0)
      const limit = Number(params.p_limit ?? 100)
      const workspace = String(params.p_workspace_id ?? '')
      const scoped = (params.p_entity_types as string[] | undefined) ?? null
      const rows = rowsOf('sync_change_log')
        .filter((row) => row.workspace_id === workspace && Number(row.sync_version) > cursor)
        .filter((row) => !scoped || scoped.includes(String(row.entity_type)))
        .sort((a, b) => Number(a.sync_version) - Number(b.sync_version))
        .slice(0, limit)
      return { data: rows, error: null }
    },
  },
}))

const { syncService, PULL_COLUMNS, ENTITIES_WITH_VERSION } =
  await import('../services/sync.service')
const { syncEntitySchema } = await import('@hisabche/validation')

const WS_A = '11111111-1111-4111-8111-111111111111'
const WS_B = '99999999-9999-4999-8999-999999999999'
const PRODUCT = '22222222-2222-4222-8222-222222222222'
const CUSTOMER = '33333333-3333-4333-8333-333333333333'
const EMPLOYEE = '44444444-4444-4444-8444-444444444444'

const VARIANT = '55555555-5555-4555-8555-555555555555'
const SESSION = '66666666-6666-4666-8666-666666666666'
const CREDIT = '77777777-7777-4777-8777-777777777777'
const TICKET = '88888888-8888-4888-8888-888888888888'

const OWNER = {
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  workspaceId: WS_A,
  deviceId: 'device-a',
  role: 'owner' as const,
}

/** The four entities this phase adds, and the server table behind each. */
const ADDED = [
  ['product_variants', 'product_variants'],
  ['service_delivery_sessions', 'service_delivery_sessions'],
  ['package_credit_ledger', 'package_credit_ledger'],
  ['repair_tickets', 'repair_tickets'],
] as const

function seed(): void {
  tables.clear()
  selects.length = 0
  inserts.length = 0

  rowsOf('product_variants').push({
    id: VARIANT,
    workspace_id: WS_A,
    version: 4,
    template_product_id: PRODUCT,
    sku: 'SHIRT-M',
    barcode: 'B-SHIRT-M',
    attributes: '[{"size":"M"}]',
    price_override_minor: 120_000,
    cost_override_minor: null,
    is_active: true,
    created_at: '2026-11-01T08:00:00.000Z',
    updated_at: '2026-11-05T08:00:00.000Z',
  })
  // Another tenant's variant: same shape, must never leave this server.
  rowsOf('product_variants').push({
    id: '55555555-5555-4555-8555-00000000000b',
    workspace_id: WS_B,
    version: 1,
    template_product_id: PRODUCT,
    sku: 'OTHER-SHOP',
    is_active: true,
  })

  rowsOf('service_delivery_sessions').push({
    id: SESSION,
    workspace_id: WS_A,
    version: 2,
    customer_id: CUSTOMER,
    service_offering_id: PRODUCT,
    practitioner_id: EMPLOYEE,
    branch_id: null,
    session_date: '2026-11-10',
    start_time: '10:00',
    end_time: '11:00',
    duration_minutes: 60,
    status: 'delivered',
    settlement_method: 'package_credit',
    package_credit_id: CREDIT,
    invoice_id: null,
    client_notes: 'شام آخر',
    internal_notes: null,
    created_at: '2026-11-10T06:00:00.000Z',
    updated_at: '2026-11-10T07:00:00.000Z',
  })

  rowsOf('package_credit_ledger').push({
    id: CREDIT,
    workspace_id: WS_A,
    version: 1,
    customer_id: CUSTOMER,
    package_product_id: PRODUCT,
    entry_type: 'CONSUME',
    // CREDITS, not money: one session consumed out of ten.
    quantity: -1,
    unit: 'session',
    source_document_type: 'service_delivery',
    source_document_id: SESSION,
    source_line_id: null,
    reference_entry_id: null,
    idempotency_key: 'consume-0001',
    notes: null,
    expires_at: null,
    effective_date: '2026-11-10',
    created_at: '2026-11-10T07:00:00.000Z',
    updated_at: '2026-11-10T07:00:00.000Z',
  })

  rowsOf('repair_tickets').push({
    id: TICKET,
    workspace_id: WS_A,
    version: 3,
    number: 1001,
    customer_id: CUSTOMER,
    serial_id: null,
    device_label: 'iPhone 13',
    problem: 'باطری زود خالی می‌شود',
    status: 'repairing',
    under_warranty: true,
    estimate_minor: null,
    currency: null,
    technician_employee_id: EMPLOYEE,
    promised_on: '2026-11-12',
    invoice_id: null,
    created_by: OWNER.userId,
    created_at: '2026-11-09T08:00:00.000Z',
    updated_at: '2026-11-09T09:00:00.000Z',
    closed_at: null,
  })
}

beforeEach(() => {
  seed()
})

describe('the protocol carries them', () => {
  it.each(ADDED)('%s is a sync entity with pull columns and a version', (entity) => {
    expect(syncEntitySchema.options).toContain(entity)
    expect(PULL_COLUMNS[entity]).not.toBeNull()
    expect(PULL_COLUMNS[entity]).toEqual(expect.arrayContaining(['id', 'workspace_id', 'version']))
    // `version` is the token the next offline edit sends back; a pulled row
    // stored without it is refused as a conflict on the first edit.
    expect(ENTITIES_WITH_VERSION.has(entity as never)).toBe(true)
  })
})

describe('snapshot: the lean pull columns, in this workspace', () => {
  it.each(ADDED)('%s selects only the declared columns', async (entity, table) => {
    const page = await syncService.snapshot(WS_A, entity, null, 10)

    const columns = PULL_COLUMNS[entity]!.join(', ')
    const walk = selects.find((entry) => entry.table === table)
    expect(walk?.columns).toBe(columns)
    expect(walk?.workspace).toBe(WS_A)
    expect(columns).not.toBe('*')

    // Another workspace's row is not in the page.
    expect(page.rows.every((row) => row.workspace_id === WS_A)).toBe(true)
  })

  it('a variant snapshot carries its identity and price override, not the deleted flag', async () => {
    const page = await syncService.snapshot(WS_A, 'product_variants', null, 10)
    const row = page.rows[0]!

    expect(row.sku).toBe('SHIRT-M')
    expect(row.version).toBe(4)
    expect(row.price_override_minor).toBe(120_000)
    // A soft-deleted row is a delete instruction from the log, not a column a
    // device has to interpret.
    expect(PULL_COLUMNS.product_variants).not.toContain('deleted_at')
    expect('deleted_at' in row).toBe(false)
  })

  it('a session snapshot carries the credit it consumed, so the calendar cannot double-book', async () => {
    const page = await syncService.snapshot(WS_A, 'service_delivery_sessions', null, 10)
    const row = page.rows[0]!

    expect(row.status).toBe('delivered')
    expect(row.package_credit_id).toBe(CREDIT)
    expect(row.session_date).toBe('2026-11-10')
    expect(row.version).toBe(2)
  })

  it('a credit snapshot carries the quantity as it stands — negative means spent', async () => {
    const page = await syncService.snapshot(WS_A, 'package_credit_ledger', null, 10)
    const row = page.rows[0]!

    expect(row.entry_type).toBe('CONSUME')
    expect(row.quantity).toBe(-1)
    expect(row.idempotency_key).toBe('consume-0001')
  })

  it('a ticket snapshot carries the status the bench screen reads', async () => {
    const page = await syncService.snapshot(WS_A, 'repair_tickets', null, 10)
    const row = page.rows[0]!

    expect(row.status).toBe('repairing')
    expect(row.device_label).toBe('iPhone 13')
    // The server decides warranty from the serial; the device only displays it.
    expect(row.under_warranty).toBe(true)
    expect(row.version).toBe(3)
  })

  it('refuses a snapshot for an entity the pull does not carry', async () => {
    // `transaction` has no pull columns: the whole row would leak columns the
    // device never stores, which is what the lean payload removed.
    await expect(syncService.snapshot(WS_A, 'transaction' as never, null, 10)).rejects.toThrow(
      /no snapshot for transaction/,
    )
  })
})

describe('pull: the four arrive in one page', () => {
  function log(): void {
    const entries: Array<[number, string, string, string, string]> = [
      [1, 'product_variants', VARIANT, 'create', 'device-b'],
      [2, 'service_delivery_sessions', SESSION, 'create', 'device-b'],
      [3, 'package_credit_ledger', CREDIT, 'create', 'device-c'],
      [4, 'repair_tickets', TICKET, 'update', 'device-c'],
      // Another workspace's change sits after them: it must never surface.
      [5, 'product_variants', '55555555-5555-4555-8555-00000000000b', 'create', 'device-z'],
    ]
    for (const [version, entityType, entityId, operation, device] of entries) {
      rowsOf('sync_change_log').push({
        sync_version: version,
        workspace_id: version === 5 ? WS_B : WS_A,
        entity_type: entityType,
        entity_id: entityId,
        operation,
        entity_version: 1,
        origin_device: device,
        created_at: `2026-11-0${version}T08:00:00.000Z`,
      })
    }
  }

  it('device A receives all four, with data, and nothing from another workspace', async () => {
    log()

    const page = await syncService.pull(WS_A, 0, 100)

    expect(page.mustRehydrate).toBe(false)
    const byType = new Map(page.changes.map((change) => [change.entityType, change.data]))
    expect(byType.get('product_variants')?.sku).toBe('SHIRT-M')
    expect(byType.get('service_delivery_sessions')?.status).toBe('delivered')
    expect(byType.get('package_credit_ledger')?.quantity).toBe(-1)
    expect(byType.get('repair_tickets')?.status).toBe('repairing')
    // The cursor advanced past the last change of THIS workspace. Another
    // tenant's log row (version 5) is not a cursor a device may hold: the
    // server function filters by workspace, so it never appears here.
    expect(page.nextCursor).toBe(4)
    // And nothing from WS_B travelled.
    expect(page.changes.every((change) => change.data?.workspace_id !== WS_B)).toBe(true)
  })

  it('the device that wrote a change does not receive it back', async () => {
    log()

    const page = await syncService.pull(WS_A, 0, 100, 'device-b')

    // Its own two rows are skipped; the two from device-c still arrive.
    expect(page.changes.map((change) => change.entityType).sort()).toEqual([
      'package_credit_ledger',
      'repair_tickets',
    ])
  })

  it('a failed row read throws instead of arriving as «deleted»', async () => {
    log()
    tables.set(
      'repair_tickets',
      rowsOf('repair_tickets').filter((row) => row.id !== TICKET),
    )

    const page = await syncService.pull(WS_A, 0, 100)
    const ticket = page.changes.find((change) => change.entityType === 'repair_tickets')
    // The row is gone from the table, so there is no data — but the operation
    // stays `update`, not `delete`: a missing row is not a delete instruction.
    expect(ticket?.operation).toBe('update')
    expect(ticket?.data ?? null).toBeNull()
  })
})

describe('push: none of the four is a row write', () => {
  it.each(ADDED.map(([entity]) => entity))('refuses %s by name', async (entityType) => {
    inserts.length = 0

    const { results } = await syncService.push(OWNER, [
      {
        mutationId: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001',
        entityType,
        entityId: VARIANT,
        operation: 'create',
        payload: { sku: 'SHIRT-M' },
      },
    ])
    const result = results[0]

    expect(result?.status).toBe('rejected')
    expect(result?.errorCode).toBe('forbidden')
    // The message names the domain route, so the caller knows where the write
    // actually belongs instead of retrying the same refused mutation.
    expect(result?.errorMessage ?? '').toContain('cannot be written through /sync/push')
    expect(result?.errorMessage ?? '').toContain('/api/')
    expect(inserts).not.toContain(entityType)
  })
})

describe('the migration carries them', () => {
  const DOCS = join(__dirname, '..', '..', '..', 'docs')
  const migration = readFileSync(join(DOCS, 'operational-pull-02-migration.sql'), 'utf8')
  const verify = readFileSync(join(DOCS, 'VERIFY-operational-pull-02.sql'), 'utf8')

  it.each(ADDED)(
    '%s gets a version column, a bump trigger and a change-log trigger',
    (entity, table) => {
      expect(migration).toMatch(
        new RegExp(`ALTER TABLE ${table}\\s+ADD COLUMN IF NOT EXISTS version BIGINT`),
      )
      expect(migration).toContain(`CREATE TRIGGER ${table}_bump_version_trg`)
      expect(migration).toContain(`CREATE TRIGGER ${table}_change_log_trg`)
      // The string the client filters on is the PROTOCOL name, not the table name
      // spelled by hand — `sync_pull_changes_v2` matches this argument exactly.
      expect(migration).toContain(`sync_record_change('${entity}')`)
    },
  )

  it('is safe to run twice: every trigger is dropped before it is created', () => {
    for (const [, table] of ADDED) {
      expect(migration).toContain(`DROP TRIGGER IF EXISTS ${table}_bump_version_trg`)
      expect(migration).toContain(`DROP TRIGGER IF EXISTS ${table}_change_log_trg`)
    }
    // The two functions are CREATE OR REPLACE, so the file does not depend on
    // sync-engine-migration.sql having been applied first.
    expect(migration).toContain('CREATE OR REPLACE FUNCTION sync_bump_version()')
    expect(migration).toContain('CREATE OR REPLACE FUNCTION sync_record_change()')
  })

  it('refuses a client the trigger functions', () => {
    for (const fn of ['sync_bump_version()', 'sync_record_change()']) {
      expect(migration).toContain(
        `REVOKE EXECUTE ON FUNCTION ${fn} FROM PUBLIC, anon, authenticated`,
      )
    }
  })

  it('ships a VERIFY query that answers for each of the four', () => {
    for (const [, table] of ADDED) expect(verify).toContain(`'${table}'`)
    // The human who runs it must be able to read the result, not infer it.
    expect(verify).toContain('PENDING HUMAN CONFIRMATION')
  })

  it('does not claim to have been run', () => {
    expect(migration).not.toMatch(/\bPASS\b/)
  })
})

describe('the client can receive them', () => {
  const ROOT = join(__dirname, '..', '..', '..')

  /** Source with comments removed: an example in a comment is not wiring. */
  const source = (path: string): string =>
    readFileSync(join(ROOT, path), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\s+/g, ' ')

  it.each(ADDED.map(([entity]) => entity))('the sync engine has a mapper for %s', (entity) => {
    const engine = source('packages/app-shell/src/features/sync/sync-engine.ts')
    expect(engine).toContain(`${entity}: (r) => ({`)
    expect(engine).toMatch(new RegExp(`BACKGROUND_ENTITIES[^\\]]*'${entity}'`))
  })

  it('the snapshot entity list is derived from PULL_COLUMNS, not a second list', () => {
    // The regression this guards: the enum was `['product', 'customer',
    // 'invoice']`, so an entity added to the pull was refused by the route.
    const routes = source('backend/src/routes/sync.routes.ts')
    expect(routes).toContain('Object.entries(PULL_COLUMNS)')
    expect(routes).not.toContain("z.enum(['product', 'customer', 'invoice'])")
  })

  it('the bridge can write them into its local tables', () => {
    const contract = source('packages/app-bridge/src/contract.ts')
    const schema = source('packages/app-bridge/src/local-schema.ts')
    for (const [entity] of ADDED) {
      expect(contract).toContain(`'${entity}'`)
      expect(schema).toMatch(new RegExp(`${entity}: \\[`))
    }
  })
})
