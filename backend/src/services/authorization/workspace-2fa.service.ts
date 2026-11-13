// ============================================
// backend/src/services/authorization/workspace-2fa.service.ts
//
// Two-step verification for the people of a workspace (V61 B.2.25).
//
// ⚠️ THE AUTHENTICATOR FACTOR IS SUPABASE AUTH'S, NOT OURS. Enrolling, the
// challenge and the code check are GoTrue's MFA endpoints, called with the
// person's OWN access token (`gotrueRequest` in db.ts). The secret never
// reaches our tables. A correct code returns a new session at AAL2, which the
// client adopts — that session is what `requireCapability` reads.
//
// What WE keep (`workspace_2fa_enrollments`, service_role only):
//   - the factor id (column `totp_secret_ref`, historical name — it holds no secret),
//   - SHA-256 hashes of the recovery codes, generated HERE and shown once,
//   - the failed-attempt counter and lockout for recovery codes.
// And `workspace_2fa_policies`: which capabilities ask for a fresh code.
//
// The first version of this file trusted the client: it accepted any string as
// the "TOTP secret", the client chose its own recovery codes, no code was ever
// verified, and nothing ever required it. It looked like 2FA and was none.
// ============================================
import { createHash, randomBytes } from 'node:crypto'
import { gotrueRequest, supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'
import { isMissingSchema } from '../customer-profile/customer-profile.domain'
import {
  DEFAULT_STEP_UP_CAPABILITIES,
  isStepUpCapability,
  normalizeStepUpCapabilities,
  recoveryCodesFrom,
  RECOVERY_CODE_COUNT,
  type StepUpCapability,
} from './step-up.domain'

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex')
}

export interface StepUpPolicy {
  capabilities: StepUpCapability[]
  requireOwner: boolean
  maxFailedAttempts: number
  lockoutMinutes: number
}

export interface TwoFactorStatus {
  /** A verified TOTP factor exists on this person's account. */
  enrolled: boolean
  factorId: string | null
  recoveryCodesLeft: number
  /** null = the workspace has no policy: nothing asks for a step-up. */
  policy: StepUpPolicy | null
  /** The migration has not run: the feature is not available yet. */
  configured: boolean
}

interface GoTrueFactor {
  id: string
  factor_type?: string
  status?: string
}

function totpFactors(user: Record<string, unknown>): GoTrueFactor[] {
  const factors = Array.isArray(user.factors) ? (user.factors as GoTrueFactor[]) : []
  return factors.filter((f) => f.factor_type === 'totp')
}

const POLICY_TTL_MS = 60_000
const policyCache = new Map<string, { at: number; policy: StepUpPolicy | null }>()

export class Workspace2faService {
  // ─── Policy ────────────────────────────────────────────────────────────────
  async getPolicy(workspaceId: string): Promise<StepUpPolicy | null> {
    const cached = policyCache.get(workspaceId)
    if (cached && Date.now() - cached.at < POLICY_TTL_MS) return cached.policy

    const { data, error } = await supabase
      .from('workspace_2fa_policies')
      .select('step_up_capabilities, require_owner, max_failed_attempts, lockout_minutes')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (isMissingSchema(error)) {
      policyCache.set(workspaceId, { at: Date.now(), policy: null })
      return null
    }
    if (error) throw new DatabaseError('Failed to read the two-step policy', error)

    const policy: StepUpPolicy | null = data
      ? {
          // A stored name that is not a step-up capability (the first default
          // named three that do not exist) protects nothing; keep the real ones.
          capabilities: ((data.step_up_capabilities as string[] | null) ?? []).filter(
            isStepUpCapability,
          ),
          requireOwner: data.require_owner !== false,
          maxFailedAttempts: Number(data.max_failed_attempts ?? 5),
          lockoutMinutes: Number(data.lockout_minutes ?? 15),
        }
      : null
    policyCache.set(workspaceId, { at: Date.now(), policy })
    return policy
  }

  async requiresStepUp(workspaceId: string, capability: string): Promise<boolean> {
    const policy = await this.getPolicy(workspaceId)
    return policy !== null && (policy.capabilities as string[]).includes(capability)
  }

