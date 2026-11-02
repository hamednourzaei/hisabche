// ============================================
// backend/src/__tests__/package-grants-status.test.ts
//
// M5 / slice C - the per-GRANT status the customer sees, derived from the ledger facts with the SHARED functions:
//   · SOLD != ACTIVATED: a GRANT never used has no end date and is not expired by the sale date;
//   · the term starts at the first consume that was not reversed; one month later the GRANT is expired;
//   · a suspension stops ONE GRANT; another GRANT of the same customer stays active;
//   · a RESUME (a later event, never an edit) lifts it;
//   · suspending needs a reason and a GRANT of THIS workspace.
// ============================================

import { afterEach, describe, expect, it } from 'vitest'
import { PackageGrantsService } from '../services/package-credits/package-grants.service'
import type { TenancyContext } from '../services/tenancy.service'

const ctx: TenancyContext = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  role: 'manager',
}

type Result = { data: unknown; error: unknown }

/** supabase.from(table) answers per table; every chain method returns the builder, awaiting it returns the table's result. */
function stubDb(tables: Record<string, Result | Result[]>) {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = []
  const queues = new Map(
    Object.entries(tables).map(([k, v]) => [k, Array.isArray(v) ? [...v] : [v]]),
  )
  const from = (table: string) => {
    const take = (): Result => {
      const queue = queues.get(table) ?? [{ data: [], error: null }]
      return queue.length > 1 ? queue.shift()! : queue[0]!
    }
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'is', 'order']) builder[m] = () => builder
    builder.insert = (payload: unknown) => {
      calls.push({ table, op: 'insert', payload })
      return builder
    }
    builder.maybeSingle = () => Promise.resolve(take())
    builder.single = () => Promise.resolve(take())
    builder.then = (resolve: (v: Result) => void) => resolve(take())
    return builder
  }
  return { from, calls }
}

async function withDb<T>(
  tables: Record<string, Result | Result[]>,
  fn: (calls: ReturnType<typeof stubDb>['calls']) => Promise<T>,
) {
  const { supabase } = await import('../db')
  const original = supabase.from
  const stub = stubDb(tables)
  supabase.from = stub.from as never
  try {
    return await fn(stub.calls)
  } finally {
    supabase.from = original
  }
}

const row = (o: Record<string, unknown>) => ({
  quantity: 5,
  reference_entry_id: null,
  deferred_amount: null,
  term_months: null,
  ...o,
})

afterEach(() => undefined)

