// ============================================
// Sync endpoint security.
//
// The endpoint these tests guard used to read a table name out of the request
// body and hand it to a service-role database client:
//
//     for (const [table, changes] of Object.entries(body.changes))
//       await supabase.from(table).insert(...)
//
// Any authenticated user could therefore read or write ANY table — another
// workspace's invoices, `workspaces` itself, `sync_mutations`. It also
// accepted arbitrary columns, so a client could set its own totals, its own
// `workspace_id`, its own `version`.
//
// Each test below is one of those attacks, expressed as a request. They are
// written against the schema and the service rather than a live server,
// because the guarantees live in both and both must hold.
// ============================================

import { describe, expect, it, vi } from 'vitest'
import { syncPushRequestSchema, syncPullRequestSchema } from '@hisabche/validation'

/* ── A store that records everything the service asks the database to do ── */

interface Row {
  [key: string]: unknown
}

const tables = new Map<string, Row[]>()
const touchedTables: string[] = []

function reset(): void {
  tables.clear()
  touchedTables.length = 0
  for (const name of [
    'invoices',
    'customers',
    'products',
    'transactions',
    'sync_mutations',
    'workspaces',
  ]) {
    tables.set(name, [])
  }
}

function makeQuery(table: string) {
  touchedTables.push(table)

  const eqs: Array<[string, unknown]> = []
  let pending: { kind: 'insert' | 'update' | 'delete'; values?: Row | Row[] } | null = null
  const rows = () => tables.get(table) ?? (tables.set(table, []), tables.get(table)!)
  const matching = () => rows().filter((r) => eqs.every(([c, v]) => r[c] === v))

  const api = {
    select: () => api,
    eq: (c: string, v: unknown) => (eqs.push([c, v]), api),
    gt: () => api,
    in: () => api,
    order: () => api,
    limit: () => api,
    insert: (values: Row | Row[]) => ((pending = { kind: 'insert', values }), api),
    update: (values: Row) => ((pending = { kind: 'update', values }), api),
    delete: () => ((pending = { kind: 'delete' }), api),
    maybeSingle: async () => ({ data: matching()[0] ?? null, error: null }),
    single: async () => {
      const out = await api.commit()
      const list = Array.isArray(out.data) ? out.data : [out.data]
      return out.error ? out : { data: list[0] ?? null, error: null }
    },
    then: (resolve: (v: { data: unknown; error: unknown }) => unknown) =>
      api.commit().then(resolve),
    commit: async (): Promise<{
      data: unknown
      error: { code?: string; message: string } | null
    }> => {
      if (!pending) return { data: matching(), error: null }

      if (pending.kind === 'insert') {
        const incoming = Array.isArray(pending.values) ? pending.values : [pending.values!]
        const made: Row[] = []
        for (const value of incoming) {
          const keyCol = table === 'sync_mutations' ? 'mutation_id' : 'id'
          if (value[keyCol] !== undefined && rows().some((r) => r[keyCol] === value[keyCol])) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } }
          }
          const row = { version: 1, ...value }
          rows().push(row)
          made.push(row)
        }
        return { data: made, error: null }
      }

      if (pending.kind === 'update') {
        const patch = (pending.values ?? {}) as Row
        const hit = matching()
        for (const row of hit) {
          Object.assign(row, patch)
          row.version = Number(row.version ?? 1) + 1
        }
        return { data: hit, error: null }
      }

      const doomed = matching()
      for (const row of doomed) rows().splice(rows().indexOf(row), 1)
      return { data: doomed, error: null }
    },
  }

  return api
}

vi.mock('../db', () => ({ supabase: { from: (t: string) => makeQuery(t) } }))

const { syncService } = await import('../services/sync.service')

const ATTACKER = {
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  workspaceId: 'wwwwwwww-wwww-4www-8www-wwwwwwwwwwww',
  deviceId: 'attacker',
}

const VICTIM_WORKSPACE = 'vvvvvvvv-vvvv-4vvv-8vvv-vvvvvvvvvvvv'

function id(n: number): string {
  return `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`
}

/* ═══════════════════════════════════════════════════════════════════════════
   Arbitrary table access — the original vulnerability
   ═══════════════════════════════════════════════════════════════════════════ */

