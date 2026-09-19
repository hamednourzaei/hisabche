'use client'

// ============================================
// Request #99 — «یک دکمه که میزان روزهای مرخصی کارمند را بشه اضافه کرد: چند
// روز، به چه دلیل، و از چه تاریخی تا چه تاریخی».
//
// Writes to the `leaves` table through `POST /api/leaves`, which already
// resolves the branch from the employee's assignment on the start date and
// files an audit entry. Nothing new is modelled here (G2).
// ============================================

import { memo, useCallback, useMemo, useState } from 'react'
import { CalendarDays, Plus, X } from 'lucide-react'
import { useCreateLeave, useLeaves, type LeaveType } from '@hisabche/api'

import { JalaliDatePicker } from '../jalali-datepicker'
import { Switch } from '../switch'
import { SelectField } from '../select-field'
import { cn } from '../../../lib/utils'

const LEAVE_TYPES: Array<{ value: LeaveType; labelKey: string; fallback: string }> = [
  { value: 'annual', labelKey: 'hr.leaveAnnual', fallback: 'مرخصی استحقاقی' },
  { value: 'sick', labelKey: 'hr.leaveSick', fallback: 'استعلاجی' },
  { value: 'unpaid', labelKey: 'hr.leaveUnpaid', fallback: 'بدون حقوق' },
  { value: 'maternity', labelKey: 'hr.leaveMaternity', fallback: 'زایمان' },
  { value: 'paternity', labelKey: 'hr.leavePaternity', fallback: 'پدری' },
  { value: 'bereavement', labelKey: 'hr.leaveBereavement', fallback: 'فوت بستگان' },
  { value: 'other', labelKey: 'hr.leaveOther', fallback: 'سایر' },
]

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]',
  approved: 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]',
  rejected: 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
  cancelled: 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]',
}

const FIELD =
  'rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]'

/**
 * Whole days, inclusive of both ends: 1st → 1st is one day off, not zero.
 * Returns null when either end is missing or the range runs backwards, so the
 * form can refuse rather than save a negative length.
 */
export function leaveDayCount(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null
  const start = Date.parse(startDate)
  const end = Date.parse(endDate)
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null
  return Math.round((end - start) / 86_400_000) + 1
}

/**
 * The last day of a leave of `days` days that starts on `startDate`.
 * Inclusive, so a 1-day leave ends the day it starts.
 *
 * ⚠️ Built from the ISO day string, never from `toISOString()` on a local
 * Date: at +04:30 that rolls the day over and the leave would end «tomorrow».
 */
