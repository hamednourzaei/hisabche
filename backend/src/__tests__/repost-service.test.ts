// ============================================
// Capability #69, step 3 — the cost repost service.
//
// ⚠️ WHY THIS FILE IS MOSTLY ABOUT DIRECTION.
//
// `planRepost` already computes the right numbers and `month-end-package.test`
// already tests the stop condition. Neither can catch the mistake this service is
// actually capable of making: writing the correction with the wrong DR/CR.
//
// A cost that came out HIGHER than recorded means the inventory asset was
// understated ⇒ Cr inventory, Dr COGS. A cost that came out LOWER is the
// mirror. Writing both as Dr COGS / Cr inventory — the shape that looks obvious
// and is the one a developer reaches for — books a cost SAVING as a cost
// increase. The books still balance. Every gross margin in the shop is now
// wrong, and nothing anywhere reports an error.
//
// That is the same failure class as `partyBalance`'s sign convention (lesson 10)
// and the accounting-rule lesson before it: a signed error produces a document
// that looks entirely reasonable.
//
// The other two things locked here are that the correction is a NEW entry rather
// than a rewrite, and that re-running the same window posts nothing the second
// time.
// ============================================

import { describe, expect, it, vi } from 'vitest'

const posted: {
  sourceType: string
  sourceId: string
  lines: { accountId: string; debit: number; credit: number }[]
}[] = []

let accounts = { inventory: 'acc-inv', cogs: 'acc-cogs' }
let resolveOutcome: { status: string } = { status: 'posted' }
let trail: Record<string, unknown>[] = []
let layers: Record<string, unknown>[] = []

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {}
      for (const op of ['select', 'eq', 'gte', 'lte', 'not', 'order', 'limit', 'range']) {
        chain[op] = vi.fn(() => chain)
      }
      // ⚠️ `range` matters: the service pages with `selectAllPages`, which stops
      // when a page comes back SHORTER than its page size. A stub that always
      // returned the full set would loop forever once the service was fixed to
      // page rather than cap — so the fake has to answer the paging shape.
      chain.then = (resolve: (v: unknown) => void) => {
        const all = table === 'cost_consumptions' ? trail : layers
        const range = (chain.range as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0]
        const from = typeof range === 'number' ? range : 0
        // `selectAllPages` asks for PAGE_SIZE rows; return fewer so it stops.
        const PAGE = 1000
        const slice = all.slice(from, from + PAGE - 1)
        resolve({ data: slice, error: null })
      }
      return chain
    },
  },
}))

// ⚠️ Path matters. `vi.mock` resolves relative to THIS file (`src/__tests__/`),
// not to the module under test — so `../accounting/...` is correct here and
// wrong inside `services/inventory-costing/`, which is one level deeper.
// The first version used `vi.mock('../accounting/accounting.service', ...)` and
// the real service loaded anyway, reaching a real repository and a real
// supabase call.
vi.mock('../services/accounting/accounting.service', () => ({
  AccountingService: class {
    async resolveAccountsByRole() {
      return { accounts, missing: [] }
    }
    async postDocument(
      _ctx: unknown,
      request: { sourceType: string; sourceId: string; lines: (typeof posted)[number]['lines'] },
    ) {
      posted.push(request)
      return resolveOutcome
    }
  },
}))

vi.mock('../services/tenancy.service', () => ({ TenancyContext: undefined }))

const { repostCosts } = await import('../services/inventory-costing/repost.service')

const ctx = { workspaceId: 'ws-1', userId: 'u-1' } as never

/** One layer @ 100, one consumption recorded at 150 — so cost came out LOWER. */
const baseTrail = (amount: number, quantity = 1) => [
  {
    consumer_type: 'invoice',
    consumer_id: 'inv-1',
    consumer_line: '1',
    product_id: 'prod-1',
    quantity,
    amount,
    entry_date: '2026-09-10',
    is_estimated: false,
  },
]

const layerRow = {
  id: 'layer-1',
  product_id: 'prod-1',
  warehouse_id: null,
  remaining_qty: 100,
  unit_cost: 100,
  entry_date: '2026-09-01',
  created_at: '2026-09-01T00:00:00Z',
}

