// ============================================
// Billing limits and entitlement quotas are WORKSPACE-scoped (DECISION A),
// count errors FAIL CLOSED, and Stripe identifiers persist.
//
// Defects pinned here (D1–D5 ledger):
//   D1  upgrade() persisted no Stripe ids, so webhooks could only resolve a
//       subscription by trusting client_reference_id. upgrade() now writes
//       stripe_customer_id / stripe_subscription_id, and
//       upgradeSubscriptionRow() addresses a row by OUR primary key.
//   D2  seat/invoice quotas counted the ACTING USER's rows. A three-member
//       shop burned the plan's quota three times over; conversely a user who
//       was a member of many workspaces could be blocked by other shops'
//       usage. Counts are per workspace now.
//   D3  the workspace quota filtered workspaces.user_id — a column that does
//       not exist — so the query errored, the count read as 0, and the quota
//       never bound. Ownership is workspaces.owner_id.
//   D4  a failed COUNT was read as 0 ("plenty of room"). Every quota count
//       now throws on error: an unreadable meter must not widen the cap, and
//       a workspace-scoped meter without a workspace context is refused
//       rather than falling back to the actor's own rows.
//   D5  writers flush BOTH spellings of the subscription cache key
//       (subscription:<uid> and subscription:ws:<wsid>) plus the
//       workspace usage report, matching how readers resolve.
//
// The fake PostgREST honours filters faithfully and logs every query, because
// "did the count carry workspace_id / owner_id" is the property under test —
// outcome assertions alone pass for the wrong reason.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

/* ── An in-memory PostgREST that honours filters ───────────────────────── */

type Row = Record<string, unknown>

interface Filter {
  column: string
  value: unknown
}

interface LoggedQuery {
  table: string
  op: 'select' | 'update'
  filters: Filter[]
  counting: boolean
}

const tables = new Map<string, Row[]>()
/** Table name → injected transport error; simulates PostgREST failure. */
const errTables = new Map<string, { message: string }>()
let queryLog: LoggedQuery[] = []

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

function sorted(rows: Row[], column: string | null, ascending: boolean): Row[] {
  if (!column) return rows
  return [...rows].sort((a, b) => {
    const ka = String(a[column])
    const kb = String(b[column])
    return ascending ? ka.localeCompare(kb) : kb.localeCompare(ka)
  })
}

function makeQuery(table: string) {
  const filters: Filter[] = []
  let orderColumn: string | null = null
  let ascending = true
  let limitN = Infinity
  let counting = false
  let pendingUpdate: Row | null = null

  const selected = () =>
    sorted(
      rowsOf(table).filter((r) => passes(r, filters)),
      orderColumn,
      ascending,
    )

  const failure = {
    data: null,
    error: { message: 'injected failure', code: 'PGRST-FAIL' },
    count: null,
  }

  const exec = async (): Promise<{ data: unknown; error: unknown; count: number | null }> => {
    queryLog.push({
      table,
      op: pendingUpdate ? 'update' : 'select',
      filters: [...filters],
      counting,
    })

    if (errTables.has(table)) return failure

    if (pendingUpdate) {
      const patch = pendingUpdate
      const targets = rowsOf(table).filter((r) => passes(r, filters))
      for (const row of targets) Object.assign(row, patch)
      return { data: targets, error: null, count: targets.length }
    }

    const found = selected().slice(0, limitN)
    if (counting) {
      // head:true — the payload is discarded, only the count survives.
      return { data: null, error: null, count: found.length }
    }
    return { data: found, error: null, count: found.length }
  }

  const api: Record<string, unknown> = {
    select: (_columns?: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.count) counting = true
      return api
    },
    eq: (column: string, value: unknown) => {
      filters.push({ column, value })
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
    update: (values: Row) => {
      pendingUpdate = values
      return api
    },
    single: async () => {
      const out = await exec()
      if (out.error) return out
      const list = Array.isArray(out.data) ? out.data : [out.data]
      const first = list[0]
      if (!first) return { data: null, error: { code: 'PGRST116', message: 'no rows' } }
      return { data: first, error: null }
    },
    maybeSingle: async () => {
      const out = await exec()
      if (out.error) return out
      const list = Array.isArray(out.data) ? out.data : [out.data]
      return { data: list[0] ?? null, error: null }
    },
    then: (resolve: (v: { data: unknown; error: unknown; count: number | null }) => unknown) =>
      exec().then(resolve),
  }

  return api
}

