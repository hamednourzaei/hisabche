'use client'

// ============================================
// «این فاکتور تکرار شود» — on the invoice's confirm step.
//
// The invoice being confirmed becomes the template of a standing arrangement:
// the same lines, issued again on each due day, unpaid, by the server. This
// panel only collects WHEN; what it issues is the invoice already on screen.
//
// Pure: value in, change out. The preview container owns the state and makes
// the call after the invoice itself has been created.
// ============================================

import {
  addIsoDays,
  calendarDay,
  type AutomationCadence,
  type ScheduleCalendar,
} from '@hisabche/validation'

import { Input } from '../input'
import { SelectField } from '../select-field'
import { Switch } from '../switch'

type T = (key: string, fallback?: string) => string

export interface RecurrenceValue {
  enabled: boolean
  kind: 'monthly' | 'interval'
  /** Every N days, for `interval`. Kept as typed. */
  everyDays: string
  name: string
}

export const INITIAL_RECURRENCE: RecurrenceValue = {
  enabled: false,
  kind: 'monthly',
  everyDays: '7',
  name: '',
}

/**
 * The calendar a reader's months are in. It follows the language, the same way
 * every date on screen does: Persian and Dari readers keep solar Hijri months,
 * English readers Gregorian ones.
 */
export function scheduleCalendarFor(locale: string): ScheduleCalendar {
  return locale.toLowerCase().startsWith('en') ? 'gregory' : 'persian'
}

/**
 * The cadence for an invoice issued on `invoiceDate`, starting with the NEXT
 * occurrence — the one being confirmed now is this period's.
 *
 * «Every month, on this day» is the invoice's day OF THE READER'S CALENDAR: an
 * invoice dated 1 Mehr repeats on 1 Aban, not on the 23rd of a Gregorian month
 * the reader never sees.
 *
 * `null` when the interval typed is not a whole number of days ≥ 1.
 */
export function cadenceFor(
  value: RecurrenceValue,
  invoiceDate: string,
  calendar: ScheduleCalendar,
): AutomationCadence | null {
  const day = invoiceDate.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null

  if (value.kind === 'monthly') {
    return {
      kind: 'monthly',
      dayOfMonth: calendarDay(day, calendar).day,
      calendar,
      from: addIsoDays(day, 1),
    }
  }
  const everyDays = Number(value.everyDays)
  if (!Number.isInteger(everyDays) || everyDays < 1 || everyDays > 366) return null
  return { kind: 'interval', everyDays, from: addIsoDays(day, everyDays) }
}

export function RecurrencePanel({
  t,
  value,
  onChange,
  invoiceDate,
  calendar,
  disabled,
}: {
  t: T
  value: RecurrenceValue
  onChange: (next: RecurrenceValue) => void
  invoiceDate: string
  /** The calendar «the same day every month» is counted in. */
  calendar: ScheduleCalendar
  disabled?: boolean
}) {
  const cadence = value.enabled ? cadenceFor(value, invoiceDate, calendar) : null
  const invalid = value.enabled && cadence === null

  return (
    <div className="rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] p-3 print:hidden">
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[hsl(var(--fg-primary))]">
          {t('invoiceBuilder.recurrence.title', 'این فاکتور خودکار تکرار شود')}
        </span>
        <Switch
          size="sm"
          checked={value.enabled}
          disabled={disabled}
          onCheckedChange={(enabled) => onChange({ ...value, enabled })}
          aria-label={t('invoiceBuilder.recurrence.title', 'این فاکتور خودکار تکرار شود')}
        />
      </label>

      {value.enabled ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              name="recurrence.kind"
              aria-label={t('invoiceBuilder.recurrence.kind', 'دوره‌ی تکرار')}
              value={value.kind}
              onChange={(kind) => onChange({ ...value, kind: kind as RecurrenceValue['kind'] })}
              options={[
                {
                  value: 'monthly',
                  label: t('invoiceBuilder.recurrence.monthly', 'هر ماه، همین روز'),
                },
                { value: 'interval', label: t('invoiceBuilder.recurrence.interval', 'هر چند روز') },
              ]}
            />
            {value.kind === 'interval' ? (
              <Input
                name="recurrence.everyDays"
                inputMode="numeric"
                aria-label={t('invoiceBuilder.recurrence.everyDays', 'هر چند روز یک‌بار')}
                placeholder={t('invoiceBuilder.recurrence.everyDays', 'هر چند روز یک‌بار')}
                value={value.everyDays}
                onChange={(event) => onChange({ ...value, everyDays: event.target.value })}
                aria-invalid={invalid ? true : undefined}
              />
            ) : null}
          </div>
          <Input
            name="recurrence.name"
            aria-label={t('invoiceBuilder.recurrence.name', 'نام این قرار (اختیاری)')}
            placeholder={t('invoiceBuilder.recurrence.name', 'نام این قرار (اختیاری)')}
            value={value.name}
            maxLength={120}
            onChange={(event) => onChange({ ...value, name: event.target.value })}
          />
          {invalid ? (
            <p className="text-xs text-[hsl(var(--color-destructive))]">
              {t('invoiceBuilder.recurrence.invalid', 'تعداد روز باید عددی بین ۱ تا ۳۶۶ باشد.')}
            </p>
          ) : (
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">
              {t(
                'invoiceBuilder.recurrence.hint',
                'از نوبت بعد، همین فاکتور با همین خط‌ها خودکار و «پرداخت‌نشده» صادر می‌شود. از صفحه‌ی فاکتورها می‌توانید آن را متوقف کنید.',
              )}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
