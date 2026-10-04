// packages/ui/src/components/ui/accounting/tabs/MonthEndTab.tsx
'use client'

// ============================================
// «بستن ماه» — the ordered month-end close (capabilities #69 and #58).
//
// The package already existed on the server (depreciation → revaluation → cost
// repost → year-end close → period lock, in that order, stopping at the first
// failure). Nothing on any screen called it. This tab is its two entry points:
//
//   · close ONE month now, and see what each step did;
//   · have every month closed automatically on the 1st of the next.
//
// ⚠️ THE MONTH IS THE READER'S MONTH. A Persian or Dari reader keeps solar Hijri
// months; «last month» is Mehr, not September. The period sent to the server is
// that month's own first and last day.
//
// ⚠️ THE YEAR END IS ASKED, NEVER ASSUMED. The product has no fiscal-year
// setting. The person says which month ends their year; nothing defaults to
// December (or to Esfand).
// ============================================

import { memo, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toIsoDay } from '@hisabche/formatting'
import { addIsoDays, calendarDay, monthBounds, type ScheduleCalendar } from '@hisabche/validation'
import {
  apiErrorMessage,
  useAutomations,
  useCreateMonthEndAutomation,
  useRemoveAutomation,
  useRunMonthEnd,
  type MonthEndResult,
} from '@hisabche/api'

import { cn } from '../../../../lib/utils'
import { useDateFormat } from '../../../../hooks/use-date-format'
import { useIntlLocale } from '../../../../hooks/use-intl-locale'
import { Button } from '../../button'
import { SelectField } from '../../select-field'
import { Switch } from '../../switch'
import { useToast } from '../../toast-provider'
import { scheduleCalendarFor } from '../../invoice-builder/recurrence-panel'

/** Refusals this tab can show, each with a sentence in the catalogue. */
export const MONTH_END_ERROR_CODES = [
  'AUTOMATION_MONTH_END_EXISTS',
  'AUTOMATION_MIGRATION_PENDING',
] as const
const KNOWN: ReadonlySet<string> = new Set(MONTH_END_ERROR_CODES)

/** One ISO day inside each of the twelve months of the reader's calendar. */
function daysInEachMonth(today: string, calendar: ScheduleCalendar): string[] {
  const byMonth = new Map<number, string>()
  // A year of days back from today always covers all twelve months.
  for (let offset = 0; offset < 400 && byMonth.size < 12; offset += 14) {
    const day = addIsoDays(today, -offset)
    const { month } = calendarDay(day, calendar)
    if (!byMonth.has(month)) byMonth.set(month, day)
  }
  return Array.from({ length: 12 }, (_, index) => byMonth.get(index + 1) ?? today)
}

