'use client'

// ============================================
// «برنامه‌ی شیفت» — who is PLANNED for which shift on the sheet's day (#101),
// beside what the attendance sheet recorded for them.
//
// ⚠️ A PLAN IS NOT ATTENDANCE. Planning someone records nothing about their
// day and changes no pay; the note says so.
// ⚠️ «حضور ثبت نشده» IS NOT «غایب». A planned person with nothing on the sheet
// has its own wording and its own count.
// ⚠️ An assignment is cancelled, never deleted or edited — a changed plan is a
// cancelled row and a new one.
// ⚠️ Several days are planned together or not at all: if one of them overlaps
// another shift of the same person, none is planned and the message says why.
// Loads only when opened.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatNumber } from '@hisabche/formatting'
import {
  apiErrorMessage,
  useAssignShift,
  useCancelShiftAssignment,
  useShiftPlan,
  type AttendanceSheetRow,
  type PlannedShift,
  type WorkShift,
} from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { useDateFormat } from '../../../hooks/use-date-format'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { Button } from '../button'
import { SelectField } from '../select-field'

export const SHIFT_PLAN_ERROR_CODES = [
  'SHIFT_ASSIGNMENT_OVERLAP',
  'SHIFT_ASSIGNMENT_SHIFT_NOT_FOUND',
  'SHIFT_ASSIGNMENT_SHIFT_RETIRED',
  'SHIFT_ASSIGNMENT_DAYS_INVALID',
  'SHIFT_ASSIGNMENTS_MIGRATION_PENDING',
] as const

/** What the sheet says about a planned day; each has a label. */
export const SHIFT_PLAN_ACTUAL_STATES = ['worked', 'open', 'absent', 'leave', 'unrecorded'] as const

/** How many consecutive days one assignment may cover. */
export const SHIFT_PLAN_DAY_COUNTS = [1, 2, 3, 5, 6, 7, 14, 30] as const

const field =
  'h-10 w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'
const label = 'block text-xs text-[hsl(var(--fg-secondary))]'
const faint = 'text-xs text-[hsl(var(--fg-tertiary))]'

