// ============================================
// D1 — webhook → subscription resolution, end to end.
//
// A Stripe webhook must land on OUR subscription row by STRIPE identifiers,
// mutate BY PRIMARY KEY, and refuse to report success when nothing was
// mutated. The legacy client_reference_id branch is pinned here too: it may
// only ever reach the buyer's OWN oldest row, and a stronger identifier
// present in the same payload always wins over it.
//
// Every assertion about scoping is made on the QUERY (which filters were
// sent) as well as the outcome, because outcome assertions alone pass for
// the wrong reason.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

interface Filter {
  column: string
  value: unknown
}

interface LoggedQuery {
  table: string
  filters: Filter[]
}

const tables = new Map<string, Row[]>()
let queryLog: LoggedQuery[] = []
let seq = 0

function rowsOf(table: string): Row[] {
  const existing = tables.get(table)
  if (existing) return existing
  const created: Row[] = []
  tables.set(table, created)
  return created
}

function passes(row: Row, filters: Filter[]): boolean {
  return filters.every((f) => row[f.column] === f.value)
}

function makeQuery(table: string) {
  const filters: Filter[] = []
  let orderColumn: string | null = null
  let ascending = true
  let limitN = Infinity
  let pendingUpdate: Row | null = null
  let pendingDelete = false

  const exec = async (): Promise<{ data: unknown; error: unknown }> => {
    queryLog.push({ table, filters: [...filters] })

    if (pendingDelete) {
      const targets = rowsOf(table).filter((r) => passes(r, filters))
      tables.set(
        table,
        rowsOf(table).filter((r) => !targets.includes(r)),
      )
      return { data: targets, error: null }
    }

    if (pendingUpdate) {
      const patch = pendingUpdate
      const targets = rowsOf(table).filter((r) => passes(r, filters))
      for (const row of targets) Object.assign(row, patch)
      return { data: targets, error: null }
    }

    const found = rowsOf(table).filter((r) => passes(r, filters))
    const ordered = orderColumn
      ? [...found].sort((a, b) => {
          const ka = String(a[orderColumn!])
          const kb = String(b[orderColumn!])
          return ascending ? ka.localeCompare(kb) : kb.localeCompare(ka)
        })
      : found

    return { data: ordered.slice(0, limitN), error: null }
  }

  const api: Record<string, unknown> = {
    select: () => api,
    eq: (column: string, value: unknown) => {
      filters.push({ column, value })
      return api
    },
    gte: () => api,
    lt: () => api,
    order: (column: string, opts?: { ascending?: boolean }) => {
      orderColumn = column
      ascending = opts?.ascending !== false
      return api
    },
    limit: (n: number) => {
      limitN = n
      return api
    },
    delete: () => {
      pendingDelete = true
      return api
    },
    update: (values: Row) => {
      pendingUpdate = values
      return api
    },
    upsert: async (values: Row, opts?: { ignoreDuplicates?: boolean }) => {
      queryLog.push({ table, filters: [] })
      const rows = rowsOf(table)
      const existing = rows.find((r) => r.id === values.id)
      if (existing && !opts?.ignoreDuplicates) Object.assign(existing, values)
      if (!existing) rows.push({ ...values })
      return { data: [values], error: null }
    },
    // The claim: one row per event id, a second insert of the same id is a 23505
    // (the webhook is already being, or has been, processed).
    insert: async (values: Row) => {
      queryLog.push({ table, filters: [] })
      const rows = rowsOf(table)
      if (rows.some((r) => r.id === values.id)) {
        return { data: null, error: { code: '23505', message: 'duplicate key value' } }
      }
      rows.push({ ...values })
      return { data: [values], error: null }
    },
    single: async () => {
      const out = await exec()
      const list = Array.isArray(out.data) ? out.data : [out.data]
      const first = list[0]
      if (!first) return { data: null, error: { code: 'PGRST116', message: 'no rows' } }
      return { data: first, error: null }
    },
    maybeSingle: async () => {
      const out = await exec()
      const list = Array.isArray(out.data) ? out.data : [out.data]
      return { data: list[0] ?? null, error: null }
    },
    then: (resolve: (v: { data: unknown; error: unknown }) => unknown) => exec().then(resolve),
  }

  return api
}

vi.mock('../utils/pagination', () => ({
  memoryCache: {
    get: async () => null,
    set: async () => undefined,
    invalidate: async () => undefined,
    clear: async () => undefined,
  },
}))

