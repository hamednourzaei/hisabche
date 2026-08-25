// ============================================
// Tenancy isolation — the workspace boundary.
//
// Every test here is a way one shopkeeper could end up looking at another
// shopkeeper's books. The boundary is `workspace_id`, derived only from the
// authenticated user via `workspace_members`; `user_id` records who acted and
// is never a tenancy filter.
//
// Platform administration is a SEPARATE security domain. A platform admin is
// not a member of any customer workspace, so on these paths they are simply a
// non-member and get 403. The tests below assert that explicitly, because the
// tempting shortcut — "admins can see everything" — would turn an email
// allowlist into read access over every customer's financial history.
//
// The Supabase client is faked because the properties under test are about
// which filters are applied, and a real client would hide that behind a
// network call.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

/* ── In-memory stand-in for the one table tenancy reads ─────────────────── */

interface MemberRow {
  workspace_id: string
  user_id: string
  role: string | null
  has_access: boolean
  suspended_at: string | null
  joined_at: string
}

let members: MemberRow[] = []

function makeQuery() {
  const eqs: Array<[keyof MemberRow, unknown]> = []
  const isNulls: Array<keyof MemberRow> = []
  let orderColumn: keyof MemberRow | null = null
  let ascending = true

  const api = {
    select: () => api,
    eq: (column: keyof MemberRow, value: unknown) => {
      eqs.push([column, value])
      return api
    },
    is: (column: keyof MemberRow, value: null) => {
      // The real client's `.is(col, null)` is `IS NULL`, which — unlike `=` —
      // is the only thing that matches a NULL.
      expect(value).toBeNull()
      isNulls.push(column)
      return api
    },
    order: (column: keyof MemberRow, opts?: { ascending?: boolean }) => {
      orderColumn = column
      ascending = opts?.ascending !== false
      return api
    },
    then: (resolve: (value: { data: MemberRow[]; error: null }) => unknown) => {
      let out = members.filter((row) => eqs.every(([column, value]) => row[column] === value))
      out = out.filter((row) => isNulls.every((column) => row[column] === null))

      if (orderColumn) {
        const key = orderColumn
        out = [...out].sort((a, b) =>
          ascending
            ? String(a[key]).localeCompare(String(b[key]))
            : String(b[key]).localeCompare(String(a[key])),
        )
      }

      return Promise.resolve({ data: out, error: null }).then(resolve)
    },
  }

  return api
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'workspace_members') {
        throw new Error(`tenancy resolution must read only workspace_members, not ${table}`)
      }
      return makeQuery()
    },
  },
}))

const { requireWorkspace, listAuthorizedWorkspaces, requireRole } =
  await import('../services/tenancy.service')

/* ── Cast ───────────────────────────────────────────────────────────────── */

const WS_A = 'workspace-a'
const WS_B = 'workspace-b'

const OWNER_A = 'user-owner-a'
const MANAGER_A = 'user-manager-a'
const SELLER_A = 'user-seller-a'
const OWNER_B = 'user-owner-b'
const SUSPENDED_A = 'user-suspended-a'
const REVOKED_A = 'user-revoked-a'
/** In ADMIN_ALLOWED_EMAILS, and deliberately in no workspace_members row. */
const PLATFORM_ADMIN = 'user-platform-admin'

function member(over: Partial<MemberRow> & Pick<MemberRow, 'workspace_id' | 'user_id'>): MemberRow {
  return {
    role: 'seller',
    has_access: true,
    suspended_at: null,
    joined_at: '2024-01-01',
    ...over,
  }
}

beforeEach(() => {
  members = [
    member({ workspace_id: WS_A, user_id: OWNER_A, role: 'owner' }),
    member({ workspace_id: WS_A, user_id: MANAGER_A, role: 'manager' }),
    member({ workspace_id: WS_A, user_id: SELLER_A, role: 'seller' }),
    member({ workspace_id: WS_B, user_id: OWNER_B, role: 'owner' }),
    member({
      workspace_id: WS_A,
      user_id: SUSPENDED_A,
      role: 'manager',
      suspended_at: '2025-01-01',
    }),
    member({ workspace_id: WS_A, user_id: REVOKED_A, role: 'manager', has_access: false }),
  ]
})