export function ShiftPlan({
  date,
  employees,
  shifts,
}: {
  /** The day the attendance sheet is showing. */
  date: string
  /** The people on the sheet. */
  employees: readonly AttendanceSheetRow[]
  /** Active shifts. Empty = none defined yet (or not set up). */
  shifts: readonly WorkShift[]
}) {
  const t = useTranslations('shiftPlan')
  const locale = useIntlLocale()
  const { date: formatDate } = useDateFormat()
  const [open, setOpen] = useState(false)
  const plan = useShiftPlan(date, open)
  const assign = useAssignShift()
  const cancel = useCancelShiftAssignment()

  const [employeeId, setEmployeeId] = useState('')
  const [shiftId, setShiftId] = useState('')
  const [days, setDays] = useState(1)

  const message = (error: unknown): string => {
    if ((error as { response?: { status?: number } } | null)?.response?.status === 403) {
      return t('forbidden')
    }
    const raw = apiErrorMessage(error, '')
    const code = SHIFT_PLAN_ERROR_CODES.find((known) => raw.includes(known))
    return code ? t(`errors.${code}`) : t('errors.general')
  }
  const number = (value: number) => formatNumber(value, locale, 0)
  const failure = assign.error ?? cancel.error

  const actual = (item: PlannedShift) => {
    const state = SHIFT_PLAN_ACTUAL_STATES.find((known) => known === item.actual) ?? 'unrecorded'
    return (
      <span
        className={cn(
          'text-xs font-medium',
          state === 'worked' || state === 'open'
            ? 'text-[hsl(var(--color-success))]'
            : state === 'absent'
              ? 'text-[hsl(var(--color-destructive))]'
              : 'text-[hsl(var(--fg-secondary))]',
        )}
      >
        {t(`actual.${state}`)}
        {item.checkIn ? (
          <span dir="ltr" className="ms-1 tabular-nums">
            {item.checkIn}
            {item.checkOut ? `–${item.checkOut}` : ''}
          </span>
        ) : null}
      </span>
    )
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-[hsl(var(--fg-primary))]">{t('title')}</h3>
          <p className={cn('mt-1', faint)}>{t('hint')}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((value) => !value)}>
          {open ? t('hide') : t('show')}
        </Button>
      </div>

      {open && plan.isLoading ? (
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('loading')}</p>
      ) : null}
      {open && plan.error ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {message(plan.error)}
        </p>
      ) : null}

      {open && plan.data ? (
        <div className="space-y-3 text-sm">
          <p className="text-[hsl(var(--fg-secondary))]">
            {t('forDay', { date: formatDate(date) })}
            {plan.data.assignments.length > 0
              ? ` · ${t('summary', {
                  planned: number(plan.data.summary.planned),
                  worked: number(plan.data.summary.worked),
                  absent: number(plan.data.summary.absent),
                  unrecorded: number(plan.data.summary.unrecorded),
                })}`
              : ''}
          </p>

          {plan.data.assignments.length === 0 ? (
            <p className="text-[hsl(var(--fg-primary))]">{t('empty')}</p>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border-default))]">
              {plan.data.assignments.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="min-w-0 flex-1 truncate font-medium text-[hsl(var(--fg-primary))]">
                    {item.employeeName}
                  </span>
                  <span className="text-[hsl(var(--fg-secondary))]">
                    {item.shiftName}{' '}
                    <span dir="ltr" className="tabular-nums">
                      {item.startsAt}–{item.endsAt}
                    </span>
                  </span>
                  {actual(item)}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={cancel.isPending && cancel.variables?.id === item.id}
                    onClick={() => cancel.mutate({ id: item.id })}
                  >
                    {t('cancel')}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {shifts.length === 0 ? (
            <p className={faint}>{t('noShifts')}</p>
          ) : employees.length === 0 ? (
            <p className={faint}>{t('noEmployees')}</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <span className={label}>{t('employee')}</span>
                <SelectField
                  name="employeeId"
                  data-field="employeeId"
                  aria-label={t('employee')}
                  value={employeeId}
                  onChange={setEmployeeId}
                  options={[
                    { value: '', label: t('choose') },
                    ...employees.map((row) => ({ value: row.employeeId, label: row.name })),
                  ]}
                  className={field}
                />
              </div>
              <div className="space-y-1">
                <span className={label}>{t('shift')}</span>
                <SelectField
                  name="shiftId"
                  data-field="shiftId"
                  aria-label={t('shift')}
                  value={shiftId}
                  onChange={setShiftId}
                  options={[
                    { value: '', label: t('choose') },
                    ...shifts.map((shift) => ({
                      value: shift.id,
                      label: `${shift.name} (${shift.startsAt}–${shift.endsAt})`,
                    })),
                  ]}
                  className={field}
                />
              </div>
              <div className="space-y-1">
                <span className={label}>{t('days')}</span>
                <SelectField
                  name="days"
                  data-field="days"
                  aria-label={t('days')}
                  value={String(days)}
                  onChange={(value) => setDays(Number(value))}
                  options={SHIFT_PLAN_DAY_COUNTS.map((count) => ({
                    value: String(count),
                    label:
                      count === 1 ? t('onlyThisDay') : t('daysFromHere', { count: number(count) }),
                  }))}
                  className={field}
                />
              </div>
              <div className="flex items-end">
                <Button
                  disabled={!employeeId || !shiftId || assign.isPending}
                  onClick={() => assign.mutate({ employeeId, shiftId, fromDate: date, days })}
                >
                  {t('assign')}
                </Button>
              </div>
            </div>
          )}

          {failure ? (
            <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
              {message(failure)}
            </p>
          ) : null}
          <p className={faint}>{t('note')}</p>
        </div>
      ) : null}
    </section>
  )
}
