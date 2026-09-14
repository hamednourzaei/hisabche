// ============================================
// backend/src/__tests__/ledger-batch-idempotency.test.ts
//
// «ثبت فاکتورهای ثبت‌نشده در دفتر» under retries, partial failure and
// concurrency.
//
// What is proven HERE (in-process, stubbed persistence):
//   · the batch walks by cursor, ≤ 25 per call, and terminates
//   · already-booked invoices are counted as alreadyPosted, never posted
//   · one failing invoice does not stop the others; its reason is a safe code
//   · postDocument, losing the unique-index race (23505) to a concurrent
//     writer, returns the EXISTING entry as `already_posted` — one entry, and
//     the loser does not count it as its own
//
// What is NOT provable here and is enforced by the database:
//   · journal_entries_source_key UNIQUE (workspace_id, source_type, source_id)
//   · accounting_post_journal_entry writes entry + lines in one transaction
//   · inventory_consume_layers: per-line advisory lock
//     (docs/inventory-consume-concurrency-migration.sql)
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Minimal supabase stub: only what postAllUnposted's reads need ──────────
const state = {
  invoices: [] as Array<{ id: string; status: string | null }>,
  booked: new Set<string>(),
}

function query(table: string) {
  const filters: { gt?: string; in?: string[]; limit?: number } = {}
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    gt: (_c: string, v: string) => ((filters.gt = v), builder),
    in: (_c: string, v: string[]) => ((filters.in = v), builder),
    limit: (n: number) => ((filters.limit = n), builder),
    insert: async () => ({ error: null }),
    then: (resolve: (v: unknown) => void) => {
      if (table === 'invoices') {
        const rows = state.invoices
          .filter((r) => !filters.gt || r.id > filters.gt)
          .sort((a, b) => a.id.localeCompare(b.id))
          .slice(0, filters.limit ?? 1000)
        return resolve({ data: rows, error: null })
      }
      if (table === 'journal_entries') {
        const rows = (filters.in ?? [])
          .filter((id) => state.booked.has(id))
          .map((id) => ({ source_id: id }))
        return resolve({ data: rows, error: null })
      }
      return resolve({ data: [], error: null })
    },
  }
  return builder
}

vi.mock('../db', () => ({
  supabase: { from: (t: string) => query(t), rpc: async () => ({ data: null, error: null }) },
}))

const ctx = { workspaceId: 'w1', userId: 'u1', role: 'owner' } as any

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

