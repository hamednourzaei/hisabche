'use client'

// ============================================
// «حضور و غیاب» — the daily sheet (#100).
//
// One day, every employee, one row each. The row says what was recorded and
// offers the next thing a person would do: check in, check out, or mark leave
// or absence.
//
// ⚠️ «ثبت‌نشده» IS ITS OWN STATE. An employee nobody has marked is not absent.
// ⚠️ AN OPEN DAY HAS NO HOURS — the cell says «هنوز خارج نشده», never 0.
// ⚠️ Attendance does not change anybody's pay; the note under the table says so.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatNumber, toIsoDay } from '@hisabche/formatting'
import {
  apiErrorMessage,
  useAttendanceSheet,
  useMarkAttendance,
  useWorkShifts,
  type AttendanceMarkStatus,
  type AttendanceSheetRow,
} from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { Button } from '../button'
import { JalaliDatePicker } from '../jalali-datepicker'
import { SelectField } from '../select-field'
import { DataTable, TableFilterSelect, matchesSearch, type TableColumn } from '../data-table'
import { ShiftManager } from './shift-manager'
import { ShiftPlan } from './shift-plan'

/** Server refusals with a translation. Anything else gets the general message. */
export const ATTENDANCE_ERROR_CODES = [
  'ATTENDANCE_TIME_INVALID',
  'ATTENDANCE_CHECK_OUT_WITHOUT_CHECK_IN',
  'ATTENDANCE_CHECK_OUT_BEFORE_CHECK_IN',
] as const
export const ATTENDANCE_STATUSES = ['present', 'absent', 'leave', 'holiday', 'open'] as const
/** The filter value for «nobody recorded this person yet». Never a status. */
const NOT_RECORDED = 'none'

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'
const timeInput =
  'h-9 w-24 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-2 text-sm tabular-nums'