describe('M5 slice C: package GRANT status', () => {
  it('SOLD != ACTIVATED: a never-used GRANT with a term is active, has no end date', async () => {
    const out = await withDb(
      {
        package_credit_ledger: {
          data: [
            row({
              id: 'g1',
              package_product_id: 'p',
              entry_type: 'GRANT',
              effective_date: '2025-01-01',
              term_months: 1,
            }),
          ],
          error: null,
        },
      },
      () => new PackageGrantsService().list(ctx, 'c', undefined, '2026-11-02'),
    )
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      id: 'g1',
      state: 'active',
      activatedOn: null,
      endsOn: null,
      remaining: 5,
      termMonths: 1,
    })
  })

  it('the term starts at the first consume; a month later the GRANT is expired and keeps its history', async () => {
    const ledger = [
      row({
        id: 'g1',
        package_product_id: 'p',
        entry_type: 'GRANT',
        effective_date: '2026-08-01',
        term_months: 1,
      }),
      row({
        id: 'c1',
        package_product_id: 'p',
        entry_type: 'CONSUME',
        quantity: 1,
        effective_date: '2026-09-01',
      }),
    ]
    const allocations = [
      {
        entry_id: 'c1',
        grant_entry_id: 'g1',
        kind: 'CONSUME',
        quantity: 1,
        released_amount: 0,
        effective_date: '2026-09-01',
      },
    ]
    const out = await withDb(
      {
        package_credit_ledger: { data: ledger, error: null },
        package_credit_allocations: { data: allocations, error: null },
      },
      () => new PackageGrantsService().list(ctx, 'c', undefined, '2026-11-02'),
    )
    expect(out[0]).toMatchObject({
      activatedOn: '2026-09-01',
      endsOn: '2026-10-01',
      state: 'expired',
      remaining: 4,
    })
  })

  it('a suspension stops ONE GRANT; the other GRANT of the same customer stays active', async () => {
    const ledger = [
      row({ id: 'g1', package_product_id: 'p', entry_type: 'GRANT', effective_date: '2026-10-01' }),
      row({ id: 'g2', package_product_id: 'p', entry_type: 'GRANT', effective_date: '2026-10-02' }),
    ]
    const suspensions = [
      {
        grant_entry_id: 'g1',
        kind: 'SUSPEND',
        effective_on: '2026-11-01',
        created_at: '2026-11-01',
      },
    ]
    const out = await withDb(
      {
        package_credit_ledger: { data: ledger, error: null },
        package_credit_suspensions: { data: suspensions, error: null },
      },
      () => new PackageGrantsService().list(ctx, 'c', undefined, '2026-11-02'),
    )
    expect(out.map((g) => [g.id, g.state])).toEqual([
      ['g1', 'suspended'],
      ['g2', 'active'],
    ])
  })

  it('a RESUME (a later event) lifts the suspension', async () => {
    const ledger = [
      row({ id: 'g1', package_product_id: 'p', entry_type: 'GRANT', effective_date: '2026-10-01' }),
    ]
    const suspensions = [
      {
        grant_entry_id: 'g1',
        kind: 'SUSPEND',
        effective_on: '2026-11-01',
        created_at: '2026-11-01',
      },
      {
        grant_entry_id: 'g1',
        kind: 'RESUME',
        effective_on: '2026-11-02',
        created_at: '2026-11-02',
      },
    ]
    const out = await withDb(
      {
        package_credit_ledger: { data: ledger, error: null },
        package_credit_suspensions: { data: suspensions, error: null },
      },
      () => new PackageGrantsService().list(ctx, 'c', undefined, '2026-11-02'),
    )
    expect(out[0]!.state).toBe('active')
  })

  it('a database without the M5 tables answers from the ledger alone (never an error, never a guess)', async () => {
    const missing = { code: '42P01', message: 'relation does not exist' }
    const out = await withDb(
      {
        package_credit_ledger: {
          data: [
            row({
              id: 'g1',
              package_product_id: 'p',
              entry_type: 'GRANT',
              effective_date: '2026-10-01',
            }),
          ],
          error: null,
        },
        package_credit_allocations: { data: null, error: missing },
        package_credit_suspensions: { data: null, error: missing },
      },
      () => new PackageGrantsService().list(ctx, 'c', undefined, '2026-11-02'),
    )
    expect(out[0]).toMatchObject({ state: 'active', remaining: 5 })
  })
})

describe('M5 slice C: recording a suspension', () => {
  it('needs a reason, and writes ONE appended event (never an update)', async () => {
    await expect(
      withDb({}, () =>
        new PackageGrantsService().recordSuspension(ctx, 'g1', { kind: 'SUSPEND', reason: '  ' }),
      ),
    ).rejects.toThrow('SUSPENSION_REASON_REQUIRED')

    const written = await withDb(
      {
        package_credit_ledger: { data: { id: 'g1' }, error: null },
        package_credit_suspensions: { data: { id: 'e1' }, error: null },
      },
      async (calls) => {
        const result = await new PackageGrantsService().recordSuspension(ctx, 'g1', {
          kind: 'SUSPEND',
          effectiveOn: '2026-11-02',
          reason: 'customer travelling',
        })
        return { result, calls }
      },
    )
    expect(written.result).toMatchObject({
      grantId: 'g1',
      kind: 'SUSPEND',
      effectiveOn: '2026-11-02',
    })
    expect(
      written.calls.filter((c) => c.table === 'package_credit_suspensions' && c.op === 'insert'),
    ).toHaveLength(1)
    expect(written.calls[0]!.payload).toMatchObject({
      workspace_id: ctx.workspaceId,
      grant_entry_id: 'g1',
      kind: 'SUSPEND',
      created_by: ctx.userId,
    })
  })

  it('refuses a GRANT that is not in this workspace', async () => {
    await expect(
      withDb({ package_credit_ledger: { data: null, error: null } }, () =>
        new PackageGrantsService().recordSuspension(ctx, 'foreign', {
          kind: 'SUSPEND',
          reason: 'x',
        }),
      ),
    ).rejects.toThrow()
  })

  it('refuses an unknown kind', async () => {
    await expect(
      withDb({}, () =>
        new PackageGrantsService().recordSuspension(ctx, 'g1', {
          kind: 'DELETE' as never,
          reason: 'x',
        }),
      ),
    ).rejects.toThrow('SUSPENSION_KIND_INVALID')
  })
})
