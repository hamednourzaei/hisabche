'use client'

// ============================================
// One employee's personal attendance link: make it, send it, revoke it.
//
// The link lets THAT employee send their own presence, absence or leave. What
// they send is a request; whether it lands on the sheet at once or waits for a
// manager is decided here, when the link is made.
//
// ⚠️ ONE LIVE LINK PER EMPLOYEE. «Make a new link» revokes the old one on the
// server, in the same call.
// ⚠️ THE STATE COMES FROM THE SERVER (`link.state`). This dialog compares no
// dates to decide whether a link works.
// ⚠️ THE ZONE IS THE WORKPLACE'S, FROM THE SERVER: the employee's branch, else
// the business (Settings → «منطقه‌ی زمانی»). This dialog reads no zone from the
// device. When none is set there is nothing to make a link with, and the dialog
// says where to set it instead of offering a button that would be refused.
// ⚠️ Copy goes through `copyText`, which says whether the text really reached
// the clipboard.
// ============================================

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Copy, Send } from 'lucide-react'
import {
  apiErrorMessage,
  useAttendanceLink,
  useCreateAttendanceLink,
  useRevokeAttendanceLink,
} from '@hisabche/api'
import { localizePath } from '@hisabche/ui-contract'

import { copyText } from '../../../lib/copy-text'
import { useDateFormat } from '../../../hooks/use-date-format'
import { useRouteLang } from '../../../hooks/use-locale-push'
import { Button } from '../button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../dialog'
import { JalaliDatePicker } from '../jalali-datepicker'
import { SelectField } from '../select-field'
import { Switch } from '../switch'
import { useToast } from '../toast-provider'

/** Server refusals this dialog can explain. Anything else gets the general sentence. */
export const ATTENDANCE_LINK_ERROR_CODES = [
  'ATTENDANCE_SELF_NOT_CONFIGURED',
  'ATTENDANCE_LINK_EXPIRY_IN_PAST',
  'ATTENDANCE_TIME_ZONE_NOT_SET',
  'ATTENDANCE_NOT_FOUND',
] as const

/** 0 = today only … 7. The server's own limit (MAX_DAYS_BACK). */
const DAYS_BACK_CHOICES = [0, 1, 2, 3, 7] as const

const field = 'space-y-1'
const label = 'block text-xs text-[hsl(var(--fg-secondary))]'
const hint = 'text-xs text-[hsl(var(--fg-tertiary))]'

