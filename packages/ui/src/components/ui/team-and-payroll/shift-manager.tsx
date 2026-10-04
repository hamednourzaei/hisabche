'use client'

// ============================================
// «شیفت‌ها» — named working hours (#101), under the attendance sheet.
//
// A shift is a definition: the sheet uses it to record a day in one click. It
// assigns nobody and changes no pay, and the hint says so.
//
// A shift is retired, never deleted or edited — a changed shift is a new one.
// Loads only when opened.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatNumber } from '@hisabche/formatting'
import {
  apiErrorMessage,
  useCreateWorkShift,
  useSetWorkShiftActive,
  useWorkShifts,
} from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { Button } from '../button'

export const SHIFT_ERROR_CODES = [
  'SHIFT_INVALID_TIMES',
  'SHIFT_BREAK_LONGER_THAN_SHIFT',
  'SHIFT_NAME_TAKEN',
  'SHIFTS_MIGRATION_PENDING',
] as const

const field =
  'h-10 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'
const label = 'block text-xs text-[hsl(var(--fg-secondary))]'

export function ShiftManager() {
  const t = useTranslations('shifts')
  const locale = useIntlLocale()
  const [open, setOpen] = useState(false)
  const shifts = useWorkShifts(open)
  const create = useCreateWorkShift()
  const setActive = useSetWorkShiftActive()

  const [name, setName] = useState('')
  const [startsAt, setStartsAt] = useState('08:00')
  const [endsAt, setEndsAt] = useState('16:00')
  const [breakMinutes, setBreakMinutes] = useState('0')

  const message = (error: unknown): string => {
    const raw = apiErrorMessage(error, '')
    const code = SHIFT_ERROR_CODES.find((known) => raw.includes(known))
    return code ? t(`errors.${code}`) : t('errors.general')
  }
  const failure = create.error ?? setActive.error

  return (
    <section className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-[hsl(var(--fg-primary))]">{t('title')}</h3>
          <p className="mt-0.5 text-xs text-[hsl(var(--fg-tertiary))]">{t('hint')}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((value) => !value)}>
          {open ? t('hide') : t('show')}
        </Button>
      </div>

      {open && shifts.isLoading ? (
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('loading')}</p>
      ) : null}
      {open && shifts.error ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {message(shifts.error)}
        </p>
      ) : null}

      {open && shifts.data ? (
        <>
          {shifts.data.length === 0 ? (
            <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('empty')}</p>
          ) : (
            <ul className="space-y-2">
              {shifts.data.map((shift) => (
                <li
                  key={shift.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl bg-[hsl(var(--surface-muted))] p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-[hsl(var(--fg-primary))]">
                      {shift.name}
                      <span className="tabular-nums text-[hsl(var(--fg-secondary))]" dir="ltr">
                        {shift.startsAt}–{shift.endsAt}
                      </span>
                      {!shift.isActive ? (
                        <span className="rounded-full bg-[hsl(var(--surface-elevated))] px-2 py-0.5 text-xs text-[hsl(var(--fg-secondary))]">
                          {t('retired')}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                      {t('hours', { hours: formatNumber(shift.payableHours, locale, 2) })}
                      {shift.breakMinutes > 0
                        ? ` · ${t('breakLabel', { minutes: formatNumber(shift.breakMinutes, locale, 0) })}`
                        : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={setActive.isPending && setActive.variables?.id === shift.id}
                    onClick={() => setActive.mutate({ id: shift.id, isActive: !shift.isActive })}
                  >
                    {shift.isActive ? t('retire') : t('reactivate')}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className={label}>{t('name')}</span>
              <input
                name="name"
                value={name}
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
                className={cn(field, 'w-40')}
              />
            </label>
            <label className="space-y-1">
              <span className={label}>{t('startsAt')}</span>
              <input
                type="time"
                name="startsAt"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                className={cn(field, 'w-28 tabular-nums')}
              />
            </label>
            <label className="space-y-1">
              <span className={label}>{t('endsAt')}</span>
              <input
                type="time"
                name="endsAt"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                className={cn(field, 'w-28 tabular-nums')}
              />
            </label>
            <label className="space-y-1">
              <span className={label}>{t('breakMinutes')}</span>
              <input
                name="breakMinutes"
                inputMode="numeric"
                dir="ltr"
                value={breakMinutes}
                onChange={(event) => setBreakMinutes(event.target.value.replace(/[^0-9]/g, ''))}
                className={cn(field, 'w-24 tabular-nums')}
              />
            </label>
            <Button
              size="sm"
              disabled={create.isPending || name.trim().length === 0 || !startsAt || !endsAt}
              onClick={() =>
                create.mutate(
                  { name, startsAt, endsAt, breakMinutes: Number(breakMinutes) || 0 },
                  { onSuccess: () => setName('') },
                )
              }
            >
              {t('add')}
            </Button>
          </div>
          {failure ? (
            <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
              {message(failure)}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