vi.mock('../db', () => ({
  supabase: { from: (table: string) => makeQuery(table) },
}))

const { WebhookService } = await import('../services/webhook.service')

/* ── Fixtures ──────────────────────────────────────────────────────────── */

const BUYER = 'user-buyer'
const BYSTANDER = 'user-bystander'
const WS_BUYER = 'ws-buyer'

function seedSubscription(opts: {
  userId: string
  workspaceId?: string | null
  plan?: string
  createdAt: string
  periodEnd?: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
}): Row {
  const row: Row = {
    id: `sub-${++seq}`,
    user_id: opts.userId,
    workspace_id: opts.workspaceId ?? null,
    plan: opts.plan ?? 'free',
    status: 'active',
    is_trial: false,
    trial_used: true,
    created_at: opts.createdAt,
    period_end: opts.periodEnd ?? '2026-01-15T00:00:00Z',
    ...(opts.stripeCustomerId !== undefined && { stripe_customer_id: opts.stripeCustomerId }),
    ...(opts.stripeSubscriptionId !== undefined && {
      stripe_subscription_id: opts.stripeSubscriptionId,
    }),
  }
  rowsOf('subscriptions').push(row)
  return row
}

const service = new WebhookService()

/** A minimal Stripe-shaped event. */
function event(
  id: string,
  type: string,
  object: Record<string, unknown>,
): { id: string; type: string; data: Record<string, unknown>; timestamp: Date } {
  return { id, type, data: { object }, timestamp: new Date('2026-01-01T00:00:00Z') }
}

beforeEach(() => {
  tables.clear()
  queryLog = []
  seq = 0
})

/* ═══════════════════════════════════════════════════════════════════════════
   Resolution by Stripe identifiers
   ═══════════════════════════════════════════════════════════════════════════ */

