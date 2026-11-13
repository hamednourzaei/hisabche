// ============================================
// Settings → «تأیید دومرحله‌ای»: an authenticator app for this person, and
// (for whoever manages the business) which actions ask for its code.
//
// ⚠️ THE FACTOR IS SUPABASE AUTH'S. We never see the secret; the QR code and
// the manual key come from the server once, while the person is enrolling.
// ⚠️ RECOVERY CODES ARE SHOWN ONCE, right after the first correct code, and
// only their hashes are kept. Closing the box without saving them loses them.
// ⚠️ A correct code returns a NEW session (AAL2). It goes straight into the
// auth store; without that, the next sensitive action would ask again.
// ============================================
'use client'

import { memo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ShieldCheck } from 'lucide-react'
import {
  apiErrorMessage,
  STEP_UP_CAPABILITY_OPTIONS,
  useMyCapabilities,
  useRecoverTwoFactor,
  useSaveTwoFactorPolicy,
  useStartTwoFactor,
  useTwoFactorStatus,
  useVerifyTwoFactor,
  type TwoFactorEnrollment,
} from '@hisabche/api'
import { useAuthStore } from '@hisabche/store'

import { Button } from '../button'
import { Checkbox } from '../checkbox'
import { Input } from '../input'
import { useToast } from '../toast-provider'
import { copyText } from '../../../lib/copy-text'
import Image from 'next/image'

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4'

/** A capability id is dotted; a message key cannot be (it would nest). */
export const capabilityLabelKey = (capability: string) =>
  `capabilities.${capability.replace(/[.-]/g, '_')}`

