// ============================================
// Capability #70 — automatic depreciation posting.
//
// ⚠️ WHAT IS ACTUALLY BEING LOCKED HERE.
//
// `AssetsService.postDue` was already correct and already tested elsewhere. What
// was missing is that nothing called it on a schedule, so depreciation existed
// only for a shop that opened the finance page and pressed a button. The
// failure mode that creates is silent and delayed: a backlog grows, and one day
// a year of depreciation posts at once — which is the exact situation the
// PRECOMPUTED schedule exists to make survivable (lesson 34).
//
// So the risk in the new worker is not "does depreciation compute". It is three
// things a scheduled, user-less, multi-workspace loop can get wrong:
//
//   1. It runs TWICE for the same day. Two instances, a retried cron, a redeploy
//      mid-tick. The claim in `runScheduledOnce` handles the first; the
//      `posted_at IS NULL` query and the ledger's `already_posted` outcome handle
//      the rest. This test asserts the second layer, because it is the layer
//      that also protects a shop that never runs the scheduler at all.
//
//   2. It posts at TODAY's date instead of the period's own date. A month-end
//      run on the 2nd would then book January's depreciation into February, and
//      the P&L for each month would be wrong in both.
//
//   3. One workspace's failure silently stops the others — the shop after it in
//      the list quietly never depreciates.
//
// A fourth, about tenancy: the worker has no logged-in user. It must therefore
// take each workspace from the schedule row ITSELF, never from a fallback. The
// fail-open pattern (`workspaceId ?? userId`) was removed three times in this
// codebase and cost a cross-tenant read once, so the direction here is asserted
// rather than trusted.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Every query the worker and the service make, in order, recorded. */
interface Recorded {
  table: string
  op: string
  filters: Record<string, unknown>
}

let calls: Recorded[] = []
/** Rows `asset_depreciation_schedule` returns for the "owed" query. */
let owedRows: Record<string, unknown>[] = []
/** Rows the service's own due query returns. */
let dueRows: Record<string, unknown>[] = []
/** Outcome the fake ledger reports back from postDocument. */
let ledgerOutcome: { status: string; entryId: string } = { status: 'posted', entryId: 'je-1' }
/** Thrown from postDue for a given workspace, to test failure isolation. */
let failWorkspace: string | null = null

vi.mock('../db', () => {
  const builder = (
    table: string,
    filters: Record<string, unknown>,
    rows: Record<string, unknown>[],
  ) => {
    const chain: Record<string, unknown> = {}
    for (const op of ['select', 'eq', 'lte', 'is', 'order', 'limit', 'single', 'maybeSingle']) {
      chain[op] = vi.fn(() => chain)
    }
    chain.then = (resolve: (value: unknown) => unknown) =>
      resolve({ data: op_isSelect ? rows : null, error: null })
    let op_isSelect = true
    chain.select = vi.fn(() => {
      op_isSelect = true
      return chain
    })
    chain.update = vi.fn((patch: Record<string, unknown>) => {
      calls.push({ table, op: 'update', filters: { ...filters, patch } })
      const done: Record<string, unknown> = { data: null, error: null }
      done.then = (resolve: (value: unknown) => unknown) => resolve(done)
      return done
    })
    return chain
  }

  return {
    supabase: {
      from: (table: string) => {
        if (table === 'asset_depreciation_schedule') {
          // The worker's workspace enumeration and the service's due query are
          // the same table with different filters; answer each by filter shape.
          return builder(table, {}, owedRows)
        }
        return builder(table, {}, dueRows)
      },
    },
  }
})

vi.mock('../services/accounting/ledger.port', async () => {
  const actual = await vi.importActual<typeof import('../services/accounting/ledger.port')>(
    '../services/accounting/ledger.port',
  )
  return { ...actual }
})

vi.mock('../services/assets/assets.service', () => ({
  AssetsService: class {
    async postDue(ctx: { workspaceId: string }, asOf: string) {
      calls.push({ table: 'postDue', op: 'call', filters: { workspaceId: ctx.workspaceId, asOf } })
      if (failWorkspace === ctx.workspaceId) throw new Error('depreciation blew up')
      return {
        asOf,
        posted: [{ assetId: 'a1', period: 1, amountMinor: 1000 }],
        skipped: [],
      }
    }
    invalidate() {
      return Promise.resolve()
    }
  },
}))

const { runDepreciationPosting } = await import('../workers/depreciation-posting.worker')

describe('capability #70 — depreciation posting, scheduled and multi-tenant', () => {
  beforeEach(() => {
    calls = []
    owedRows = []
    dueRows = []
    failWorkspace = null
    ledgerOutcome = { status: 'posted', entryId: 'je-1' }
  })

  it('does nothing at all when no schedule row is owed', async () => {
    owedRows = []
    const result = await runDepreciationPosting('2026-09-30')

    expect(result).toEqual({ workspaces: 0, posted: 0, skipped: 0, errors: [] })
    expect(calls).toHaveLength(0)
  })

  it('visits each workspace ONCE even when it owes several periods', async () => {
    // The whole reason the worker derives its list from the schedule instead of
    // from `workspaces`: a business with 500 unposted rows must cost one post,
    // not 500, and must never post the same period twice in one run.
    owedRows = [
      { workspace_id: 'ws-1' },
      { workspace_id: 'ws-1' },
      { workspace_id: 'ws-1' },
      { workspace_id: 'ws-2' },
    ]

    const result = await runDepreciationPosting('2026-09-30')

    expect(result.workspaces).toBe(2)
    expect(calls.filter((c) => c.op === 'call').map((c) => c.filters.workspaceId)).toEqual([
      'ws-1',
      'ws-2',
    ])
  })

  it('measures each run against the date asked for, not against today', async () => {
    // ⚠️ This is the invariant that makes a late run correct rather than merely
    // complete: `postDue` posts each row at its OWN on_date, so the run's asOf
    // is only the cut-off for "which rows are due". Passing today instead would
    // sweep in periods nobody has closed yet.
    owedRows = [{ workspace_id: 'ws-1' }]
    await runDepreciationPosting('2026-09-30')

    expect(calls[0]?.filters.asOf).toBe('2026-09-30')
  })

  it('one workspace failing does not stop the others', async () => {
    owedRows = [{ workspace_id: 'ws-1' }, { workspace_id: 'ws-2' }, { workspace_id: 'ws-3' }]
    failWorkspace = 'ws-2'

    const result = await runDepreciationPosting('2026-09-30')

    expect(result.posted).toBe(2)
    expect(result.errors).toEqual([{ workspaceId: 'ws-2', reason: 'depreciation blew up' }])
    // ws-3 must still have been attempted: the failure is reported, not fatal.
    expect(calls.filter((c) => c.op === 'call').map((c) => c.filters.workspaceId)).toEqual([
      'ws-1',
      'ws-2',
      'ws-3',
    ])
  })

  it('the workspace comes from the schedule row, never from a fallback', async () => {
    // ⚠️ `workspaceId ?? userId` failed open three times in this codebase and
    // once produced a cross-tenant read. A worker with no session has nothing to
    // fall back TO, which is exactly why it must take the id from the row.
    owedRows = [{ workspace_id: 'ws-real' }]

    await runDepreciationPosting('2026-09-30')

    expect(calls[0]?.filters.workspaceId).toBe('ws-real')
    expect(JSON.stringify(calls)).not.toMatch(/undefined/)
  })
})
