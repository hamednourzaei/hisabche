import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { AuditService } from '../services/audit.service'
import { supabase } from '../db'

vi.mock('../db', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('Audit Chain Verification (Option 48)', () => {
  const service = new AuditService()
  const workspaceId = '00000000-0000-0000-0000-000000000001'

  it('verifies empty chain as valid', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    } as any)

    const res = await service.verifyChain(workspaceId)
    expect(res.verified).toBe(true)
    expect(res.count).toBe(0)
  })

  it('verifies correctly chained rows', async () => {
    const prev0 = '0'.repeat(64)
    const hash1 = createHash('sha256')
      .update(`${prev0}:${workspaceId}:row-1:create:2026-10-26T10:00:00Z:ent-1`)
      .digest('hex')
    const hash2 = createHash('sha256')
      .update(`${hash1}:${workspaceId}:row-2:update:2026-10-26T10:05:00Z:ent-1`)
      .digest('hex')

    const rows = [
      {
        id: 'row-1',
        workspace_id: workspaceId,
        action: 'create',
        entity_id: 'ent-1',
        created_at: '2026-10-26T10:00:00Z',
        prev_hash: prev0,
        hash: hash1,
      },
      {
        id: 'row-2',
        workspace_id: workspaceId,
        action: 'update',
        entity_id: 'ent-1',
        created_at: '2026-10-26T10:05:00Z',
        prev_hash: hash1,
        hash: hash2,
      },
    ]

    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: rows, error: null }),
        }),
      }),
    } as any)

    const res = await service.verifyChain(workspaceId)
    expect(res.verified).toBe(true)
    expect(res.count).toBe(2)
  })

  it('detects broken chain when prev_hash is tampered', async () => {
    const prev0 = '0'.repeat(64)
    const hash1 = createHash('sha256')
      .update(`${prev0}:${workspaceId}:row-1:create:2026-10-26T10:00:00Z:ent-1`)
      .digest('hex')

    const rows = [
      {
        id: 'row-1',
        workspace_id: workspaceId,
        action: 'create',
        entity_id: 'ent-1',
        created_at: '2026-10-26T10:00:00Z',
        prev_hash: prev0,
        hash: hash1,
      },
      {
        id: 'row-2',
        workspace_id: workspaceId,
        action: 'update',
        entity_id: 'ent-1',
        created_at: '2026-10-26T10:05:00Z',
        prev_hash: 'tampered-hash-value',
        hash: 'some-hash',
      },
    ]

    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: rows, error: null }),
        }),
      }),
    } as any)

    const res = await service.verifyChain(workspaceId)
    expect(res.verified).toBe(false)
    expect(res.failedAtRowId).toBe('row-2')
  })
})
