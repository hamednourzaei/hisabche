// «سابقه تغییرات»: every row read «—» for user, role and branch (reported,
// 26 Sep 2026). The query selected only id/action/entity/created_at — the page
// asked for columns that were never fetched.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const selects: Array<{ columns: string; options: unknown }> = []
let branchMissing = false

vi.mock('../db', () => {
  const chain = (columns: string, options: unknown) => {
    selects.push({ columns, options })
    const q: Record<string, unknown> = {}
    for (const m of ['eq', 'gte', 'lte', 'order']) q[m] = () => q
    q.range = async () =>
      branchMissing && columns.includes('branch_id')
        ? {
            data: null,
            error: { code: '42703', message: 'column audit_logs.branch_id does not exist' },
            count: null,
          }
        : { data: [{ id: '1' }], error: null, count: 1 }
    return q
  }
  return { supabase: { from: () => ({ select: chain }) } }
})
vi.mock('../utils/pagination', () => ({
  memoryCache: { get: async () => null, set: async () => {}, invalidate: async () => {} },
}))

const { AuditService } = await import('../services/audit.service')
const ctx = { workspaceId: 'ws-1', userId: 'u-1', role: 'owner' as const }

beforeEach(() => {
  selects.length = 0
  branchMissing = false
})

describe('the workspace audit trail fetches what its table shows', () => {
  it('who, where, and before/after — and an EXACT count', async () => {
    await new AuditService().listForWorkspace(ctx, {})
    const { columns, options } = selects[0]!
    for (const column of ['created_at', 'user_id', 'branch_id', 'old_data', 'new_data']) {
      expect(columns).toContain(column)
    }
    expect(options).toMatchObject({ count: 'exact' })
  })

  it('before the branch migration: retried without branch_id, still with the user', async () => {
    branchMissing = true
    const result = (await new AuditService().listForWorkspace(ctx, {})) as { data: unknown[] }
    expect(result.data).toHaveLength(1)
    expect(selects[1]!.columns).not.toContain('branch_id')
    expect(selects[1]!.columns).toContain('user_id')
  })
})