/** The device's clock as HH:MM — the shop's own local time, which is what a check-in is. */
const nowHHMM = () => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export function AttendanceSheet() {
  const t = useTranslations('attendance')
  const locale = useIntlLocale()
  const [date, setDate] = useState(() => toIsoDay(new Date()))
  const sheet = useAttendanceSheet(date)
  const mark = useMarkAttendance()
  const [failedFor, setFailedFor] = useState<string | null>(null)
  // The shift a day is recorded by. A failed or not-yet-set-up read simply
  // offers no shift; the sheet itself works without one.
  const shifts = useWorkShifts()
  const activeShifts = (shifts.data ?? []).filter((shift) => shift.isActive)
  const [shiftId, setShiftId] = useState('')
  const shift = activeShifts.find((candidate) => candidate.id === shiftId) ?? null

  const failure = (error: unknown): string => {
    const raw = apiErrorMessage(error, '')
    const code = ATTENDANCE_ERROR_CODES.find((known) => raw.includes(known))
    return code ? t(`errors.${code}`) : t('errors.general')
  }

  const submit = (
    row: AttendanceSheetRow,
    status: AttendanceMarkStatus,
    checkIn: string | null,
    checkOut: string | null,
  ) => {
    setFailedFor(null)
    mark.mutate(
      {
        employeeId: row.employeeId,
        date,
        status,
        checkIn,
        checkOut,
        note: row.record?.note ?? null,
      },
      {
        onError: () => setFailedFor(row.employeeId),
        onSuccess: () =>
          setDrafts((current) => {
            const next = { ...current }
            delete next[`${date}|${row.employeeId}`]
            return next
          }),
      },
    )
  }

  // The shared table speaks in whole keys with a fallback.
  const translate = useTranslations()
  const tableT = (key: string, fallback?: string): string => {
    const value = translate(key as never)
    return value && value !== key ? value : (fallback ?? key)
  }
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Times being typed, per employee. Absent = what is recorded. Cleared when
  // the day changes or the row is saved, so a draft never outlives its record.
  const [drafts, setDrafts] = useState<Record<string, { checkIn: string; checkOut: string }>>({})
  // Keyed by day too: a time typed for Monday is not Tuesday's.
  const draftKey = (row: AttendanceSheetRow) => `${date}|${row.employeeId}`
  const timesOf = (row: AttendanceSheetRow) =>
    drafts[draftKey(row)] ?? {
      checkIn: row.record?.checkIn ?? '',
      checkOut: row.record?.checkOut ?? '',
    }
  const setTime = (row: AttendanceSheetRow, field: 'checkIn' | 'checkOut', value: string) =>
    setDrafts((current) => ({ ...current, [draftKey(row)]: { ...timesOf(row), [field]: value } }))
  const atWork = (row: AttendanceSheetRow) =>
    !row.record || row.record.status === 'present' || row.record.status === 'open'
  const busyFor = (row: AttendanceSheetRow) =>
    mark.isPending && mark.variables?.employeeId === row.employeeId

  const rows = (sheet.data?.rows ?? [])
    .filter((row) =>
      statusFilter === 'all'
        ? true
        : statusFilter === NOT_RECORDED
          ? !row.record
          : row.record?.status === statusFilter,
    )
    .filter((row) => matchesSearch(search, [row.name, row.position ?? '']))

  const columns: TableColumn<AttendanceSheetRow>[] = [
    {
      id: 'employee',
      labelKey: 'attendance.employee',
      labelFallback: t('employee'),
      locked: true,
      sortValue: (row) => row.name,
      render: (row) => (
        <>
          <span className="font-medium">{row.name || '—'}</span>
          {row.position ? (
            <span className="block text-xs text-[hsl(var(--fg-tertiary))]">{row.position}</span>
          ) : null}
        </>
      ),
    },
    {
      id: 'status',
      labelKey: 'attendance.status',
      labelFallback: t('status'),
      sortValue: (row) => row.record?.status ?? '',
      render: (row) => {
        const status = row.record?.status
        const known = !!status && (ATTENDANCE_STATUSES as readonly string[]).includes(status)
        return (
          <span className="text-xs">
            {!row.record ? (
              <span className="text-[hsl(var(--fg-tertiary))]">{t('notRecorded')}</span>
            ) : row.record.result.isOpen ? (
              <span className="font-medium text-[hsl(var(--color-warning))]">{t('stillIn')}</span>
            ) : (
              <span className="font-medium">{known ? t(`statuses.${status}`) : status}</span>
            )}
          </span>
        )
      },
    },
    {
      id: 'checkIn',
      labelKey: 'attendance.checkIn',
      labelFallback: t('checkIn'),
      sortValue: (row) => row.record?.checkIn ?? '',
      render: (row) =>
        atWork(row) ? (
          <input
            type="time"
            name="checkIn"
            aria-label={t('checkIn')}
            value={timesOf(row).checkIn}
            onChange={(event) => setTime(row, 'checkIn', event.target.value)}
            className={timeInput}
          />
        ) : (
          '—'
        ),
    },
    {
      id: 'checkOut',
      labelKey: 'attendance.checkOut',
      labelFallback: t('checkOut'),
      sortValue: (row) => row.record?.checkOut ?? '',
      render: (row) =>
        atWork(row) ? (
          <input
            type="time"
            name="checkOut"
            aria-label={t('checkOut')}
            value={timesOf(row).checkOut}
            onChange={(event) => setTime(row, 'checkOut', event.target.value)}
            className={timeInput}
          />
        ) : (
          '—'
        ),
    },
    {
      id: 'hours',
      labelKey: 'attendance.hours',
      labelFallback: t('hours'),
      align: 'end',
      showFrom: 'md',
      sortValue: (row) => row.record?.result.workedHours ?? null,
      render: (row) => (
        <span className="tabular-nums">
          {!row.record
            ? '—'
            : row.record.result.workedHours === null
              ? // No hours to vouch for yet: said in words, never shown as 0.
                row.record.result.isOpen
                ? t('stillIn')
                : '—'
              : formatNumber(row.record.result.workedHours, locale, 2)}
        </span>
      ),
    },
    {
      id: 'actions',
      labelKey: 'attendance.actions',
      labelFallback: t('actions'),
      locked: true,
      render: (row) => {
        const record = row.record
        const status = record?.status
        const busy = busyFor(row)
        const { checkIn, checkOut } = timesOf(row)
        return (
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1.5">
              {atWork(row) ? (
                <>
                  {shift && !record ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => submit(row, 'present', shift.startsAt, shift.endsAt)}
                    >
                      {t('byShift')}
                    </Button>
                  ) : null}
                  {!record?.checkIn && !checkIn ? (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => submit(row, 'present', nowHHMM(), null)}
                    >
                      {t('checkInNow')}
                    </Button>
                  ) : null}
                  {record?.result.isOpen && !checkOut ? (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => submit(row, 'present', record.checkIn, nowHHMM())}
                    >
                      {t('checkOutNow')}
                    </Button>
                  ) : null}
                  {checkIn &&
                  (checkIn !== (record?.checkIn ?? '') || checkOut !== (record?.checkOut ?? '')) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => submit(row, 'present', checkIn, checkOut || null)}
                    >
                      {t('saveTimes')}
                    </Button>
                  ) : null}
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => submit(row, 'present', null, null)}
                >
                  {t('markPresent')}
                </Button>
              )}
              {status !== 'leave' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => submit(row, 'leave', null, null)}
                >
                  {t('markLeave')}
                </Button>
              ) : null}
              {status !== 'absent' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => submit(row, 'absent', null, null)}
                >
                  {t('markAbsent')}
                </Button>
              ) : null}
            </div>
            {failedFor === row.employeeId && mark.error ? (
              <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
                {failure(mark.error)}
              </p>
            ) : null}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <span className="block text-xs text-[hsl(var(--fg-secondary))]">{t('date')}</span>
          <JalaliDatePicker
            value={date}
            onChange={(next) => next && setDate(next)}
            className="w-40"
          />
        </div>
        {activeShifts.length > 0 ? (
          <div className="space-y-1">
            <span className="block text-xs text-[hsl(var(--fg-secondary))]">
              {t('shiftPicker')}
            </span>
            <SelectField
              name="shift"
              aria-label={t('shiftPicker')}
              value={shiftId}
              onChange={setShiftId}
              placeholder={t('shiftNone')}
              options={activeShifts.map((option) => ({
                value: option.id,
                label: `${option.name} (${option.startsAt}–${option.endsAt})`,
              }))}
              className="h-10 w-56 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-sm"
            />
          </div>
        ) : null}
      </div>

      {sheet.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
          ))}
        </div>
      ) : sheet.error || !sheet.data ? (
        <p role="alert" className={cn(card, 'p-4 text-sm text-[hsl(var(--color-destructive))]')}>
          {(sheet.error as { response?: { status?: number } } | null)?.response?.status === 403
            ? t('forbidden')
            : t('loadFailed')}
        </p>
      ) : sheet.data.rows.length === 0 ? (
        <p className={cn(card, 'p-6 text-center text-sm text-[hsl(var(--fg-secondary))]')}>
          {t('noEmployees')}
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {(
              [
                ['present', sheet.data.summary.present],
                ['absent', sheet.data.summary.absent],
                ['leave', sheet.data.summary.leave],
                ['stillIn', sheet.data.summary.open],
                ['notRecorded', sheet.data.summary.employees - sheet.data.summary.recorded],
              ] as const
            ).map(([key, value]) => (
              <div key={key} className={cn(card, 'p-3')}>
                <dt className="text-xs text-[hsl(var(--fg-secondary))]">{t(`summary.${key}`)}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
                  {formatNumber(value, locale, 0)}
                </dd>
              </div>
            ))}
          </dl>

          {/* The shared table: search, saved views, column settings, and a
              status filter in its own toolbar. Each row still records in place. */}
          <DataTable
            tableId="attendance-sheet"
            t={tableT}
            rows={rows}
            columns={columns}
            rowKey={(row) => row.employeeId}
            searchValue={search}
            onSearchChange={setSearch}
            actions={
              <TableFilterSelect
                label={t('status')}
                value={statusFilter}
                onChange={setStatusFilter}
                allValue="all"
                options={[
                  { value: 'all', label: tableT('common.all', 'همه') },
                  { value: NOT_RECORDED, label: t('notRecorded') },
                  ...ATTENDANCE_STATUSES.map((status) => ({
                    value: status as string,
                    label: t(`statuses.${status}`),
                  })),
                ]}
              />
            }
            minWidthClass="min-w-[640px]"
            emptyState={
              <p className="p-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
                {t('noMatch')}
              </p>
            }
          />
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('note')}</p>
        </>
      )}

      {/* Who is planned for this day, beside what was recorded (#101). */}
      <ShiftPlan date={date} employees={sheet.data?.rows ?? []} shifts={activeShifts} />

      <ShiftManager />
    </div>
  )
}
