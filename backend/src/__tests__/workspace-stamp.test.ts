// ============================================
// Uploading a stamp/signature must not fail silently or lie.
//
// The bug this pins: `updateWorkspace` wrote and read back `stamp_url`
// unconditionally. On a database that has not run
// `docs/workspace-stamp-migration.sql` that column does not exist, so Postgres
// errored and the service threw `DatabaseError('Failed to update workspace')`
// — discarding the cause, so the logs said nothing. In production this showed
// as PATCH /api/workspaces/:id → 500 with no explanation, and the settings UI
// (which had no onError) showed nothing at all, so the feature looked missing.
//
// Two properties matter here:
//   1. a rename that does not involve the stamp still succeeds
//   2. a stamp upload that cannot be stored FAILS LOUDLY — never a silent
//      success, which would tell the user their signature was saved when it
//      was discarded
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const single = vi.fn()
const select = vi.fn(() => ({ single }))
const eq = vi.fn(() => ({ select }))
const update = vi.fn(() => ({ eq }))

vi.mock('../db', () => ({
  supabase: { from: vi.fn(() => ({ update })) },
}))

const { WorkspaceService } = await import('../services/workspace.service')

/** What Postgres returns for a column the stamp migration has not added. */
const missingStampColumn = {
  data: null,
  error: { code: '42703', message: 'column workspaces.stamp_url does not exist' },
}

const workspaceRow = { id: 'ws-1', name: 'حسابچه', slug: 'hisabche' }

function serviceWithAdminRole() {
  const service = new WorkspaceService()
  // Role check talks to a different table; this suite is about the write.
  vi.spyOn(
    service as unknown as { requireRole: () => Promise<void> },
    'requireRole',
  ).mockResolvedValue(undefined)
  return service
}

describe('updateWorkspace when the stamp column is missing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    single.mockReset()
  })

  it('still applies a rename by retrying without the stamp column', async () => {
    single
      .mockResolvedValueOnce(missingStampColumn)
      .mockResolvedValueOnce({ data: workspaceRow, error: null })

    const service = serviceWithAdminRole()
    await expect(service.updateWorkspace('u-1', 'ws-1', { name: 'نو' })).resolves.toMatchObject({
      id: 'ws-1',
    })
  })

  it('refuses to report success when the stamp itself could not be saved', async () => {
    single
      .mockResolvedValueOnce(missingStampColumn)
      .mockResolvedValueOnce({ data: workspaceRow, error: null })

    const service = serviceWithAdminRole()

    await expect(
      service.updateWorkspace('u-1', 'ws-1', { stampUrl: 'data:image/png;base64,AAA' }),
    ).rejects.toThrow(/stamp/i)
  })

  it('names the migration in the error so the fix is actionable', async () => {
    single
      .mockResolvedValueOnce(missingStampColumn)
      .mockResolvedValueOnce({ data: workspaceRow, error: null })

    const service = serviceWithAdminRole()

    await expect(
      service.updateWorkspace('u-1', 'ws-1', { stampUrl: 'data:image/png;base64,AAA' }),
    ).rejects.toThrow(/workspace-stamp-migration/)
  })

  it('carries the database error instead of discarding it', async () => {
    // The original bug logged a bare "Failed to update workspace" with no cause.
    const cause = { code: '23505', message: 'duplicate key value violates unique constraint' }
    single.mockResolvedValue({ data: null, error: cause })

    const service = serviceWithAdminRole()

    await expect(service.updateWorkspace('u-1', 'ws-1', { name: 'نو' })).rejects.toMatchObject({
      originalError: cause,
    })
  })

  it('does not degrade for an unrelated database failure', async () => {
    single.mockResolvedValue({
      data: null,
      error: { code: '42703', message: 'column workspaces.nonsense does not exist' },
    })

    const service = serviceWithAdminRole()

    await expect(service.updateWorkspace('u-1', 'ws-1', { name: 'نو' })).rejects.toThrow()
    // One attempt only — degradation is scoped to the stamp column.
    expect(single).toHaveBeenCalledTimes(1)
  })
})
