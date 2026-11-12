import { createHash } from 'node:crypto'
import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import type { TenancyContext } from '../tenancy.service'

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex')
}

export class Workspace2faService {
  async enroll(
    tenancy: TenancyContext,
    totpSecretRef: string,
    plainRecoveryCodes: readonly string[],
  ) {
    const hashes = plainRecoveryCodes.map(hashRecoveryCode)
    const { data, error } = await supabase
      .from('workspace_2fa_enrollments')
      .upsert(
        {
          workspace_id: tenancy.workspaceId,
          user_id: tenancy.userId,
          totp_secret_ref: totpSecretRef,
          recovery_code_hashes: hashes,
          is_enabled: true,
          failed_attempts: 0,
          locked_until: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,user_id' },
      )
      .select('id, workspace_id, user_id, is_enabled')
      .single()

    if (error || !data) throw new DatabaseError('Failed to enroll workspace 2FA', error)
    return data
  }

  async verifyRecoveryCode(
    tenancy: TenancyContext,
    code: string,
    maxFailedAttempts = 5,
    lockoutMinutes = 15,
  ): Promise<
    { ok: true } | { ok: false; code: 'MFA_LOCKED' | 'MFA_INVALID_CODE'; status: 429 | 403 }
  > {
    const { data: row, error } = await supabase
      .from('workspace_2fa_enrollments')
      .select('*')
      .eq('workspace_id', tenancy.workspaceId)
      .eq('user_id', tenancy.userId)
      .single()

    if (error) throw new DatabaseError('Failed to load 2FA enrollment', error)
    if (!row) throw new NotFoundError('2FA enrollment')

    if (row.locked_until && Date.parse(row.locked_until) > Date.now()) {
      return { ok: false, code: 'MFA_LOCKED', status: 429 }
    }

    const hash = hashRecoveryCode(code)
    const hashes = (row.recovery_code_hashes ?? []) as string[]
    const idx = hashes.indexOf(hash)
    if (idx === -1) {
      const nextFails = Number(row.failed_attempts ?? 0) + 1
      const lockedUntil =
        nextFails >= maxFailedAttempts
          ? new Date(Date.now() + lockoutMinutes * 60_000).toISOString()
          : null
      await supabase
        .from('workspace_2fa_enrollments')
        .update({
          failed_attempts: nextFails,
          locked_until: lockedUntil,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .eq('workspace_id', tenancy.workspaceId)

      return lockedUntil
        ? { ok: false, code: 'MFA_LOCKED', status: 429 }
        : { ok: false, code: 'MFA_INVALID_CODE', status: 403 }
    }

    // Consume single-use recovery code
    const remaining = hashes.filter((_, i) => i !== idx)
    await supabase
      .from('workspace_2fa_enrollments')
      .update({
        recovery_code_hashes: remaining,
        failed_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('workspace_id', tenancy.workspaceId)

    return { ok: true }
  }
}

export const workspace2faService = new Workspace2faService()
