// ============================================
// backend/src/services/password-reset.service.ts — v3.0
// ✅ Admin SDK (بدون fetch دستی)
// ✅ email_confirm حذف شد (Password Reset ≠ Email Verify)
// ✅ getUserById قبل از update
// ============================================

import { createHash, randomBytes } from 'crypto'
import { supabase } from '../db'
import { emailService, type Language } from './email.service'
import { AuditService } from './audit.service'
import { memoryCache } from '../utils/pagination'
import { invalidateSessionEpoch } from '../middleware/auth.middleware'

const TOKEN_EXPIRY_MS = 60 * 60 * 1000 // 1 hour
const auditService = new AuditService()

// ─── Cache Keys ──────────────────────────────────────────────
const getUserLanguageCacheKey = (userId: string) => `user:lang:${userId}`

// ─── Detect user language with cache ──────────────────────────
async function getUserLanguage(userId: string): Promise<Language> {
  const cacheKey = getUserLanguageCacheKey(userId)

  const cached = await memoryCache.get(cacheKey)
  if (cached) return cached as Language

  try {
    const { data } = await supabase.auth.admin.getUserById(userId)

    const lang = data?.user?.user_metadata?.preferred_language
    const result: Language =
      lang && ['fa-IR', 'fa-AF', 'en'].includes(String(lang)) ? (String(lang) as Language) : 'fa-IR'

    await memoryCache.set(cacheKey, result, 3600)
    return result
  } catch {
    return 'fa-IR'
  }
}

// ─── Get user by email (برای requestReset) ──────────────────
async function getUserByEmail(email: string): Promise<{
  id: string
  email: string
  preferred_language?: string
} | null> {
  try {
    const { data } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 100,
    })

    if (!data?.users?.length) return null

    const normalizedEmail = email.toLowerCase().trim()
    const user = data.users.find((u) => u.email?.toLowerCase() === normalizedEmail)

    if (!user) return null

    return {
      id: user.id,
      email: user.email || email,
      preferred_language: user.user_metadata?.preferred_language || 'fa-IR',
    }
  } catch (err) {
    console.error('getUserByEmail error:', err)
    return null
  }
}