/* ── Mocks shared by every service under test ──────────────────────────── */

const invalidateCalls: string[] = []

vi.mock('../utils/pagination', () => ({
  memoryCache: {
    get: async () => null,
    set: async () => undefined,
    getShared: async () => null,
    setShared: async () => undefined,
    invalidate: async (key: string) => {
      invalidateCalls.push(key)
    },
    clear: async () => undefined,
  },
}))

vi.mock('../services/event-log.service', () => ({
  logBusinessEvent: async () => undefined,
}))

vi.mock('../db', () => ({
  supabase: { from: (table: string) => makeQuery(table) },
}))

const { EntitlementService } = await import('../services/entitlement.service')
const { BillingService } = await import('../services/billing.service')
const { CheckoutService } = await import('../services/checkout.service')
const { DatabaseError } = await import('../errors/database.error')

/* ── Fixtures ──────────────────────────────────────────────────────────── */

const U_PRO = 'user-pro'
const U_FREE = 'user-free'
const U_ATTACKER = 'user-attacker'

const WS_A = 'ws-a' // U_FREE's shop
const WS_B = 'ws-b' // a shop U_FREE merely sells in
const WS_PRO = 'ws-pro' // U_PRO's shop

let seq = 0

function seedSubscription(
  userId: string,
  plan: 'free' | 'pro',
  workspaceId: string | null,
  createdAt: string,
): Row {
  const row: Row = {
    id: `sub-${++seq}`,
    user_id: userId,
    workspace_id: workspaceId,
    plan,
    status: 'active',
    is_trial: false,
    trial_used: true,
    created_at: createdAt,
    period_end: '2026-01-01T00:00:00Z',
  }
  rowsOf('subscriptions').push(row)
  return row
}

function seedMember(workspaceId: string, userId: string): void {
  rowsOf('workspace_members').push({
    id: `mem-${++seq}`,
    workspace_id: userId ? workspaceId : workspaceId,
    user_id: userId,
  })
}

beforeEach(() => {
  tables.clear()
  errTables.clear()
  queryLog = []
  invalidateCalls.length = 0
  seq = 0

  // Subscriptions drive every entitlement lookup (plan per user).
  seedSubscription(U_PRO, 'pro', WS_PRO, '2026-01-01')
  seedSubscription(U_FREE, 'free', WS_A, '2026-01-01')
})

const ent = new EntitlementService()
const billing = new BillingService()

const ctxFor = (userId: string, workspaceId: string) => ({
  workspaceId,
  userId,
  role: 'owner' as const,
})

/* ═══════════════════════════════════════════════════════════════════════════
   D2 — seat quota counts THIS workspace's members, not the actor's memberships
   ═══════════════════════════════════════════════════════════════════════════ */

