import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditService } from '../services/audit.service'
import { supabase } from '../db'

vi.mock('../db', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

const rpc = vi.mocked(supabase.rpc)
const answer = (data: unknown, error: unknown = null) =>
  rpc.mockResolvedValueOnce({ data, error } as never)

describe('Audit chain verification (V53 4.7: asks the database, never trusts an unchained table)', () => {
  const service = new AuditService()
  const workspaceId = '00000000-0000-0000-0000-000000000001'

  beforeEach(() => {
    rpc.mockReset()
  })

  it('asks audit_chain_verify for THIS workspace', async () => {
    answer([{ ok: true, checked: 0, legacy_unchained: 0, first_bad_seq: null, reason: null }])
    answer([{ last_seq: 1, last_hash: 'aa' }])
    await service.verifyChain(workspaceId)
    expect(rpc).toHaveBeenCalledWith('audit_chain_verify', { p_workspace_id: workspaceId })
    expect(rpc).toHaveBeenCalledWith('audit_chain_head', { p_workspace_id: workspaceId })
  })

  it('an intact chain is verified, with its length and the legacy rows counted apart', async () => {
    answer([{ ok: true, checked: '5', legacy_unchained: '2', first_bad_seq: null, reason: null }])
    answer([{ last_seq: 5, last_hash: 'deadbeef' }])
    expect(await service.verifyChain(workspaceId)).toEqual({
      verified: true,
      count: 5,
      legacyUnchained: 2,
      head: { seq: 5, hash: 'deadbeef' },
    })
  })

  it('a chain with no head yet answers null, never a made-up value', async () => {
    answer([{ ok: true, checked: 0, legacy_unchained: 0, first_bad_seq: null, reason: null }])
    answer([])
    expect(await service.verifyChain(workspaceId)).toEqual({
      verified: true,
      count: 0,
      legacyUnchained: 0,
      head: null,
    })
  })

  it.each(['HASH_MISMATCH', 'BROKEN_LINK', 'MISSING_RECORD', 'TAIL_REMOVED'] as const)(
    'a %s is reported as not verified, with where and why',
    async (reason) => {
      answer([{ ok: false, checked: 2, legacy_unchained: 0, first_bad_seq: 3, reason }])
      answer(null)
      expect(await service.verifyChain(workspaceId)).toEqual({
        verified: false,
        count: 2,
        legacyUnchained: 0,
        failedAtSeq: 3,
        reason,
        head: null,
      })
    },
  )

  it('a database without the migration is NOT verified — it says the migration is required', async () => {
    answer(null, { code: '42883', message: 'function audit_chain_verify does not exist' })
    expect(await service.verifyChain(workspaceId)).toEqual({
      verified: false,
      count: 0,
      legacyUnchained: 0,
      migrationRequired: true,
      head: null,
    })
  })

  it('a head read that fails for any other reason is an error, not a null head', async () => {
    answer([{ ok: true, checked: 1, legacy_unchained: 0, first_bad_seq: null, reason: null }])
    answer(null, { code: '57014', message: 'timeout' })
    await expect(service.verifyChain(workspaceId)).rejects.toThrow()
  })

  it('any other failure is an error, never a verdict', async () => {
    answer(null, { code: '57014', message: 'timeout' })
    await expect(service.verifyChain(workspaceId)).rejects.toThrow()
  })

  it('the old check that skipped unhashed rows is gone', () => {
    expect(service.verifyChain.toString()).not.toContain('createHash')
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