export function AttendanceLinkDialog({
  employee,
  onClose,
}: {
  /** Null = closed. The link is fetched only while this is set. */
  employee: { id: string; name: string } | null
  onClose: () => void
}) {
  const t = useTranslations('attendance')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const lang = useRouteLang()
  const toast = useToast()
  const { dateTime, date: formatDay } = useDateFormat()

  const link = useAttendanceLink(employee?.id ?? null)
  const create = useCreateAttendanceLink()
  const revoke = useRevokeAttendanceLink()

  const [expiresOn, setExpiresOn] = useState('')
  const [daysBack, setDaysBack] = useState('0')
  const [autoApply, setAutoApply] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  // The public page lives on the website; a packaged desktop app runs from
  // file://, so the public site is the link's home there. The share sheet is
  // the device's too. Both are read after mount.
  const [device, setDevice] = useState<{ origin: string; canShare: boolean }>({
    origin: '',
    canShare: false,
  })
  useEffect(() => {
    setDevice({
      origin: window.location.protocol.startsWith('http')
        ? window.location.origin
        : 'https://hisabche.com',
      canShare: typeof navigator.share === 'function',
    })
  }, [])

  // A new employee, a clean form.
  const employeeId = employee?.id ?? null
  useEffect(() => {
    setExpiresOn('')
    setDaysBack('0')
    setAutoApply(false)
    setFailure(null)
  }, [employeeId])

  const explain = (error: unknown): string => {
    const raw = apiErrorMessage(error, '')
    const code = ATTENDANCE_LINK_ERROR_CODES.find((known) => raw.includes(known))
    return code ? t(`errors.${code}`) : t('errors.general')
  }

  const status = (link.error as { response?: { status?: number } } | null)?.response?.status
  const current = link.data?.link ?? null
  const workplace = link.data?.workplace ?? null
  const zone = workplace?.timeZone ?? null
  const live = current?.state === 'active'
  const url = current
    ? `${device.origin}${localizePath(`/my-attendance/${current.token}`, locale)}`
    : ''

  const make = () => {
    if (!employee || !zone) return
    setFailure(null)
    create.mutate(
      {
        employeeId: employee.id,
        expiresOn: expiresOn || null,
        daysBack: Number(daysBack),
        autoApply,
      },
      { onError: (error) => setFailure(explain(error)) },
    )
  }

  const copy = async () => {
    if (await copyText(url)) toast.success(t('link.copied'))
    else toast.error(t('link.copyFailed'))
  }

  const share = () => {
    // The person may close the share sheet; that is not a failure to report.
    void navigator.share({ title: t('link.shareText'), url }).catch(() => undefined)
  }

  const daysBackLabel = (days: number) =>
    days === 0 ? t('link.daysBackToday') : t('link.daysBackOption', { count: days })

  return (
    <Dialog open={employee !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent data-attendance-link>
        <DialogHeader>
          <DialogTitle>{t('link.title', { name: employee?.name ?? '' })}</DialogTitle>
          <DialogDescription>{t('link.help')}</DialogDescription>
        </DialogHeader>

        {link.isLoading ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('link.loading')}</p>
        ) : status === 503 ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('link.notConfigured')}</p>
        ) : link.error ? (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
              {t('link.loadFailed')}
            </p>
            <Button size="sm" variant="outline" onClick={() => void link.refetch()}>
              {tCommon('retry')}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {current ? (
              <section className="space-y-3 rounded-xl border border-[hsl(var(--border-default))] p-3">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <dt className="text-[hsl(var(--fg-tertiary))]">{t('link.stateLabel')}</dt>
                    <dd
                      data-link-state={current.state}
                      className={
                        live
                          ? 'font-medium text-[hsl(var(--color-success))]'
                          : 'font-medium text-[hsl(var(--color-warning))]'
                      }
                    >
                      {t(`link.state.${current.state}`)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[hsl(var(--fg-tertiary))]">{t('link.validUntil')}</dt>
                    <dd>{current.expiresAt ? dateTime(current.expiresAt) : t('link.noExpiry')}</dd>
                  </div>
                  <div>
                    <dt className="text-[hsl(var(--fg-tertiary))]">{t('link.createdAt')}</dt>
                    <dd>{formatDay(current.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-[hsl(var(--fg-tertiary))]">{t('link.lastUsedAt')}</dt>
                    <dd>
                      {current.lastUsedAt ? dateTime(current.lastUsedAt) : t('link.neverUsed')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[hsl(var(--fg-tertiary))]">{t('link.daysBack')}</dt>
                    <dd>{daysBackLabel(current.daysBack)}</dd>
                  </div>
                  <div>
                    <dt className="text-[hsl(var(--fg-tertiary))]">{t('link.autoApply')}</dt>
                    <dd>{current.autoApply ? t('link.autoApplyOn') : t('link.autoApplyOff')}</dd>
                  </div>
                </dl>

                {live ? (
                  <div className={field}>
                    <span className={label}>{t('link.url')}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        readOnly
                        dir="ltr"
                        name="attendanceLinkUrl"
                        aria-label={t('link.url')}
                        value={url}
                        onFocus={(event) => event.currentTarget.select()}
                        className="h-9 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] px-2 text-xs"
                      />
                      <Button size="sm" variant="outline" onClick={() => void copy()}>
                        <Copy className="size-4" aria-hidden="true" />
                        {t('link.copy')}
                      </Button>
                      {device.canShare ? (
                        <Button size="sm" variant="outline" onClick={share}>
                          <Send className="size-4" aria-hidden="true" />
                          {t('link.share')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <Button
                  size="sm"
                  variant="ghost"
                  disabled={revoke.isPending}
                  onClick={() => {
                    setFailure(null)
                    revoke.mutate(
                      { id: current.id, employeeId: current.employeeId },
                      {
                        onSuccess: () => toast.success(t('link.revoked')),
                        onError: (error) => setFailure(explain(error)),
                      },
                    )
                  }}
                >
                  {t('link.revoke')}
                </Button>
              </section>
            ) : (
              <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('link.none')}</p>
            )}

            <section className="space-y-3">
              <div className={field}>
                <span className={label}>{t('link.expiresOn')}</span>
                <div className="flex items-center gap-2">
                  <JalaliDatePicker value={expiresOn} onChange={setExpiresOn} className="w-44" />
                  {expiresOn ? (
                    <Button size="sm" variant="ghost" onClick={() => setExpiresOn('')}>
                      {t('link.noExpiry')}
                    </Button>
                  ) : null}
                </div>
                <p className={hint}>{t('link.expiresOnHelp')}</p>
              </div>

              <div className={field}>
                <span className={label}>{t('link.daysBack')}</span>
                <SelectField
                  name="daysBack"
                  aria-label={t('link.daysBack')}
                  value={daysBack}
                  onChange={setDaysBack}
                  options={DAYS_BACK_CHOICES.map((days) => ({
                    value: String(days),
                    label: daysBackLabel(days),
                  }))}
                  className="h-10 w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-sm"
                />
              </div>

              <label className="flex items-start gap-3">
                <Switch
                  name="autoApply"
                  checked={autoApply}
                  onCheckedChange={setAutoApply}
                  aria-label={t('link.autoApply')}
                />
                <span className="space-y-1">
                  <span className="block text-sm text-[hsl(var(--fg-primary))]">
                    {t('link.autoApply')}
                  </span>
                  <span className={`block ${hint}`}>{t('link.autoApplyHelp')}</span>
                </span>
              </label>

              {zone ? (
                <p className={hint} data-workplace-zone={workplace?.source ?? ''}>
                  {t('link.timeZone', { zone })}{' '}
                  {workplace?.source === 'branch'
                    ? t('link.zoneFromBranch')
                    : t('link.zoneFromBusiness')}
                </p>
              ) : (
                <p
                  role="alert"
                  data-workplace-zone-missing
                  className="text-sm text-[hsl(var(--color-warning))]"
                >
                  {t('link.zoneMissing')}{' '}
                  <Link
                    href={localizePath('/settings', lang)}
                    className="font-medium underline underline-offset-4"
                  >
                    {t('link.zoneSettings')}
                  </Link>
                </p>
              )}
              {current ? <p className={hint}>{t('link.recreateHelp')}</p> : null}

              {failure ? (
                <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
                  {failure}
                </p>
              ) : null}

              <Button disabled={create.isPending || !zone} onClick={make}>
                {current ? t('link.recreate') : t('link.create')}
              </Button>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
