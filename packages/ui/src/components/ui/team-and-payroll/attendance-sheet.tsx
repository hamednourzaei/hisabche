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
//
// The employee's NAME is a link to their file; the day lives in the address
// (`?date=`), so Back returns to the same day. Beside each row: the employee's
// personal link (share), and — when they have sent something nobody has decided
// — a marker that opens it.
// ⚠️ A PENDING REQUEST IS NOT A RECORD. It has its own number above the table
// and never counts as «present».
// ============================================

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Share2 } from 'lucide-react'
import { formatNumber } from '@hisabche/formatting'
import {
  apiErrorMessage,
  useAttendanceSheet,
  useAttendanceSubmissions,
  useMarkAttendance,
  useWorkShifts,
  type AttendanceMarkStatus,
  type AttendanceSheetRow,
} from '@hisabche/api'
import { localizePath } from '@hisabche/ui-contract'

import { cn } from '../../../lib/utils'
import { useAddressDay } from '../../../hooks/use-address-day'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { useRouteLang } from '../../../hooks/use-locale-push'
import { Button } from '../button'
import { GHOST_ICON_BUTTON } from '../button-classes'
import { JalaliDatePicker } from '../jalali-datepicker'
import { SelectField } from '../select-field'
import { DataTable, TableFilterSelect, matchesSearch, type TableColumn } from '../data-table'
import { AttendanceDevices } from './attendance-devices'
import { AttendanceLinkDialog } from './attendance-link-dialog'
import { AttendanceSubmissionsDialog } from './attendance-submissions-dialog'
import { ShiftManager } from './shift-manager'
import { ShiftPlan } from './shift-plan'

/** Server refusals with a translation. Anything else gets the general message. */
export const ATTENDANCE_ERROR_CODES = [
  'ATTENDANCE_TIME_INVALID',
  'ATTENDANCE_CHECK_OUT_WITHOUT_CHECK_IN',
  'ATTENDANCE_CHECK_OUT_BEFORE_CHECK_IN',
  'ATTENDANCE_NIGHT_NOT_CONFIGURED',
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
  const lang = useRouteLang()
  // In the address, so the way back from an employee's file is the same day.
  const [date, setDate] = useAddressDay()
  const sheet = useAttendanceSheet(date)
  // Read beside the sheet and never in its way: before attendance-self-01 is
  // run this answers «not configured», and a failure here leaves the sheet as
  // it is — the share button says why when it is opened.
  const sent = useAttendanceSubmissions(date)
  const pendingOf = (employeeId: string) =>
    (sent.data?.pending ?? []).filter((submission) => submission.employeeId === employeeId)
  const cameFromLink = (employeeId: string) => (sent.data?.fromLink ?? []).includes(employeeId)
  const cameFromDevice = (employeeId: string) => (sent.data?.fromDevice ?? []).includes(employeeId)
  const [linkFor, setLinkFor] = useState<{ id: string; name: string } | null>(null)
  const [reviewing, setReviewing] = useState<string | null>(null)
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
    /** The exit is on the day after. Only ever passed from a control that says so. */
    endsNextDay = false,
  ) => {
    setFailedFor(null)
    mark.mutate(
      {
        employeeId: row.employeeId,
        date,
        status,
        checkIn,
        checkOut,
        endsNextDay,
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
  // `HH:MM` compares as text. An exit earlier than the arrival is either a
  // typing error or a night — and only a person can say which.
  const endsEarlier = (checkIn: string, checkOut: string) =>
    checkIn !== '' && checkOut !== '' && checkOut < checkIn
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
          {/* Only the name navigates; nothing else in the row does. */}
          <Link
            href={localizePath(`/team-and-payroll/${row.employeeId}`, lang)}
            aria-label={t('openFile', { name: row.name })}
            data-employee-file
            className="rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary)/0.5)]"
          >
            {row.name || '—'}
          </Link>
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
            {row.record && cameFromLink(row.employeeId) ? (
              <span data-from-link className="block text-[hsl(var(--fg-tertiary))]">
                {t('fromLink')}
              </span>
            ) : null}
            {row.record && cameFromDevice(row.employeeId) ? (
              <span data-from-device className="block text-[hsl(var(--fg-tertiary))]">
                {t('fromDevice')}
              </span>
            ) : null}
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
      id: 'night',
      labelKey: 'attendance.nightColumn',
      labelFallback: t('nightColumn'),
      showFrom: 'md',
      sortValue: (row) => (row.record?.endsNextDay ? 1 : 0),
      render: (row) =>
        row.record?.endsNextDay ? (
          <span data-ends-next-day className="text-xs text-[hsl(var(--fg-secondary))]">
            {t('endsNextDay')}
          </span>
        ) : (
          ''
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
        const waiting = pendingOf(row.employeeId).length
        return (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {waiting > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  data-pending-submissions
                  onClick={() => setReviewing(row.employeeId)}
                >
                  {t('submissions.pendingCount', { count: formatNumber(waiting, locale, 0) })}
                </Button>
              ) : null}
              {atWork(row) ? (
                <>
                  {shift && !record ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        submit(
                          row,
                          'present',
                          shift.startsAt,
                          shift.endsAt,
                          // A shift defined across midnight is a night by definition.
                          endsEarlier(shift.startsAt, shift.endsAt),
                        )
                      }
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
                    endsEarlier(checkIn, checkOut) ? (
                      // Saved as typed it would be refused as a mistake. The
                      // button names the other reading, and a person presses it.
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        data-save-night
                        onClick={() => submit(row, 'present', checkIn, checkOut, true)}
                      >
                        {t('saveAsNight')}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => submit(row, 'present', checkIn, checkOut || null)}
                      >
                        {t('saveTimes')}
                      </Button>
                    )
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
              <button
                type="button"
                data-share-attendance-link
                aria-label={t('link.open', { name: row.name })}
                title={t('link.open', { name: row.name })}
                onClick={() => setLinkFor({ id: row.employeeId, name: row.name })}
                className={GHOST_ICON_BUTTON}
              >
                <Share2 className="size-4" aria-hidden="true" />
              </button>
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
            {/* Requests, not records: shown only when there are some, and never
                added to «present». */}
            {(sent.data?.pending.length ?? 0) > 0 ? (
              <div className={cn(card, 'p-3')} data-pending-summary>
                <dt className="text-xs text-[hsl(var(--fg-secondary))]">
                  {t('submissions.summary')}
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[hsl(var(--color-warning))]">
                  {formatNumber(sent.data?.pending.length ?? 0, locale, 0)}
                </dd>
              </div>
            ) : null}
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

      {/* Fingerprint / face / card terminals that write onto this sheet. */}
      <AttendanceDevices
        employees={(sheet.data?.rows ?? []).map((row) => ({ id: row.employeeId, name: row.name }))}
      />

      <AttendanceLinkDialog employee={linkFor} onClose={() => setLinkFor(null)} />
      {(() => {
        const row = (sheet.data?.rows ?? []).find((item) => item.employeeId === reviewing)
        return (
          <AttendanceSubmissionsDialog
            employee={row ? { id: row.employeeId, name: row.name } : null}
            date={date}
            record={row?.record ?? null}
            submissions={row ? pendingOf(row.employeeId) : []}
            onClose={() => setReviewing(null)}
          />
        )
      })()}
    </div>
  )
}
