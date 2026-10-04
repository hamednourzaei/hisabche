'use client'

// ============================================
// «فاکتورهای تکراری» — the standing arrangements of this business, from the
// invoices page: what each one issues, when it runs next, why it is off when it
// is off, and the history of every slot (issued, skipped, failed — with the
// reason).
//
// An arrangement is DEFINED on the invoice's confirm step (the invoice on
// screen is its template); here it is watched, paused, resumed, run now, or
// removed.
// ============================================

import { useState } from 'react'
import { Repeat } from 'lucide-react'
import { formatNumber } from '@hisabche/formatting'
import {
  apiErrorMessage,
  useAutomationRuns,
  useAutomations,
  useRemoveAutomation,
  useRunAutomationNow,
  useUpdateAutomation,
  type Automation,
} from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { useDateFormat } from '../../../hooks/use-date-format'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { useLocalePush } from '../../../hooks/use-locale-push'
import { Button } from '../button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../dialog'
import { useToast } from '../toast-provider'

type T = (key: string, fallback?: string) => string

/**
 * Codes a run or a refusal can carry, each with a sentence in the catalogue.
 * A closed list: `t()` on a key that does not exist throws, and a server
 * message is not a key until it is here — anything else is shown as it came.
 */
export const RECURRING_REASON_CODES = [
  'OK',
  'TOO_LATE',
  'DISABLED',
  'PAUSED',
  'ARCHIVED',
  'FAILED_TOO_OFTEN',
  'AUTOMATION_ALREADY_RAN_TODAY',
  'AUTOMATION_MIGRATION_PENDING',
  'AUTOMATION_ACTION_NOT_SUPPORTED',
  'AUTOMATION_TEMPLATE_MISSING',
  'INVENTORY_INSUFFICIENT_STOCK',
] as const

const KNOWN: ReadonlySet<string> = new Set(RECURRING_REASON_CODES)

export function recurringReasonText(t: T, code: string | null | undefined, fallback: string) {
  if (!code) return fallback
  return KNOWN.has(code) ? t(`invoices.recurring.reasons.${code}`, code) : code
}

function cadenceText(t: T, locale: string, automation: Automation): string {
  const cadence = automation.cadence
  if (cadence.kind === 'monthly') {
    const calendar =
      cadence.calendar === 'persian'
        ? t('invoices.recurring.calendarPersian', 'شمسی')
        : t('invoices.recurring.calendarGregory', 'میلادی')
    return `${t('invoices.recurring.monthlyOn', 'هر ماه، روز')} ${formatNumber(cadence.dayOfMonth, locale, 0)} (${calendar})`
  }
  if (cadence.kind === 'interval') {
    return `${t('invoices.recurring.every', 'هر')} ${formatNumber(cadence.everyDays, locale, 0)} ${t('invoices.recurring.days', 'روز')}`
  }
  return t('invoices.recurring.once', 'یک‌بار')
}

