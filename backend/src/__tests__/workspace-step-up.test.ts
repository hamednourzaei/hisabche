// ============================================
// Two-step verification for workspace members (V61 B.2.25), end to end:
//   - the pure rules (which capabilities, what "fresh" means, recovery codes);
//   - the service against Supabase Auth's MFA endpoints (mocked `gotrueRequest`)
//     and our tables (fake DB): codes are generated HERE, only hashes stored;
//   - `requireCapability` refusing a protected action without a fresh code.
//
// The first version accepted any client string as the "TOTP secret", let the
// client choose its own recovery codes, verified nothing, and nothing ever
// required it. Each block below fails against that version.
// ============================================
import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase } from './helpers/fake-supabase'
import type { TenancyContext } from '../services/tenancy.service'

// A fresh database per test; the mock reads whichever is current.
const holder: { db: FakeDatabase } = { db: new FakeDatabase() }
const gotrue = vi.fn()

vi.mock('../db', () => ({
  supabase: { from: (table: string) => holder.db.from(table) },
  gotrueRequest: (...args: unknown[]) => gotrue(...args),
}))

const { hashRecoveryCode, Workspace2faService } =
  await import('../services/authorization/workspace-2fa.service')
const {
  DEFAULT_STEP_UP_CAPABILITIES,
  isFreshStepUp,
  isStepUpCapability,
  normalizeStepUpCapabilities,
  recoveryCodesFrom,
  STEP_UP_ELIGIBLE,
} = await import('../services/authorization/step-up.domain')
const { can } = await import('../services/authorization/authorization.domain')

const WS = '11111111-1111-4111-8111-111111111111'
const USER = '22222222-2222-4222-8222-222222222222'
const ctx: TenancyContext = { workspaceId: WS, userId: USER, role: 'owner' }
const NOW = Date.UTC(2026, 10, 12, 12, 0, 0)
const nowSec = NOW / 1000