export const TwoFactorSection = memo(function TwoFactorSection() {
  const t = useTranslations('settings.twoFactor')
  const toast = useToast()
  const status = useTwoFactorStatus()
  const start = useStartTwoFactor()
  const verify = useVerifyTwoFactor()
  const recover = useRecoverTwoFactor()
  const savePolicy = useSaveTwoFactorPolicy()
  const capabilities = useMyCapabilities()
  const adopt = useAuthStore((s) => s.adoptVerifiedSession)

  const [enrollment, setEnrollment] = useState<TwoFactorEnrollment | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [recoveryInput, setRecoveryInput] = useState('')
  const [policyDraft, setPolicyDraft] = useState<string[] | null>(null)

  if (status.isLoading) {
    return <div className={card}>{t('loading')}</div>
  }
  // Error and "not configured" are two different branches (CLAUDE.md §7.3).
  if (status.isError || !status.data) {
    return (
      <div className={card} role="alert">
        <p className="text-sm text-[hsl(var(--color-destructive))]">{t('loadFailed')}</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => void status.refetch()}>
          {t('retry')}
        </Button>
      </div>
    )
  }
  if (!status.data.configured) {
    return (
      <div className={card}>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('notReady')}</p>
      </div>
    )
  }

  const data = status.data
  const mayManage = capabilities.can('workspace.manage') === true
  const savedPolicy = data.policy?.capabilities ?? []
  const selected = policyDraft ?? savedPolicy

  const confirmCode = () => {
    if (!enrollment || !/^\d{6}$/.test(code)) {
      setCodeError(true)
      return
    }
    verify.mutate(
      { factorId: enrollment.factorId, code },
      {
        onSuccess: (session) => {
          adopt({ token: session.token, refreshToken: session.refreshToken })
          setEnrollment(null)
          setCode('')
          setCodeError(false)
          setRecoveryCodes(session.recoveryCodes)
          toast.success(t('saved'))
        },
        onError: () => setCodeError(true),
      },
    )
  }

  return (
    <div className="space-y-4">
      <div className={`${card} space-y-3`}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h3 className="text-base font-semibold text-[hsl(var(--fg-primary))]">{t('title')}</h3>
        </div>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('description')}</p>

        {data.enrolled ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-[hsl(var(--color-success))]">
              {t('enrolledBadge')}
            </p>
            <p className="text-xs text-[hsl(var(--fg-secondary))]">
              {t('recoveryLeft')}: <span className="tabular-nums">{data.recoveryCodesLeft}</span>
            </p>
          </div>
        ) : enrollment ? (
          <div className="space-y-3">
            <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('scanHint')}</p>
            {enrollment.qrCode ? (
              <Image
                unoptimized
                src={enrollment.qrCode}
                alt={t('qrAlt')}
                width={176}
                height={176}
                className="h-44 w-44 rounded-lg bg-white p-2"
              />
            ) : null}
            <p className="text-xs text-[hsl(var(--fg-secondary))]">
              {t('manualKey')}:{' '}
              <code dir="ltr" className="select-all break-all font-mono">
                {enrollment.secret}
              </code>
            </p>
            <label className="block text-sm font-medium" htmlFor="two-factor-code">
              {t('codeLabel')}
            </label>
            <Input
              id="two-factor-code"
              name="code"
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              placeholder="000000"
              aria-invalid={codeError}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                setCodeError(false)
              }}
              className="w-40 text-center tabular-nums tracking-widest"
            />
            {codeError ? (
              <p className="text-xs text-[hsl(var(--color-destructive))]">{t('invalidCode')}</p>
            ) : null}
            <div className="flex gap-2">
              <Button size="sm" disabled={verify.isPending} onClick={confirmCode}>
                {t('confirm')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEnrollment(null)
                  setCode('')
                }}
              >
                {t('cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('notEnrolled')}</p>
            <Button
              size="sm"
              disabled={start.isPending}
              onClick={() =>
                start.mutate(undefined, {
                  onSuccess: setEnrollment,
                  onError: (e) => toast.error(apiErrorMessage(e, t('startFailed'))),
                })
              }
            >
              {t('turnOn')}
            </Button>
          </div>
        )}
      </div>

      {recoveryCodes && recoveryCodes.length > 0 ? (
        <div className={`${card} space-y-2`} role="region" aria-label={t('recoveryTitle')}>
          <h4 className="text-sm font-semibold">{t('recoveryTitle')}</h4>
          <p className="text-xs text-[hsl(var(--fg-secondary))]">{t('recoveryHint')}</p>
          <ul dir="ltr" className="grid grid-cols-2 gap-1 font-mono text-sm">
            {recoveryCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void copyText(recoveryCodes.join('\n')).then((ok) =>
                  ok ? toast.success(t('recoveryCopied')) : toast.error(t('copyFailed')),
                )
              }
            >
              {t('recoveryCopy')}
            </Button>
            <Button size="sm" onClick={() => setRecoveryCodes(null)}>
              {t('recoveryDone')}
            </Button>
          </div>
        </div>
      ) : null}

      {data.enrolled ? (
        <div className={`${card} space-y-2`}>
          <h4 className="text-sm font-semibold">{t('lostDevice')}</h4>
          <p className="text-xs text-[hsl(var(--fg-secondary))]">{t('lostDeviceHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Input
              name="recoveryCode"
              dir="ltr"
              value={recoveryInput}
              onChange={(e) => setRecoveryInput(e.target.value)}
              className="w-48 font-mono"
              aria-label={t('recoverLabel')}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={recover.isPending || recoveryInput.trim().length < 6}
              onClick={() =>
                recover.mutate(recoveryInput, {
                  onSuccess: () => {
                    setRecoveryInput('')
                    toast.success(t('recovered'))
                  },
                  onError: (e) => toast.error(apiErrorMessage(e, t('recoverFailed'))),
                })
              }
            >
              {t('recoverAction')}
            </Button>
          </div>
        </div>
      ) : null}

      {mayManage ? (
        <div className={`${card} space-y-3`}>
          <h4 className="text-sm font-semibold">{t('policyTitle')}</h4>
          <p className="text-xs text-[hsl(var(--fg-secondary))]">
            {data.policy ? t('policyHint') : t('policyOff')}
          </p>
          <ul className="space-y-2">
            {STEP_UP_CAPABILITY_OPTIONS.map((capability) => {
              const id = `step-up-${capability.replace(/\./g, '-')}`
              return (
                <li key={capability} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={selected.includes(capability)}
                    onCheckedChange={(checked) =>
                      setPolicyDraft(
                        checked === true
                          ? [...new Set([...selected, capability])]
                          : selected.filter((c) => c !== capability),
                      )
                    }
                  />
                  <label htmlFor={id} className="text-sm">
                    {t(capabilityLabelKey(capability))}
                  </label>
                </li>
              )
            })}
          </ul>
          <Button
            size="sm"
            disabled={savePolicy.isPending || policyDraft === null}
            onClick={() =>
              savePolicy.mutate(
                { capabilities: selected, requireOwner: true },
                {
                  onSuccess: () => {
                    setPolicyDraft(null)
                    toast.success(t('policySaved'))
                  },
                  onError: (e) => toast.error(apiErrorMessage(e, t('policySaveFailed'))),
                },
              )
            }
          >
            {t('policySave')}
          </Button>
        </div>
      ) : null}
    </div>
  )
})