export const passwordResetService = {
  async requestReset(email: string, ip: string, userAgent: string, lang: Language = 'fa-IR') {
    const genericMessage = 'If an account exists with this email, a reset link has been sent.'

    try {
      const user = await getUserByEmail(email)

      if (!user) {
        return { success: true, message: genericMessage }
      }

      const token = randomBytes(32).toString('hex')
      const tokenHash = createHash('sha256').update(token).digest('hex')

      const [memberResult, insertResult] = await Promise.all([
        supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .limit(1)
          .single(),
        supabase.from('password_reset_tokens').insert({
          user_id: user.id,
          workspace_id: '00000000-0000-0000-0000-000000000000',
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString(),
          requested_ip: ip,
          requested_user_agent: userAgent,
        }),
      ])

      if (insertResult.error) {
        console.error('Error saving reset token:', insertResult.error)
        return {
          success: false,
          message: 'Failed to process request',
        }
      }

      const resetLink = `${
        process.env.FRONTEND_URL || 'https://hisabche.com'
      }/reset-password?token=${token}`

      let userLang = lang
      if (!userLang || userLang === 'fa-IR') {
        userLang = await getUserLanguage(user.id)
      }

      emailService
        .sendResetPassword(email, resetLink, userLang)
        .catch((err) => console.error('Failed to send reset email:', err))

      auditService
        .log({
          userId: user.id,
          action: 'update',
          entityType: 'user',
          entityId: user.id,
          ipAddress: ip,
          userAgent,
        })
        .catch(() => {})

      return { success: true, message: genericMessage }
    } catch (err) {
      console.error('Password reset request error:', err)
      return {
        success: false,
        message: 'Failed to process request',
      }
    }
  },

  async resetPassword(token: string, newPassword: string, ip: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex')

    try {
      // ۱. پیدا کردن توکن معتبر
      const { data: tokens, error: tokenError } = await supabase
        .from('password_reset_tokens')
        .select('id, user_id, workspace_id, expires_at')
        .eq('token_hash', tokenHash)
        .is('used_at', null)
        .is('revoked_at', null)
        .is('deleted_at', null)
        .limit(1)

      if (tokenError || !tokens?.length) {
        return {
          success: false,
          message: 'Invalid or expired token',
        }
      }

      const resetToken = tokens[0]!

      // ۲. بررسی انقضا
      if (new Date(resetToken.expires_at) < new Date()) {
        return { success: false, message: 'Token has expired' }
      }

      // ۳. ✅ دریافت اطلاعات کاربر (قبل از update)
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
        resetToken.user_id,
      )

      if (userError || !userData?.user) {
        console.error('User not found:', userError)
        return {
          success: false,
          message: 'User not found',
        }
      }

      // ۴. ✅ تغییر رمز از طریق Admin SDK (نه fetch دستی)
      //    بدون email_confirm — Password Reset ≠ Email Verify
      const { error: updateError } = await supabase.auth.admin.updateUserById(resetToken.user_id, {
        password: newPassword,
      })

      if (updateError) {
        console.error('Supabase admin update error:', updateError)
        return {
          success: false,
          message: 'Failed to reset password',
        }
      }

      // ۵. ✅ علامت‌گذاری توکن و باطل کردن سایر توکن‌ها
      // ===============================================================
      // INVALIDATE ACTIVE SESSIONS -- not only the reset tokens.
      //
      // Until now only the password-RESET tokens were revoked here; active
      // sign-in sessions were left untouched. So someone who changes their
      // password BECAUSE they believe another person is in their account did
      // not put that person out -- they stayed in until their token expired
      // on its own, which is the whole thing a reset is meant to stop.
      //
      // This timestamp is the line: `auth.middleware` rejects any token whose
      // `iat` is earlier than it. Supabase exposes no "revoke every session
      // for this user id" call, so a line in time does the same job.
      //
      // If the migration has not run the column does not exist. The error is
      // logged and the reset still succeeds -- the password HAS changed, and
      // telling the person it failed would be worse than the missing lock.
      // ===============================================================
      const { error: epochError } = await supabase
        .from('profiles')
        .update({ sessions_valid_from: new Date().toISOString() })
        .eq('id', resetToken.user_id)

      if (epochError) {
        console.error('Failed to invalidate active sessions:', epochError)
      } else {
        // Drops the cached epoch so the lock applies now, not a minute from now.
        await invalidateSessionEpoch(resetToken.user_id)
      }

      const [updateResult, revokeResult] = await Promise.all([
        supabase
          .from('password_reset_tokens')
          .update({ used_at: new Date().toISOString() })
          .eq('id', resetToken.id),
        supabase
          .from('password_reset_tokens')
          .update({ revoked_at: new Date().toISOString() })
          .eq('user_id', resetToken.user_id)
          .neq('id', resetToken.id)
          .is('revoked_at', null),
      ])

      if (updateResult.error) {
        console.error('Failed to mark token as used:', updateResult.error)
      }
      if (revokeResult.error) {
        console.error('Failed to revoke other tokens:', revokeResult.error)
      }

      // ۶. Audit log
      auditService
        .log({
          userId: resetToken.user_id,
          action: 'update',
          entityType: 'user',
          entityId: resetToken.user_id,
          ipAddress: ip,
          userAgent: 'password-reset',
        })
        .catch(() => {})

      // ۷. Invalidate cache
      await memoryCache.invalidate(getUserLanguageCacheKey(resetToken.user_id))

      return {
        success: true,
        message: 'Password reset successful',
      }
    } catch (err) {
      console.error('Password reset error:', err)
      return {
        success: false,
        message: 'Failed to reset password',
      }
    }
  },

  async cleanupExpiredTokens(): Promise<{ deleted: number }> {
    const { data, error } = await supabase
      .from('password_reset_tokens')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id')

    if (error) {
      console.error('Failed to cleanup expired tokens:', error)
      return { deleted: 0 }
    }

    return { deleted: data?.length || 0 }
  },

  async getTokenStatus(token: string): Promise<{
    valid: boolean
    expired?: boolean
    used?: boolean
    revoked?: boolean
  }> {
    const tokenHash = createHash('sha256').update(token).digest('hex')

    const { data, error } = await supabase
      .from('password_reset_tokens')
      .select('expires_at, used_at, revoked_at')
      .eq('token_hash', tokenHash)
      .single()

    if (error || !data) {
      return { valid: false }
    }

    if (data.used_at) return { valid: false, used: true }
    if (data.revoked_at) return { valid: false, revoked: true }
    if (new Date(data.expires_at) < new Date()) return { valid: false, expired: true }

    return { valid: true }
  },

  async invalidateUserLanguageCache(userId: string): Promise<void> {
    await memoryCache.invalidate(getUserLanguageCacheKey(userId))
  },
}