export const MonthEndTab = memo(function MonthEndTab() {
  const t = useTranslations()
  const locale = useIntlLocale()
  const { date } = useDateFormat()
  const toast = useToast()
  const calendar = scheduleCalendarFor(locale)

  // The reader's LOCAL day: east of Greenwich, the UTC day is still yesterday
  // for the first hours of the morning, and «last month» would be a month off
  // on the 1st.
  const today = useMemo(() => toIsoDay(new Date()), [])
  // The month that ended most recently — the one a person closes.
  const lastMonth = useMemo(() => {
    const thisMonth = monthBounds(today, calendar)
    return monthBounds(addIsoDays(thisMonth.from, -1), calendar)
  }, [today, calendar])
  const monthNames = useMemo(
    () => daysInEachMonth(today, calendar).map((day) => date(day, { month: 'long' })),
    [today, calendar, date],
  )

  const [yearEndMonth, setYearEndMonth] = useState('')
  const [lock, setLock] = useState(true)
  const [result, setResult] = useState<MonthEndResult | null>(null)

  const run = useRunMonthEnd()
  const automations = useAutomations()
  const createAutomatic = useCreateMonthEndAutomation()
  const removeAutomatic = useRemoveAutomation()

  const automatic = (automations.data ?? []).find((row) => row.actionType === 'month_end') ?? null
  const yearEnd = Number(yearEndMonth)
  const hasYearEnd = Number.isInteger(yearEnd) && yearEnd >= 1 && yearEnd <= 12

  const say = (error: unknown, fallbackKey: 'runFailed' | 'saveFailed') => {
    const message = apiErrorMessage(error, '')
    toast.error(
      KNOWN.has(message)
        ? t(`accounting.monthEnd.errors.${message}` as Parameters<typeof t>[0])
        : message || t(`accounting.monthEnd.${fallbackKey}`),
    )
  }

  const statusTone: Record<string, string> = {
    ok: 'text-[hsl(var(--color-success))]',
    nothing_to_do: 'text-[hsl(var(--fg-secondary))]',
    failed: 'text-[hsl(var(--color-destructive))]',
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* ── Which month ends the year: asked once, used by both actions ── */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t('accounting.monthEnd.yearEndTitle')}
        </h2>
        <div className="max-w-xs">
          <SelectField
            name="fiscalYearEndMonth"
            aria-label={t('accounting.monthEnd.yearEndTitle')}
            value={yearEndMonth}
            onChange={setYearEndMonth}
            placeholder={t('accounting.monthEnd.yearEndPlaceholder')}
            options={monthNames.map((name, index) => ({ value: String(index + 1), label: name }))}
          />
        </div>
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {t('accounting.monthEnd.yearEndHint')}
        </p>
      </section>

      <label className="flex items-center gap-2 text-sm text-[hsl(var(--fg-primary))]">
        <Switch
          size="sm"
          checked={lock}
          onCheckedChange={setLock}
          aria-label={t('accounting.monthEnd.lock')}
        />
        {t('accounting.monthEnd.lock')}
      </label>

      {/* ── Close one month now ───────────────────────────────────────── */}
      <section className="rounded-2xl border border-[hsl(var(--border-default))] p-4">
        <h2 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t('accounting.monthEnd.nowTitle')}
        </h2>
        <p className="mt-1 text-sm text-[hsl(var(--fg-secondary))]">
          {date(lastMonth.from)} — {date(lastMonth.to)}
        </p>
        <p className="mt-1 text-xs text-[hsl(var(--fg-tertiary))]">
          {t('accounting.monthEnd.steps')}
        </p>
        <Button
          type="button"
          className="mt-3"
          disabled={!hasYearEnd || run.isPending}
          loading={run.isPending}
          onClick={() =>
            run.mutate(
              {
                fromDate: lastMonth.from,
                toDate: lastMonth.to,
                fiscalYearEnd: lastMonth.to.slice(5, 10),
                closesYear: lastMonth.month === yearEnd,
                lock,
              },
              { onSuccess: setResult, onError: (error) => say(error, 'runFailed') },
            )
          }
        >
          {t('accounting.monthEnd.run')}
        </Button>
        {!hasYearEnd ? (
          <p className="mt-2 text-xs text-[hsl(var(--color-warning))]">
            {t('accounting.monthEnd.needYearEnd')}
          </p>
        ) : null}

        {result ? (
          <div className="mt-4 space-y-2" role="status">
            {/* «Locked» is said on its own: a run can finish without sealing. */}
            <p
              className={cn(
                'text-sm font-medium',
                result.failedAt
                  ? 'text-[hsl(var(--color-destructive))]'
                  : 'text-[hsl(var(--color-success))]',
              )}
            >
              {result.failedAt
                ? t('accounting.monthEnd.stopped')
                : result.locked
                  ? t('accounting.monthEnd.doneLocked')
                  : t('accounting.monthEnd.doneOpen')}
            </p>
            <ul className="space-y-1 text-xs">
              {result.outcomes.map((outcome) => (
                <li
                  key={outcome.step}
                  className="flex flex-wrap items-baseline justify-between gap-2"
                >
                  <span className="text-[hsl(var(--fg-primary))]">
                    {t(`accounting.monthEnd.step.${outcome.step}` as Parameters<typeof t>[0])}
                  </span>
                  <span className={cn('font-medium', statusTone[outcome.status])}>
                    {t(`accounting.monthEnd.status.${outcome.status}` as Parameters<typeof t>[0])}
                    {outcome.detail ? (
                      <span className="ms-2 font-normal text-[hsl(var(--fg-secondary))]" dir="ltr">
                        {outcome.detail}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* ── Close every month automatically ──────────────────────────── */}
      <section className="rounded-2xl border border-[hsl(var(--border-default))] p-4">
        <h2 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t('accounting.monthEnd.autoTitle')}
        </h2>
        {automations.isLoading ? (
          <div className="mt-3 h-9 w-56 animate-pulse rounded-lg bg-[hsl(var(--surface-muted))]" />
        ) : automations.error ? (
          // A failed read is a failure — not «automatic closing is off».
          <p role="alert" className="mt-2 text-sm text-[hsl(var(--color-destructive))]">
            {t('accounting.monthEnd.autoLoadFailed')}
          </p>
        ) : automatic ? (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-[hsl(var(--fg-secondary))]">
              {automatic.enabled
                ? t('accounting.monthEnd.autoOn')
                : t('accounting.monthEnd.autoStopped')}
              {automatic.monthEnd && automatic.monthEnd.fiscalYearEndMonth >= 1 ? (
                <>
                  {' · '}
                  {t('accounting.monthEnd.yearEndIs')}{' '}
                  {monthNames[automatic.monthEnd.fiscalYearEndMonth - 1]}
                </>
              ) : null}
              {automatic.nextRunOn ? (
                <>
                  {' · '}
                  {t('accounting.monthEnd.next')} {date(automatic.nextRunOn)}
                </>
              ) : null}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={removeAutomatic.isPending}
              onClick={() =>
                removeAutomatic.mutate(automatic.id, {
                  onError: (error) => say(error, 'saveFailed'),
                })
              }
            >
              {t('accounting.monthEnd.autoTurnOff')}
            </Button>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-[hsl(var(--fg-secondary))]">
              {t('accounting.monthEnd.autoOff')}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasYearEnd || createAutomatic.isPending}
              loading={createAutomatic.isPending}
              onClick={() =>
                createAutomatic.mutate(
                  { calendar, fiscalYearEndMonth: yearEnd, lock },
                  {
                    onSuccess: () => toast.success(t('accounting.monthEnd.autoSaved')),
                    onError: (error) => say(error, 'saveFailed'),
                  },
                )
              }
            >
              {t('accounting.monthEnd.autoTurnOn')}
            </Button>
          </div>
        )}
      </section>
    </div>
  )
})

MonthEndTab.displayName = 'MonthEndTab'
