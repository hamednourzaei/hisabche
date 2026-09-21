// ============================================
// Sync protocol invariants.
//
// These are not example tests. Each one pins a property that, if it ever
// stopped holding, would corrupt a shopkeeper's books:
//
//   * a mutation applies at most once, however many times it is sent;
//   * a stale write is refused rather than applied;
//   * a finalized invoice cannot be edited;
//   * a client cannot advance its cursor past changes it has not applied;
//   * a lost response cannot become a second payment.
//
// The Supabase client is faked with an in-memory store that behaves like the
// real one for the operations the service uses, including the PRIMARY KEY
// conflict on `sync_mutations` that the idempotency guarantee rests on.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

/* ── In-memory stand-in for PostgREST ───────────────────────────────────── */

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
    'transactions',
    'sync_change_log',
    'sync_mutations',
  ]) {
    tables.set(name, [])
  }
  sequence = 0
}

/** Mirrors the trigger in docs/sync-engine-migration.sql. */
function recordChange(table: string, row: Row, operation: string): void {
  const entity: Record<string, string> = {
    invoices: 'invoice',
    customers: 'customer',
    products: 'product',
    transactions: 'transaction',
  }
  const type = entity[table]
  if (!type || !row.workspace_id) return

  sequence += 1
  tables.get('sync_change_log')!.push({
    sync_version: sequence,
    workspace_id: row.workspace_id,
    entity_type: type,
    entity_id: row.id,
    operation,
    entity_version: row.version ?? 1,
    origin_device: null,
  })
}

function matches(row: Row, filters: Array<[string, unknown]>): boolean {
  return filters.every(([column, value]) => row[column] === value)
}

function makeQuery(table: string) {
  const eqs: Array<[string, unknown]> = []
  let gtColumn: string | null = null
  let gtValue = 0
  let inColumn: string | null = null
  let inValues: unknown[] = []
  let limitN = Infinity
  let ascending = true
  let orderColumn: string | null = null
  let pending: { kind: 'insert' | 'update' | 'delete'; values?: Row | Row[] } | null = null

  const rows = () => tables.get(table) ?? []

  const selected = () => {
    let out = rows().filter((r) => matches(r, eqs))
    if (gtColumn) out = out.filter((r) => Number(r[gtColumn!]) > gtValue)
    if (inColumn) out = out.filter((r) => inValues.includes(r[inColumn!]))
    if (orderColumn) {
      out = [...out].sort((a, b) => {
        const x = Number(a[orderColumn!])
        const y = Number(b[orderColumn!])
        return ascending ? x - y : y - x
      })
    }
    return out.slice(0, limitN)
  }

  const api = {
    select: (_cols?: string) => api,
    eq: (column: string, value: unknown) => {
      eqs.push([column, value])
      return api
    },
    gt: (column: string, value: number) => {
      gtColumn = column
      gtValue = Number(value)
      return api
    },
    in: (column: string, values: unknown[]) => {
      inColumn = column
      inValues = values
      return api
    },
    order: (column: string, opts?: { ascending?: boolean }) => {
      orderColumn = column
      ascending = opts?.ascending !== false
      return api
    },
    limit: (n: number) => {
      limitN = n
      return api
    },
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
      const found = selected()
      return { data: found[0] ?? null, error: null }
    },

    single: async () => {
      const outcome = await api.commit()
      if (outcome.error) return outcome
      const list = Array.isArray(outcome.data) ? outcome.data : [outcome.data]
      return { data: list[0] ?? null, error: null }
    },

    /** Resolves the query when awaited directly. */
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      api.commit().then(resolve),

    commit: async (): Promise<{
      data: unknown
      error: { code?: string; message: string } | null
    }> => {
      if (!pending) return { data: selected(), error: null }

      if (pending.kind === 'insert') {
        const incoming = Array.isArray(pending.values) ? pending.values : [pending.values!]
        const inserted: Row[] = []

        for (const value of incoming) {
          const keyColumn = table === 'sync_mutations' ? 'mutation_id' : 'id'
          const key = value[keyColumn]

          // The PRIMARY KEY. This is the whole idempotency guarantee.
          if (key !== undefined && rows().some((r) => r[keyColumn] === key)) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } }
          }

          const row: Row = { version: 1, ...value }
          rows().push(row)
          inserted.push(row)
          recordChange(table, row, 'create')
        }

        return { data: inserted, error: null }
      }

      if (pending.kind === 'update') {
        const targets = rows().filter((r) => matches(r, eqs))
        const updated: Row[] = []

        const patch = (pending.values ?? {}) as Row

        for (const row of targets) {
          // Mirrors invoices_guard_finalized_trg.
          if (table === 'invoices' && row.finalized_at) {
            const money = ['total', 'subtotal', 'currency', 'customer_id', 'type']
            const touchesMoney = money.some((c) => c in patch && patch[c] !== row[c])
            if (touchesMoney) {
              return { data: null, error: { code: '23001', message: 'invoice is finalized' } }
            }
          }

          Object.assign(row, patch)
          // Mirrors sync_bump_version().
          row.version = Number(row.version ?? 1) + 1
          updated.push(row)
          recordChange(table, row, 'update')
        }

        return { data: updated, error: null }
      }

      const doomed = rows().filter((r) => matches(r, eqs))
      for (const row of doomed) {
        recordChange(table, row, 'delete')
        rows().splice(rows().indexOf(row), 1)
      }
      return { data: doomed, error: null }
    },
  }

  return api
}

