// ============================================
// backend/src/services/auth/email-otp.service.ts
//
// V54 5.1 — email one-time codes. INFRASTRUCTURE ONLY (8 Nov 2026): the owner
// has not bought the email subscription yet, so sending is OFF unless
// EMAIL_OTP_ENABLED === 'true'. Nothing in signup or billing requires a
// verified address yet; when it does, it reads `emailOtpStatus`.
//
//   request   a 6-digit code from crypto.randomInt, stored as SHA-256 only,
//             10 minutes, one per minute per person; the email is sent with the
//             row id as the provider's idempotency key. The CODE IS NEVER LOGGED.
//   verify    one Postgres function (`email_otp_verify`, email-otp-01): locks the
//             newest open code, 5 wrong tries lock it, a right one works once.
//   status    verified = a used code exists for (person, current address).
//
// ⚠️ Imports no other service except the email sender it exists for.
// ============================================

import { createHash, randomInt } from 'node:crypto'
import { supabase } from '../../db'
import { ConflictError, DatabaseError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { emailService } from '../email.service'

export const EMAIL_OTP_TTL_MINUTES = 10
export const EMAIL_OTP_COOLDOWN_SECONDS = 60
export const EMAIL_OTP_MAX_ATTEMPTS = 5

export type EmailOtpVerdict = 'VERIFIED' | 'WRONG' | 'EXPIRED' | 'LOCKED'

/** Off until the owner turns it on; the default is explicit, never implied. */
export function emailOtpEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.EMAIL_OTP_ENABLED === 'true'
}

/** Six digits, uniformly drawn; leading zeros kept. */
export function newEmailOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

/** What is stored: the code bound to its owner, hashed. */
export function hashEmailOtp(userId: string, code: string): string {
  return createHash('sha256').update(`${userId}:${code}`).digest('hex')
}

/** A code as a person types it: Persian/Arabic digits and spaces accepted. */
export function normalizeEmailOtp(raw: string): string | null {
  const latin = raw
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/\s+/g, '')
  return /^[0-9]{6}$/.test(latin) ? latin : null
}

const isMissing = (code: string | undefined) =>
  code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || code === '42883'

function codeEmail(code: string, lang: 'fa' | 'af' | 'en'): { subject: string; html: string } {
  if (lang === 'en') {
    return {
      subject: `Your Hisabche code: ${code}`,
      html: `<p>Your verification code is <strong style="font-size:20px;letter-spacing:4px">${code}</strong>.</p><p>It expires in ${EMAIL_OTP_TTL_MINUTES} minutes. If you did not ask for it, ignore this email.</p>`,
    }
  }
  return {
    subject: `کد تأیید حسابچه: ${code}`,
    html: `<div dir="rtl"><p>کد تأیید شما <strong style="font-size:20px;letter-spacing:4px">${code}</strong> است.</p><p>این کد ${EMAIL_OTP_TTL_MINUTES} دقیقه اعتبار دارد. اگر شما درخواست نکرده‌اید، این ایمیل را نادیده بگیرید.</p></div>`,
  }
}

export async function requestEmailOtp(
  userId: string,
  email: string,
  lang: 'fa' | 'af' | 'en',
): Promise<{ sent: true; expiresInMinutes: number }> {
  if (!emailOtpEnabled()) throw new ConflictError('EMAIL_OTP_DISABLED')
  if (!email) throw new ValidationError('EMAIL_REQUIRED')

  const since = new Date(Date.now() - EMAIL_OTP_COOLDOWN_SECONDS * 1000).toISOString()
  const recent = await supabase
    .from('email_otp_codes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gt('created_at', since)
  if (recent.error) {
    if (isMissing(recent.error.code)) throw new ConflictError('EMAIL_OTP_NOT_CONFIGURED')
    throw new DatabaseError('Failed to read recent codes', recent.error)
  }
  if ((recent.count ?? 0) > 0) throw new ConflictError('EMAIL_OTP_TOO_SOON')

  const code = newEmailOtpCode()
  const { data, error } = await supabase
    .from('email_otp_codes')
    .insert({
      user_id: userId,
      email,
      code_hash: hashEmailOtp(userId, code),
      expires_at: new Date(Date.now() + EMAIL_OTP_TTL_MINUTES * 60_000).toISOString(),
    })
    .select('id')
    .single()
  if (error || !data) throw new DatabaseError('Failed to store the code', error)

  const message = codeEmail(code, lang)
  const sent = await emailService._send(email, message.subject, message.html, `otp-${data.id}`)
  if (!sent.success) throw new ConflictError('EMAIL_NOT_SENT')
  return { sent: true, expiresInMinutes: EMAIL_OTP_TTL_MINUTES }
}

export async function verifyEmailOtp(
  userId: string,
  email: string,
  rawCode: string,
): Promise<EmailOtpVerdict> {
  const code = normalizeEmailOtp(rawCode)
  if (!code) throw new ValidationError('EMAIL_OTP_FORMAT')
  const { data, error } = await supabase.rpc('email_otp_verify', {
    p_user_id: userId,
    p_email: email,
    p_code_hash: hashEmailOtp(userId, code),
  })
  if (error) {
    if (isMissing(error.code)) throw new ConflictError('EMAIL_OTP_NOT_CONFIGURED')
    throw new DatabaseError('Failed to verify the code', error)
  }
  const verdict = String(data)
  if (
    verdict === 'VERIFIED' ||
    verdict === 'WRONG' ||
    verdict === 'EXPIRED' ||
    verdict === 'LOCKED'
  ) {
    return verdict
  }
  throw new DatabaseError(`Unexpected verifier answer: ${verdict}`)
}

export async function emailOtpStatus(
  userId: string,
  email: string,
): Promise<{ enabled: boolean; configured: boolean; verified: boolean }> {
  const enabled = emailOtpEnabled()
  const { count, error } = await supabase
    .from('email_otp_codes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .ilike('email', email)
    .not('consumed_at', 'is', null)
  if (error) {
    if (isMissing(error.code)) return { enabled, configured: false, verified: false }
    throw new DatabaseError('Failed to read the verification status', error)
  }
  return { enabled, configured: true, verified: (count ?? 0) > 0 }
}
