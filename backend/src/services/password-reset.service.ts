// ============================================
// backend/src/services/password-reset.service.ts — Optimized v2.2
// FIXED: Added cache, Promise.all, parallel queries
// ============================================

import { createHash, randomBytes } from 'crypto'
import { supabase } from "../db"
import { emailService, type Language } from './email.service'
import { AuditService } from './audit.service'
import { memoryCache } from '../utils/pagination'

const TOKEN_EXPIRY_MS = 60 * 60 * 1000 // 1 hour
const auditService = new AuditService()

// ─── Cache Keys ──────────────────────────────────────────────
const getUserLanguageCacheKey = (userId: string) => `user:lang:${userId}`

// ─── Detect user language with cache ──────────────────────────
async function getUserLanguage(userId: string): Promise<Language> {
  const cacheKey = getUserLanguageCacheKey(userId)
  
  // ✅ کش کردن زبان کاربر
  const cached = await memoryCache.get(cacheKey)
  if (cached) return cached as Language

  try {
    const { data: user } = await supabase
      .from('users')
      .select('preferred_language')
      .eq('id', userId)
      .single()
    
    const lang = user?.preferred_language || 'fa-IR'
    const result = ['fa-IR', 'fa-AF', 'en'].includes(lang) ? lang as Language : 'fa-IR'
    
    // ✅ ذخیره در کش به مدت ۱ ساعت
    await memoryCache.set(cacheKey, result, 3600)
    return result
  } catch {
    return 'fa-IR'
  }
}

export const passwordResetService = {
  async requestReset(email: string, ip: string, userAgent: string, lang: Language = 'fa-IR') {
    const genericMessage = 'If an account exists with this email, a reset link has been sent.'

    try {
      // ۱. پیدا کردن کاربر (با email)
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, preferred_language')
        .eq('email', email.toLowerCase().trim())
        .single()

      if (userError || !user) {
        // برای امنیت، همیشه پیام یکسان برگردانید
        return { success: true, message: genericMessage }
      }

      // ۲. تولید توکن
      const token = randomBytes(32).toString('hex')
      const tokenHash = createHash('sha256').update(token).digest('hex')

      // ✅ دو کوئری موازی: گرفتن workspace_id و ذخیره توکن
      const [memberResult, insertResult] = await Promise.all([
        supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .limit(1)
          .single(),
        supabase
          .from('password_reset_tokens')
          .insert({
            user_id: user.id,
            workspace_id: '00000000-0000-0000-0000-000000000000',
            token_hash: tokenHash,
            expires_at: new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString(),
            requested_ip: ip,
            requested_user_agent: userAgent,
          })
      ])

      // گرفتن workspace_id از memberResult
      const workspaceId = memberResult.data?.workspace_id || '00000000-0000-0000-0000-000000000000'

      if (insertResult.error) {
        console.error('Error saving reset token:', insertResult.error)
        return { success: false, message: 'Failed to process request' }
      }

      // ۳. ارسال ایمیل با زبان کاربر
      const resetLink = `${process.env.FRONTEND_URL || 'https://hisabche.com'}/reset-password?token=${token}`
      
      // ✅ اگر زبان از کاربر نیامده، از تنظیمات کاربر بگیر
      let userLang = lang
      if (!userLang || userLang === 'fa-IR') {
        userLang = await getUserLanguage(user.id)
      }
      
      // ✅ ارسال ایمیل بدون await (non-blocking)
      emailService.sendResetPassword(email, resetLink, userLang).catch(err =>
        console.error('Failed to send reset email:', err)
      )

      // ۴. Audit log (بدون await)
      auditService.log({
        userId: user.id,
        action: 'update',
        entityType: 'user',
        entityId: user.id,
        ipAddress: ip,
        userAgent,
      }).catch(() => {})

      return { success: true, message: genericMessage }

    } catch (err) {
      console.error('Password reset request error:', err)
      return { success: false, message: 'Failed to process request' }
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
        return { success: false, message: 'Invalid or expired token' }
      }

      const resetToken = tokens[0]!
      
      // ۲. بررسی انقضا
      if (new Date(resetToken.expires_at) < new Date()) {
        return { success: false, message: 'Token has expired' }
      }

      // ۳. تغییر رمز از طریق Supabase Admin API
      const supabaseUrl = process.env.SUPABASE_URL!
      const serviceKey = process.env.SUPABASE_SERVICE_KEY!

      const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${resetToken.user_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'apikey': serviceKey,
        },
        body: JSON.stringify({
          password: newPassword,
          email_confirm: true,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Supabase admin API error:', errorData)
        return { success: false, message: 'Failed to reset password' }
      }

      // ✅ دو کوئری موازی: علامت‌گذاری توکن و باطل کردن سایر توکن‌ها
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
          .is('revoked_at', null)
      ])

      if (updateResult.error) {
        console.error('Failed to mark token as used:', updateResult.error)
      }
      if (revokeResult.error) {
        console.error('Failed to revoke other tokens:', revokeResult.error)
      }

      // ۶. Audit log (بدون await)
      auditService.log({
        userId: resetToken.user_id,
        action: 'update',
        entityType: 'user',
        entityId: resetToken.user_id,
        ipAddress: ip,
        userAgent: 'password-reset',
      }).catch(() => {})

      // ✅ Invalidate user cache
      await memoryCache.invalidate(getUserLanguageCacheKey(resetToken.user_id))

      return { success: true, message: 'Password reset successful' }

    } catch (err) {
      console.error('Password reset error:', err)
      return { success: false, message: 'Failed to reset password' }
    }
  },

  // ─── Cleanup expired tokens ──────────────────────────────────
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

  // ─── Get token status ────────────────────────────────────────
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

  // ─── Invalidate user language cache ──────────────────────────
  async invalidateUserLanguageCache(userId: string): Promise<void> {
    await memoryCache.invalidate(getUserLanguageCacheKey(userId))
  }
}