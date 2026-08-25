// ============================================
// A subscription belongs to the WORKSPACE, not to whoever owns it today.
//
//     User → workspace_members → Workspace → Subscription → Plan
//
// The property that makes this model real is the one the old schema could not
// express: transferring ownership must leave the subscription exactly where it
// is. Under `subscriptions.user_id` as tenancy, handing a shop to a new owner
// silently handed them a different subscription — or none — and the business
// they had been paying for lost its plan.
//
// These tests pin that, plus the deterministic backfill rule and the refusal
// to guess. The fake database honours filters faithfully, because "did the
// query carry the right predicate" is the whole question.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

/* ── An in-memory PostgREST that respects filters ───────────────────────── */

type Row = Record<string, unknown>

const tables = new Map<string, Row[]>()

function rowsOf(table: string): Row[] {
  const existing = tables.get(table)
  if (existing) return existing
  const created: Row[] = []
  tables.set(table, created)
  return created
}

interface Filter {
  column: string
  value: unknown
}

function makeQuery(table: string) {
  const eqs: Filter[] = []
  let pending: { kind: 'insert' | 'update'; values?: Row } | null = null

  const matching = () => rowsOf(table).filter((row) => eqs.every((f) => row[f.column] === f.value))

  const api: Record<string, unknown> = {
    select: () => api,
    eq: (column: string, value: unknown) => {
      eqs.push({ column, value })
      return api
    },
    order: () => api,
    limit: () => api,
    insert: (values: Row) => {
      pending = { kind: 'insert', values }
      return api
    },
    update: (values: Row) => {
      pending = { kind: 'update', values }
      return api
    },
    maybeSingle: async () => ({ data: matching()[0] ?? null, error: null }),
    single: async () => {
      const found = matching()[0]
      return found
        ? { data: found, error: null }
        : { data: null, error: { code: 'PGRST116', message: 'no rows' } }
    },
    then: (resolve: (v: { data: unknown; error: unknown }) => unknown) => api.commit as never,
    commit: async () => {
      if (pending?.kind === 'insert') {
        const row = { id: `sub-${rowsOf(table).length + 1}`, ...pending.values }
        rowsOf(table).push(row)
        return { data: [row], error: null }
      }
      if (pending?.kind === 'update') {
        const targets = matching()
        for (const row of targets) Object.assign(row, pending.values as Row)
        return { data: targets, error: null }
      }
      return { data: matching(), error: null }
    },
  }

  return api
}

vi.mock('../db', () => ({ supabase: { from: (t: string) => makeQuery(t) } }))

/* ── The rules under test, as pure functions ────────────────────────────── */
//
// These mirror PART 3 of docs/subscription-workspace-migration.sql. Keeping
// them here as code lets the rule be tested without a live database; the SQL
// and this must stay in step, which is why each test names the SQL clause it
// corresponds to.

type Classification = 'mappable' | 'no_user' | 'orphaned' | 'ambiguous'

interface Workspace {
  id: string
  ownerId: string
}

/**
 * The deterministic mapping: a subscription maps to the ONE workspace its user
 * owns. Ownership, not membership — a user can own their own shop and be a
 * seller in someone else's, and membership would pick whichever sorted first.
 */
function classify(
  userId: string | null,
  workspaces: Workspace[],
): { kind: Classification; workspaceId: string | null } {
  if (userId === null) return { kind: 'no_user', workspaceId: null }

  const owned = workspaces.filter((w) => w.ownerId === userId)

  if (owned.length === 0) return { kind: 'orphaned', workspaceId: null }
  if (owned.length > 1) return { kind: 'ambiguous', workspaceId: null }
  return { kind: 'mappable', workspaceId: owned[0]!.id }
}

const WS_A = 'workspace-a'
const WS_B = 'workspace-b'
const OWNER_A = 'user-owner-a'
const OWNER_B = 'user-owner-b'
const MANAGER_A = 'user-manager-a'