describe('postAllUnposted — batching, counts, isolation', () => {
  beforeEach(() => {
    state.invoices = []
    state.booked = new Set()
  })

  async function service() {
    const { InvoiceService } = await import('../services/invoice.service')
    return new InvoiceService()
  }

  it('walks every invoice in ≤ 25 per call and stops', async () => {
    state.invoices = Array.from({ length: 60 }, (_, i) => ({ id: id(i + 1), status: 'issued' }))
    const svc = await service()
    const post = vi.spyOn(svc, 'postToLedger').mockImplementation(async (invoiceId) => {
      state.booked.add(invoiceId)
      return { status: 'posted' }
    })

    const seen: number[] = []
    let cursor: string | null = null
    let rounds = 0
    do {
      const batch = await svc.postAllUnposted(ctx, { afterId: cursor })
      expect(batch.checked).toBeLessThanOrEqual(25)
      seen.push(batch.posted)
      cursor = batch.nextCursor
      rounds++
    } while (cursor && rounds < 10)

    expect(rounds).toBe(3)
    expect(seen.reduce((a, b) => a + b, 0)).toBe(60)
    expect(post).toHaveBeenCalledTimes(60)
  })

  it('Scenario A/E — retrying a committed batch posts nothing again', async () => {
    state.invoices = [id(1), id(2)].map((i) => ({ id: i, status: 'issued' }))
    const svc = await service()
    const post = vi.spyOn(svc, 'postToLedger').mockImplementation(async (invoiceId) => {
      state.booked.add(invoiceId)
      return { status: 'posted' }
    })

    const first = await svc.postAllUnposted(ctx)
    // The response is "lost"; the client retries the same batch.
    const retry = await svc.postAllUnposted(ctx)

    expect(first).toMatchObject({ posted: 2, alreadyPosted: 0 })
    expect(retry).toMatchObject({ posted: 0, alreadyPosted: 2 })
    expect(post).toHaveBeenCalledTimes(2)
  })

  it('Scenario B — A ok, B fails, C ok; retry books only B', async () => {
    state.invoices = [id(1), id(2), id(3)].map((i) => ({ id: i, status: 'issued' }))
    const svc = await service()
    let failB = true
    vi.spyOn(svc, 'postToLedger').mockImplementation(async (invoiceId) => {
      if (invoiceId === id(2) && failB) {
        throw new Error('INVENTORY_SOMETHING: relation "cost_layers" details that must not leak')
      }
      state.booked.add(invoiceId)
      return { status: 'posted' }
    })

    const first = await svc.postAllUnposted(ctx)
    expect(first.posted).toBe(2)
    expect(first.skipped).toEqual([
      { invoiceId: id(2), status: 'error', detail: 'INVENTORY_SOMETHING' },
    ])
    expect(JSON.stringify(first)).not.toContain('cost_layers')

    failB = false
    const retry = await svc.postAllUnposted(ctx)
    expect(retry).toMatchObject({ posted: 1, alreadyPosted: 2, skipped: [] })
  })

  it('cancelled / held invoices are excluded, not failures', async () => {
    state.invoices = [
      { id: id(1), status: 'cancelled' },
      { id: id(2), status: 'pending' },
    ]
    const svc = await service()
    const post = vi.spyOn(svc, 'postToLedger')
    const batch = await svc.postAllUnposted(ctx)
    expect(batch).toMatchObject({ checked: 2, posted: 0, excluded: 2, skipped: [] })
    expect(post).not.toHaveBeenCalled()
  })

  it('a concurrent winner reported by postToLedger counts as alreadyPosted', async () => {
    state.invoices = [{ id: id(1), status: 'issued' }]
    const svc = await service()
    vi.spyOn(svc, 'postToLedger').mockResolvedValue({ status: 'already_posted' })
    const batch = await svc.postAllUnposted(ctx)
    expect(batch).toMatchObject({ posted: 0, alreadyPosted: 1 })
  })

  it('an empty batch has no cursor', async () => {
    const svc = await service()
    expect(await svc.postAllUnposted(ctx)).toMatchObject({ checked: 0, nextCursor: null })
  })
})

describe('postDocument — Scenario C/D: two writers, one journal entry', () => {
  it('the loser of the unique-index race returns the winner as already_posted', async () => {
    const { AccountingService } = await import('../services/accounting/accounting.service')

    let lookups = 0
    const repo: any = {
      // First lookup (before writing): nothing yet. After the 23505: the winner.
      findEntryBySource: async () =>
        lookups++ === 0 ? null : { id: 'winner-entry', status: 'posted' },
      listPeriodLocks: async () => [],
      lastEntrySequence: async () => 0,
      listAccounts: async () => [
        {
          id: 'cash',
          code: '1010',
          name: 'c',
          type: 'asset',
          role: 'cash',
          parentId: null,
          isGroup: false,
          isActive: true,
          createdAt: null,
        },
        {
          id: 'sales',
          code: '4000',
          name: 's',
          type: 'revenue',
          role: 'sales',
          parentId: null,
          isGroup: false,
          isActive: true,
          createdAt: null,
        },
      ],
      postEntry: async () => {
        throw Object.assign(
          new Error('duplicate key value violates unique constraint "journal_entries_source_key"'),
          {
            code: '23505',
          },
        )
      },
    }

    const ledger = new AccountingService(repo)
    const outcome = await ledger.postDocument(
      { workspaceId: 'w-race', userId: 'u1', role: 'owner' } as any,
      {
        sourceType: 'invoice',
        sourceId: 'inv-1',
        date: '2026-09-14',
        description: 'sale',
        lines: [
          { accountId: 'cash', debit: 100, credit: 0 },
          { accountId: 'sales', debit: 0, credit: 100 },
        ],
      } as any,
    )

    expect(outcome).toEqual({ status: 'already_posted', entryId: 'winner-entry' })
  })
})
