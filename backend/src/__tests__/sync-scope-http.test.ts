import { beforeAll, describe, expect, it, vi } from 'vitest'

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'

const rpcCalls: Array<{ fn: string; params: Record<string, unknown> }> = []

vi.mock('../db', () => ({
  supabase: {
    rpc: vi.fn(async (fn: string, params: Record<string, unknown>) => {
      rpcCalls.push({ fn, params })
      if (fn === 'sync_pull_changes_v2') {
        const types = (params.p_entity_types as string[] | null) ?? ['invoice', 'time_entry']
        const allRows = [
          {
            sync_version: 10,
            workspace_id: WORKSPACE_ID,
            entity_type: 'invoice',
            entity_id: '33333333-3333-4333-8333-333333333333',
            operation: 'delete',
            entity_version: 1,
            origin_device: null,
            created_at: '2026-11-12T00:00:00Z',
          },
          {
            sync_version: 11,
            workspace_id: WORKSPACE_ID,
            entity_type: 'time_entry',
            entity_id: '44444444-4444-4444-8444-444444444444',
            operation: 'delete',
            entity_version: 1,
            origin_device: null,
            created_at: '2026-11-12T00:01:00Z',
          },
        ]
        return {
          data: allRows.filter((r) => types.includes(r.entity_type)),
          error: null,
        }
      }
      return { data: [], error: null }
    }),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { sync_version: 1 }, error: null })),
            })),
          })),
        })),
      })),
    })),
  },
}))

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: vi.fn(async (req: { user?: { id: string } }) => {
    req.user = { id: USER_ID }
  }),
}))

vi.mock('../middleware/workspace.middleware', () => ({
  requireWorkspaceContext: vi.fn(async (req: { tenancy?: Record<string, unknown> }) => {
    req.tenancy = { workspaceId: WORKSPACE_ID, userId: USER_ID, role: 'owner' }
  }),
}))

describe('Module-scoped sync HTTP (V62 Slice 5)', () => {
  let app: Awaited<ReturnType<(typeof import('../index'))['buildServer']>>

  beforeAll(async () => {
    const { buildServer } = await import('../index')
    app = await buildServer()
  })

  it('passes validated entityTypes to sync_pull_changes_v2 and returns only requested types', async () => {
    rpcCalls.length = 0
    const res = await app.inject({
      method: 'GET',
      url: '/api/sync/pull?cursor=0&limit=50&entityTypes=time_entry',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { changes: Array<{ entityType: string }> }
    expect(body.changes.map((c) => c.entityType)).toEqual(['time_entry'])
    expect(rpcCalls[0]?.fn).toBe('sync_pull_changes_v2')
    expect(rpcCalls[0]?.params.p_entity_types).toEqual(['time_entry'])
  })

  it('rejects unknown entityTypes with 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sync/pull?cursor=0&entityTypes=not_a_real_entity',
    })
    expect(res.statusCode).toBe(400)
  })
})