  async savePolicy(
    ctx: TenancyContext,
    input: { capabilities: string[]; requireOwner: boolean },
  ): Promise<StepUpPolicy> {
    const normalized = normalizeStepUpCapabilities(input.capabilities)
    if (!normalized.ok) throw new ValidationError('STEP_UP_CAPABILITY_UNKNOWN')
    const { error } = await supabase.from('workspace_2fa_policies').upsert(
      {
        workspace_id: ctx.workspaceId,
        step_up_capabilities: normalized.value,
        require_owner: input.requireOwner,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id' },
    )
    if (isMissingSchema(error)) throw new ValidationError('TWO_FACTOR_NOT_READY')
    if (error) throw new DatabaseError('Failed to save the two-step policy', error)
    policyCache.delete(ctx.workspaceId)
    const saved = await this.getPolicy(ctx.workspaceId)
    if (!saved) throw new DatabaseError('Two-step policy did not read back')
    return saved
  }

  /** The policy a workspace starts from when the owner first turns it on. */
  defaultPolicy(): { capabilities: StepUpCapability[]; requireOwner: boolean } {
    return { capabilities: [...DEFAULT_STEP_UP_CAPABILITIES], requireOwner: true }
  }

  // ─── Status ────────────────────────────────────────────────────────────────
  async status(ctx: TenancyContext, userToken: string): Promise<TwoFactorStatus> {
    const user = await gotrueRequest('/user', { method: 'GET', userToken })
    if (user.status >= 400) throw new ValidationError('TWO_FACTOR_SESSION_INVALID')
    const verified = totpFactors(user.body).find((f) => f.status === 'verified') ?? null

    const { data, error } = await supabase
      .from('workspace_2fa_enrollments')
      .select('recovery_code_hashes, totp_secret_ref')
      .eq('workspace_id', ctx.workspaceId)
      .eq('user_id', ctx.userId)
      .maybeSingle()
    if (isMissingSchema(error)) {
      return {
        enrolled: verified !== null,
        factorId: verified?.id ?? null,
        recoveryCodesLeft: 0,
        policy: null,
        configured: false,
      }
    }
    if (error) throw new DatabaseError('Failed to read the two-step enrollment', error)

    return {
      enrolled: verified !== null,
      factorId: verified?.id ?? null,
      recoveryCodesLeft:
        verified && data?.totp_secret_ref === verified.id
          ? ((data.recovery_code_hashes as string[] | null) ?? []).length
          : 0,
      policy: await this.getPolicy(ctx.workspaceId),
      configured: true,
    }
  }

  // ─── Enroll → verify ───────────────────────────────────────────────────────
  /** Starts a new TOTP factor. Returns what the authenticator app needs. */
  async startEnrollment(userToken: string): Promise<{
    factorId: string
    qrCode: string
    uri: string
    secret: string
  }> {
    const user = await gotrueRequest('/user', { method: 'GET', userToken })
    if (user.status >= 400) throw new ValidationError('TWO_FACTOR_SESSION_INVALID')
    const factors = totpFactors(user.body)
    if (factors.some((f) => f.status === 'verified')) {
      throw new ValidationError('TWO_FACTOR_ALREADY_ENROLLED')
    }
    // An abandoned attempt leaves an unverified factor behind; GoTrue refuses a
    // second one with the same name, so clear them first.
    for (const stale of factors) {
      await gotrueRequest(`/factors/${encodeURIComponent(stale.id)}`, {
        method: 'DELETE',
        userToken,
      })
    }
    const res = await gotrueRequest('/factors', {
      method: 'POST',
      userToken,
      body: { factor_type: 'totp', friendly_name: 'Hisabche', issuer: 'Hisabche' },
    })
    const totp = (res.body.totp ?? {}) as Record<string, unknown>
    if (res.status >= 400 || typeof res.body.id !== 'string') {
      throw new ValidationError('TWO_FACTOR_ENROLL_FAILED')
    }
    return {
      factorId: res.body.id,
      qrCode: String(totp.qr_code ?? ''),
      uri: String(totp.uri ?? ''),
      secret: String(totp.secret ?? ''),
    }
  }

  /**
   * Checks a code against the factor and returns the new AAL2 session. On the
   * FIRST verification of a factor, recovery codes are generated and returned
   * — once; only their hashes are kept.
   */
  async verify(
    ctx: TenancyContext,
    userToken: string,
    factorId: string,
    code: string,
  ): Promise<
    | { ok: false; code: 'TWO_FACTOR_INVALID_CODE' }
    | {
        ok: true
        session: { access_token: string; refresh_token: string; expires_at?: number | undefined }
        recoveryCodes: string[] | null
      }
  > {
    const challenge = await gotrueRequest(`/factors/${encodeURIComponent(factorId)}/challenge`, {
      method: 'POST',
      userToken,
    })
    if (challenge.status >= 400 || typeof challenge.body.id !== 'string') {
      return { ok: false, code: 'TWO_FACTOR_INVALID_CODE' }
    }
    const verified = await gotrueRequest(`/factors/${encodeURIComponent(factorId)}/verify`, {
      method: 'POST',
      userToken,
      body: { challenge_id: challenge.body.id, code: code.trim() },
    })
    const access = verified.body.access_token
    const refresh = verified.body.refresh_token
    if (verified.status >= 400 || typeof access !== 'string' || typeof refresh !== 'string') {
      return { ok: false, code: 'TWO_FACTOR_INVALID_CODE' }
    }
    const session = {
      access_token: access,
      refresh_token: refresh,
      ...(typeof verified.body.expires_at === 'number'
        ? { expires_at: verified.body.expires_at }
        : {}),
    }

    const { data: row, error } = await supabase
      .from('workspace_2fa_enrollments')
      .select('totp_secret_ref')
      .eq('workspace_id', ctx.workspaceId)
      .eq('user_id', ctx.userId)
      .maybeSingle()
    if (isMissingSchema(error)) return { ok: true, session, recoveryCodes: null }
    if (error) throw new DatabaseError('Failed to read the two-step enrollment', error)
    if (row?.totp_secret_ref === factorId) return { ok: true, session, recoveryCodes: null }

    const codes = recoveryCodesFrom(randomBytes(RECOVERY_CODE_COUNT * 10))
    const { error: saveError } = await supabase.from('workspace_2fa_enrollments').upsert(
      {
        workspace_id: ctx.workspaceId,
        user_id: ctx.userId,
        totp_secret_ref: factorId,
        recovery_code_hashes: codes.map(hashRecoveryCode),
        is_enabled: true,
        failed_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,user_id' },
    )
    if (saveError) throw new DatabaseError('Failed to save the recovery codes', saveError)
    return { ok: true, session, recoveryCodes: codes }
  }

  // ─── Recovery ──────────────────────────────────────────────────────────────
  /**
   * A recovery code removes the lost authenticator so the person can enrol a
   * new one. It does NOT grant a step-up by itself: Supabase Auth has no
   * recovery codes, so the only honest effect is "start again".
   */
  async recover(
    ctx: TenancyContext,
    code: string,
  ): Promise<{ ok: true } | { ok: false; code: 'TWO_FACTOR_LOCKED' | 'TWO_FACTOR_INVALID_CODE' }> {
    const policy = await this.getPolicy(ctx.workspaceId)
    const maxFailed = policy?.maxFailedAttempts ?? 5
    const lockoutMinutes = policy?.lockoutMinutes ?? 15

    const { data: row, error } = await supabase
      .from('workspace_2fa_enrollments')
      .select('id, recovery_code_hashes, failed_attempts, locked_until')
      .eq('workspace_id', ctx.workspaceId)
      .eq('user_id', ctx.userId)
      .maybeSingle()
    if (isMissingSchema(error)) throw new ValidationError('TWO_FACTOR_NOT_READY')
    if (error) throw new DatabaseError('Failed to load the two-step enrollment', error)
    if (!row) throw new NotFoundError('Two-step enrollment')

    if (row.locked_until && Date.parse(String(row.locked_until)) > Date.now()) {
      return { ok: false, code: 'TWO_FACTOR_LOCKED' }
    }

    const hashes = (row.recovery_code_hashes as string[] | null) ?? []
    const index = hashes.indexOf(hashRecoveryCode(code))
    if (index === -1) {
      const failed = Number(row.failed_attempts ?? 0) + 1
      const lockedUntil =
        failed >= maxFailed ? new Date(Date.now() + lockoutMinutes * 60_000).toISOString() : null
      await supabase
        .from('workspace_2fa_enrollments')
        .update({
          failed_attempts: failed,
          locked_until: lockedUntil,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .eq('workspace_id', ctx.workspaceId)
      return { ok: false, code: lockedUntil ? 'TWO_FACTOR_LOCKED' : 'TWO_FACTOR_INVALID_CODE' }
    }

    // Remove every TOTP factor of this person (admin endpoint, project key).
    const admin = await gotrueRequest(`/admin/users/${encodeURIComponent(ctx.userId)}`, {
      method: 'GET',
    })
    if (admin.status >= 400) throw new DatabaseError('Failed to read the account factors')
    for (const factor of totpFactors(admin.body)) {
      const removed = await gotrueRequest(
        `/admin/users/${encodeURIComponent(ctx.userId)}/factors/${encodeURIComponent(factor.id)}`,
        { method: 'DELETE' },
      )
      if (removed.status >= 400) throw new DatabaseError('Failed to remove the lost authenticator')
    }

    const { error: updateError } = await supabase
      .from('workspace_2fa_enrollments')
      .update({
        recovery_code_hashes: [],
        is_enabled: false,
        failed_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('workspace_id', ctx.workspaceId)
    if (updateError)
      throw new DatabaseError('Failed to close the recovered enrollment', updateError)
    return { ok: true }
  }
}

export const workspace2faService = new Workspace2faService()