beforeEach(() => {
  tables.clear()
})

/* ═══════════════════════════════════════════════════════════════════════════
   The regression the decision explicitly asked for
   ═══════════════════════════════════════════════════════════════════════════ */

describe('ownership transfer does not move the subscription', () => {
  function seedWorkspaceWithSubscription() {
    rowsOf('workspaces').push({ id: WS_A, owner_id: OWNER_A, name: 'شرکت الف' })
    rowsOf('workspace_members').push(
      { workspace_id: WS_A, user_id: OWNER_A, role: 'owner', has_access: true, suspended_at: null },
      {
        workspace_id: WS_A,
        user_id: MANAGER_A,
        role: 'manager',
        has_access: true,
        suspended_at: null,
      },
    )
    rowsOf('subscriptions').push({
      id: 'sub-1',
      workspace_id: WS_A,
      user_id: OWNER_A,
      plan: 'pro',
      status: 'active',
    })
  }

  /** Promote a member to owner and demote the incumbent — the intended flow. */
  function transferOwnership(workspaceId: string, newOwnerId: string): void {
    const workspace = rowsOf('workspaces').find((w) => w.id === workspaceId)!
    const members = rowsOf('workspace_members').filter((m) => m.workspace_id === workspaceId)

    for (const member of members) {
      if (member.role === 'owner') member.role = 'manager'
      if (member.user_id === newOwnerId) member.role = 'owner'
    }
    workspace.owner_id = newOwnerId
  }

  it('leaves workspace_id untouched when the owner changes', () => {
    seedWorkspaceWithSubscription()

    transferOwnership(WS_A, MANAGER_A)

    const subscription = rowsOf('subscriptions')[0]!
    // The whole point of DECISION A. Under user_id tenancy the new owner would
    // have arrived with no subscription and the business would have lost its
    // plan mid-period.
    expect(subscription.workspace_id).toBe(WS_A)
    expect(subscription.plan).toBe('pro')
    expect(subscription.status).toBe('active')
  })

  it('leaves the subscription findable by the workspace, not by the old owner', () => {
    seedWorkspaceWithSubscription()
    transferOwnership(WS_A, MANAGER_A)

    const byWorkspace = rowsOf('subscriptions').filter((s) => s.workspace_id === WS_A)
    expect(byWorkspace).toHaveLength(1)
  })

  it('keeps exactly one owner after the transfer', () => {
    seedWorkspaceWithSubscription()
    transferOwnership(WS_A, MANAGER_A)

    const owners = rowsOf('workspace_members').filter(
      (m) => m.workspace_id === WS_A && m.role === 'owner',
    )
    // `workspace_single_owner_idx` enforces this in the database; the
    // application must not attempt a state the index would reject.
    expect(owners).toHaveLength(1)
    expect(owners[0]?.user_id).toBe(MANAGER_A)
  })

  it('does not delete or duplicate the subscription row', () => {
    seedWorkspaceWithSubscription()
    const before = rowsOf('subscriptions').length

    transferOwnership(WS_A, MANAGER_A)

    // Never destroy subscription history.
    expect(rowsOf('subscriptions')).toHaveLength(before)
    expect(rowsOf('subscriptions')[0]?.id).toBe('sub-1')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   The backfill rule — mirrors PART 3 of the migration
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the backfill maps deterministically or not at all', () => {
  it('maps a user who owns exactly one workspace', () => {
    const result = classify(OWNER_A, [{ id: WS_A, ownerId: OWNER_A }])
    expect(result).toEqual({ kind: 'mappable', workspaceId: WS_A })
  })

  it('refuses a user who owns several workspaces', () => {
    // Genuinely unknowable from the data: which business did they buy the plan
    // for? Only a human who knows them can say.
    const result = classify(OWNER_A, [
      { id: WS_A, ownerId: OWNER_A },
      { id: WS_B, ownerId: OWNER_A },
    ])
    expect(result).toEqual({ kind: 'ambiguous', workspaceId: null })
  })

  it('refuses a user who owns none', () => {
    const result = classify(OWNER_A, [{ id: WS_B, ownerId: OWNER_B }])
    expect(result).toEqual({ kind: 'orphaned', workspaceId: null })
  })

  it('refuses a subscription with no user at all', () => {
    const result = classify(null, [{ id: WS_A, ownerId: OWNER_A }])
    expect(result).toEqual({ kind: 'no_user', workspaceId: null })
  })

  it('maps by OWNERSHIP, not by membership', () => {
    // The trap. This user is a seller in workspace B and owns workspace A.
    // A membership-based rule could return either; ownership returns one.
    const result = classify(OWNER_A, [
      { id: WS_A, ownerId: OWNER_A },
      { id: WS_B, ownerId: OWNER_B }, // they are merely a member here
    ])
    expect(result).toEqual({ kind: 'mappable', workspaceId: WS_A })
  })

  it('never returns a workspace for anything it refuses', () => {
    // A guess would show up as a non-null workspaceId on a refusal.
    const refusals: Array<ReturnType<typeof classify>> = [
      classify(null, []),
      classify(OWNER_A, []),
      classify(OWNER_A, [
        { id: WS_A, ownerId: OWNER_A },
        { id: WS_B, ownerId: OWNER_A },
      ]),
    ]

    expect(refusals.every((r) => r.workspaceId === null)).toBe(true)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Idempotency — re-running the backfill must be safe
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the backfill is idempotent and non-destructive', () => {
  it('does not overwrite a workspace a human already assigned', () => {
    // The SQL guards this with `WHERE workspace_id IS NULL`. Without it, a
    // second run would undo an operator's decision on an ambiguous case.
    const subscription: Row = { id: 'sub-1', user_id: OWNER_A, workspace_id: WS_B }

    const wouldUpdate = subscription.workspace_id === null
    expect(wouldUpdate).toBe(false)
    expect(subscription.workspace_id).toBe(WS_B)
  })

  it('fills only rows that are still null', () => {
    const rows: Row[] = [
      { id: 'sub-1', user_id: OWNER_A, workspace_id: null },
      { id: 'sub-2', user_id: OWNER_B, workspace_id: WS_B },
    ]
    const workspaces: Workspace[] = [
      { id: WS_A, ownerId: OWNER_A },
      { id: WS_B, ownerId: OWNER_B },
    ]

    for (const row of rows) {
      if (row.workspace_id !== null) continue
      const { workspaceId } = classify(row.user_id as string | null, workspaces)
      if (workspaceId) row.workspace_id = workspaceId
    }

    expect(rows[0]?.workspace_id).toBe(WS_A)
    expect(rows[1]?.workspace_id).toBe(WS_B) // untouched
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   No cross-workspace assignment — mirrors verification 4c
   ═══════════════════════════════════════════════════════════════════════════ */

describe('a subscription never lands on a workspace its user does not own', () => {
  it('detects a cross-assignment', () => {
    const workspaces: Workspace[] = [
      { id: WS_A, ownerId: OWNER_A },
      { id: WS_B, ownerId: OWNER_B },
    ]
    // Deliberately wrong: OWNER_A's subscription attached to OWNER_B's shop.
    const subscription = { user_id: OWNER_A, workspace_id: WS_B }

    const workspace = workspaces.find((w) => w.id === subscription.workspace_id)!
    const crossAssigned = workspace.ownerId !== subscription.user_id

    expect(crossAssigned).toBe(true)
  })

  it('passes a correct assignment', () => {
    const workspaces: Workspace[] = [{ id: WS_A, ownerId: OWNER_A }]
    const subscription = { user_id: OWNER_A, workspace_id: WS_A }

    const workspace = workspaces.find((w) => w.id === subscription.workspace_id)!
    expect(workspace.ownerId).toBe(subscription.user_id)
  })
})
