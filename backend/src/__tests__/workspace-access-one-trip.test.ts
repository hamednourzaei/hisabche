// The request's authorization context in ONE round trip (27 Sep 2026).
// The RPC only reads; the decisions are the old path's own functions — so the
// two must agree, and a failure must never read as «no access» or «no blocks».
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const tableReads: string[] = []
let tables: Record<string, { data: unknown; error: unknown }> = {}

function builder(table: string) {
  tableReads.push(table)
  const result = () => tables[table] ?? { data: [], error: null }
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'is', 'order', 'in']) q[m] = () => q
  q.then = (resolve: (v: unknown) => void) => resolve(result())
  return q
}

vi.mock('../db', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (t: string) => builder(t) },
}))
vi.mock('../utils/pagination', () => ({
  memoryCache: { getShared: vi.fn(async () => null), setShared: vi.fn(), invalidate: vi.fn() },
}))

const { resolveWorkspaceAccess, __resetWorkspaceAccessProbe } =
  await import('../services/authorization/workspace-access.service')

const WS_A = '11111111-1111-4111-8111-111111111111'
const WS_B = '22222222-2222-4222-8222-222222222222'
const USER = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  rpc.mockReset()
  tableReads.length = 0
  tables = {}
  __resetWorkspaceAccessProbe()
})

describe('resolveWorkspaceAccess — one round trip', () => {
  it('uses only the RPC: no table is read', async () => {
    rpc.mockResolvedValue({
      data: { memberships: [{ workspace_id: WS_A, role: 'seller' }], overrides: [], blocks: [] },
      error: null,
    })
    const ctx = await resolveWorkspaceAccess(USER, null)
    expect(ctx.workspaceId).toBe(WS_A)
    expect(ctx.role).toBe('seller')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(tableReads).toEqual([])
  })

  it('applies overrides for the role, and page blocks for the member', async () => {
    rpc.mockResolvedValue({
      data: {
        memberships: [{ workspace_id: WS_A, role: 'manager' }],
        overrides: [
          { role: 'manager', capability: 'ledger.read', granted: false },
          { role: 'seller', capability: 'ledger.read', granted: true },
        ],
        blocks: [],
      },
      error: null,
    })
    const ctx = await resolveWorkspaceAccess(USER, WS_A)
    expect(ctx.capabilities?.has('ledger.read')).toBe(false)
  })

  it('a workspace the user is not a member of is refused — same 403 as the old path', async () => {
    rpc.mockResolvedValue({
      data: { memberships: [{ workspace_id: WS_A, role: 'owner' }], overrides: [], blocks: [] },
      error: null,
    })
    await expect(resolveWorkspaceAccess(USER, WS_B)).rejects.toThrow(
      'No active workspace membership',
    )
  })

  it('several memberships and none named → refused, never guessed', async () => {
    rpc.mockResolvedValue({
      data: {
        memberships: [
          { workspace_id: WS_A, role: 'owner' },
          { workspace_id: WS_B, role: 'seller' },
        ],
        overrides: [],
        blocks: [],
      },
      error: null,
    })
    await expect(resolveWorkspaceAccess(USER, null)).rejects.toThrow(/explicit workspace/)
  })

  it('a failed RPC throws — it is never read as «no blocks» or «no overrides»', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '57014', message: 'canceling statement' } })
    await expect(resolveWorkspaceAccess(USER, null)).rejects.toThrow(
      'Failed to resolve workspace access',
    )
    expect(tableReads).toEqual([])
  })
})

describe('resolveWorkspaceAccess — before the migration', () => {
  it('a missing function falls back to the separate reads, and stops asking for a while', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } })
    tables.workspace_members = {
      data: [{ workspace_id: WS_A, role: 'owner', has_access: true, suspended_at: null }],
      error: null,
    }

    const first = await resolveWorkspaceAccess(USER, null)
    expect(first.workspaceId).toBe(WS_A)
    expect(tableReads).toContain('workspace_members')

    await resolveWorkspaceAccess(USER, null)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('both paths agree on the same data', async () => {
    const overrides = [{ role: 'seller', capability: 'ledger.read', granted: true }]
    rpc.mockResolvedValue({
      data: {
        memberships: [{ workspace_id: WS_A, role: 'seller' }],
        overrides,
        blocks: ['accounting'],
      },
      error: null,
    })
    const viaRpc = await resolveWorkspaceAccess(USER, WS_A)

    __resetWorkspaceAccessProbe()
    rpc.mockResolvedValue({ data: null, error: { code: '42883', message: 'no function' } })
    tables = {
      workspace_members: {
        data: [{ workspace_id: WS_A, role: 'seller', has_access: true, suspended_at: null }],
        error: null,
      },
      workspace_role_capabilities: { data: overrides, error: null },
      workspace_member_module_blocks: {
        data: [{ user_id: USER, module_key: 'accounting' }],
        error: null,
      },
    }
    const viaReads = await resolveWorkspaceAccess(USER, WS_A)

    expect([...(viaRpc.capabilities ?? [])].sort()).toEqual(
      [...(viaReads.capabilities ?? [])].sort(),
    )
    expect(viaRpc.role).toBe(viaReads.role)
  })
})
