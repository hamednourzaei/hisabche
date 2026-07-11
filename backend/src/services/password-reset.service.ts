// backend/src/services/password-reset.service.ts
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
      console.log('[PWD-RESET] Looking up user:', email);

      // ✅ Use auth.users (Supabase built-in)
      const { data: userData, error: userError } = await supabase.auth.admin.listUsers();

      if (userError) {
        console.log('[PWD-RESET] Auth error:', userError);
        return { success: true, message: genericMessage };
      }

      const user = userData?.users?.find(u => u.email === email.toLowerCase().trim());

      if (!user) {
        console.log('[PWD-RESET] User not found:', email);
        return { success: true, message: genericMessage };
      }

      console.log('[PWD-RESET] User found:', user.id);

      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');

      // Get workspace_id from workspace_members
      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      const workspaceId = member?.workspace_id || '00000000-0000-0000-0000-000000000000';

      console.log('[PWD-RESET] Storing token...');
      const { error: insertError } = await supabase
        .from('password_reset_tokens')
        .insert({
          user_id: user.id,
          workspace_id: workspaceId,
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString(),
          requested_ip: ip,
          requested_user_agent: userAgent,
        });

      if (insertError) {
        console.error('[PWD-RESET] Insert error:', insertError);
        return { success: false, message: 'Failed to process request' };
      }

      console.log('[PWD-RESET] Sending email...');
      console.log('[PWD-RESET] API_KEY exists:', !!process.env.RESEND_API_KEY);

      const resetLink = `${process.env.FRONTEND_URL || 'https://hisabche.com'}/reset-password?token=${token}`;
      const emailResult = await emailService.sendResetPassword(email, resetLink, lang);
      console.log('[PWD-RESET] Email result:', JSON.stringify(emailResult));

      console.log('[PWD-RESET] Logging audit...');
      await auditService.log({
    userId: user.id,
    action: 'update',
    entityType: 'user',
    entityId: user.id,
    ipAddress: ip,
    userAgent: userAgent,
  });

      console.log('[PWD-RESET] Done!');
      return { success: true, message: genericMessage };
    } catch (err) {
      console.error('[PWD-RESET] Exception:', err);
      return { success: false, message: 'Failed to process request' };
    }
  },

  async resetPassword(token: string, newPassword: string, ip: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const { data: tokens, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, workspace_id, expires_at, used_at, revoked_at')
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .is('revoked_at', null)
      .is('deleted_at', null)
      .limit(1);

    if (tokenError || !tokens?.length) {
      return { success: false, message: 'Invalid or expired token' };
    }

    const resetToken = tokens[0]!;

    if (new Date(resetToken.expires_at) < new Date()) {
      return { success: false, message: 'Token has expired' };
    }

    try {
      // Update password via Supabase Auth Admin
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        resetToken.user_id,
        { password: newPassword }
      );

      if (updateError) {
        console.error('[PWD-RESET] Update error:', updateError);
        return { success: false, message: 'Failed to reset password' };
      }

      // Mark token as used
      await supabase
        .from('password_reset_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', resetToken.id);

      // Revoke other tokens
      await supabase
        .from('password_reset_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('user_id', resetToken.user_id)
        .neq('id', resetToken.id)
        .is('revoked_at', null);

      return { success: true, message: 'Password reset successful' };
    } catch (err) {
      console.error('[PWD-RESET] Exception:', err);
      return { success: false, message: 'Failed to reset password' };
    }
  },
};