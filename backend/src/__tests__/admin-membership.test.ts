// ============================================
// Admin workspace membership — the three endpoints' service layer.
//
// This capability lets a platform admin see who is in a business and correct
// it. Everything dangerous about it lives in the guards, so that is what these
// tests pin:
//
//   * the workspace owner cannot be removed or demoted from here — that is an
//     ownership transfer, a different operation with different rules;
//   * a second owner cannot be created, because `workspace_single_owner_idx`
//     would reject it and the caller deserves a real conflict, not a 500;
//   * a removal deletes the MEMBERSHIP and nothing else — never the user
//     account, never a financial row;
//   * a refused mutation writes NO audit entry. A log of things that did not
//     happen is worse than no log.
//
// The fake PostgREST honours filters, so "did the query carry the right
// predicate" is observable rather than assumed.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const tables = new Map<string, Row[]>()

function rowsOf(table: string): Row[] {
  const existing = tables.get(table)
  if (existing) return existing
  const created: Row[] = []
  tables.set(table, created)
  return created
}

/** Every table queried, in order — so N+1 is measurable rather than eyeballed. */
let queryLog: string[] = []

function makeQuery(table: string) {
  queryLog.push(table)

  const eqs: Array<[string, unknown]> = []
  let inFilter: { column: string; values: unknown[] } | null = null
  let pending: { kind: 'update' | 'delete'; values?: Row } | null = null
  let likeFilter: { column: string; needle: string } | null = null
  const ranges: Array<{ column: string; op: 'lte' | 'gte'; value: unknown }> = []

  const matching = (): Row[] => {
    let out = rowsOf(table).filter((r) => eqs.every(([c, v]) => r[c] === v))
    if (inFilter) {
      const f = inFilter
      out = out.filter((r) => f.values.includes(r[f.column]))
    }
    if (likeFilter) {
      const l = likeFilter
      out = out.filter((r) => String(r[l.column] ?? '').includes(l.needle))
    }
    for (const r of ranges) {
      out = out.filter((row) => {
        const v = row[r.column]
        // NULL is not comparable — a row with no period_end is outside every
        // expiry window, which is exactly what production must do.
        if (v === null || v === undefined) return false
        return r.op === 'lte' ? String(v) <= String(r.value) : String(v) >= String(r.value)
      })
    }
    return out
  }

  const api: Record<string, unknown> = {
    select: () => api,
    eq: (column: string, value: unknown) => {
      eqs.push([column, value])
      return api
    },
    in: (column: string, values: unknown[]) => {
      inFilter = { column, values }
      return api
    },
    lte: (column: string, value: unknown) => {
      ranges.push({ column, op: 'lte', value })
      return api
    },
    gte: (column: string, value: unknown) => {
      ranges.push({ column, op: 'gte', value })
      return api
    },
    order: () => api,
    range: () => api,
    ilike: (column: string, pattern: string) => {
      likeFilter = { column, needle: pattern.replace(/%/g, '') }
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
    // COPIES, not the live rows. A real PostgREST response is deserialized
    // JSON, so a later UPDATE cannot retroactively change an object the caller
    // already read. Returning the live row made the service audit
    // `oldData: { role: 'manager' }` for a seller->manager change, because
    // the update had mutated the very object holding the "before" value.
    maybeSingle: async () => {
      const found = matching()[0]
      return { data: found ? { ...found } : null, error: null }
    },
    single: async () => {
      const found = matching()[0]
      return found
        ? { data: { ...found }, error: null }
        : { data: null, error: { code: 'PGRST116', message: 'no rows' } }
    },
    then: (resolve: (v: unknown) => unknown) =>
      (api.commit as () => Promise<unknown>)().then(resolve),
    commit: async () => {
      if (pending?.kind === 'update') {
        const targets = matching()
        for (const row of targets) Object.assign(row, pending.values as Row)
        return { data: targets, error: null }
      }
      if (pending?.kind === 'delete') {
        const doomed = matching()
        tables.set(
          table,
          rowsOf(table).filter((r) => !doomed.includes(r)),
        )
        return { data: doomed, error: null }
      }
      const found = matching()
      return { data: found, error: null, count: found.length }
    },
  }

  return api
}

/** The auth directory — where emails actually live. Not a table. */
let authDirectory: Array<{ id: string; email: string | null }> = []
/** Counts auth-admin calls, so "one call, not one per user" is assertable. */
let authCalls = 0

vi.mock('../db', () => ({
  supabase: {
    from: (t: string) => makeQuery(t),
    auth: {
      admin: {
        listUsers: async () => {
          authCalls += 1
          return { data: { users: authDirectory }, error: null }
        },
      },
    },
  },
}))

/** Audit rows written during a test. */
const auditRows: Array<Record<string, unknown>> = []

vi.mock('../services/audit.service', () => ({
  AuditService: class {
    async log(data: Record<string, unknown>) {
      auditRows.push(data)
    }
  },
}))

const { AdminService } = await import('../services/admin.service')

/* ── Cast ───────────────────────────────────────────────────────────────── */

const WS_A = '11111111-1111-4111-8111-111111111111'
const WS_B = '22222222-2222-4222-8222-222222222222'
const WS_EMPTY = '33333333-3333-4333-8333-333333333333'
const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999'

const M_OWNER_A = 'aaaa1111-1111-4111-8111-111111111111'
const M_MANAGER_A = 'aaaa2222-2222-4222-8222-222222222222'
const M_SELLER_A = 'aaaa3333-3333-4333-8333-333333333333'
const M_OWNER_B = 'bbbb1111-1111-4111-8111-111111111111'

const U_OWNER_A = 'u-owner-a'
const U_MANAGER_A = 'u-manager-a'
const U_SELLER_A = 'u-seller-a'

const ACTOR = { adminUserId: 'platform-admin', ipAddress: '127.0.0.1', userAgent: 'test' }

let service: InstanceType<typeof AdminService>

beforeEach(() => {
  tables.clear()
  queryLog = []
  auditRows.length = 0
  service = new AdminService()

  rowsOf('workspace_members').push(
    {
      id: M_OWNER_A,
      workspace_id: WS_A,
      user_id: U_OWNER_A,
      role: 'owner',
      has_access: true,
      suspended_at: null,
      joined_at: '2024-01-01',
    },
    {
      id: M_MANAGER_A,
      workspace_id: WS_A,
      user_id: U_MANAGER_A,
      role: 'manager',
      has_access: true,
      suspended_at: null,
      joined_at: '2024-02-01',
    },
    {
      id: M_SELLER_A,
      workspace_id: WS_A,
      user_id: U_SELLER_A,
      role: 'seller',
      has_access: false,
      suspended_at: null,
      joined_at: '2024-03-01',
    },
    {
      id: M_OWNER_B,
      workspace_id: WS_B,
      user_id: 'u-owner-b',
      role: 'owner',
      has_access: true,
      suspended_at: null,
      joined_at: '2024-01-01',
    },
  )

  // Identity is split across two sources, exactly as in production:
  //   profiles      -> full_name  (public schema, no email column)
  //   auth.users    -> email      (auth schema, via auth.admin only)
  // There is NO public.users table; assuming one is what produced PGRST205.
  rowsOf('profiles').push(
    { id: U_OWNER_A, full_name: 'مالک الف' },
    { id: U_MANAGER_A, full_name: 'مدیر الف' },
    // U_SELLER_A deliberately absent — a membership whose profile row is gone.
  )

  authDirectory = [
    { id: U_OWNER_A, email: 'owner@a.test' },
    { id: U_MANAGER_A, email: 'manager@a.test' },
  ]
  authCalls = 0
})

/* ═══════════════════════════════════════════════════════════════════════════
   Listing
   ═══════════════════════════════════════════════════════════════════════════ */

describe('listing the members of a workspace', () => {
  it('returns only that workspace members', async () => {
    const members = await service.listWorkspaceMembers(WS_A)

    expect(members.map((m) => m.id).sort()).toEqual([M_OWNER_A, M_MANAGER_A, M_SELLER_A].sort())
    expect(members.some((m) => m.id === M_OWNER_B)).toBe(false)
  })

  it('resolves identity without N+1', async () => {
    await service.listWorkspaceMembers(WS_A)

    // Memberships, then ONE batched profile lookup. Three members must not
    // mean three identity queries — this is what stops a future refactor
    // reintroducing per-member fetching.
    expect(queryLog).toEqual(['workspace_members', 'profiles'])
    // And exactly one auth-directory call, not one per member.
    expect(authCalls).toBe(1)
  })

  it('keeps a member whose profile row is missing', async () => {
    const members = await service.listWorkspaceMembers(WS_A)
    const orphan = members.find((m) => m.userId === U_SELLER_A)

    // A membership with no profile is still a membership. Dropping it would
    // hide a real person who really has access to the business.
    expect(orphan).toBeDefined()
    expect(orphan?.name).toBeNull()
    expect(orphan?.email).toBeNull()
  })

  it('derives status from has_access and suspended_at together', async () => {
    const members = await service.listWorkspaceMembers(WS_A)

    expect(members.find((m) => m.id === M_OWNER_A)?.status).toBe('active')
    // has_access false but not suspended — a distinct state, not "active".
    expect(members.find((m) => m.id === M_SELLER_A)?.status).toBe('no-access')
  })

  it('returns an empty list for a workspace with no members', async () => {
    expect(await service.listWorkspaceMembers(WS_EMPTY)).toEqual([])
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Role changes
   ═══════════════════════════════════════════════════════════════════════════ */

describe('changing a role', () => {
  it('promotes a seller to manager and audits it', async () => {
    const updated = await service.updateMemberRole(ACTOR, M_SELLER_A, 'manager')

    expect(updated.role).toBe('manager')
    expect(rowsOf('workspace_members').find((m) => m.id === M_SELLER_A)?.role).toBe('manager')

    expect(auditRows).toHaveLength(1)
    expect(auditRows[0]).toMatchObject({
      userId: 'platform-admin',
      action: 'update',
      entityType: 'workspace_member',
      entityId: M_SELLER_A,
      oldData: { role: 'seller' },
      newData: { role: 'manager' },
    })
  })

  it('refuses to create a second owner', async () => {
    // `workspace_single_owner_idx` would reject this at the database. Catching
    // it here turns an opaque 500 into an explainable conflict.
    await expect(service.updateMemberRole(ACTOR, M_MANAGER_A, 'owner')).rejects.toThrow(
      /already has an owner/i,
    )

    expect(rowsOf('workspace_members').find((m) => m.id === M_MANAGER_A)?.role).toBe('manager')
  })

  it('writes NO audit row when the promotion is refused', async () => {
    await service.updateMemberRole(ACTOR, M_MANAGER_A, 'owner').catch(() => undefined)

    expect(auditRows).toEqual([])
  })

  it('refuses to demote the owner', async () => {
    // Demoting the sole owner is an ownership transfer, not a role edit.
    await expect(service.updateMemberRole(ACTOR, M_OWNER_A, 'manager')).rejects.toThrow(
      /demote owner/i,
    )

    expect(rowsOf('workspace_members').find((m) => m.id === M_OWNER_A)?.role).toBe('owner')
    expect(auditRows).toEqual([])
  })

  it('is idempotent when the role is unchanged', async () => {
    const result = await service.updateMemberRole(ACTOR, M_MANAGER_A, 'manager')

    expect(result.role).toBe('manager')
    // No write happened, so no audit entry — re-sending the same PATCH must
    // not fill the log with non-events.
    expect(auditRows).toEqual([])
  })

  it('rejects an unknown membership id', async () => {
    await expect(service.updateMemberRole(ACTOR, UNKNOWN_ID, 'seller')).rejects.toThrow()
    expect(auditRows).toEqual([])
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Removal
   ═══════════════════════════════════════════════════════════════════════════ */

describe('removing a member', () => {
  it('removes the membership and audits it', async () => {
    await service.removeMember(ACTOR, M_SELLER_A)

    expect(rowsOf('workspace_members').some((m) => m.id === M_SELLER_A)).toBe(false)
    expect(auditRows).toHaveLength(1)
    expect(auditRows[0]).toMatchObject({
      action: 'delete',
      entityType: 'workspace_member',
      entityId: M_SELLER_A,
      newData: null,
    })
  })

  it('never deletes the user account', async () => {
    const profilesBefore = rowsOf('profiles').length
    const directoryBefore = authDirectory.length

    await service.removeMember(ACTOR, M_MANAGER_A)

    // The membership is gone; the person still exists in BOTH identity
    // sources. This is the whole difference between "remove from this
    // business" and "delete this human".
    expect(rowsOf('profiles')).toHaveLength(profilesBefore)
    expect(rowsOf('profiles').some((u) => u.id === U_MANAGER_A)).toBe(true)
    expect(authDirectory).toHaveLength(directoryBefore)
    expect(authDirectory.some((u) => u.id === U_MANAGER_A)).toBe(true)
  })

  it('refuses to remove the owner', async () => {
    await expect(service.removeMember(ACTOR, M_OWNER_A)).rejects.toThrow(/remove owner/i)

    expect(rowsOf('workspace_members').some((m) => m.id === M_OWNER_A)).toBe(true)
  })

  it('writes NO audit row when removal is refused', async () => {
    await service.removeMember(ACTOR, M_OWNER_A).catch(() => undefined)

    expect(auditRows).toEqual([])
  })

  it('removes exactly one membership, leaving the other workspace intact', async () => {
    await service.removeMember(ACTOR, M_MANAGER_A)

    // The delete must be keyed on the membership id alone. Keyed on user_id or
    // workspace_id, this count would drop by more than one.
    expect(rowsOf('workspace_members')).toHaveLength(3)
    expect(rowsOf('workspace_members').some((m) => m.id === M_OWNER_B)).toBe(true)
  })

  it('rejects an unknown membership id without touching anything', async () => {
    const before = rowsOf('workspace_members').length

    await expect(service.removeMember(ACTOR, UNKNOWN_ID)).rejects.toThrow()

    expect(rowsOf('workspace_members')).toHaveLength(before)
    expect(auditRows).toEqual([])
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Workspace listing — owner identity, plan and member count
   ═══════════════════════════════════════════════════════════════════════════ */

describe('listing workspaces with their owner', () => {
  beforeEach(() => {
    rowsOf('workspaces').push(
      {
        id: WS_A,
        name: 'شرکت الف',
        slug: 'a',
        description: null,
        owner_id: U_OWNER_A,
        is_active: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
      {
        id: WS_B,
        name: 'شرکت ب',
        slug: 'b',
        description: null,
        owner_id: 'u-owner-b',
        is_active: false,
        created_at: '2024-02-01',
        updated_at: '2024-02-01',
      },
    )
    rowsOf('subscriptions').push({
      id: 'sub-a',
      workspace_id: WS_A,
      plan: 'pro',
      status: 'active',
      period_end: '2026-01-01',
    })
    queryLog = []
  })

  it('returns the real owner name and email, never a placeholder', async () => {
    const { workspaces } = await service.listWorkspaces({})
    const a = workspaces.find((w) => w.id === WS_A)

    expect(a?.ownerName).toBe('مالک الف')
    expect(a?.ownerEmail).toBe('owner@a.test')
  })

  it('reports null — not a truncated uuid — when the owner has no profile row', async () => {
    // u-owner-b has no `users` row. A shortened uuid would look like data
    // while meaning nothing; the UI shows "no owner" instead.
    const { workspaces } = await service.listWorkspaces({})
    const b = workspaces.find((w) => w.id === WS_B)

    expect(b?.ownerName).toBeNull()
    expect(b?.ownerEmail).toBeNull()
  })

  it('returns the real plan from the subscriptions table', async () => {
    const { workspaces } = await service.listWorkspaces({})

    expect(workspaces.find((w) => w.id === WS_A)?.plan).toBe('pro')
    // No subscription row: null, not 'free'. Inferring a plan from absence
    // would put a fact on screen that the database never asserted.
    expect(workspaces.find((w) => w.id === WS_B)?.plan).toBeNull()
  })

  it('counts only ACTIVE seats', async () => {
    const { workspaces } = await service.listWorkspaces({})

    // WS_A has owner + manager active, and a seller with has_access false.
    expect(workspaces.find((w) => w.id === WS_A)?.memberCount).toBe(2)
  })

  it('costs a bounded number of queries regardless of page size', async () => {
    await service.listWorkspaces({})

    // Four table queries: the page, owner profiles, subscriptions,
    // memberships. Two workspaces must not mean 1 + 2*3 — this is the
    // assertion that stops a future refactor looping per row.
    expect(queryLog).toEqual(['workspaces', 'profiles', 'subscriptions', 'workspace_members'])
    expect(authCalls).toBe(1)
  })

  it('issues no enrichment queries for an empty page', async () => {
    const { workspaces } = await service.listWorkspaces({ search: 'no-such-workspace' })

    expect(workspaces).toEqual([])
    // Enriching nothing is three wasted round-trips.
    expect(queryLog).toEqual(['workspaces'])
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Subscription expiry window
   ═══════════════════════════════════════════════════════════════════════════ */

describe('filtering subscriptions by expiry window', () => {
  const NOW = '2026-06-15T00:00:00.000Z'
  const IN_3_DAYS = '2026-06-18T00:00:00.000Z'
  const IN_30_DAYS = '2026-07-15T00:00:00.000Z'

  beforeEach(() => {
    rowsOf('subscriptions').push(
      {
        id: 's-expired',
        workspace_id: WS_A,
        plan: 'pro',
        status: 'active',
        period_end: '2026-06-01T00:00:00.000Z',
        created_at: '2026-01-01',
      },
      {
        id: 's-soon',
        workspace_id: WS_B,
        plan: 'pro',
        status: 'active',
        period_end: '2026-06-17T00:00:00.000Z',
        created_at: '2026-02-01',
      },
      {
        id: 's-later',
        workspace_id: WS_EMPTY,
        plan: 'free',
        status: 'active',
        period_end: '2026-07-01T00:00:00.000Z',
        created_at: '2026-03-01',
      },
      // No period_end at all — must never appear in ANY expiry window.
      {
        id: 's-perpetual',
        workspace_id: null,
        plan: 'enterprise',
        status: 'active',
        period_end: null,
        created_at: '2026-04-01',
      },
    )
  })

  it('finds subscriptions that already expired', async () => {
    const { subscriptions } = await service.listSubscriptions({ expiringBefore: NOW })

    expect(subscriptions.map((s: { id: string }) => s.id)).toEqual(['s-expired'])
  })

  it('finds subscriptions expiring inside a window', async () => {
    const { subscriptions } = await service.listSubscriptions({
      expiringAfter: NOW,
      expiringBefore: IN_3_DAYS,
    })

    expect(subscriptions.map((s: { id: string }) => s.id)).toEqual(['s-soon'])
  })

  it('never includes a subscription with no period_end', async () => {
    // The trap: a never-expiring row appearing in "expires soon" would send an
    // admin chasing a renewal that does not exist.
    const windows = [
      { expiringBefore: NOW },
      { expiringAfter: NOW, expiringBefore: IN_30_DAYS },
      { expiringAfter: NOW },
    ]

    for (const w of windows) {
      const { subscriptions } = await service.listSubscriptions(w)
      expect(subscriptions.some((s: { id: string }) => s.id === 's-perpetual')).toBe(false)
    }
  })

  it('returns the perpetual row when no expiry window is asked for', async () => {
    // The counterweight: the filter must exclude it from expiry questions
    // WITHOUT hiding it from the plain list.
    const { subscriptions } = await service.listSubscriptions({})

    expect(subscriptions.some((s: { id: string }) => s.id === 's-perpetual')).toBe(true)
  })

  it('combines an expiry window with a plan filter', async () => {
    const { subscriptions } = await service.listSubscriptions({
      plan: 'pro',
      expiringAfter: NOW,
      expiringBefore: IN_30_DAYS,
    })

    expect(subscriptions.map((s: { id: string }) => s.id)).toEqual(['s-soon'])
  })
})
