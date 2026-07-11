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
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, workspace_id, email')
        .eq('email', email.toLowerCase().trim())
        .is('deleted_at', null)
        .limit(1);

      if (userError || !users?.length) {
        return { success: true, message: genericMessage };
      }

      const user = users[0]!;
      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');

      const { error: insertError } = await supabase
        .from('password_reset_tokens')
        .insert({
          user_id: user.id,
          workspace_id: user.workspace_id,
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString(),
          requested_ip: ip,
          requested_user_agent: userAgent,
        });

      if (insertError) {
        console.error('[PasswordReset] Insert error:', insertError);
        return { success: false, message: 'Failed to process request' };
      }

      const resetLink = `${process.env.FRONTEND_URL || 'https://hisabche.com'}/reset-password?token=${token}`;
      await emailService.sendResetPassword(email, resetLink, lang);

      await auditService.log({
        userId: user.id,
        action: 'update', // ✅ allowed value
        entityType: 'user',
        entityId: user.id,
        ipAddress: ip,
        userAgent: userAgent,
      });

      return { success: true, message: genericMessage };
    } catch (err) {
      console.error('[PasswordReset] Exception:', err);
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
      const { error: updateError } = await supabase.rpc('reset_user_password', {
        p_user_id: resetToken.user_id,
        p_password_hash: createHash('sha256').update(newPassword).digest('hex'),
        p_token_id: resetToken.id,
        p_ip: ip,
      });

      if (updateError) {
        console.error('[PasswordReset] Update error:', updateError);
        return { success: false, message: 'Failed to reset password' };
      }

      return { success: true, message: 'Password reset successful' };
    } catch (err) {
      console.error('[PasswordReset] Exception:', err);
      return { success: false, message: 'Failed to reset password' };
    }
  },
};