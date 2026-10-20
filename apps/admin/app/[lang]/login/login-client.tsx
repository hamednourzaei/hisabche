'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui'
import { createAdminSupabaseClient } from '@/lib/supabase-client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

/**
 * Admin sign-in is two steps: password, then a TOTP code (Supabase MFA).
 *
 * `proxy.ts` refuses every admin page below AAL2, so an admin who had only
 * typed a password used to be bounced back here with nothing to type a code
 * into — the panel had no way to enrol or verify a factor at all.
 *
 *   password  → signInWithPassword
 *   enroll    → first time: QR code + secret, the code from the app enrols it
 *   challenge → afterwards: the code from the app
 */
type Step =
  | { kind: 'password' }
  | { kind: 'enroll'; factorId: string; qrCode: string; secret: string }
  | { kind: 'challenge'; factorId: string }

export function LoginClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useTranslations()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<Step>({ kind: 'password' })

  // proxy.ts redirects here with `?error=admin_required` when the credentials
  // were valid but the account is not in ADMIN_ALLOWED_EMAILS, and with
  // `?error=mfa_required` when the session has not passed a TOTP check.
  const reason = searchParams.get('error')

  const goToDashboard = () => {
    const localePrefix = pathname.split('/').filter(Boolean)[0] || 'fa'
    router.replace(`/${localePrefix}/dashboard`)
  }

  /** After the password: verified already → in; a TOTP factor → challenge; none → enrol. */
  const continueToSecondFactor = async () => {
    const supabase = createAdminSupabaseClient()
    const { data: assurance, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aalError) throw aalError
    if (assurance?.currentLevel === 'aal2') {
      goToDashboard()
      return
    }

    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
    if (listError) throw listError
    const verified = factors?.totp?.[0]
    if (verified) {
      setStep({ kind: 'challenge', factorId: verified.id })
      return
    }

    // A half-finished enrolment blocks a new one; remove it before starting again.
    for (const factor of factors?.all ?? []) {
      if (factor.factor_type === 'totp' && factor.status === 'unverified') {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
        if (unenrollError) throw unenrollError
      }
    }
    const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
    })
    if (enrollError) throw enrollError
    setStep({
      kind: 'enroll',
      factorId: enrolled.id,
      qrCode: enrolled.totp.qr_code,
      secret: enrolled.totp.secret,
    })
  }

  const run = async (work: () => Promise<void>) => {
    setIsLoading(true)
    setError(null)
    try {
      await work()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('app.error'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignIn = (email: string, password: string) =>
    run(async () => {
      const supabase = createAdminSupabaseClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      await continueToSecondFactor()
    })

  const handleVerify = (factorId: string, code: string) =>
    run(async () => {
      const supabase = createAdminSupabaseClient()
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: code.trim(),
      })
      if (verifyError) throw verifyError
      goToDashboard()
    })

  useEffect(() => {
    // An existing session goes on only as far as its own level allows.
    const supabase = createAdminSupabaseClient()
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return
      try {
        await continueToSecondFactor()
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : t('app.error'))
      }
    })
    // Once on mount; after that the forms drive the steps.
  }, [])

  const notice =
    reason === 'admin_required'
      ? t('adminPanel.notAllowed')
      : reason === 'mfa_required' && step.kind === 'password'
        ? t('adminPanel.mfaRequired')
        : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--surface-base))] p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {step.kind === 'password'
              ? t('adminPanel.access')
              : step.kind === 'enroll'
                ? t('adminPanel.mfaEnrollTitle')
                : t('adminPanel.mfaChallengeTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(error ?? notice) && (
            <div
              className="mb-4 text-sm text-[hsl(var(--color-destructive))] bg-[hsl(var(--color-destructive)/0.08)] border border-[hsl(var(--color-destructive)/0.2)] p-3 rounded-xl flex items-start gap-2"
              role="alert"
            >
              <span className="shrink-0 mt-px opacity-60">⚠</span>
              <span>{error ?? notice}</span>
            </div>
          )}

          {step.kind === 'password' ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.target as HTMLFormElement
                const emailInput = form.elements.namedItem('email') as HTMLInputElement
                const passwordInput = form.elements.namedItem('password') as HTMLInputElement
                void handleSignIn(emailInput.value, passwordInput.value)
              }}
            >
              <Input
                name="email"
                type="email"
                required
                dir="ltr"
                label={t('auth.email')}
                disabled={isLoading}
              />
              <Input
                name="password"
                type="password"
                required
                dir="ltr"
                label={t('auth.password')}
                disabled={isLoading}
              />
              <Button type="submit" fullWidth loading={isLoading}>
                {t('auth.signIn')}
              </Button>
            </form>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.target as HTMLFormElement
                const codeInput = form.elements.namedItem('code') as HTMLInputElement
                void handleVerify(step.factorId, codeInput.value)
              }}
            >
              {step.kind === 'enroll' && (
                <div className="space-y-3">
                  <p className="text-sm text-[hsl(var(--fg-secondary))]">
                    {t('adminPanel.mfaEnrollHint')}
                  </p>
                  {/* Supabase returns the QR as an SVG data URI. */}
                  <img
                    src={step.qrCode}
                    alt={t('adminPanel.mfaQrAlt')}
                    className="mx-auto h-44 w-44 rounded-lg bg-white p-2"
                  />
                  <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('adminPanel.mfaSecret')}
                  </p>
                  <p
                    dir="ltr"
                    className="break-all rounded-lg bg-[hsl(var(--surface-muted))] p-2 text-center font-mono text-xs"
                  >
                    {step.secret}
                  </p>
                </div>
              )}
              <Input
                name="code"
                required
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="[0-9]{6}"
                label={t('adminPanel.mfaCode')}
                disabled={isLoading}
              />
              <Button type="submit" fullWidth loading={isLoading}>
                {t('adminPanel.mfaVerify')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
