import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { summariseSync, type MutationRow } from '../services/sync-overview.domain'

const row = (over: Partial<MutationRow>): MutationRow => ({
  mutation_id: 'm1',
  device_id: 'dev-a',
  entity_type: 'invoice',
  entity_id: 'e1',
  operation: 'create',
  status: 'applied',
  error_code: null,
  created_at: '2026-09-10T10:00:00Z',
  ...over,
})

describe('summariseSync', () => {
  it('groups devices, counts applied and rejected, keeps latest seen', () => {
    const out = summariseSync(
      [
        row({ mutation_id: '1' }),
        row({
          mutation_id: '2',
          status: 'rejected',
          error_code: 'STALE',
          created_at: '2026-09-12T10:00:00Z',
        }),
        row({ mutation_id: '3', device_id: 'dev-b', created_at: '2026-09-11T10:00:00Z' }),
        row({ mutation_id: '4', device_id: null }),
      ],
      30,
      false,
    )
    expect(out.devices.map((d) => d.deviceId)).toEqual(['dev-a', 'dev-b', 'unknown'])
    expect(out.devices[0]).toMatchObject({
      applied: 1,
      rejected: 1,
      lastSeenAt: '2026-09-12T10:00:00Z',
    })
    expect(out.failed.count).toBe(1)
    expect(out.failed.recent[0]).toMatchObject({ mutationId: '2', errorCode: 'STALE' })
  })

  it('empty log is zero, not an error', () => {
    expect(summariseSync([], 30, false)).toEqual({
      windowDays: 30,
      truncated: false,
      devices: [],
      failed: { count: 0, recent: [] },
    })
  })

  it('failed count is exact even when the recent list is capped at 20', () => {
    const rows = Array.from({ length: 25 }, (_, i) =>
      row({ mutation_id: String(i), status: 'rejected' }),
    )
    const out = summariseSync(rows, 30, true)
    expect(out.failed.count).toBe(25)
    expect(out.failed.recent).toHaveLength(20)
    expect(out.truncated).toBe(true)
  })
})

describe('GET /api/sync/overview route', () => {
  const src = readFileSync(join(__dirname, '../routes/sync.routes.ts'), 'utf8').replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    '',
  )
  const block = src.slice(src.indexOf("'/api/sync/overview'"))
  it('is scoped by workspace, never by user', () => {
    expect(block).toContain(".eq('workspace_id', request.tenancy.workspaceId)")
    expect(block).not.toContain("'user_id'")
    expect(block).toContain('requireWorkspaceContext')
  })
  it('keeps a read error apart from an empty log', () => {
    expect(block).toContain('reply.code(500)')
  })
})