describe('#69 — repost posts a correction, never a rewrite', () => {
  it('uses the cost_repost source type so the ledger keys it separately', async () => {
    posted.length = 0
    trail = baseTrail(150)
    layers = [layerRow]

    await repostCosts(ctx, '2026-09-01')

    expect(posted[0]?.sourceType).toBe('cost_repost')
  })

  it('the source id is stable per document+line+product', async () => {
    // ⚠️ What makes a re-run find its own entry instead of making a second one.
    posted.length = 0
    trail = baseTrail(150)
    layers = [layerRow]

    await repostCosts(ctx, '2026-09-01')
    await repostCosts(ctx, '2026-09-01')

    expect(posted[0]?.sourceId).toBe(posted[1]?.sourceId)
  })

  it('an already_posted outcome still counts as done', async () => {
    posted.length = 0
    trail = baseTrail(150)
    layers = [layerRow]
    resolveOutcome = { status: 'already_posted' }

    const result = await repostCosts(ctx, '2026-09-01')

    expect(result.posted).toBe(1)
    expect(result.netPostedMinor).toBe(-5000)
  })
})

describe('#69 — the direction of the correction follows the sign', () => {
  it('cost came out LOWER ⇒ Dr inventory, Cr COGS', async () => {
    // ⚠️ THE TEST THAT MATTERS. Recorded 150, recomputed 100 — the asset was
    // overstated by 50, so inventory drops and COGS is credited. Written the
    // other way round, this books a saving as a cost.
    posted.length = 0
    trail = baseTrail(150)
    layers = [layerRow]

    const result = await repostCosts(ctx, '2026-09-01')
    expect(result.netPostedMinor).toBe(-5000)

    const lines = posted[0]!.lines
    expect(lines).toEqual([
      { accountId: 'acc-inv', debit: 50, credit: 0 },
      { accountId: 'acc-cogs', debit: 0, credit: 50 },
    ])
  })

  it('cost came out HIGHER ⇒ Dr COGS, Cr inventory', async () => {
    posted.length = 0
    trail = baseTrail(50)
    layers = [layerRow]

    const result = await repostCosts(ctx, '2026-09-01')
    expect(result.netPostedMinor).toBe(5000)

    const lines = posted[0]!.lines
    expect(lines).toEqual([
      { accountId: 'acc-cogs', debit: 50, credit: 0 },
      { accountId: 'acc-inv', debit: 0, credit: 50 },
    ])
  })

  it('the entry always balances, whichever way it points', async () => {
    for (const recorded of [50, 150]) {
      posted.length = 0
      trail = baseTrail(recorded)
      layers = [layerRow]

      await repostCosts(ctx, '2026-09-01')

      const lines = posted[0]!.lines
      const debit = lines.reduce((sum, l) => sum + l.debit, 0)
      const credit = lines.reduce((sum, l) => sum + l.credit, 0)
      expect(debit).toBe(credit)
    }
  })
})

describe('#69 — a window with nothing to re-post writes nothing', () => {
  it('an empty trail produces no entry and no ledger call', async () => {
    posted.length = 0
    trail = []
    layers = [layerRow]

    const result = await repostCosts(ctx, '2026-09-01')

    expect(result).toEqual({
      fromDate: '2026-09-01',
      examined: 0,
      adjustments: [],
      posted: 0,
      netPostedMinor: 0,
    })
    expect(posted).toHaveLength(0)
  })

  it('a recomputation that AGREES writes nothing', async () => {
    // ⚠️ This is what makes the month-end package safe to run every period. If
    // the service posted "whatever the recomputation says", every run would
    // rewrite the ledger; `planRepost` emits nothing on agreement, and this test
    // is the reason that behaviour is not allowed to change quietly.
    posted.length = 0
    trail = baseTrail(100)
    layers = [layerRow]

    const result = await repostCosts(ctx, '2026-09-01')

    expect(result.posted).toBe(0)
    expect(result.netPostedMinor).toBe(0)
    expect(posted).toHaveLength(0)
  })
})

describe('#69 — a chart of accounts that is not set up says so', () => {
  it('a missing inventory or cogs account is reported, not posted blindly', async () => {
    posted.length = 0
    trail = baseTrail(150)
    layers = [layerRow]
    accounts = { inventory: undefined as never, cogs: 'acc-cogs' }

    const result = await repostCosts(ctx, '2026-09-01')

    expect(result.posted).toBe(0)
    expect(posted).toHaveLength(0)

    accounts = { inventory: 'acc-inv', cogs: 'acc-cogs' }
  })
})