vi.mock('../db', () => ({
  supabase: { from: (table: string) => makeQuery(table) },
}))

const { syncService } = await import('../services/sync.service')

const ACTOR = {
  userId: '11111111-1111-4111-8111-111111111111',
  workspaceId: '22222222-2222-4222-8222-222222222222',
  deviceId: 'device-a',
}

const OTHER_USER = '33333333-3333-4333-8333-333333333333'

function uuid(n: number): string {
  return `44444444-4444-4444-8444-${String(n).padStart(12, '0')}`
}

function invoiceMutation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    mutationId: uuid(900),
    entityType: 'invoice' as const,
    entityId: uuid(1),
    operation: 'create' as const,
    // ⚠️ A DESCRIPTIVE FIELD ON PURPOSE.
    //
    // These tests are about idempotency, versioning and immutability — they
    // need a field they can watch change, not a financial one. `total` used
    // to be that field, but this road may no longer write money: it inserts
    // the row directly, with no lines to derive a total from and no ledger
    // entry behind it. `notes` proves the same invariants and is what a
    // client is actually allowed to send here.
    payload: { notes: 'یادداشت اول' },
    ...overrides,
  }
}

beforeEach(reset)

/* ═══════════════════════════════════════════════════════════════════════════
   Idempotency
   ═══════════════════════════════════════════════════════════════════════════ */

