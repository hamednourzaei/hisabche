'use client'

// ============================================
// «بسته‌های مشتری» - every GRANT of one customer with its term, activation, expiry, suspension and what is left (M5, slice C).
//
// ⚠️ NOTHING HERE IS DECIDED BY THIS FILE. The state of a GRANT (not started / active / expired / suspended), its end date and what
// is left come from the server (or the device) through `usePackageGrants` - the same shared function everywhere. This panel only
// shows them and records ONE thing: a SUSPEND or a RESUME of ONE GRANT, an append-only event. It never suspends the customer,
// never edits a row, never expires, refunds or posts money.
// ⚠️ SOLD != ACTIVATED: a package nobody has used yet has no end date; the panel says so instead of showing a date.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePackageGrants, useRecordGrantSuspension, apiErrorMessage } from '@hisabche/api'

import { Badge } from '../capability/capability-kit'
import { Button } from '../button'

export interface PackageGrantsPanelProps {
  customerId: string
  /** May this person suspend / resume a GRANT? (payment.cancel on the server - manager by default.) */
  maySuspend: boolean
}

const TONE: Record<string, 'good' | 'info' | 'warn' | 'bad'> = {
  active: 'good',
  not_started: 'info',
  suspended: 'warn',
  expired: 'bad',
}

export function PackageGrantsPanel({ customerId, maySuspend }: PackageGrantsPanelProps) {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    try {
      const value = tOriginal(key as never)
      return value === key ? (fallback ?? key) : value
    } catch {
      return fallback ?? key
    }
  }
  const grants = usePackageGrants(customerId)
  const record = useRecordGrantSuspension()
  const [reasonFor, setReasonFor] = useState<{ id: string; kind: 'SUSPEND' | 'RESUME' } | null>(
    null,
  )
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (grants.isLoading) {
    return (
      <p className="text-xs text-[hsl(var(--fg-secondary))]">{t('serviceDelivery.loading', '…')}</p>
    )
  }
  if (grants.isError) {
    return (
      <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
        {t('packageGrants.unread', 'بسته‌های این مشتری خوانده نشد.')}
      </p>
    )
  }
  const items = grants.data ?? []
  if (items.length === 0) {
    return (
      <p className="text-xs text-[hsl(var(--fg-secondary))]">
        {t('packageGrants.empty', 'این مشتری هنوز بسته‌ای نخریده است.')}
      </p>
    )
  }

  const submit = () => {
    if (!reasonFor) return
    if (!reason.trim()) {
      setError(t('packageGrants.reasonRequired', 'دلیل را بنویسید.'))
      return
    }
    setError(null)
    record.mutate(
      { grantId: reasonFor.id, customerId, kind: reasonFor.kind, reason: reason.trim() },
      {
        onSuccess: () => {
          setReasonFor(null)
          setReason('')
        },
        onError: (cause) => setError(apiErrorMessage(cause, t('packageGrants.failed', 'ثبت نشد.'))),
      },
    )
  }

  return (
    <section aria-label={t('packageGrants.title', 'بسته‌های مشتری')} className="space-y-3">
      <h3 className="text-sm font-medium text-[hsl(var(--fg-primary))]">
        {t('packageGrants.title', 'بسته‌های مشتری')}
      </h3>
      <ul className="space-y-2">
        {items.map((grant) => (
          <li
            key={grant.id}
            data-grant-id={grant.id}
            className="rounded-md border border-[hsl(var(--border-default))] p-3 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="tabular-nums" dir="ltr">
                {grant.remaining} / {grant.quantity}
              </span>
              <Badge tone={TONE[grant.state] ?? 'info'}>
                {t(`packageGrants.state.${grant.state}`, grant.state)}
              </Badge>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[hsl(var(--fg-secondary))]">
              <dt>{t('packageGrants.soldOn', 'تاریخ خرید')}</dt>
              <dd dir="ltr" className="tabular-nums">
                {grant.soldOn}
              </dd>
              <dt>{t('packageGrants.term', 'مدت')}</dt>
              <dd>
                {grant.termMonths
                  ? t('packageGrants.months', '{n} ماه').replace('{n}', String(grant.termMonths))
                  : t('packageGrants.noTerm', 'بدون مدت')}
              </dd>
              <dt>{t('packageGrants.activatedOn', 'شروع مدت')}</dt>
              <dd dir="ltr" className="tabular-nums">
                {grant.activatedOn ?? t('packageGrants.notStarted', 'هنوز استفاده نشده')}
              </dd>
              <dt>{t('packageGrants.endsOn', 'پایان مدت')}</dt>
              <dd dir="ltr" className="tabular-nums">
                {grant.endsOn ?? '—'}
              </dd>
            </dl>

            {maySuspend && (grant.state === 'active' || grant.state === 'suspended') ? (
              <div className="mt-2">
                {reasonFor?.id === grant.id ? (
                  <div className="space-y-2">
                    <label className="block text-xs">
                      {t('packageGrants.reason', 'دلیل')}
                      <textarea
                        name="reason"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        className="mt-1 w-full rounded-md border border-[hsl(var(--border-default))] bg-transparent p-2 text-sm"
                        rows={2}
                      />
                    </label>
                    {error ? (
                      <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
                        {error}
                      </p>
                    ) : null}
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={submit} disabled={record.isPending}>
                        {t('packageGrants.confirm', 'ثبت')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReasonFor(null)
                          setError(null)
                        }}
                      >
                        {t('packageGrants.cancel', 'انصراف')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setReasonFor({
                        id: grant.id,
                        kind: grant.state === 'suspended' ? 'RESUME' : 'SUSPEND',
                      })
                    }
                  >
                    {grant.state === 'suspended'
                      ? t('packageGrants.resume', 'ازسرگیری این بسته')
                      : t('packageGrants.suspend', 'تعلیق این بسته')}
                  </Button>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
