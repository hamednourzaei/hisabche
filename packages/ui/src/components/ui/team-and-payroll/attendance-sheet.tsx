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
import { ShiftManager } from './shift-manager'

/** Server refusals with a translation. Anything else gets the general message. */
export const ATTENDANCE_ERROR_CODES = [
  'ATTENDANCE_TIME_INVALID',
  'ATTENDANCE_CHECK_OUT_WITHOUT_CHECK_IN',
  'ATTENDANCE_CHECK_OUT_BEFORE_CHECK_IN',
] as const
export const ATTENDANCE_STATUSES = ['present', 'absent', 'leave', 'holiday', 'open'] as const

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'
const th = 'px-3 py-2.5 text-start text-xs font-medium text-[hsl(var(--fg-secondary))]'
const td = 'px-3 py-2.5 text-sm text-[hsl(var(--fg-primary))]'
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
      { onError: () => setFailedFor(row.employeeId) },
    )
  }

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

          <div className={cn(card, 'overflow-x-auto')}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                  <th className={th}>{t('employee')}</th>
                  <th className={th}>{t('status')}</th>
                  <th className={th}>{t('checkIn')}</th>
                  <th className={th}>{t('checkOut')}</th>
                  <th className={th}>{t('hours')}</th>
                  <th className={th}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sheet.data.rows.map((row) => (
                  <SheetLine
                    key={`${row.employeeId}-${row.record?.checkIn ?? ''}-${row.record?.checkOut ?? ''}`}
                    row={row}
                    busy={mark.isPending && mark.variables?.employeeId === row.employeeId}
                    error={failedFor === row.employeeId && mark.error ? failure(mark.error) : null}
                    onSubmit={submit}
                    shift={shift ? { startsAt: shift.startsAt, endsAt: shift.endsAt } : null}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('note')}</p>
        </>
      )}

      <ShiftManager />
    </div>
  )
}

function SheetLine({
  row,
  busy,
  error,
  onSubmit,
  shift,
}: {
  row: AttendanceSheetRow
  busy: boolean
  error: string | null
  /** The shift picked above the table; null = none picked. */
  shift: { startsAt: string; endsAt: string } | null
  onSubmit: (
    row: AttendanceSheetRow,
    status: AttendanceMarkStatus,
    checkIn: string | null,
    checkOut: string | null,
  ) => void
}) {
  const t = useTranslations('attendance')
  const locale = useIntlLocale()
  const record = row.record
  const [checkIn, setCheckIn] = useState(record?.checkIn ?? '')
  const [checkOut, setCheckOut] = useState(record?.checkOut ?? '')

  const status = record?.status
  const known = !!status && (ATTENDANCE_STATUSES as readonly string[]).includes(status)
  const atWork = !record || status === 'present' || status === 'open'

  return (
    <>
      <tr className="border-b border-[hsl(var(--border-default))]">
        <td className={td}>
          <span className="font-medium">{row.name || '—'}</span>
          {row.position ? (
            <span className="block text-xs text-[hsl(var(--fg-tertiary))]">{row.position}</span>
          ) : null}
        </td>
        <td className={cn(td, 'text-xs')}>
          {!record ? (
            <span className="text-[hsl(var(--fg-tertiary))]">{t('notRecorded')}</span>
          ) : record.result.isOpen ? (
            <span className="font-medium text-[hsl(var(--color-warning))]">{t('stillIn')}</span>
          ) : (
            <span className="font-medium">{known ? t(`statuses.${status}`) : status}</span>
          )}
        </td>
        <td className={td}>
          {atWork ? (
            <input
              type="time"
              name="checkIn"
              aria-label={t('checkIn')}
              value={checkIn}
              onChange={(event) => setCheckIn(event.target.value)}
              className={timeInput}
            />
          ) : (
            '—'
          )}
        </td>
        <td className={td}>
          {atWork ? (
            <input
              type="time"
              name="checkOut"
              aria-label={t('checkOut')}
              value={checkOut}
              onChange={(event) => setCheckOut(event.target.value)}
              className={timeInput}
            />
          ) : (
            '—'
          )}
        </td>
        <td className={cn(td, 'tabular-nums')}>
          {!record
            ? '—'
            : record.result.workedHours === null
              ? // No hours to vouch for yet: said in words, never shown as 0.
                record.result.isOpen
                ? t('stillIn')
                : '—'
              : formatNumber(record.result.workedHours, locale, 2)}
        </td>
        <td className={td}>
          <div className="flex flex-wrap gap-1.5">
            {atWork ? (
              <>
                {shift && !record ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onSubmit(row, 'present', shift.startsAt, shift.endsAt)}
                  >
                    {t('byShift')}
                  </Button>
                ) : null}
                {!record?.checkIn && !checkIn ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => onSubmit(row, 'present', nowHHMM(), null)}
                  >
                    {t('checkInNow')}
                  </Button>
                ) : null}
                {record?.result.isOpen && !checkOut ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => onSubmit(row, 'present', record.checkIn, nowHHMM())}
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
                    onClick={() => onSubmit(row, 'present', checkIn, checkOut || null)}
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
                onClick={() => onSubmit(row, 'present', null, null)}
              >
                {t('markPresent')}
              </Button>
            )}
            {status !== 'leave' ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => onSubmit(row, 'leave', null, null)}
              >
                {t('markLeave')}
              </Button>
            ) : null}
            {status !== 'absent' ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => onSubmit(row, 'absent', null, null)}
              >
                {t('markAbsent')}
              </Button>
            ) : null}
          </div>
        </td>
      </tr>
      {error ? (
        <tr>
          <td
            colSpan={6}
            role="alert"
            className="px-3 pb-2 text-xs text-[hsl(var(--color-destructive))]"
          >
            {error}
          </td>
        </tr>
      ) : null}
    </>
  )
}
