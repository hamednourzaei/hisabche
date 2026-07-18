// ============================================
// backend/src/services/password-reset.service.ts — Optimized v2.1 (i18n)
// ============================================

import { createHash, randomBytes } from 'crypto'
import { supabase } from "../db"
import { emailService, type Language } from './email.service'
import { AuditService } from './audit.service'

const TOKEN_EXPIRY_MS = 60 * 60 * 1000 // 1 hour
const auditService = new AuditService()

// ─── Detect user language ──────────────────────────────────────
async function getUserLanguage(userId: string): Promise<Language> {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('preferred_language')
      .eq('id', userId)
      .single()
    
    const lang = user?.preferred_language || 'fa-IR'
    return ['fa-IR', 'fa-AF', 'en'].includes(lang) ? lang as Language : 'fa-IR'
  } catch {
    return 'fa-IR'
  }
}

export const passwordResetService = {
  async requestReset(email: string, ip: string, userAgent: string, lang: Language = 'fa-IR') {
    const genericMessage = 'If an account exists with this email, a reset link has been sent.'

    try {
      // ۱. پیدا کردن کاربر
      const { data: userData, error: userError } = await supabase.auth.admin.listUsers()
      if (userError) return { success: true, message: genericMessage }

      const user = userData?.users?.find(u => u.email === email.toLowerCase().trim())
      if (!user) return { success: true, message: genericMessage }

      // ۲. تولید توکن
      const token = randomBytes(32).toString('hex')
      const tokenHash = createHash('sha256').update(token).digest('hex')

      // ۳. دریافت workspace_id
      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      const workspaceId = member?.workspace_id || '00000000-0000-0000-0000-000000000000'

      // ۴. ذخیره توکن
      const { error: insertError } = await supabase
        .from('password_reset_tokens')
        .insert({
          user_id: user.id,
          workspace_id: workspaceId,
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString(),
          requested_ip: ip,
          requested_user_agent: userAgent,
        })

      if (insertError) {
        console.error('Error saving reset token:', insertError)
        return { success: false, message: 'Failed to process request' }
      }

      // ۵. ارسال ایمیل با زبان کاربر
      const resetLink = `${process.env.FRONTEND_URL || 'https://hisabche.com'}/reset-password?token=${token}`
      
      // ✅ اگر زبان از کاربر نیامده، از تنظیمات کاربر بگیر
      let userLang = lang
      if (!userLang || userLang === 'fa-IR') {
        userLang = await getUserLanguage(user.id)
      }
      
      await emailService.sendResetPassword(email, resetLink, userLang)

      // ۶. Audit log
      try {
        await auditService.log({
          userId: user.id,
          action: 'update',
          entityType: 'user',
          entityId: user.id,
          ipAddress: ip,
          userAgent,
        })
      } catch {}

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

      // ۴. علامت‌گذاری توکن به‌عنوان استفاده‌شده
      await supabase
        .from('password_reset_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', resetToken.id)

      // ۵. باطل کردن سایر توکن‌های این کاربر
      await supabase
        .from('password_reset_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('user_id', resetToken.user_id)
        .neq('id', resetToken.id)
        .is('revoked_at', null)

      // ۶. Audit log
      try {
        await auditService.log({
          userId: resetToken.user_id,
          action: 'update',
          entityType: 'user',
          entityId: resetToken.user_id,
          ipAddress: ip,
          userAgent: 'password-reset',
        })
      } catch {}

      return { success: true, message: 'Password reset successful' }

    } catch (err) {
      console.error('Password reset error:', err)
      return { success: false, message: 'Failed to reset password' }
    }
  },
}