describe('checkout.session.completed resolves by STRIPE ids', () => {
  it('finds our row by stripe_subscription_id, upgrades it, persists both ids', async () => {
    const row = seedSubscription({
      userId: BUYER,
      workspaceId: WS_BUYER,
      stripeSubscriptionId: 'sub_stripe_1',
      createdAt: '2026-01-01',
    })

    const result = await service.processWebhook(
      event('evt_1', 'checkout.session.completed', {
        subscription: 'sub_stripe_1',
        customer: 'cus_1',
        metadata: { plan: 'enterprise', interval: 'year' },
      }),
    )

    expect(result.success).toBe(true)
    expect(result.action).toBe('upgraded')
    expect(row.plan).toBe('enterprise')
    expect(row.stripe_customer_id).toBe('cus_1')
    expect(row.is_trial).toBe(false)

    // The resolution query filtered on the Stripe subscription id — asserted
    // on the query itself, not inferred from the outcome.
    const resolution = queryLog.find(
      (q) =>
        q.table === 'subscriptions' && q.filters.some((f) => f.column === 'stripe_subscription_id'),
    )
    expect(resolution).toBeDefined()
    expect(
      queryLog.some(
        (q) =>
          q.table === 'subscriptions' &&
          q.filters.length > 0 &&
          q.filters.every((f) => f.column === 'id'),
      ),
    ).toBe(true) // the final mutation was addressed by OUR primary key
  })

  it('a Stripe-id payload NEVER falls through to another user via client_reference_id', async () => {
    // Attacker-controlled crid names the bystander; the legitimate Stripe
    // subscription id names the buyer. Resolution must stop at the Stripe id.
    const buyerRow = seedSubscription({
      userId: BUYER,
      stripeSubscriptionId: 'sub_stripe_2',
      createdAt: '2026-01-01',
    })
    const bystanderRow = seedSubscription({ userId: BYSTANDER, createdAt: '2026-01-01' })

    const result = await service.processWebhook(
      event('evt_2', 'checkout.session.completed', {
        subscription: 'sub_stripe_2',
        client_reference_id: BYSTANDER, // forged / stale
        metadata: { plan: 'pro', interval: 'month' },
      }),
    )

    expect(result.success).toBe(true)
    expect(buyerRow.plan).toBe('pro')
    expect(bystanderRow.plan).toBe('free') // untouched
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   The LEGACY branch: client_reference_id only, own-row only
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the legacy client_reference_id branch is confined', () => {
  it('resolves an unstamped row to its OWN buyer and nobody else', async () => {
    const buyerRow = seedSubscription({ userId: BUYER, createdAt: '2026-01-01' })
    const bystanderRow = seedSubscription({ userId: BYSTANDER, createdAt: '2026-01-01' })

    const result = await service.processWebhook(
      event('evt_legacy', 'customer.subscription.deleted', {
        client_reference_id: BUYER,
      }),
    )

    expect(result.success).toBe(true)
    expect(buyerRow.status).toBe('cancelled')
    expect(bystanderRow.status).toBe('active')

    const resolution = queryLog.find(
      (q) => q.table === 'subscriptions' && q.filters.some((f) => f.column === 'user_id'),
    )!
    // The legacy lookup is pinned to the buyer's identity, ordered oldest-first.
    expect(resolution.filters).toEqual([{ column: 'user_id', value: BUYER }])
  })

  it('cannot reach any row when the crid names a user who owns none', async () => {
    seedSubscription({ userId: BUYER, createdAt: '2026-01-01' })

    const result = await service.processWebhook(
      event('evt_ghost', 'invoice.payment_failed', {
        client_reference_id: 'user-nobody',
      }),
    )

    // Not reported handled: success:false so Stripe retries.
    expect(result.success).toBe(false)
    expect(rowsOf('subscriptions')[0]?.status).toBe('active') // nothing mutated
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Never claim success when the intended mutation did not happen
   ═══════════════════════════════════════════════════════════════════════════ */

describe('failures are reported as failures', () => {
  it('an unresolvable checkout event is NOT a success', async () => {
    const result = await service.processWebhook(
      event('evt_orphan', 'checkout.session.completed', {
        metadata: { plan: 'pro' },
      }),
    )
    expect(result.success).toBe(false)
  })

  it('an unmapped Stripe status throws instead of being written verbatim', async () => {
    const row = seedSubscription({
      userId: BUYER,
      stripeSubscriptionId: 'sub_stripe_9',
      createdAt: '2026-01-01',
    })

    const result = await service.processWebhook(
      event('evt_status', 'customer.subscription.updated', {
        subscription: 'sub_stripe_9',
        status: 'incomplete_expired', // real Stripe value, unmapped by us
      }),
    )

    expect(result.success).toBe(false)
    expect(row.status).toBe('active') // the old `as any` wrote this verbatim
  })

  it('an unrecognized plan in metadata is refused, never defaulted to pro', async () => {
    const row = seedSubscription({
      userId: BUYER,
      stripeSubscriptionId: 'sub_stripe_10',
      createdAt: '2026-01-01',
    })

    const result = await service.processWebhook(
      event('evt_plan', 'checkout.session.completed', {
        subscription: 'sub_stripe_10',
        metadata: { plan: 'diamond-titanium' },
      }),
    )

    expect(result.success).toBe(false)
    expect(row.plan).toBe('free')
  })

  it('an unmapped status never marks the event processed', async () => {
    seedSubscription({ userId: BUYER, stripeSubscriptionId: 'sub_s11', createdAt: '2026-01-01' })

    await service.processWebhook(
      event('evt_nolog', 'customer.subscription.updated', {
        subscription: 'sub_s11',
        status: 'unpaid',
      }),
    )

    expect(rowsOf('webhook_events')).toEqual([]) // logWebhook skipped on failure
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Status mapping and renewal extension on the resolved row
   ═══════════════════════════════════════════════════════════════════════════ */

describe('mutations land on the resolved primary key', () => {
  it('maps canceled → cancelled through the enum', async () => {
    const row = seedSubscription({
      userId: BUYER,
      stripeSubscriptionId: 'sub_c1',
      createdAt: '2026-01-01',
    })

    const result = await service.processWebhook(
      event('evt_cancel', 'customer.subscription.deleted', {
        subscription: 'sub_c1',
      }),
    )

    expect(result.success).toBe(true)
    expect(row.status).toBe('cancelled')
  })

  it('invoice.paid extends period_end by one month on the resolved row', async () => {
    const row = seedSubscription({
      userId: BUYER,
      stripeSubscriptionId: 'sub_r1',
      createdAt: '2026-01-01',
      // In the future: a renewal of a LAPSED subscription starts from now
      // (billing.extendSubscriptionRow), so a fixed past date made this test
      // depend on the day it ran.
      periodEnd: '2099-01-15T00:00:00Z',
    })

    const result = await service.processWebhook(
      event('evt_renew', 'invoice.paid', {
        subscription: 'sub_r1',
      }),
    )

    expect(result.success).toBe(true)
    // toISOString() spells milliseconds explicitly — the month arithmetic is
    // what this pins.
    expect(row.period_end).toBe('2099-02-15T00:00:00.000Z')
  })

  it('a successful event is logged to webhook_events exactly once', async () => {
    seedSubscription({ userId: BUYER, stripeSubscriptionId: 'sub_l1', createdAt: '2026-01-01' })

    await service.processWebhook(event('evt_log', 'invoice.paid', { subscription: 'sub_l1' }))

    const logged = rowsOf('webhook_events')
    expect(logged).toHaveLength(1)
    expect(logged[0]?.id).toBe('evt_log')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   A temporary failure must never poison a valid event
   ═══════════════════════════════════════════════════════════════════════════ */

describe('a failed delivery can be retried; a successful one cannot be repeated', () => {
  const renewal = (id: string) => event(id, 'invoice.paid', { subscription: 'sub_retry' })

  it('fails while the subscription is not there yet, then succeeds on the retry', async () => {
    const first = await service.processWebhook(renewal('evt_retry'))
    expect(first.success).toBe(false)
    // The claim was released: nothing is left that would answer the retry «already processed».
    expect(rowsOf('webhook_events').filter((r) => r.id === 'evt_retry')).toHaveLength(0)

    const row = seedSubscription({
      userId: BUYER,
      stripeSubscriptionId: 'sub_retry',
      createdAt: '2026-01-01',
      periodEnd: '2099-01-15T00:00:00Z',
    })
    const second = await service.processWebhook(renewal('evt_retry'))
    expect(second.success).toBe(true)
    expect(row.period_end).toBe('2099-02-15T00:00:00.000Z')
  })

  it('a successful event delivered again is answered, and applied once', async () => {
    const row = seedSubscription({
      userId: BUYER,
      stripeSubscriptionId: 'sub_retry',
      createdAt: '2026-01-01',
      periodEnd: '2099-01-15T00:00:00Z',
    })
    await service.processWebhook(renewal('evt_once'))
    const again = await service.processWebhook(renewal('evt_once'))

    expect(again).toMatchObject({ success: true, action: 'already_processed' })
    expect(row.period_end).toBe('2099-02-15T00:00:00.000Z')
    expect(rowsOf('webhook_events').filter((r) => r.id === 'evt_once')).toHaveLength(1)
  })

  it('two deliveries at the same moment are applied once', async () => {
    const row = seedSubscription({
      userId: BUYER,
      stripeSubscriptionId: 'sub_retry',
      createdAt: '2026-01-01',
      periodEnd: '2099-01-15T00:00:00Z',
    })
    const [a, b] = await Promise.all([
      service.processWebhook(renewal('evt_twin')),
      service.processWebhook(renewal('evt_twin')),
    ])

    expect([a.action, b.action].sort()).toEqual(['already_processed', 'invoice_paid'])
    expect(row.period_end).toBe('2099-02-15T00:00:00.000Z')
  })

  it('a restarted process (a new service, the cache gone) still knows the event was applied', async () => {
    const row = seedSubscription({
      userId: BUYER,
      stripeSubscriptionId: 'sub_retry',
      createdAt: '2026-01-01',
      periodEnd: '2099-01-15T00:00:00Z',
    })
    await service.processWebhook(renewal('evt_restart'))
    const afterRestart = await new WebhookService().processWebhook(renewal('evt_restart'))

    expect(afterRestart).toMatchObject({ success: true, action: 'already_processed' })
    expect(row.period_end).toBe('2099-02-15T00:00:00.000Z')
  })

  it('an id reused with a different payload is the same event, not a second one', async () => {
    const row = seedSubscription({
      userId: BUYER,
      stripeSubscriptionId: 'sub_retry',
      createdAt: '2026-01-01',
      periodEnd: '2099-01-15T00:00:00Z',
    })
    await service.processWebhook(renewal('evt_same_id'))
    const other = await service.processWebhook(
      event('evt_same_id', 'invoice.paid', { subscription: 'sub_other' }),
    )

    expect(other.action).toBe('already_processed')
    expect(row.period_end).toBe('2099-02-15T00:00:00.000Z')
  })

  it('a failure that keeps failing never marks the event processed', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await service.processWebhook(renewal('evt_never'))
      expect(result.success).toBe(false)
    }
    expect(rowsOf('webhook_events').filter((r) => r.id === 'evt_never')).toHaveLength(0)
  })
})
