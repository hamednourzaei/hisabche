// backend/src/services/password-reset.service.ts — Optimized v2.0
import { createHash, randomBytes } from 'crypto';
import { supabase } from "../db";
import { emailService } from './email.service';
import { AuditService } from './audit.service';

const TOKEN_EXPIRY_MS = 60 * 60 * 1000;
const auditService = new AuditService();

export const passwordResetService = {
  async requestReset(email: string, ip: string, userAgent: string, lang: string = 'fa-IR') {
    const genericMessage = 'If an account exists with this email, a reset link has been sent.';

    try {
      const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
      if (userError) return { success: true, message: genericMessage };

      const user = userData?.users?.find(u => u.email === email.toLowerCase().trim());
      if (!user) return { success: true, message: genericMessage };

      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');

      // ✅ فقط workspace_id
      const { data: member } = await supabase
        .from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();

      const workspaceId = member?.workspace_id || '00000000-0000-0000-0000-000000000000';

      const { error: insertError } = await supabase
        .from('password_reset_tokens')
        .insert({
          user_id: user.id, workspace_id: workspaceId, token_hash: tokenHash,
          expires_at: new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString(),
          requested_ip: ip, requested_user_agent: userAgent,
        });

      if (insertError) return { success: false, message: 'Failed to process request' };

      const resetLink = `${process.env.FRONTEND_URL || 'https://hisabche.com'}/reset-password?token=${token}`;
      await emailService.sendResetPassword(email, resetLink, lang);

      try { await auditService.log({ userId: user.id, action: 'update', entityType: 'user', entityId: user.id, ipAddress: ip, userAgent }) } catch {}

      return { success: true, message: genericMessage };
    } catch {
      return { success: false, message: 'Failed to process request' };
    }
  },

  async resetPassword(token: string, newPassword: string, ip: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // ✅ فقط ستون‌های ضروری
    const { data: tokens, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, workspace_id, expires_at')
      .eq('token_hash', tokenHash).is('used_at', null).is('revoked_at', null).is('deleted_at', null).limit(1);

    if (tokenError || !tokens?.length) return { success: false, message: 'Invalid or expired token' };

    const resetToken = tokens[0]!;
    if (new Date(resetToken.expires_at) < new Date()) return { success: false, message: 'Token has expired' };

    try {
      const supabaseUrl = process.env.SUPABASE_URL!;
      const serviceKey = process.env.SUPABASE_SERVICE_KEY!;

      const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${resetToken.user_id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'apikey': serviceKey },
        body: JSON.stringify({ password: newPassword, email_confirm: true }),
      });

      if (!response.ok) return { success: false, message: 'Failed to reset password' };

      await supabase.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('id', resetToken.id);
      await supabase.from('password_reset_tokens').update({ revoked_at: new Date().toISOString() }).eq('user_id', resetToken.user_id).neq('id', resetToken.id).is('revoked_at', null);

      return { success: true, message: 'Password reset successful' };
    } catch {
      return { success: false, message: 'Failed to reset password' };
    }
  },
};