function jwt(claims: Record<string, unknown>): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${enc({ alg: 'HS256' })}.${enc(claims)}.sig`
}

beforeEach(() => {
  gotrue.mockReset()
  holder.db = new FakeDatabase()
  const db = holder.db
  db.seed('workspace_2fa_enrollments', [])
  db.seed('workspace_2fa_policies', [])
  db.unique('workspace_2fa_enrollments', ['workspace_id', 'user_id'])
  db.unique('workspace_2fa_policies', ['workspace_id'])
})

describe('step-up rules (pure)', () => {
  it('every eligible capability and every default is a REAL capability', () => {
    // The first default named payroll.manage / role.manage / bank.manage —
    // none exists, so nothing but period close was ever protected.
    for (const c of STEP_UP_ELIGIBLE) expect(can('owner', c)).toBe(true)
    for (const c of DEFAULT_STEP_UP_CAPABILITIES) expect(isStepUpCapability(c)).toBe(true)
  })

  it('refuses unknown names instead of dropping them', () => {
    expect(normalizeStepUpCapabilities(['payroll.manage'])).toEqual({
      ok: false,
      unknown: ['payroll.manage'],
    })
    expect(normalizeStepUpCapabilities(['ledger.lock_period', 'ledger.lock_period'])).toEqual({
      ok: true,
      value: ['ledger.lock_period'],
    })
  })

  it('fresh = AAL2 AND a TOTP check within ten minutes', () => {
    expect(isFreshStepUp({ aal: 'aal1' }, NOW)).toBe(false)
    expect(
      isFreshStepUp({ aal: 'aal2', amr: [{ method: 'password', timestamp: nowSec }] }, NOW),
    ).toBe(false)
    expect(
      isFreshStepUp({ aal: 'aal2', amr: [{ method: 'totp', timestamp: nowSec - 60 }] }, NOW),
    ).toBe(true)
    expect(
      isFreshStepUp({ aal: 'aal2', amr: [{ method: 'totp', timestamp: nowSec - 11 * 60 }] }, NOW),
    ).toBe(false)
  })

  it('recovery codes: ten, distinct format, from the given entropy', () => {
    const codes = recoveryCodesFrom(new Uint8Array(100).map((_, i) => i * 7))
    expect(codes).toHaveLength(10)
    for (const c of codes) expect(c).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/)
    expect(() => recoveryCodesFrom(new Uint8Array(10))).toThrow('RECOVERY_CODE_ENTROPY_SHORT')
  })
})

describe('Workspace2faService against Supabase Auth MFA', () => {
  const service = new Workspace2faService()

  it('starts an enrollment with the person OWN token and returns the QR', async () => {
    gotrue.mockResolvedValueOnce({ status: 200, body: { factors: [] } }).mockResolvedValueOnce({
      status: 200,
      body: {
        id: 'factor-1',
        totp: { qr_code: 'data:image/svg+xml;utf8,<svg/>', secret: 'S3CR3T', uri: 'otpauth://x' },
      },
    })
    const result = await service.startEnrollment('user-token')
    expect(result).toEqual({
      factorId: 'factor-1',
      qrCode: 'data:image/svg+xml;utf8,<svg/>',
      uri: 'otpauth://x',
      secret: 'S3CR3T',
    })
    expect(gotrue).toHaveBeenNthCalledWith(
      2,
      '/factors',
      expect.objectContaining({ method: 'POST', userToken: 'user-token' }),
    )
  })

  it('refuses a second enrollment when a verified factor exists', async () => {
    gotrue.mockResolvedValueOnce({
      status: 200,
      body: { factors: [{ id: 'f', factor_type: 'totp', status: 'verified' }] },
    })
    await expect(service.startEnrollment('t')).rejects.toThrow('TWO_FACTOR_ALREADY_ENROLLED')
  })

  it('first correct code → AAL2 session + recovery codes shown once, only hashes stored', async () => {
    gotrue
      .mockResolvedValueOnce({ status: 200, body: { id: 'challenge-1' } })
      .mockResolvedValueOnce({
        status: 200,
        body: { access_token: 'aal2-token', refresh_token: 'r2', expires_at: 1 },
      })
    const result = await service.verify(ctx, 'user-token', 'factor-1', '123456')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.session.access_token).toBe('aal2-token')
    expect(result.recoveryCodes).toHaveLength(10)

    const row = holder.db.rows('workspace_2fa_enrollments')[0]!
    expect(row.totp_secret_ref).toBe('factor-1')
    expect(row.recovery_code_hashes).toEqual(result.recoveryCodes!.map(hashRecoveryCode))
    expect(JSON.stringify(row)).not.toContain(result.recoveryCodes![0]!)
  })

  it('a later code for the same factor returns no new recovery codes', async () => {
    holder.db.seed('workspace_2fa_enrollments', [
      {
        id: 'e1',
        workspace_id: WS,
        user_id: USER,
        totp_secret_ref: 'factor-1',
        recovery_code_hashes: ['h'],
      },
    ])
    gotrue
      .mockResolvedValueOnce({ status: 200, body: { id: 'c' } })
      .mockResolvedValueOnce({ status: 200, body: { access_token: 'a', refresh_token: 'r' } })
    const result = await service.verify(ctx, 't', 'factor-1', '123456')
    expect(result.ok && result.recoveryCodes).toBeNull()
  })

  it('a wrong code is refused and stores nothing', async () => {
    gotrue
      .mockResolvedValueOnce({ status: 200, body: { id: 'c' } })
      .mockResolvedValueOnce({ status: 422, body: { msg: 'Invalid TOTP code' } })
    expect(await service.verify(ctx, 't', 'factor-1', '000000')).toEqual({
      ok: false,
      code: 'TWO_FACTOR_INVALID_CODE',
    })
    expect(holder.db.rows('workspace_2fa_enrollments')).toHaveLength(0)
  })

  it('a recovery code is single-use and removes the lost factor', async () => {
    holder.db.seed('workspace_2fa_enrollments', [
      {
        id: 'e1',
        workspace_id: WS,
        user_id: USER,
        totp_secret_ref: 'factor-1',
        recovery_code_hashes: [hashRecoveryCode('AAAAA-BBBBB'), hashRecoveryCode('CCCCC-DDDDD')],
        failed_attempts: 0,
        locked_until: null,
      },
    ])
    gotrue
      .mockResolvedValueOnce({
        status: 200,
        body: { factors: [{ id: 'factor-1', factor_type: 'totp', status: 'verified' }] },
      })
      .mockResolvedValueOnce({ status: 200, body: {} })
    expect(await service.recover(ctx, 'aaaaa-bbbbb')).toEqual({ ok: true })
    expect(gotrue).toHaveBeenLastCalledWith(
      `/admin/users/${USER}/factors/factor-1`,
      expect.objectContaining({ method: 'DELETE' }),
    )
    const row = holder.db.rows('workspace_2fa_enrollments')[0]!
    expect(row.recovery_code_hashes).toEqual([])
    expect(row.is_enabled).toBe(false)
  })

  it('wrong recovery codes lock after the policy limit', async () => {
    holder.db.seed('workspace_2fa_enrollments', [
      {
        id: 'e1',
        workspace_id: WS,
        user_id: USER,
        totp_secret_ref: 'f',
        recovery_code_hashes: ['x'],
        failed_attempts: 4,
        locked_until: null,
      },
    ])
    expect(await service.recover(ctx, 'WRONG-CODE')).toEqual({
      ok: false,
      code: 'TWO_FACTOR_LOCKED',
    })
    expect(holder.db.rows('workspace_2fa_enrollments')[0]!.locked_until).not.toBeNull()
  })

  it('saving a policy refuses capability names that do not exist', async () => {
    await expect(
      service.savePolicy(ctx, { capabilities: ['role.manage'], requireOwner: true }),
    ).rejects.toThrow('STEP_UP_CAPABILITY_UNKNOWN')
  })
})

describe('requireCapability enforces the step-up', () => {
  async function appWith(opts: { required: boolean | Error; apiKey?: boolean }) {
    const mod = await import('../services/authorization/workspace-2fa.service')
    const spy = vi.spyOn(mod.workspace2faService, 'requiresStepUp')
    if (opts.required instanceof Error) spy.mockRejectedValue(opts.required)
    else spy.mockResolvedValue(opts.required)
    const { requireCapability } = await import('../middleware/authorize.middleware')
    const app = Fastify()
    app.addHook('preHandler', async (request) => {
      Object.assign(request, { tenancy: ctx })
      if (opts.apiKey) Object.assign(request, { apiKey: { id: 'k' } })
    })
    app.post('/protected', { preHandler: requireCapability('member.manage') }, async () => ({
      ok: true,
    }))
    app.get('/plain', { preHandler: requireCapability('invoice.read') }, async () => ({ ok: true }))
    return { app, spy }
  }

  it('lets the action through when the policy does not protect it', async () => {
    const { app } = await appWith({ required: false })
    expect((await app.inject({ method: 'POST', url: '/protected' })).statusCode).toBe(200)
  })

  it('refuses with WORKSPACE_STEP_UP_REQUIRED without a fresh code', async () => {
    const { app } = await appWith({ required: true })
    const res = await app.inject({
      method: 'POST',
      url: '/protected',
      headers: { authorization: `Bearer ${jwt({ aal: 'aal1' })}` },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({
      code: 'WORKSPACE_STEP_UP_REQUIRED',
      capability: 'member.manage',
    })
  })

  it('passes with a fresh AAL2 TOTP session', async () => {
    const { app } = await appWith({ required: true })
    const token = jwt({
      aal: 'aal2',
      amr: [{ method: 'totp', timestamp: Math.floor(Date.now() / 1000) }],
    })
    const res = await app.inject({
      method: 'POST',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
  })

  it('an API key cannot pass a protected action', async () => {
    const { app } = await appWith({ required: true, apiKey: true })
    const res = await app.inject({ method: 'POST', url: '/protected' })
    expect(res.json().code).toBe('STEP_UP_NOT_AVAILABLE_FOR_API_KEYS')
  })

  it('fails CLOSED when the policy cannot be read', async () => {
    const { app } = await appWith({ required: new Error('db down') })
    const res = await app.inject({ method: 'POST', url: '/protected' })
    expect(res.statusCode).toBe(503)
    expect(res.json().code).toBe('TWO_FACTOR_POLICY_UNAVAILABLE')
  })

  it('a capability outside the closed set never reads the policy', async () => {
    const { app, spy } = await appWith({ required: true })
    spy.mockClear()
    expect((await app.inject({ method: 'GET', url: '/plain' })).statusCode).toBe(200)
    expect(spy).not.toHaveBeenCalled()
  })
})
