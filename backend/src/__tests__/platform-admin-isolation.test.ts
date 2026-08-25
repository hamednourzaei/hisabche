// ============================================
// Platform admin vs. customer workspaces — two separate security domains.
//
// The platform administrator runs Hisabche. They are NOT a member of any
// customer's business, and the Admin Panel is the only surface they use.
//
// The tempting shortcut is a single `if (isPlatformAdmin) return true` in the
// tenancy layer. It would be one line, it would look like an operational
// convenience, and it would silently convert an email allowlist into read
// access over every shopkeeper's financial history. These tests exist to make
// that line fail loudly the moment anyone writes it.
//
// The two guards are deliberately independent:
//
//   platformAdminGuard   ADMIN_ALLOWED_EMAILS   -> Admin Panel
//   requireWorkspace     workspace_members      -> customer financial data
//
// Neither consults the other. A platform admin hitting a workspace API is just
// a non-member; a workspace owner hitting the Admin Panel is just a stranger.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

/* ── Membership store, read only through workspace_members ──────────────── */

interface MemberRow {
  workspace_id: string
  user_id: string
  role: string | null
  has_access: boolean
  suspended_at: string | null
  joined_at: string
}

let members: MemberRow[] = []

/** Every table the tenancy resolver touched during a test. */
let tablesRead: string[] = []

function makeQuery() {
  const eqs: Array<[keyof MemberRow, unknown]> = []
  const isNulls: Array<keyof MemberRow> = []

  const api = {
    select: () => api,
    eq: (column: keyof MemberRow, value: unknown) => {
      eqs.push([column, value])
      return api
    },
    is: (column: keyof MemberRow) => {
      isNulls.push(column)
      return api
    },
    order: () => api,
    then: (resolve: (v: { data: MemberRow[]; error: null }) => unknown) => {
      const rows = members
        .filter((row) => eqs.every(([c, v]) => row[c] === v))
        .filter((row) => isNulls.every((c) => row[c] === null))
      return Promise.resolve({ data: rows, error: null }).then(resolve)
    },
  }

  return api
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => {
      tablesRead.push(table)
      return makeQuery()
    },
  },
}))

const { requireWorkspace } = await import('../services/tenancy.service')

/* ── Cast ───────────────────────────────────────────────────────────────── */

const WS_SHOP = 'workspace-of-a-real-shop'

const SHOP_OWNER = 'user-shop-owner'
/** In ADMIN_ALLOWED_EMAILS. Deliberately absent from workspace_members. */
const PLATFORM_ADMIN = 'user-platform-admin'

const ADMIN_EMAIL = 'admin@hisabche.com'

beforeEach(() => {
  tablesRead = []
  members = [
    {
      workspace_id: WS_SHOP,
      user_id: SHOP_OWNER,
      role: 'owner',
      has_access: true,
      suspended_at: null,
      joined_at: '2024-01-01',
    },
  ]
})

/* ═══════════════════════════════════════════════════════════════════════════
   The admin cannot reach customer data
   ═══════════════════════════════════════════════════════════════════════════ */

describe('a platform admin is a stranger to every workspace', () => {
  it('cannot resolve any workspace', async () => {
    // No workspace id means no filter, which means no read path and no write
    // path into this shop's invoices, customers, products or transactions.
    await expect(requireWorkspace(PLATFORM_ADMIN)).rejects.toThrow('No active workspace membership')
  })

  it('cannot reach a workspace by naming it', async () => {
    await expect(requireWorkspace(PLATFORM_ADMIN, WS_SHOP)).rejects.toThrow(
      'No active workspace membership',
    )
  })

  it('is refused with the same message as any other outsider', async () => {
    // Different wording for admins would leak that the allowlist exists and
    // that this id is on it.
    const asAdmin = await requireWorkspace(PLATFORM_ADMIN, WS_SHOP).catch((e: Error) => e.message)
    const asStranger = await requireWorkspace('nobody-at-all', WS_SHOP).catch(
      (e: Error) => e.message,
    )

    expect(asAdmin).toBe(asStranger)
  })

  it('does not gain a membership by attempting access', async () => {
    await requireWorkspace(PLATFORM_ADMIN).catch(() => undefined)
    await requireWorkspace(PLATFORM_ADMIN, WS_SHOP).catch(() => undefined)

    expect(members.some((m) => m.user_id === PLATFORM_ADMIN)).toBe(false)
  })

  it('never has its admin status consulted during tenancy resolution', async () => {
    await requireWorkspace(SHOP_OWNER)
    await requireWorkspace(PLATFORM_ADMIN).catch(() => undefined)

    // The ONLY table tenancy reads is workspace_members. A future branch that
    // checked an allowlist table, a profile flag or a role column would show
    // up here — and this assertion is what turns that from a silent bypass
    // into a failing test.
    expect([...new Set(tablesRead)]).toEqual(['workspace_members'])
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   The Admin Panel still works
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the Admin Panel guard is independent of workspace membership', () => {
  async function guardWith(allowlist: string, user: unknown) {
    vi.resetModules()
    process.env.ADMIN_ALLOWED_EMAILS = allowlist

    const { platformAdminGuard } = await import('../middleware/platform-admin.middleware')

    const sent: Array<{ code: number; body: unknown }> = []
    const reply = {
      code(status: number) {
        return {
          send(body: unknown) {
            sent.push({ code: status, body })
          },
        }
      },
    }

    await platformAdminGuard({ user } as never, reply as never)
    return sent
  }

  it('admits an allowlisted email that belongs to no workspace', async () => {
    // The positive case, and the point of the split: administering the
    // platform must not require joining a customer's business.
    const sent = await guardWith(ADMIN_EMAIL, { email: ADMIN_EMAIL })

    expect(sent).toEqual([])
    expect(members.some((m) => m.user_id === PLATFORM_ADMIN)).toBe(false)
  })

  it('is case-insensitive about the email', async () => {
    const sent = await guardWith(ADMIN_EMAIL, { email: 'Admin@Hisabche.COM' })
    expect(sent).toEqual([])
  })

  it('refuses a workspace owner who is not on the allowlist', async () => {
    // Owning a shop confers nothing on the platform. The two directions are
    // both closed, not just the one.
    const sent = await guardWith(ADMIN_EMAIL, { email: 'shopkeeper@example.com' })

    expect(sent[0]?.code).toBe(403)
    expect(sent[0]?.body).toMatchObject({ code: 'ADMIN_UNAUTHORIZED' })
  })

  it('refuses an unauthenticated caller', async () => {
    const sent = await guardWith(ADMIN_EMAIL, undefined)

    expect(sent[0]?.code).toBe(401)
  })

  it('refuses everyone when the allowlist is empty', async () => {
    // A missing ADMIN_ALLOWED_EMAILS must not mean "everyone is an admin".
    const sent = await guardWith('', { email: ADMIN_EMAIL })

    expect(sent[0]?.code).toBe(403)
  })
})
