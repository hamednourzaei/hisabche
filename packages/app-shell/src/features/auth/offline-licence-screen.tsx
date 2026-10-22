// ============================================
// The step before the offline edition: this device's ID, and the licence code.
//
// The ID is what the admin panel needs to issue a licence for this device;
// the code is what it gives back. Nothing on the device opens until the code
// verifies (offline-license.ts).
// ============================================

import { useEffect, useState } from 'react'
import { Button, copyText } from '@hisabche/ui'

import { activateLicence, deviceLicenceId, type LicenceCheck } from './offline-license'

export interface OfflineLicenceScreenProps {
  t: (key: string, fallback?: string) => string
  /** Why the stored licence (if any) was not accepted — shown above the form. */
  initialProblem: Exclude<LicenceCheck, { ok: true }>['reason'] | null
  onActivated: () => void
  onBack: () => void
}

const PROBLEM_FALLBACK: Record<string, string> = {
  NOT_CONFIGURED:
    'کلید بررسی لایسنس هنوز روی این دستگاه نیست. برای فعال‌سازی یک بار به اینترنت وصل شوید و دوباره امتحان کنید.',
  INVALID_CODE: 'این متن کد لایسنس نیست. کد را کامل کپی کنید.',
  TAMPERED: 'امضای لایسنس معتبر نیست.',
  EXPIRED: 'مدت این لایسنس تمام شده است.',
  WRONG_DEVICE: 'این لایسنس برای دستگاه دیگری صادر شده است.',
  WRONG_WORKSPACE: 'این لایسنس برای کسب‌وکار دیگری است.',
  REVOKED: 'این لایسنس باطل شده است.',
  BANNED: 'این لایسنس مسدود است.',
  CLOCK_ROLLED_BACK: 'ساعت دستگاه به عقب برگشته است. تاریخ و ساعت را درست کنید.',
}

export function OfflineLicenceScreen({
  t,
  initialProblem,
  onActivated,
  onBack,
}: OfflineLicenceScreenProps) {
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  // «MISSING» is the ordinary first visit, not a problem to announce.
  const [problem, setProblem] = useState<string | null>(
    initialProblem && initialProblem !== 'MISSING' ? initialProblem : null,
  )
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    void deviceLicenceId().then((id) => {
      if (!cancelled) setDeviceId(id)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const say = (reason: string) =>
    t(`auth.offlineLicense.${reason}`, PROBLEM_FALLBACK[reason] ?? reason)

  const submit = async () => {
    setBusy(true)
    setProblem(null)
    const result = await activateLicence(code)
    setBusy(false)
    if (result.ok) onActivated()
    else setProblem(result.reason)
  }

  return (
    <div className="relative flex h-dvh items-start justify-center overflow-y-auto p-6">
      <div className="w-full max-w-md space-y-5 pt-8">
        <div className="space-y-1.5 text-center">
          <h1 className="text-xl font-bold text-[hsl(var(--fg-primary))]">
            {t('auth.offlineLicense.title', 'لایسنس نسخه‌ی محلی')}
          </h1>
          <p className="text-sm text-[hsl(var(--fg-secondary))]">
            {t(
              'auth.offlineLicense.intro',
              'برای کار با نسخه‌ی محلی، کد لایسنسی را که از پشتیبانی حسابچه گرفته‌اید وارد کنید.',
            )}
          </p>
        </div>

        <div className="space-y-2 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4">
          <p className="text-xs font-semibold text-[hsl(var(--fg-secondary))]">
            {t('auth.offlineLicense.deviceId', 'شناسه‌ی این دستگاه')}
          </p>
          <div className="flex items-center gap-2">
            <code
              dir="ltr"
              className="min-w-0 flex-1 select-all break-all rounded-lg bg-[hsl(var(--surface-muted))] px-3 py-2 font-mono text-xs text-[hsl(var(--fg-primary))]"
            >
              {deviceId ?? '…'}
            </code>
            <Button
              variant="outline"
              size="sm"
              disabled={!deviceId}
              onClick={async () => setCopied(await copyText(deviceId ?? ''))}
            >
              {copied
                ? t('auth.offlineLicense.copied', 'کپی شد')
                : t('auth.offlineLicense.copy', 'کپی')}
            </Button>
          </div>
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">
            {t(
              'auth.offlineLicense.deviceIdHint',
              'این شناسه را برای پشتیبانی بفرستید تا لایسنس برای همین دستگاه صادر شود.',
            )}
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {t('auth.offlineLicense.code', 'کد لایسنس')}
          </span>
          <textarea
            dir="ltr"
            rows={5}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={t('auth.offlineLicense.codePlaceholder', 'HSB1.…')}
            className="w-full break-all rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3 font-mono text-xs text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]"
          />
        </label>

        {problem ? (
          <p role="alert" className="text-sm font-medium text-[hsl(var(--color-destructive))]">
            {say(problem)}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button disabled={busy || code.trim() === ''} onClick={() => void submit()}>
            {t('auth.offlineLicense.submit', 'فعال‌سازی')}
          </Button>
          <Button variant="ghost" onClick={onBack}>
            {t('auth.offlineLicense.back', 'بازگشت به ورود')}
          </Button>
        </div>
      </div>
    </div>
  )
}