export function endOfLeave(startDate: string, days: number): string {
  const start = new Date(`${startDate}T00:00:00`)
  start.setDate(start.getDate() + Math.max(1, Math.round(days)) - 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
}

export const EmployeeLeavePanel = memo(function EmployeeLeavePanel({
  t,
  employeeId,
}: {
  t: (key: string, fallback?: string) => string
  employeeId: string
}) {
  const { data: leaves = [], isLoading } = useLeaves(employeeId)
  const createLeave = useCreateLeave()

  const [open, setOpen] = useState(false)
  const [leaveType, setLeaveType] = useState<LeaveType>('annual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  /**
   * ⚠️ THE DAY COUNT IS THE FIRST FIELD, NOT THE LAST.
   *
   * It used to be derived from the range and rendered read-only, so recording
   * «سه روز مرخصی» meant first working out which two calendar days that was —
   * «نمی‌ذاره به اینپوت دسترسی داشته باشم». Now the count is typed directly and
   * the leave runs from today; the switch below is for when the exact days
   * matter. Either way ONE of them is derived from the other, so the stored
   * range and the stored `total_days` can never contradict each other.
   */
  const [dayInput, setDayInput] = useState('1')
  const [exactDates, setExactDates] = useState(false)

  const typedDays = Number(dayInput)
  const rangeDays = useMemo(() => leaveDayCount(startDate, endDate), [startDate, endDate])
  const days = exactDates
    ? rangeDays
    : Number.isFinite(typedDays) && typedDays > 0
      ? Math.round(typedDays)
      : null

  const today = useMemo(() => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  }, [])

  // What will actually be stored — shown to the user in both modes, so the
  // dates are never something the form decided behind their back.
  const effectiveStart = exactDates ? startDate : today
  const effectiveEnd = exactDates ? endDate : days === null ? '' : endOfLeave(today, days)

  const submit = useCallback(async () => {
    if (days === null || !effectiveStart || !effectiveEnd) {
      setError(
        exactDates
          ? t('hr.leaveRangeInvalid', 'تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.')
          : t('hr.leaveDaysInvalid', 'تعداد روز باید عددی بزرگ‌تر از صفر باشد.'),
      )
      return
    }
    setError(null)
    try {
      await createLeave.mutateAsync({
        employeeId,
        leaveType,
        startDate: effectiveStart,
        endDate: effectiveEnd,
        totalDays: days,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      })
      setOpen(false)
      setStartDate('')
      setEndDate('')
      setDayInput('1')
      setExactDates(false)
      setReason('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('hr.leaveSaveError', 'ثبت مرخصی انجام نشد.'))
    }
  }, [
    createLeave,
    days,
    effectiveEnd,
    effectiveStart,
    employeeId,
    exactDates,
    leaveType,
    reason,
    t,
  ])

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-[hsl(var(--color-primary))]" />
          <h2 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
            {t('hr.leaves', 'مرخصی‌ها')}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--color-primary))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--color-primary-fg))]"
        >
          {open ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          {t('hr.addLeave', 'ثبت مرخصی')}
        </button>
      </div>

      {open && (
        <div className="space-y-3 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('hr.leaveType', 'نوع مرخصی')}
              </span>
              <SelectField
                value={leaveType}
                onChange={(value) => setLeaveType(value as LeaveType)}
                options={LEAVE_TYPES.map((item) => ({
                  value: item.value,
                  label: t(item.labelKey, item.fallback),
                }))}
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('hr.leaveDays', 'تعداد روز')}
              </span>
              {exactDates ? (
                // With a range chosen, the count is what the range says — two
                // editable fields could disagree, and then «۳ روز» would sit on
                // a five-day span with payroll trusting whichever it read.
                <span
                  className={cn(
                    FIELD,
                    'tabular-nums',
                    rangeDays === null && 'text-[hsl(var(--fg-tertiary))]',
                  )}
                >
                  {rangeDays === null ? t('hr.leavePickRange', 'بازه را انتخاب کنید') : rangeDays}
                </span>
              ) : (
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={dayInput}
                  onChange={(e) => setDayInput(e.target.value)}
                  className={cn(FIELD, 'tabular-nums')}
                />
              )}
            </label>
          </div>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-[hsl(var(--fg-primary))]">
              {t('hr.leaveExactDates', 'مشخص کردن تاریخ دقیق')}
            </span>
            <Switch
              id="leave-exact-dates"
              checked={exactDates}
              onCheckedChange={(next) => {
                setExactDates(next)
                setError(null)
                if (!next) {
                  // Leaving exact mode: keep the length the user already chose
                  // rather than silently resetting it to one day.
                  if (rangeDays !== null) setDayInput(String(rangeDays))
                  setStartDate('')
                  setEndDate('')
                }
              }}
            />
          </label>

          {exactDates ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-[hsl(var(--fg-secondary))]">
                  {t('hr.leaveFrom', 'از تاریخ')}
                </span>
                <JalaliDatePicker value={startDate} onChange={setStartDate} />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-[hsl(var(--fg-secondary))]">
                  {t('hr.leaveTo', 'تا تاریخ')}
                </span>
                <JalaliDatePicker value={endDate} onChange={setEndDate} />
              </label>
            </div>
          ) : (
            // The dates are still what gets stored, so they are shown rather
            // than decided quietly on the user's behalf.
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">
              {t('hr.leaveFromToday', 'از امروز، به مدت {days} روز (تا {end})')
                .replace('{days}', days === null ? '—' : String(days))
                .replace('{end}', effectiveEnd || '—')}
            </p>
          )}

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder={t('hr.leaveReason', 'دلیل مرخصی')}
            className={cn(FIELD, 'w-full')}
          />

          {error && (
            <p className="text-sm text-[hsl(var(--color-destructive))]" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={days === null || createLeave.isPending}
              className="rounded-full bg-[hsl(var(--color-primary))] px-5 py-2 text-sm font-bold text-[hsl(var(--color-primary-fg))] disabled:opacity-50"
            >
              {createLeave.isPending ? '...' : t('action.save', 'ذخیره')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-[hsl(var(--border-default))] px-5 py-2 text-sm"
            >
              {t('action.cancel', 'لغو')}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="h-16 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
      ) : leaves.length === 0 ? (
        <p className="py-4 text-center text-sm text-[hsl(var(--fg-secondary))]">
          {t('hr.noLeaves', 'هنوز مرخصی‌ای ثبت نشده')}
        </p>
      ) : (
        <div className="space-y-2">
          {leaves.map((leave) => (
            <div
              key={leave.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[hsl(var(--border-default))] p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                  {t(
                    `hr.leave${leave.leave_type.charAt(0).toUpperCase()}${leave.leave_type.slice(1)}`,
                    leave.leave_type,
                  )}
                  {typeof leave.total_days === 'number' && (
                    <span className="ms-2 text-xs text-[hsl(var(--fg-secondary))] tabular-nums">
                      {leave.total_days} {t('hr.days', 'روز')}
                    </span>
                  )}
                </p>
                <p className="text-xs tabular-nums text-[hsl(var(--fg-tertiary))]">
                  {leave.start_date} — {leave.end_date}
                </p>
                {leave.reason && (
                  <p className="truncate text-xs text-[hsl(var(--fg-secondary))]">{leave.reason}</p>
                )}
              </div>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  STATUS_TONE[leave.status] ?? STATUS_TONE.pending,
                )}
              >
                {t(`hr.leaveStatus_${leave.status}`, leave.status)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

EmployeeLeavePanel.displayName = 'EmployeeLeavePanel'
