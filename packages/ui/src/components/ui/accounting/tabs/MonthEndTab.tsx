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
import { formatNumber, toIsoDay } from '@hisabche/formatting'
import { addIsoDays, calendarDay, monthBounds, type ScheduleCalendar } from '@hisabche/validation'
import {
  apiErrorMessage,
  useAutomations,
  useCreateMonthEndAutomation,
  useRemoveAutomation,
  useUpdateAutomation,
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

/** The runner looks every five minutes, so a minute is offered in fives. */
export const RUN_MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] as const

/**
 * The months an automatic close may START in: this one and the next thirteen,
 * each with its own first ISO day, in the reader's calendar.
 */
export function startMonths(
  today: string,
  calendar: ScheduleCalendar,
): Array<{ year: number; month: number; from: string }> {
  const months: Array<{ year: number; month: number; from: string }> = []
  let cursor = monthBounds(today, calendar)
  for (let index = 0; index < 14; index += 1) {
    const { year, month } = calendarDay(cursor.from, calendar)
    months.push({ year, month, from: cursor.from })
    cursor = monthBounds(addIsoDays(cursor.to, 1), calendar)
  }
  return months
}

const two = (value: number) => String(value).padStart(2, '0')

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

  // ── When the automatic close runs: month, year, day, hour, minute ──
  // Starts on the 1st of next month at 00:00 — what «automatic» has always
  // meant here — until the person says otherwise.
  const months = useMemo(() => startMonths(today, calendar), [today, calendar])
  const next = months[1] ?? months[0]
  const [runMonth, setRunMonth] = useState(() => String(next?.month ?? 1))
  const [runYear, setRunYear] = useState(() => String(next?.year ?? ''))
  const [runDay, setRunDay] = useState('1')
  const [runHour, setRunHour] = useState('0')
  const [runMinute, setRunMinute] = useState('0')
  const years = useMemo(() => [...new Set(months.map((entry) => entry.year))], [months])
  // The first ISO day of the chosen month; undefined when that month is past.
  const runFrom = months.find(
    (entry) => entry.year === Number(runYear) && entry.month === Number(runMonth),
  )?.from
  const [lock, setLock] = useState(true)
  const [result, setResult] = useState<MonthEndResult | null>(null)

  const run = useRunMonthEnd()
  const automations = useAutomations()
  const createAutomatic = useCreateMonthEndAutomation()
  const removeAutomatic = useRemoveAutomation()
  const updateAutomatic = useUpdateAutomation()

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

        {/* ── When the automatic close runs — one horizontal row ── */}
        <h3 className="pt-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t('accounting.monthEnd.scheduleTitle')}
        </h3>
        <div className="flex flex-nowrap items-end gap-2 overflow-x-auto pb-1" data-run-schedule="">
          <div className="w-36 shrink-0">
            <span className="mb-1 block text-xs text-[hsl(var(--fg-secondary))]">
              {t('accounting.monthEnd.month')}
            </span>
            <SelectField
              name="runMonth"
              aria-label={t('accounting.monthEnd.month')}
              value={runMonth}
              onChange={setRunMonth}
              options={monthNames.map((name, index) => ({ value: String(index + 1), label: name }))}
            />
          </div>
          <div className="w-28 shrink-0">
            <span className="mb-1 block text-xs text-[hsl(var(--fg-secondary))]">
              {t('accounting.monthEnd.year')}
            </span>
            <SelectField
              name="runYear"
              aria-label={t('accounting.monthEnd.year')}
              value={runYear}
              onChange={setRunYear}
              options={years.map((year) => ({
                value: String(year),
                label: new Intl.NumberFormat(locale, { useGrouping: false }).format(year),
              }))}
            />
          </div>
          <div className="w-24 shrink-0">
            <span className="mb-1 block text-xs text-[hsl(var(--fg-secondary))]">
              {t('accounting.monthEnd.day')}
            </span>
            <SelectField
              name="dayOfMonth"
              aria-label={t('accounting.monthEnd.day')}
              value={runDay}
              onChange={setRunDay}
              options={Array.from({ length: 31 }, (_, index) => ({
                value: String(index + 1),
                label: formatNumber(index + 1, locale, 0),
              }))}
            />
          </div>
          <div className="w-24 shrink-0">
            <span className="mb-1 block text-xs text-[hsl(var(--fg-secondary))]">
              {t('accounting.monthEnd.hour')}
            </span>
            <SelectField
              name="runHour"
              aria-label={t('accounting.monthEnd.hour')}
              value={runHour}
              onChange={setRunHour}
              options={Array.from({ length: 24 }, (_, hour) => ({
                value: String(hour),
                label: two(hour),
              }))}
            />
          </div>
          <div className="w-24 shrink-0">
            <span className="mb-1 block text-xs text-[hsl(var(--fg-secondary))]">
              {t('accounting.monthEnd.minute')}
            </span>
            <SelectField
              name="runMinute"
              aria-label={t('accounting.monthEnd.minute')}
              value={runMinute}
              onChange={setRunMinute}
              options={RUN_MINUTES.map((minute) => ({ value: String(minute), label: two(minute) }))}
            />
          </div>
        </div>
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {runFrom ? t('accounting.monthEnd.scheduleHint') : t('accounting.monthEnd.schedulePast')}
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
              {automatic.cadence.kind === 'monthly' && automatic.cadence.atMinute !== undefined ? (
                <>
                  {' · '}
                  {t('accounting.monthEnd.runsAt')}{' '}
                  <span dir="ltr" className="tabular-nums">
                    {two(Math.floor(automatic.cadence.atMinute / 60))}:
                    {two(automatic.cadence.atMinute % 60)}
                  </span>
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
            {/* An automatic close that is already on takes the new time in place —
                no need to turn it off and on again. */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ms-2"
              disabled={!runFrom || updateAutomatic.isPending}
              loading={updateAutomatic.isPending}
              onClick={() =>
                updateAutomatic.mutate(
                  {
                    id: automatic.id,
                    cadence: {
                      kind: 'monthly',
                      calendar,
                      dayOfMonth: Number(runDay),
                      from: runFrom ?? today,
                      atMinute: Number(runHour) * 60 + Number(runMinute),
                      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    },
                  },
                  {
                    onSuccess: () => toast.success(t('accounting.monthEnd.scheduleSaved')),
                    onError: (error) => say(error, 'saveFailed'),
                  },
                )
              }
            >
              {t('accounting.monthEnd.scheduleSave')}
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
              disabled={!hasYearEnd || !runFrom || createAutomatic.isPending}
              loading={createAutomatic.isPending}
              onClick={() =>
                createAutomatic.mutate(
                  {
                    calendar,
                    fiscalYearEndMonth: yearEnd,
                    lock,
                    dayOfMonth: Number(runDay),
                    ...(runFrom ? { from: runFrom } : {}),
                    atMinute: Number(runHour) * 60 + Number(runMinute),
                    // The time is the person's own clock: the zone of this device.
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  },
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