export function RecurringInvoicesButton({ t }: { t: T }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Repeat className="size-4" aria-hidden="true" />
        {t('invoices.recurring.title', 'فاکتورهای تکراری')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('invoices.recurring.title', 'فاکتورهای تکراری')}</DialogTitle>
          </DialogHeader>
          {open ? <RecurringInvoicesList t={t} onNavigate={() => setOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function RecurringInvoicesList({ t, onNavigate }: { t: T; onNavigate: () => void }) {
  const locale = useIntlLocale()
  const { date } = useDateFormat()
  const toast = useToast()
  const push = useLocalePush()
  const automations = useAutomations()
  const update = useUpdateAutomation()
  const remove = useRemoveAutomation()
  const runNow = useRunAutomationNow()
  const [historyOf, setHistoryOf] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  if (automations.isLoading) {
    return <div className="h-24 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
  }

  // A failed read is a failure — not «you have no recurring invoices».
  if (automations.error) {
    return (
      <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
        {recurringReasonText(
          t,
          apiErrorMessage(automations.error, ''),
          t('invoices.recurring.loadFailed', 'فاکتورهای تکراری خوانده نشد.'),
        )}
      </p>
    )
  }

  const rows = (automations.data ?? []).filter((row) => row.actionType === 'recurring_invoice')

  if (rows.length === 0) {
    return (
      <p className="text-sm text-[hsl(var(--fg-secondary))]">
        {t(
          'invoices.recurring.empty',
          'هنوز فاکتور تکراری ندارید. هنگام تأیید یک فاکتور، گزینه‌ی «این فاکتور خودکار تکرار شود» را روشن کنید.',
        )}
      </p>
    )
  }

  const fail = (error: unknown, fallback: string) =>
    toast.error(recurringReasonText(t, apiErrorMessage(error, ''), fallback))

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const busy =
          (update.isPending && update.variables?.id === row.id) ||
          (runNow.isPending && runNow.variables === row.id) ||
          (remove.isPending && remove.variables === row.id)
        return (
          <li
            key={row.id}
            className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[hsl(var(--fg-primary))]">
                  {row.name}
                </p>
                <p className="mt-0.5 text-xs text-[hsl(var(--fg-secondary))]">
                  {cadenceText(t, locale, row)}
                  {row.summary.total !== null ? (
                    <>
                      {' · '}
                      <span className="tabular-nums">
                        {formatNumber(row.summary.total, locale, 2)}
                      </span>{' '}
                      {row.summary.currency
                        ? t(`currency.${row.summary.currency.toLowerCase()}`, row.summary.currency)
                        : ''}
                    </>
                  ) : null}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                  row.enabled
                    ? 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]'
                    : 'bg-[hsl(var(--color-warning)/0.15)] text-[hsl(var(--fg-primary))]',
                )}
              >
                {row.enabled
                  ? t('invoices.recurring.active', 'فعال')
                  : t('invoices.recurring.stopped', 'متوقف')}
              </span>
            </div>

            {/* When, or why not — said in words, never left as a blank. */}
            <p className="mt-2 text-xs text-[hsl(var(--fg-secondary))]">
              {row.enabled ? (
                row.nextRunOn ? (
                  <>
                    {t('invoices.recurring.next', 'نوبت بعد')}: {date(row.nextRunOn)}
                  </>
                ) : (
                  t('invoices.recurring.noNext', 'نوبت دیگری ندارد.')
                )
              ) : (
                recurringReasonText(
                  t,
                  row.disabledReason,
                  t('invoices.recurring.reasons.PAUSED', 'شما آن را متوقف کرده‌اید.'),
                )
              )}
              {row.lastRunAt ? (
                <>
                  {' · '}
                  {t('invoices.recurring.last', 'آخرین صدور')}: {date(row.lastRunAt)}
                </>
              ) : null}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  update.mutate(
                    { id: row.id, enabled: !row.enabled },
                    {
                      onError: (error) =>
                        fail(error, t('invoices.recurring.updateFailed', 'تغییر ذخیره نشد.')),
                    },
                  )
                }
              >
                {row.enabled
                  ? t('invoices.recurring.pause', 'توقف')
                  : t('invoices.recurring.resume', 'ازسرگیری')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  runNow.mutate(row.id, {
                    onSuccess: (result) => {
                      if (result.outcome === 'ran') {
                        toast.success(t('invoices.recurring.issued', 'فاکتور امروز صادر شد.'))
                        if (result.documentId) {
                          onNavigate()
                          push(`/invoices/${result.documentId}`)
                        }
                      } else {
                        // Not issued, and the reason is the answer.
                        toast.warning(
                          t('invoices.recurring.notIssued', 'فاکتور صادر نشد.'),
                          recurringReasonText(t, result.reason, ''),
                        )
                      }
                    },
                    onError: (error) =>
                      fail(error, t('invoices.recurring.runFailed', 'صدور انجام نشد.')),
                  })
                }
              >
                {t('invoices.recurring.runNow', 'همین حالا صادر کن')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setHistoryOf(historyOf === row.id ? null : row.id)}
                aria-expanded={historyOf === row.id}
              >
                {t('invoices.recurring.history', 'تاریخچه')}
              </Button>
              {confirmRemove === row.id ? (
                <>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      remove.mutate(row.id, {
                        onSuccess: () => setConfirmRemove(null),
                        onError: (error) =>
                          fail(error, t('invoices.recurring.removeFailed', 'حذف نشد.')),
                      })
                    }
                  >
                    {t('invoices.recurring.confirmRemove', 'بله، حذف شود')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmRemove(null)}
                  >
                    {t('action.cancel', 'انصراف')}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmRemove(row.id)}
                >
                  {t('action.delete', 'حذف')}
                </Button>
              )}
            </div>
            {confirmRemove === row.id ? (
              <p className="mt-2 text-xs text-[hsl(var(--fg-tertiary))]">
                {t(
                  'invoices.recurring.removeHint',
                  'فقط این قرار حذف می‌شود؛ فاکتورهایی که تا امروز صادر شده‌اند سر جایشان می‌مانند.',
                )}
              </p>
            ) : null}

            {historyOf === row.id ? <RunHistory t={t} id={row.id} /> : null}
          </li>
        )
      })}
    </ul>
  )
}

function RunHistory({ t, id }: { t: T; id: string }) {
  const { date } = useDateFormat()
  const runs = useAutomationRuns(id)

  if (runs.isLoading) {
    return <div className="mt-3 h-10 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
  }
  if (runs.error) {
    return (
      <p role="alert" className="mt-3 text-xs text-[hsl(var(--color-destructive))]">
        {t('invoices.recurring.historyFailed', 'تاریخچه خوانده نشد.')}
      </p>
    )
  }
  const rows = runs.data ?? []
  if (rows.length === 0) {
    return (
      <p className="mt-3 text-xs text-[hsl(var(--fg-tertiary))]">
        {t('invoices.recurring.historyEmpty', 'هنوز نوبتی نرسیده است.')}
      </p>
    )
  }

  const tone: Record<string, string> = {
    ran: 'text-[hsl(var(--color-success))]',
    skipped: 'text-[hsl(var(--fg-secondary))]',
    failed: 'text-[hsl(var(--color-destructive))]',
  }
  const label: Record<string, string> = {
    ran: t('invoices.recurring.outcome.ran', 'صادر شد'),
    skipped: t('invoices.recurring.outcome.skipped', 'رد شد'),
    failed: t('invoices.recurring.outcome.failed', 'خطا'),
  }

  return (
    <ul className="mt-3 space-y-1 border-t border-[hsl(var(--border-default))] pt-2 text-xs">
      {rows.map((run) => (
        <li key={run.id} className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[hsl(var(--fg-primary))]">{date(run.slot)}</span>
          <span className={cn('font-medium', tone[run.outcome])}>
            {label[run.outcome] ?? run.outcome}
            {run.outcome !== 'ran' && run.detail ? (
              <span className="ms-2 font-normal text-[hsl(var(--fg-secondary))]">
                {recurringReasonText(t, run.detail, '')}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  )
}