/* ═══════════════════════════════════════════════════════════════════════════
   Platform admin is not a workspace member
   ═══════════════════════════════════════════════════════════════════════════ */

describe('platform admin is a separate security domain', () => {
  it('cannot resolve a workspace at all', async () => {
    // Tests 1 and 2: with no workspace, there is no id to filter by, so there
    // is no read path and no write path into workspace A's data.
    await expect(requireWorkspace(PLATFORM_ADMIN)).rejects.toThrow('No active workspace membership')
  })

  it('cannot reach a workspace by naming it', async () => {
    // Test 3/4: platform-admin status confers nothing here. Asking for WS_A by
    // id is the same rejected request it would be from any other stranger.
    await expect(requireWorkspace(PLATFORM_ADMIN, WS_A)).rejects.toThrow(
      'No active workspace membership',
    )
  })

  it('does not become a member implicitly by asking', async () => {
    await requireWorkspace(PLATFORM_ADMIN).catch(() => undefined)
    expect(members.some((m) => m.user_id === PLATFORM_ADMIN)).toBe(false)
  })

  it('is never consulted for platform-admin status during tenancy resolution', async () => {
    // The `from()` fake throws on any table other than workspace_members, so
    // a future "unless they are a platform admin" branch that reads an
    // allowlist table would fail this test rather than open a bypass.
    await expect(requireWorkspace(OWNER_A)).resolves.toMatchObject({ workspaceId: WS_A })
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Cross-workspace isolation
   ═══════════════════════════════════════════════════════════════════════════ */

describe('a member reaches only their own workspace', () => {
  it.each([
    ['owner', OWNER_A, 'owner'],
    ['manager', MANAGER_A, 'manager'],
    ['seller', SELLER_A, 'seller'],
  ])('%s of A resolves to A with the right role', async (_label, userId, role) => {
    // Tests 6, 7, 8.
    await expect(requireWorkspace(userId)).resolves.toEqual({
      workspaceId: WS_A,
      userId,
      role,
    })
  })

  it('refuses a workspace id the caller supplied but does not belong to', async () => {
    // Test 9 — the IDOR. A member of A naming B must not get B, and must not
    // silently fall back to A either, which would make the attempt look
    // successful.
    await expect(requireWorkspace(OWNER_A, WS_B)).rejects.toThrow('No active workspace membership')
  })

  it('does not leak whether an unauthorized workspace exists', async () => {
    const real = await requireWorkspace(OWNER_A, WS_B).catch((e: Error) => e.message)
    const invented = await requireWorkspace(OWNER_A, 'no-such-workspace').catch(
      (e: Error) => e.message,
    )
    expect(real).toBe(invented)
  })

  it('honours a requested workspace the caller DOES belong to', async () => {
    members.push(
      member({ workspace_id: WS_B, user_id: OWNER_A, role: 'seller', joined_at: '2024-06-01' }),
    )
    await expect(requireWorkspace(OWNER_A, WS_B)).resolves.toMatchObject({
      workspaceId: WS_B,
      role: 'seller',
    })
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Revoked access
   ═══════════════════════════════════════════════════════════════════════════ */

describe('access can be taken away', () => {
  it('a suspended member gets nothing', async () => {
    // Test 10. `suspended_at` is a timestamp, so the filter must be IS NULL;
    // `= null` would match no row at all and silently lock everyone out.
    await expect(requireWorkspace(SUSPENDED_A)).rejects.toThrow('No active workspace membership')
  })

  it('a member with has_access = false gets nothing', async () => {
    // Test 11.
    await expect(requireWorkspace(REVOKED_A)).rejects.toThrow('No active workspace membership')
  })

  it('a suspended member cannot re-enter by naming their own workspace', async () => {
    await expect(requireWorkspace(SUSPENDED_A, WS_A)).rejects.toThrow(
      'No active workspace membership',
    )
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Determinism
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the active workspace is never guessed', () => {
  it('refuses to choose when the user belongs to several', async () => {
    members.push(member({ workspace_id: WS_B, user_id: OWNER_A, joined_at: '2024-06-01' }))

    // The replaced code did `.limit(1)` with no ORDER BY, so this case
    // resolved to whichever row PostgreSQL happened to return — a sale could
    // post into a different business on a retry.
    await expect(requireWorkspace(OWNER_A)).rejects.toThrow(
      'an explicit workspace must be selected',
    )
  })

  it('lists every authorized workspace so the client can choose one', async () => {
    members.push(member({ workspace_id: WS_B, user_id: OWNER_A, joined_at: '2024-06-01' }))

    const all = await listAuthorizedWorkspaces(OWNER_A)
    expect(all.map((c) => c.workspaceId)).toEqual([WS_A, WS_B]) // joined_at order
  })

  it('excludes suspended memberships from the choices', async () => {
    members.push(
      member({
        workspace_id: WS_B,
        user_id: OWNER_A,
        joined_at: '2024-06-01',
        suspended_at: '2025-02-02',
      }),
    )
    // Only one remains authorized, so resolution is unambiguous again.
    await expect(requireWorkspace(OWNER_A)).resolves.toMatchObject({ workspaceId: WS_A })
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Roles
   ═══════════════════════════════════════════════════════════════════════════ */

describe('roles do not escalate', () => {
  it('an unrecognised role degrades to the least privilege', async () => {
    members = [member({ workspace_id: WS_A, user_id: OWNER_A, role: 'wizard' })]

    // The replaced middleware defaulted a MISSING membership to 'admin', which
    // workflow.service.ts accepts as an approver override. Unknown must mean
    // less, never more.
    await expect(requireWorkspace(OWNER_A)).resolves.toMatchObject({ role: 'seller' })
  })

  it('a NULL role degrades to the least privilege', async () => {
    members = [member({ workspace_id: WS_A, user_id: OWNER_A, role: null })]
    await expect(requireWorkspace(OWNER_A)).resolves.toMatchObject({ role: 'seller' })
  })

  it('requireRole ranks owner above manager above seller', async () => {
    const owner = await requireWorkspace(OWNER_A)
    const manager = await requireWorkspace(MANAGER_A)
    const seller = await requireWorkspace(SELLER_A)

    expect(() => requireRole(owner, 'owner')).not.toThrow()
    expect(() => requireRole(manager, 'manager')).not.toThrow()
    expect(() => requireRole(manager, 'owner')).toThrow('Requires owner role')
    expect(() => requireRole(seller, 'manager')).toThrow('Requires manager role')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   The actor is recorded, and is not the boundary
   ═══════════════════════════════════════════════════════════════════════════ */

describe('actor and tenancy are different things', () => {
  it('carries the acting user alongside the workspace', async () => {
    // Test 12: a mutation built from this context has both — workspace_id to
    // scope it, user_id to say who did it.
    await expect(requireWorkspace(MANAGER_A)).resolves.toEqual({
      workspaceId: WS_A,
      userId: MANAGER_A,
      role: 'manager',
    })
  })

  it('two members of one workspace resolve to the SAME book', async () => {
    // The whole point of the tenancy correction: a workspace is a shared
    // business. If these differed, each member would have private invoices.
    const owner = await requireWorkspace(OWNER_A)
    const seller = await requireWorkspace(SELLER_A)

    expect(owner.workspaceId).toBe(seller.workspaceId)
    expect(owner.userId).not.toBe(seller.userId)
  })

  it('an empty user id is rejected before any query runs', async () => {
    // Test 13: an unauthenticated request must never reach the database with a
    // blank filter. The replaced middleware produced workspaceId '' on exactly
    // this path.
    await expect(requireWorkspace('')).rejects.toThrow('Not authenticated')
  })
})