describe('D2 — the seat quota is per workspace', () => {
  it('allows a seat while THIS workspace is under the limit, ignoring other shops', async () => {
    // Pro allows 10 seats. WS_PRO has 8. U_PRO is ALSO a member of five other
    // businesses (13 memberships total) — the old user-scoped count saw 13
    // and wrongly blocked this shop from hiring.
    for (let i = 0; i < 8; i++) seedMember(WS_PRO, `member-${i}`)
    seedMember(WS_PRO, U_PRO)
    for (const ws of ['ws-x1', 'ws-x2', 'ws-x3', 'ws-x4', 'ws-x5']) seedMember(ws, U_PRO)

    const result = await ent.canPerformAction(ctxFor(U_PRO, WS_PRO), 'create_user')
    expect(result.allowed).toBe(true)
  })

  it('blocks a seat once THIS workspace reaches the plan limit', async () => {
    for (let i = 0; i < 11; i++) seedMember(WS_PRO, `member-${i}`)

    const result = await ent.canPerformAction(ctxFor(U_PRO, WS_PRO), 'create_user')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('limit of 10')
  })

  it('counts invoices for the workspace book, not the author', async () => {
    // Free allows 10 invoices. WS_A holds 5 (the shop's whole book). U_FREE
    // personally authored 12 across two shops — the old count saw 12 and
    // lied about this shop being full.
    for (let i = 0; i < 5; i++) {
      rowsOf('invoices').push({ id: `inv-a-${i}`, workspace_id: WS_A, user_id: `clerk-${i}` })
    }
    for (let i = 0; i < 7; i++) {
      rowsOf('invoices').push({ id: `inv-b-${i}`, workspace_id: WS_B, user_id: U_FREE })
    }

    const result = await ent.canPerformAction(ctxFor(U_FREE, WS_A), 'create_invoice')
    expect(result.allowed).toBe(true)
  })

  it('blocks invoicing once the WORKSPACE book reaches the limit', async () => {
    for (let i = 0; i < 10; i++) {
      rowsOf('invoices').push({ id: `inv-a-${i}`, workspace_id: WS_A, user_id: `clerk-${i}` })
    }

    const result = await ent.canPerformAction(ctxFor(U_FREE, WS_A), 'create_invoice')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('limit of 10')
  })

  it('checkUsageLimit agrees with the workspace scope', async () => {
    for (let i = 0; i < 5; i++) {
      rowsOf('transactions').push({ id: `tx-a-${i}`, workspace_id: WS_A, user_id: U_FREE })
    }
    for (let i = 0; i < 20; i++) {
      rowsOf('transactions').push({ id: `tx-b-${i}`, workspace_id: WS_B, user_id: U_FREE })
    }

    // Free transaction limit is 20. WS_A has 5 → room. Counting the actor's
    // 25 rows instead would have reported the shop as full.
    await expect(billing.checkUsageLimit(U_FREE, 'transactions', WS_A)).resolves.toBe(true)
  })

  it('refuses a workspace-scoped meter with no workspace context (no user fallback)', async () => {
    // The old signature had no workspace parameter at all and silently
    // counted by user_id. There is no honest user-shaped reading of a
    // workspace-owned meter, so the request must fail loudly instead.
    await expect(billing.checkUsageLimit(U_FREE, 'invoices')).rejects.toThrow(DatabaseError)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   D3 — the workspace quota filters owner_id (workspaces has no user_id)
   ═══════════════════════════════════════════════════════════════════════════ */

describe('D3 — the workspace quota counts OWNERSHIP', () => {
  it('blocks a user who already owns the plan maximum', async () => {
    rowsOf('workspaces').push({ id: WS_A, owner_id: U_FREE, is_sandbox: false })

    const result = await ent.canPerformAction(ctxFor(U_FREE, WS_A), 'create_workspace')
    // Free allows 1 workspace; U_FREE owns exactly one. The broken query
    // errored, read the count as 0, and allowed unlimited workspaces.
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('limit of 1')
  })

  it('a sandbox is not a business: it does not use up the quota', async () => {
    // The free plan allows one business. A developer's sandbox of someone
    // else's shop (or of their own) is a test space — counted, it refused the
    // person their first real business.
    rowsOf('workspaces').push({ id: 'ws-sandbox', owner_id: U_FREE, is_sandbox: true })

    const result = await ent.canPerformAction(ctxFor(U_FREE, WS_A), 'create_workspace')
    expect(result.allowed).toBe(true)
  })

  it('allows a user who owns nothing', async () => {
    rowsOf('workspaces').push({ id: WS_B, owner_id: 'someone-else' })

    const result = await ent.canPerformAction(ctxFor(U_FREE, WS_A), 'create_workspace')
    expect(result.allowed).toBe(true)
  })

  it('membership in other shops does not consume the quota', async () => {
    // Being a seller in someone else's business is not running one.
    rowsOf('workspaces').push(
      { id: WS_B, owner_id: 'someone-else' },
      { id: 'ws-c', owner_id: 'another-owner' },
    )
    seedMember(WS_B, U_FREE)
    seedMember('ws-c', U_FREE)

    const result = await ent.canPerformAction(ctxFor(U_FREE, WS_A), 'create_workspace')
    expect(result.allowed).toBe(true)
  })

  it('the query filters by owner_id — asserted on the query, not the outcome', async () => {
    rowsOf('workspaces').push({ id: WS_A, owner_id: U_FREE, is_sandbox: false })
    await ent.canPerformAction(ctxFor(U_FREE, WS_A), 'create_workspace').catch(() => undefined)

    const workspaceCounts = queryLog.filter((q) => q.table === 'workspaces')
    expect(workspaceCounts.length).toBeGreaterThan(0)
    for (const q of workspaceCounts) {
      const columns = q.filters.map((f) => f.column)
      expect(columns).toContain('owner_id')
      expect(columns).not.toContain('user_id')
    }
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   D4 — a failing count fails CLOSED
   ═══════════════════════════════════════════════════════════════════════════ */

describe('D4 — database errors never widen a quota', () => {
  it('an invoice-count failure refuses the action instead of allowing it', async () => {
    errTables.set('invoices', { message: 'connection reset' })

    await expect(
      ent.canPerformAction(ctxFor(U_FREE, WS_A), 'create_invoice'),
    ).rejects.toBeInstanceOf(DatabaseError)
  })

  it('a workspace-count failure refuses workspace creation', async () => {
    errTables.set('workspaces', { message: 'connection reset' })

    await expect(
      ent.canPerformAction(ctxFor(U_FREE, WS_A), 'create_workspace'),
    ).rejects.toBeInstanceOf(DatabaseError)
  })

  it('a seat-count failure refuses member creation', async () => {
    errTables.set('workspace_members', { message: 'connection reset' })

    await expect(ent.canPerformAction(ctxFor(U_FREE, WS_A), 'create_user')).rejects.toBeInstanceOf(
      DatabaseError,
    )
  })

  it('checkUsageLimit throws instead of answering true on a failed count', async () => {
    errTables.set('transactions', { message: 'connection reset' })

    await expect(billing.checkUsageLimit(U_FREE, 'transactions', WS_A)).rejects.toBeInstanceOf(
      DatabaseError,
    )
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   D1 — Stripe identifiers are persisted, and rows are addressable by PK
   ═══════════════════════════════════════════════════════════════════════════ */

describe('D1 — upgrade persists Stripe identifiers', () => {
  it('writes stripe_customer_id and stripe_subscription_id on upgrade', async () => {
    const sub = rowsOf('subscriptions').find((r) => r.user_id === U_PRO)!

    await billing.upgrade(U_PRO, 'enterprise', 'year', {
      customerId: 'cus_123',
      subscriptionId: 'sub_789',
    })

    expect(sub.stripe_customer_id).toBe('cus_123')
    expect(sub.stripe_subscription_id).toBe('sub_789')
    expect(sub.plan).toBe('enterprise')
    expect(sub.is_trial).toBe(false)
  })

  it('upgrade without Stripe ids leaves existing identifiers intact', async () => {
    const sub = rowsOf('subscriptions').find((r) => r.user_id === U_PRO)!
    sub.stripe_subscription_id = 'sub_preexisting'

    await billing.upgrade(U_PRO, 'pro', 'month')

    expect(sub.stripe_subscription_id).toBe('sub_preexisting')
  })

  it('upgradeSubscriptionRow mutates exactly the addressed row', async () => {
    const kept = seedSubscription(U_PRO, 'pro', 'ws-second', '2026-02-01')
    const target = seedSubscription(U_PRO, 'pro', WS_PRO, '2026-03-01')

    await billing.upgradeSubscriptionRow(target.id as string, 'enterprise', 'month')

    expect(target.plan).toBe('enterprise')
    expect(kept.plan).toBe('pro')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   D5 — writers flush the workspace-spelled cache keys too
   ═══════════════════════════════════════════════════════════════════════════ */

describe('D5 — cache invalidation covers the workspace scope', () => {
  it('upgrade flushes subscription:<uid>, subscription:ws:<wsid> and usage:<uid>', async () => {
    await billing.upgrade(U_PRO, 'enterprise', 'month')

    expect(invalidateCalls).toContain(`subscription:${U_PRO}`)
    expect(invalidateCalls).toContain(`subscription:ws:${WS_PRO}`)
    expect(invalidateCalls).toContain(`usage:${U_PRO}`)
  })

  it('a subscription without a workspace still flushes its user keys', async () => {
    // Pre-onboarding buyers have workspace_id NULL — DECISION A's documented
    // transitional state.
    seedSubscription('user-nows', 'free', null, '2026-01-02')
    invalidateCalls.length = 0

    await billing.upgrade('user-nows', 'pro', 'month')

    expect(invalidateCalls).toContain('subscription:user-nows')
    expect(invalidateCalls.some((k) => k.startsWith('subscription:ws:'))).toBe(false)
  })

  it('the usage report is computed per workspace and cached under the workspace key', async () => {
    for (let i = 0; i < 5; i++) {
      rowsOf('invoices').push({ id: `inv-a-${i}`, workspace_id: WS_A, user_id: U_FREE })
    }
    for (let i = 0; i < 7; i++) {
      rowsOf('invoices').push({ id: `inv-b-${i}`, workspace_id: WS_B, user_id: U_FREE })
    }
    rowsOf('transactions').push({ id: 'tx-1', workspace_id: WS_A, user_id: U_FREE })
    rowsOf('workspace_members').push({ id: 'm1', workspace_id: WS_A, user_id: U_FREE })
    rowsOf('workspaces').push({ id: WS_A, owner_id: U_FREE, is_sandbox: false })

    const report = await billing.getUsageReport(U_FREE, WS_A)

    // Foreign-shop rows authored by the same user must not appear.
    expect(report.usage.invoices).toBe(5)
    expect(report.usage.transactions).toBe(1)
    expect(report.usage.users).toBe(1)
    expect(report.usage.workspaces).toBe(1)

    await billing.invalidateCache(U_FREE, WS_A)
    expect(invalidateCalls).toContain(`usage:ws:${WS_A}`)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Checkout ownership — a session finalizes only for its buyer
   ═══════════════════════════════════════════════════════════════════════════ */

describe('handleCheckoutSuccess enforces session ownership', () => {
  const checkout = new CheckoutService()

  function seedPendingCheckout(buyerId: string): void {
    rowsOf('checkout_sessions').push({
      id: 'co_test',
      user_id: buyerId,
      plan: 'enterprise',
      interval: 'year',
      status: 'pending',
      stripe_session_id: 'cs_test',
      checkout_url: 'https://example.test/co',
      idempotency_key: null,
    })
  }

  it("another user's checkout id is rejected and grants nothing", async () => {
    seedPendingCheckout(U_PRO)

    await expect(checkout.handleCheckoutSuccess(U_ATTACKER, 'co_test')).rejects.toThrow(
      /does not belong/,
    )

    const sub = rowsOf('subscriptions').find((r) => r.user_id === U_PRO)!
    expect(sub.plan).toBe('pro') // untouched
  })

  it('the buyer can finalize and receives the purchased plan', async () => {
    seedPendingCheckout(U_PRO)

    await checkout.handleCheckoutSuccess(U_PRO, 'co_test')

    const sub = rowsOf('subscriptions').find((r) => r.user_id === U_PRO)!
    expect(sub.plan).toBe('enterprise')
    expect(sub.is_trial).toBe(false)
  })

  it('an unknown checkout id fails rather than upgrading blindly', async () => {
    await expect(checkout.handleCheckoutSuccess(U_PRO, 'co_missing')).rejects.toThrow(DatabaseError)
  })
})