describe('a mutation is applied at most once', () => {
  it('does not create a second invoice when the same mutation_id is retried', async () => {
    const mutation = invoiceMutation()

    const first = await syncService.push(ACTOR, [mutation])
    const retry = await syncService.push(ACTOR, [mutation])

    expect(first.results[0]?.status).toBe('applied')
    expect(first.results[0]?.duplicate).toBe(false)

    // The retry is reported as applied — the client must not be told its
    // invoice failed — but it is flagged as a replay.
    expect(retry.results[0]?.status).toBe('applied')
    expect(retry.results[0]?.duplicate).toBe(true)

    expect(tables.get('invoices')).toHaveLength(1)
  })

  it('survives an entire batch being submitted twice', async () => {
    const batch = [
      invoiceMutation({ mutationId: uuid(901), entityId: uuid(11) }),
      invoiceMutation({ mutationId: uuid(902), entityId: uuid(12) }),
      invoiceMutation({ mutationId: uuid(903), entityId: uuid(13) }),
    ]

    await syncService.push(ACTOR, batch)
    const second = await syncService.push(ACTOR, batch)

    expect(tables.get('invoices')).toHaveLength(3)
    expect(second.results.every((r) => r.duplicate)).toBe(true)
  })

  it('a retry cannot duplicate a payment', async () => {
    const payment = {
      mutationId: uuid(910),
      entityType: 'transaction' as const,
      entityId: uuid(20),
      operation: 'create' as const,
      // ⚠️ NOT `amount`. This road refuses financial fields outright now —
      // see the test below. What it still proves is the thing it was written
      // for: the same mutation sent three times is applied once.
      payload: { notes: 'رسید نقدی' },
    }

    // The response to the first attempt is "lost" — the client simply sends
    // the same mutation again, which is exactly the dangerous case.
    await syncService.push(ACTOR, [payment])
    await syncService.push(ACTOR, [payment])
    await syncService.push(ACTOR, [payment])

    const paid = tables.get('transactions') ?? []
    // Applied ONCE — that is what this test is about, and it still holds.
    expect(paid).toHaveLength(1)

    expect(paid[0]?.notes).toBe('رسید نقدی')
    // Money is not here, and could not have been: see the refusal test.
    expect(paid[0]?.amount).toBeUndefined()
  })

  it('⚠️ a financial field is REFUSED, not quietly dropped', async () => {
    // The difference decides what a person believes. Dropping `amount` and
    // answering «applied» tells somebody who just changed a payment that it
    // saved — and nothing changed. They close the screen trusting a number
    // the books do not have.
    const withMoney = {
      mutationId: uuid(911),
      entityType: 'transaction' as const,
      entityId: uuid(21),
      operation: 'create' as const,
      payload: { amount: 5000, notes: 'رسید' },
    }

    const result = await syncService.push(ACTOR, [withMoney])

    expect(result.results[0]?.status).toBe('rejected')
    // The message names the field, so the client can say which one and send
    // it down the road that recalculates.
    expect(result.results[0]?.errorMessage ?? '').toContain('FINANCIAL_FIELD_NOT_WRITABLE')
    // And nothing was written — not even the part that was allowed.
    expect(tables.get('transactions') ?? []).toHaveLength(0)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Optimistic concurrency
   ═══════════════════════════════════════════════════════════════════════════ */

describe('a stale write never overwrites a newer one', () => {
  it('rejects an update whose expected version is behind the server', async () => {
    await syncService.push(ACTOR, [invoiceMutation({ entityId: uuid(2), mutationId: uuid(920) })])

    // User A saves: version 1 → 2.
    await syncService.push(ACTOR, [
      {
        mutationId: uuid(921),
        entityType: 'invoice',
        entityId: uuid(2),
        operation: 'update',
        expectedVersion: 1,
        payload: { notes: 'note-200' },
      },
    ])

    // User B was still holding version 1.
    const stale = await syncService.push(ACTOR, [
      {
        mutationId: uuid(922),
        entityType: 'invoice',
        entityId: uuid(2),
        operation: 'update',
        expectedVersion: 1,
        payload: { notes: 'note-999' },
      },
    ])

    expect(stale.results[0]?.status).toBe('rejected')
    expect(stale.results[0]?.errorCode).toBe('version_conflict')
    // Not retryable: sending it again unchanged would be just as stale.
    expect(stale.results[0]?.retryable).toBe(false)
    // The server hands back its row so the client can merge rather than guess.
    expect(stale.results[0]?.serverState).toBeDefined()

    // The winner's value stands; the stale one never landed.
    expect(tables.get('invoices')?.[0]?.notes).toBe('note-200')
  })

  it('accepts an update that carries the current version', async () => {
    await syncService.push(ACTOR, [invoiceMutation({ entityId: uuid(3), mutationId: uuid(930) })])

    const ok = await syncService.push(ACTOR, [
      {
        mutationId: uuid(931),
        entityType: 'invoice',
        entityId: uuid(3),
        operation: 'update',
        expectedVersion: 1,
        payload: { notes: 'note-150' },
      },
    ])

    expect(ok.results[0]?.status).toBe('applied')
    expect(ok.results[0]?.entityVersion).toBe(2)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Immutability
   ═══════════════════════════════════════════════════════════════════════════ */

describe('a finalized invoice is immutable', () => {
  it('refuses to change the money on a finalized invoice', async () => {
    await syncService.push(ACTOR, [invoiceMutation({ entityId: uuid(4), mutationId: uuid(940) })])

    const invoice = tables.get('invoices')!.find((r) => r.id === uuid(4))!
    invoice.finalized_at = new Date().toISOString()

    const attempt = await syncService.push(ACTOR, [
      {
        mutationId: uuid(941),
        entityType: 'invoice',
        entityId: uuid(4),
        operation: 'update',
        payload: { notes: 'note-1' },
      },
    ])

    expect(attempt.results[0]?.status).toBe('rejected')
    expect(attempt.results[0]?.errorCode).toBe('immutable')
    expect(attempt.results[0]?.retryable).toBe(false)
    // Untouched — a finalized invoice refuses even a note.
    expect(tables.get('invoices')?.find((r) => r.id === uuid(4))?.notes).toBe('یادداشت اول')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Authority
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the client cannot decide what it is not entitled to', () => {
  it('ignores a workspace_id supplied in the payload', async () => {
    await syncService.push(ACTOR, [
      invoiceMutation({
        mutationId: uuid(950),
        entityId: uuid(5),
        payload: { notes: 'note-10', workspace_id: 'someone-elses-workspace', user_id: OTHER_USER },
      }),
    ])

    const row = tables.get('invoices')!.find((r) => r.id === uuid(5))
    // Derived from the verified token, not from the body.
    expect(row?.workspace_id).toBe(ACTOR.workspaceId)
    expect(row?.user_id).toBe(ACTOR.userId)
  })

  it('ignores a version supplied in the payload', async () => {
    await syncService.push(ACTOR, [
      invoiceMutation({
        mutationId: uuid(951),
        entityId: uuid(6),
        payload: { notes: 'note-10', version: 9999 },
      }),
    ])

    expect(tables.get('invoices')!.find((r) => r.id === uuid(6))?.version).toBe(1)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Partial failure
   ═══════════════════════════════════════════════════════════════════════════ */

describe('one bad mutation does not discard the batch', () => {
  it('applies the good mutations and reports only the bad one', async () => {
    await syncService.push(ACTOR, [invoiceMutation({ entityId: uuid(7), mutationId: uuid(960) })])
    await syncService.push(ACTOR, [
      {
        mutationId: uuid(961),
        entityType: 'invoice',
        entityId: uuid(7),
        operation: 'update',
        expectedVersion: 1,
        payload: { notes: 'note-500' },
      },
    ])

    const mixed = await syncService.push(ACTOR, [
      invoiceMutation({ mutationId: uuid(962), entityId: uuid(8) }),
      {
        mutationId: uuid(963),
        entityType: 'invoice',
        entityId: uuid(7),
        operation: 'update',
        expectedVersion: 1, // stale
        payload: { notes: 'note-1' },
      },
      invoiceMutation({ mutationId: uuid(964), entityId: uuid(9) }),
    ])

    expect(mixed.results.map((r) => r.status)).toEqual(['applied', 'rejected', 'applied'])
    expect(tables.get('invoices')!.some((r) => r.id === uuid(8))).toBe(true)
    expect(tables.get('invoices')!.some((r) => r.id === uuid(9))).toBe(true)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Cursor
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the cursor is monotonic and never skips a change', () => {
  it('returns changes strictly after the cursor, in order', async () => {
    for (let i = 0; i < 5; i += 1) {
      await syncService.push(ACTOR, [
        invoiceMutation({ mutationId: uuid(970 + i), entityId: uuid(30 + i) }),
      ])
    }

    const first = await syncService.pull(ACTOR.workspaceId, 0, 2)
    expect(first.changes).toHaveLength(2)
    expect(first.hasMore).toBe(true)

    const versions = first.changes.map((c) => c.syncVersion)
    expect(versions).toEqual([...versions].sort((a, b) => a - b))

    const second = await syncService.pull(ACTOR.workspaceId, first.nextCursor, 2)
    // Strictly after: no change is ever delivered twice.
    expect(Math.min(...second.changes.map((c) => c.syncVersion))).toBeGreaterThan(
      Math.max(...first.changes.map((c) => c.syncVersion)),
    )
  })

  it('walks the whole log without gaps or repeats', async () => {
    for (let i = 0; i < 7; i += 1) {
      await syncService.push(ACTOR, [
        invoiceMutation({ mutationId: uuid(980 + i), entityId: uuid(40 + i) }),
      ])
    }

    const seen: number[] = []
    let cursor = 0
    let guard = 0

    for (;;) {
      const page = await syncService.pull(ACTOR.workspaceId, cursor, 3)
      seen.push(...page.changes.map((c) => c.syncVersion))
      cursor = page.nextCursor
      if (!page.hasMore || (guard += 1) > 10) break
    }

    expect(new Set(seen).size).toBe(seen.length) // no repeats
    expect(seen).toEqual([...seen].sort((a, b) => a - b)) // ordered
    expect(seen).toHaveLength(7) // no gaps
  })

  it('does not advance the cursor when there is nothing new', async () => {
    await syncService.push(ACTOR, [invoiceMutation({ mutationId: uuid(990), entityId: uuid(50) })])

    const caughtUp = await syncService.pull(ACTOR.workspaceId, 0, 100)
    const again = await syncService.pull(ACTOR.workspaceId, caughtUp.nextCursor, 100)

    expect(again.changes).toHaveLength(0)
    expect(again.nextCursor).toBe(caughtUp.nextCursor)
    expect(again.hasMore).toBe(false)
  })

  it('carries the row data, so a change needs no follow-up request', async () => {
    await syncService.push(ACTOR, [
      invoiceMutation({
        mutationId: uuid(991),
        entityId: uuid(51),
        payload: { notes: 'note-777' },
      }),
    ])

    const page = await syncService.pull(ACTOR.workspaceId, 0, 10)
    const change = page.changes.find((c) => c.entityId === uuid(51))

    expect(change?.data).toMatchObject({ notes: 'note-777' })
  })

  it('sends no row for a delete — there is nothing left to send', async () => {
    await syncService.push(ACTOR, [invoiceMutation({ mutationId: uuid(992), entityId: uuid(52) })])
    await syncService.push(ACTOR, [
      {
        mutationId: uuid(993),
        entityType: 'invoice',
        entityId: uuid(52),
        operation: 'delete',
        payload: {},
      },
    ])

    const page = await syncService.pull(ACTOR.workspaceId, 0, 10)
    const removal = page.changes.find((c) => c.operation === 'delete')

    expect(removal).toBeDefined()
    expect(removal?.data).toBeNull()
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Draft lease
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the draft editing lease', () => {
  it('blocks a second user while it is held', async () => {
    await syncService.push(ACTOR, [invoiceMutation({ mutationId: uuid(994), entityId: uuid(60) })])

    const granted = await syncService.acquireLease(ACTOR, 'invoice', uuid(60))
    expect(granted.granted).toBe(true)

    const other = { ...ACTOR, userId: OTHER_USER, deviceId: 'device-b' }
    const denied = await syncService.acquireLease(other, 'invoice', uuid(60))

    expect(denied.granted).toBe(false)
    expect(denied.heldByUserId).toBe(ACTOR.userId)
  })

  it('expires on its own, so a crashed client cannot hold a record forever', async () => {
    await syncService.push(ACTOR, [invoiceMutation({ mutationId: uuid(995), entityId: uuid(61) })])
    await syncService.acquireLease(ACTOR, 'invoice', uuid(61))

    // The holder's process died; its lease lapses rather than being released.
    const row = tables.get('invoices')!.find((r) => r.id === uuid(61))!
    row.lock_expires_at = new Date(Date.now() - 1000).toISOString()

    const other = { ...ACTOR, userId: OTHER_USER, deviceId: 'device-b' }
    expect((await syncService.acquireLease(other, 'invoice', uuid(61))).granted).toBe(true)
  })

  it('refuses a write from someone who does not hold the lease', async () => {
    await syncService.push(ACTOR, [invoiceMutation({ mutationId: uuid(996), entityId: uuid(62) })])
    await syncService.acquireLease(ACTOR, 'invoice', uuid(62))

    const other = { ...ACTOR, userId: OTHER_USER, deviceId: 'device-b' }
    const blocked = await syncService.push(other, [
      {
        mutationId: uuid(997),
        entityType: 'invoice',
        entityId: uuid(62),
        operation: 'update',
        payload: { notes: 'note-42' },
      },
    ])

    expect(blocked.results[0]?.errorCode).toBe('locked')
    // Retryable: the lease will expire, and the write can then succeed.
    expect(blocked.results[0]?.retryable).toBe(true)
  })

  it('does not record a retryable failure, so the retry can still succeed', async () => {
    await syncService.push(ACTOR, [invoiceMutation({ mutationId: uuid(998), entityId: uuid(63) })])
    await syncService.acquireLease(ACTOR, 'invoice', uuid(63))

    const other = { ...ACTOR, userId: OTHER_USER, deviceId: 'device-b' }
    const attempt = {
      mutationId: uuid(999),
      entityType: 'invoice' as const,
      entityId: uuid(63),
      operation: 'update' as const,
      payload: { notes: 'note-42' },
    }

    await syncService.push(other, [attempt])

    // Lease lapses.
    const row = tables.get('invoices')!.find((r) => r.id === uuid(63))!
    row.lock_expires_at = new Date(Date.now() - 1000).toISOString()

    // The SAME mutation_id must now be able to apply. Recording the earlier
    // "locked" outcome would have replayed the failure forever.
    const retry = await syncService.push(other, [attempt])
    expect(retry.results[0]?.status).toBe('applied')
  })
})
