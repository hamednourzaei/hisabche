import { describe, expect, it, vi, beforeEach } from 'vitest'
import { computeDocumentFieldDiff } from '@hisabche/validation'

const mocks = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  lastWorkspaceFilter: '' as string | null,
}))

vi.mock('../db', () => {
  const queryBuilder = {
    select: () => queryBuilder,
    eq: (col: string, val: string) => {
      if (col === 'workspace_id') mocks.lastWorkspaceFilter = val
      return queryBuilder
    },
    order: async () => ({ data: mocks.rows, error: null }),
  }
  return {
    supabase: {
      from: () => queryBuilder,
    },
  }
})

describe('B.2.22 document_revisions', () => {
  beforeEach(() => {
    mocks.rows = []
    mocks.lastWorkspaceFilter = null
  })

  it('computes field-level before/after diff and ignores updated_at', () => {
    const diff = computeDocumentFieldDiff(
      { name: 'Old', price: 100, updated_at: '2026-01-01T00:00:00Z' },
      { name: 'New', price: 100, updated_at: '2026-01-02T00:00:00Z' },
    )
    expect(diff).toEqual([{ field: 'name', before: 'Old', after: 'New' }])
  })

  it('returns empty diff on no-op edit', () => {
    const diff = computeDocumentFieldDiff(
      { name: 'Same', updated_at: '2026-01-01T00:00:00Z' },
      { name: 'Same', updated_at: '2026-01-02T00:00:00Z' },
    )
    expect(diff).toEqual([])
  })

  it('AuditService.listDocumentRevisions scopes to workspace_id', async () => {
    mocks.rows = [
      {
        id: 'rev-1',
        workspace_id: 'ws-1',
        document_type: 'invoice',
        document_id: 'inv-1',
        version: 1,
        actor_id: 'u-1',
        created_at: '2026-01-01T00:00:00Z',
        before_data: { total: 100 },
        after_data: { total: 150 },
        changed_fields: ['total'],
      },
    ]
    const { AuditService } = await import('../services/audit.service')
    const svc = new AuditService()
    const res = await svc.listDocumentRevisions(
      { workspaceId: 'ws-1', userId: 'u-1', role: 'owner' },
      'invoice',
      'inv-1',
    )
    expect(mocks.lastWorkspaceFilter).toBe('ws-1')
    expect(res).toHaveLength(1)
  })
})