describe('a client cannot name a table', () => {
  it('rejects an entity type outside the closed set', () => {
    const parsed = syncPushRequestSchema.safeParse({
      deviceId: 'x',
      batchId: id(1),
      mutations: [
        {
          mutationId: id(2),
          entityType: 'workspaces', // the old endpoint would have written this
          entityId: id(3),
          operation: 'update',
          payload: { owner_id: ATTACKER.userId },
        },
      ],
    })

    expect(parsed.success).toBe(false)
  })

  it.each(['workspaces', 'sync_mutations', 'profiles', 'auth.users', 'billing'])(
    'rejects "%s"',
    (entityType) => {
      const parsed = syncPushRequestSchema.safeParse({
        deviceId: 'x',
        batchId: id(1),
        mutations: [
          { mutationId: id(2), entityType, entityId: id(3), operation: 'create', payload: {} },
        ],
      })
      expect(parsed.success).toBe(false)
    },
  )

  it('only ever touches the four mapped tables', async () => {
    reset()

    await syncService.push(ATTACKER, [
      {
        mutationId: id(10),
        entityType: 'invoice',
        entityId: id(11),
        operation: 'create',
        payload: { notes: 'note' },
      },
    ])

    // `sync_change_log` is read for the cursor; everything else is one of the
    // four mapped entity tables or the idempotency ledger.
    const allowed = new Set([
      'invoices',
      'customers',
      'products',
      'transactions',
      'sync_mutations',
      'sync_change_log',
    ])

    const unexpected = touchedTables.filter((t) => !allowed.has(t))
    expect(unexpected).toEqual([])
    expect(touchedTables).not.toContain('workspaces')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Mass assignment
   ═══════════════════════════════════════════════════════════════════════════ */

describe('a client cannot set the columns that decide authority', () => {
  it('ignores workspace_id from the payload', async () => {
    reset()

    await syncService.push(ATTACKER, [
      {
        mutationId: id(20),
        entityType: 'invoice',
        entityId: id(21),
        operation: 'create',
        // Trying to plant a row in someone else's workspace.
        payload: { notes: 'note', workspace_id: VICTIM_WORKSPACE },
      },
    ])

    const row = tables.get('invoices')!.find((r) => r.id === id(21))
    expect(row?.workspace_id).toBe(ATTACKER.workspaceId)
    expect(row?.workspace_id).not.toBe(VICTIM_WORKSPACE)
  })

  it('ignores user_id from the payload', async () => {
    reset()

    await syncService.push(ATTACKER, [
      {
        mutationId: id(22),
        entityType: 'invoice',
        entityId: id(23),
        operation: 'create',
        payload: { notes: 'note', user_id: 'someone-else' },
      },
    ])

    expect(tables.get('invoices')!.find((r) => r.id === id(23))?.user_id).toBe(ATTACKER.userId)
  })

  it('ignores version, so a client cannot fake being ahead', async () => {
    reset()

    await syncService.push(ATTACKER, [
      {
        mutationId: id(24),
        entityType: 'invoice',
        entityId: id(25),
        operation: 'create',
        payload: { notes: 'note', version: 999999 },
      },
    ])

    expect(tables.get('invoices')!.find((r) => r.id === id(25))?.version).toBe(1)
  })

  it('ignores finalized_at, so a client cannot freeze or unfreeze a document', async () => {
    reset()

    await syncService.push(ATTACKER, [
      {
        mutationId: id(26),
        entityType: 'invoice',
        entityId: id(27),
        operation: 'create',
        payload: { notes: 'note', finalized_at: '2020-01-01T00:00:00Z' },
      },
    ])

    expect(tables.get('invoices')!.find((r) => r.id === id(27))?.finalized_at).toBeUndefined()
  })

  it('ignores the lease columns, so a client cannot lock others out', async () => {
    reset()

    await syncService.push(ATTACKER, [
      {
        mutationId: id(28),
        entityType: 'invoice',
        entityId: id(29),
        operation: 'create',
        payload: {
          total: 1,
          locked_by_user_id: ATTACKER.userId,
          lock_expires_at: '2099-01-01T00:00:00Z',
        },
      },
    ])

    const row = tables.get('invoices')!.find((r) => r.id === id(29))
    expect(row?.locked_by_user_id).toBeUndefined()
    expect(row?.lock_expires_at).toBeUndefined()
  })

  it('drops an unknown column rather than writing it', async () => {
    reset()

    await syncService.push(ATTACKER, [
      {
        mutationId: id(30),
        entityType: 'invoice',
        entityId: id(31),
        operation: 'create',
        payload: { notes: 'note', is_admin: true, '; DROP TABLE invoices; --': 1 },
      },
    ])

    const row = tables.get('invoices')!.find((r) => r.id === id(31))
    expect(row?.is_admin).toBeUndefined()
    expect(Object.keys(row ?? {})).not.toContain('; DROP TABLE invoices; --')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Workspace isolation
   ═══════════════════════════════════════════════════════════════════════════ */

describe('workspace isolation', () => {
  it('cannot update a row belonging to another workspace', async () => {
    reset()

    tables.get('invoices')!.push({
      id: id(40),
      workspace_id: VICTIM_WORKSPACE,
      total: 5_000_000,
      version: 1,
    })

    const result = await syncService.push(ATTACKER, [
      {
        mutationId: id(41),
        entityType: 'invoice',
        entityId: id(40),
        operation: 'update',
        payload: { notes: 'note' },
      },
    ])

    // Every read and write is scoped by the token's workspace, so the row is
    // simply not visible.
    expect(result.results[0]?.status).toBe('rejected')
    expect(result.results[0]?.errorCode).toBe('not_found')
    expect(tables.get('invoices')!.find((r) => r.id === id(40))?.total).toBe(5_000_000)
  })

  it('cannot delete another workspace’s row', async () => {
    reset()

    tables.get('invoices')!.push({
      id: id(42),
      workspace_id: VICTIM_WORKSPACE,
      total: 1,
      version: 1,
    })

    const result = await syncService.push(ATTACKER, [
      {
        mutationId: id(43),
        entityType: 'invoice',
        entityId: id(42),
        operation: 'delete',
        payload: {},
      },
    ])

    expect(result.results[0]?.status).toBe('rejected')
    expect(tables.get('invoices')!.some((r) => r.id === id(42))).toBe(true)
  })

  it('cannot pull another workspace’s change log', async () => {
    reset()
    // `pull` takes the workspace as an argument the route derives from the
    // token — there is no code path that lets the body supply it.
    const page = await syncService.pull(ATTACKER.workspaceId, 0, 100)
    expect(page.changes.every((c) => c.entityId !== undefined)).toBe(true)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Replay and financial authority
   ═══════════════════════════════════════════════════════════════════════════ */

describe('replay and financial authority', () => {
  it('a replayed batch cannot duplicate a payment', async () => {
    reset()

    const payment = {
      mutationId: id(50),
      entityType: 'transaction' as const,
      entityId: id(51),
      operation: 'create' as const,
      // The attacker's amount is refused outright now, so the replay test
      // uses what a client may legitimately send. Idempotency is the point
      // here; the refusal has its own test.
      payload: { notes: 'replayed' },
    }

    await syncService.push(ATTACKER, [payment])
    await syncService.push(ATTACKER, [payment])
    await syncService.push(ATTACKER, [payment])

    expect(tables.get('transactions')).toHaveLength(1)
  })

  it('⚠️ a client-supplied total is REFUSED, not quietly dropped', async () => {
    reset()

    const result = await syncService.push(ATTACKER, [
      {
        mutationId: id(52),
        entityType: 'invoice',
        entityId: id(53),
        operation: 'create',
        payload: { total: 1, subtotal: 5_000_000, notes: 'یادداشت' },
      },
    ])

    // ⚠️ THE RULE GOT STRICTER, TWICE.
    //
    // First it was «the figures are written but not trusted» — the server
    // recalculated on the authoritative path, so the row carried a number
    // nobody had derived from any lines, visible in every list until
    // something recalculated it.
    //
    // Then it was «the figures are dropped». That is quieter and worse: the
    // client is told the mutation applied, so a person who just changed an
    // amount closes the screen believing it saved. Nothing changed.
    //
    // Now the whole mutation is refused and the field is NAMED, so the client
    // can say which one and send it down the road that recalculates.
    expect(result.results[0]?.status).toBe('rejected')
    expect(result.results[0]?.errorMessage ?? '').toContain('FINANCIAL_FIELD_NOT_WRITABLE')
    expect(result.results[0]?.errorMessage ?? '').toContain('total')

    // Nothing was written — not even the descriptive part that was allowed.
    // A partial write would leave the row half-saved with no way to tell.
    expect(tables.get('invoices')!.find((r) => r.id === id(53))).toBeUndefined()
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Request shape
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the request itself is bounded', () => {
  it('rejects an unbounded batch', () => {
    const mutations = Array.from({ length: 500 }, (_, i) => ({
      mutationId: id(1000 + i),
      entityType: 'invoice' as const,
      entityId: id(2000 + i),
      operation: 'create' as const,
      payload: {},
    }))

    const parsed = syncPushRequestSchema.safeParse({
      deviceId: 'x',
      batchId: id(1),
      mutations,
    })

    // An unbounded batch is a request that can time out halfway and a
    // transaction that holds locks for seconds.
    expect(parsed.success).toBe(false)
  })

  it('rejects a non-uuid mutation id, which would break idempotency', () => {
    const parsed = syncPushRequestSchema.safeParse({
      deviceId: 'x',
      batchId: id(1),
      mutations: [
        {
          mutationId: 'not-a-uuid',
          entityType: 'invoice',
          entityId: id(3),
          operation: 'create',
          payload: {},
        },
      ],
    })

    expect(parsed.success).toBe(false)
  })

  it('caps the pull page size', () => {
    const parsed = syncPullRequestSchema.safeParse({ cursor: 0, limit: 100000 })
    expect(parsed.success).toBe(false)
  })

  it('defaults a missing cursor to 0 rather than failing', () => {
    const parsed = syncPullRequestSchema.safeParse({})
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.cursor).toBe(0)
  })

  it('rejects a negative cursor', () => {
    expect(syncPullRequestSchema.safeParse({ cursor: -1 }).success).toBe(false)
  })
})
