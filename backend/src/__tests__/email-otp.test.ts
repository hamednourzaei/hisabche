// V54 5.1 (8 Nov 2026) — email one-time codes: infrastructure, off by default.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => ({ supabase: {} }))
vi.mock('../services/email.service', () => ({ emailService: { _send: vi.fn() } }))

const otp = await import('../services/auth/email-otp.service')

describe('email OTP — pure parts', () => {
  it('codes are six digits, leading zeros kept', () => {
    for (let i = 0; i < 200; i++) expect(otp.newEmailOtpCode()).toMatch(/^[0-9]{6}$/)
  })

  it('the stored hash is bound to the person, and is not the code', () => {
    const a = otp.hashEmailOtp('user-a', '123456')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).not.toContain('123456')
    expect(otp.hashEmailOtp('user-b', '123456')).not.toBe(a)
  })

  it('accepts Persian and Arabic digits and spaces; refuses anything else', () => {
    expect(otp.normalizeEmailOtp('۱۲۳ ۴۵۶')).toBe('123456')
    expect(otp.normalizeEmailOtp('١٢٣٤٥٦')).toBe('123456')
    expect(otp.normalizeEmailOtp('12345')).toBeNull()
    expect(otp.normalizeEmailOtp('12a456')).toBeNull()
  })

  it('is OFF unless the owner turns it on', () => {
    expect(otp.emailOtpEnabled({})).toBe(false)
    expect(otp.emailOtpEnabled({ EMAIL_OTP_ENABLED: '1' })).toBe(false)
    expect(otp.emailOtpEnabled({ EMAIL_OTP_ENABLED: 'true' })).toBe(true)
  })

  it('requesting while off is refused before anything is written or sent', async () => {
    delete process.env.EMAIL_OTP_ENABLED
    await expect(otp.requestEmailOtp('u', 'a@b.c', 'fa')).rejects.toThrow('EMAIL_OTP_DISABLED')
  })
})

describe('routes — own address only, rate limited, never log the code', () => {
  const routes = readFileSync(join(__dirname, '..', 'routes', 'email-otp.routes.ts'), 'utf8')
  const service = readFileSync(
    join(__dirname, '..', 'services', 'auth', 'email-otp.service.ts'),
    'utf8',
  )
  it('the address is the account email, never the body', () => {
    expect(routes).toContain('request.user.email')
    expect(routes).not.toMatch(/body\.email/)
  })
  it('both writes are rate limited per person', () => {
    expect(routes.match(/rateLimit:/g)?.length).toBe(2)
  })
  it('the service never logs', () => {
    expect(service).not.toMatch(/console\.(log|info|warn|error)/)
  })
})
