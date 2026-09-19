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

  const days = useMemo(() => leaveDayCount(startDate, endDate), [startDate, endDate])

  const submit = useCallback(async () => {
    if (days === null) {
      setError(t('hr.leaveRangeInvalid', 'تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.'))
      return
    }
    setError(null)
    try {
      await createLeave.mutateAsync({
        employeeId,
        leaveType,
        startDate,
        endDate,
        totalDays: days,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      })
      setOpen(false)
      setStartDate('')
      setEndDate('')
      setReason('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('hr.leaveSaveError', 'ثبت مرخصی انجام نشد.'))
    }
  }, [createLeave, days, employeeId, endDate, leaveType, reason, startDate, t])

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
              {/*
                Not typed in: the count IS the range. Two fields that can
                disagree would let «۳ روز» sit on a five-day span, and the
                payroll would then be wrong for whichever one it trusted.
              */}
              <span
                className={cn(
                  FIELD,
                  'tabular-nums',
                  days === null && 'text-[hsl(var(--fg-tertiary))]',
                )}
              >
                {days === null ? t('hr.leavePickRange', 'بازه را انتخاب کنید') : days}
              </span>
            </label>

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
