'use client'

// ============================================
// packages/ui/src/components/ui/dashboard/display-basis-picker.tsx
//
// T10 — choosing what amounts are shown in.
//
// ⚠️ The label deliberately says «نمایش» and the panel says so again when a
// non-base currency is chosen. A person who sets this and later reads a figure
// must not be able to mistake it for what their books are kept in — that
// mistake is how someone reports the wrong number to a tax office.
// ============================================

import * as React from 'react'

import { AlertTriangle } from 'lucide-react'

import { CURRENCY_SIGN } from '@hisabche/formatting'

import { SelectField } from '../select-field'
import { cn } from '../../../lib/utils'
import { toIsoDay } from '@hisabche/formatting'
import { rateFromPair } from '../../../lib/warehouse/rate-from-pair'

/** Persian labels for the codes a shop is most likely to display in. */
const LABEL: Record<string, string> = {
  AFN: 'افغانی',
  IRT: 'تومان',
  IRR: 'ریال',
  USD: 'دالر',
  EUR: 'یورو',
  PKR: 'روپیه',
  XAU: 'طلا (گرم)',
  XAG: 'نقره (گرم)',
  XPT: 'پلاتین (گرم)',
  XPD: 'پالادیوم (گرم)',
}

export interface DisplayBasisPickerProps {
  t?: (key: string, fallback?: string) => string
  /** The currency the books are kept in. Always offered; needs no rate. */
  base: string
  /** What is being displayed in right now. */
  basis: string
  /** Codes with a usable rate, plus the base. */
  available: readonly string[]
  onChange: (code: string | null) => void
  disabled?: boolean
  className?: string
}

export function DisplayBasisPicker({
  t,
  base,
  basis,
  available,
  onChange,
  disabled,
  className,
}: DisplayBasisPickerProps) {
  const tr = (key: string, fallback: string) => (t ? t(key, fallback) : fallback)

  const label = (code: string): string => {
    const name = LABEL[code] ?? code
    const sign = CURRENCY_SIGN[code as keyof typeof CURRENCY_SIGN]
    return code === base
      ? `${name} — ${tr('display.ownCurrency', 'ارز دفاتر')}`
      : sign
        ? `${name} (${sign})`
        : name
  }

  // Only the base is available: there is nothing to choose between, so a
  // picker would be a control that does nothing.
  if (available.length <= 1) return null

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <SelectField
        value={basis}
        onChange={(code) => onChange(code === base ? null : code)}
        options={available.map((code) => ({ value: code, label: label(code) }))}
        aria-label={tr('display.basis', 'نمایش مبلغ بر مبنای')}
        disabled={Boolean(disabled)}
        className="w-auto min-w-[10rem]"
      />

      {basis !== base ? (
        // ⚠️ Not decoration. Once the figures are in grams of gold, every
        // number on the screen means something different from what is stored,
        // and nothing else on the page says so.
        <p className="flex items-start gap-1.5 text-[11px] text-[hsl(var(--color-warning))]">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          <span>
            {tr(
              'display.convertedNotice',
              'این ارقام فقط برای نمایش تبدیل شده‌اند — دفاتر و فاکتورها بدون تغییر باقی می‌مانند.',
            )}
          </span>
        </p>
      ) : null}
    </div>
  )
}

export interface ConvertedAmountProps {
  t?: (key: string, fallback?: string) => string
  /** Null when no rate was available for the pair. */
  value: number | null
  currency: string
  /** How to render the number once it exists. */
  format: (value: number) => string
  className?: string
}

/**
 * One converted figure — or an honest gap where one could not be produced.
 *
 * ⚠️ THE NULL BRANCH IS THE WHOLE POINT. `convertVia` returns null when a rate
 * is missing, which is the real state for most currencies in this product: the
 * client shipped four hardcoded rates and a `fetchRates` that called nothing.
 *
 * Rendering the unconverted amount here instead would put «۱۵٬۰۰۰٬۰۰۰» under a
 * heading that says grams. That is not a degraded experience, it is a wrong
 * number, and the person reading it has no way to tell.
 */
export function ConvertedAmount({ t, value, currency, format, className }: ConvertedAmountProps) {
  const tr = (key: string, fallback: string) => (t ? t(key, fallback) : fallback)

  if (value === null) {
    return (
      <span
        className={cn('text-[hsl(var(--fg-tertiary))]', className)}
        title={tr('display.noRateHint', 'برای این ارز نرخی ثبت نشده است')}
      >
        {tr('display.noRate', 'نرخ ثبت نشده')}
      </span>
    )
  }

  const sign = CURRENCY_SIGN[currency as keyof typeof CURRENCY_SIGN]
  return (
    <span className={className}>
      {format(value)}
      {sign ? <span className="ms-1 text-[0.75em] opacity-70">{sign}</span> : null}
    </span>
  )
}

// ============================================
// Setting a rate.
//
// ⚠️ WITHOUT THIS THE WHOLE FEATURE IS UNREACHABLE.
//
// `PUT /currency/rates` existed with zero callers, so no workspace could have
// a rate for anything, so the basis picker could only ever offer the currency
// the books are already in — a control with one option.
//
// ---------------------------------------------------------------------------
// ⚠️ THE RATE COMES FROM THE PERSON, NOT FROM A GUESS
//
// There is no exchange-rate feed in this product: `fetchRates` in the currency
// store is still a TODO that calls nothing. That is a real limitation and this
// does not paper over it — a jeweller knows today's gold price and types it,
// the same way they price the goods in the case.
//
// The date is part of the rate, not metadata about it. `exchange_rates` is
// keyed by `rate_date` precisely so that «what was gold worth on 12 March» has
// an answer, which is the only question a backdated figure asks.
// ============================================

export interface ExchangeRateFormProps {
  t?: (key: string, fallback?: string) => string
  base: string
  /** Codes the user may quote. Excludes the base — it is 1 by definition. */
  currencies: readonly string[]
  /** «اصلاح قیمت»: open on the currency being displayed. */
  initialCurrency?: string | undefined
  isSaving?: boolean
  error?: string | null
  onSave: (input: { currency: string; rate: number; onDate: string }) => void
}

/**
 * «[amount] [unit] = [amount] [unit]», the way a rate is said — «هر ۳٬۰۰۰
 * افغانی = ۱٬۰۰۰٬۰۰۰ تومان», «هر ۱ گرم طلا = ۲۴٬۰۰۰٬۰۰۰ …» (owner's request,
 * 26 Sep 2026). The left box starts on the books' currency. Whatever is typed
 * is turned into the one thing stored: how many BASE units one unit of the
 * other currency is worth (`rateFromPair`), so every reader of the rate is
 * unchanged. One side must be the base: the dashboard keeps no rate between
 * two foreign currencies to bridge with.
 */
export function ExchangeRateForm({
  t,
  base,
  currencies,
  initialCurrency,
  isSaving,
  error,
  onSave,
}: ExchangeRateFormProps) {
  const tr = (key: string, fallback: string) => (t ? t(key, fallback) : fallback)

  const units = [base, ...currencies]
  const [leftAmount, setLeftAmount] = React.useState('1')
  const [leftCode, setLeftCode] = React.useState(initialCurrency ?? base)
  const [rightAmount, setRightAmount] = React.useState('')
  const [rightCode, setRightCode] = React.useState(initialCurrency ? base : (currencies[0] ?? ''))
  const [onDate, setOnDate] = React.useState(() => toIsoDay(new Date()))
  const [problem, setProblem] = React.useState<string | null>(null)

  if (currencies.length === 0) return null

  const option = (code: string) => ({
    value: code,
    label:
      code === base
        ? `${LABEL[code] ?? code} — ${tr('display.ownCurrency', 'ارز دفاتر')}`
        : (LABEL[code] ?? code),
  })
  const box =
    'h-9 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 text-xs text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'

  return (
    <form
      data-exchange-rate-form=""
      className="space-y-3 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] p-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (isSaving) return
        const result = rateFromPair(
          { amount: Number(leftAmount), code: leftCode },
          { amount: Number(rightAmount), code: rightCode },
          () => null,
          base,
        )
        if (!result.ok) {
          setProblem(
            result.reason === 'same'
              ? tr('display.rateSame', 'دو واحد باید متفاوت باشند.')
              : result.reason === 'amount'
                ? tr('display.rateAmount', 'هر دو مقدار باید بزرگ‌تر از صفر باشند.')
                : tr('display.rateNeedsBase', 'یکی از دو طرف باید ارز دفاتر باشد.'),
          )
          return
        }
        setProblem(null)
        onSave({ currency: result.code, rate: result.afnPerUnit, onDate })
      }}
    >
      <p className="text-xs font-medium text-[hsl(var(--fg-primary))]">
        {tr('display.exchangeButton', 'تبادل نرخ داشبورد')}
      </p>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span>{tr('display.each', 'هر')}</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          dir="ltr"
          aria-label={tr('display.rateAmountLabel', 'مقدار')}
          value={leftAmount}
          onChange={(event) => setLeftAmount(event.target.value)}
          disabled={isSaving}
          className={cn(box, 'w-28 tabular-nums')}
        />
        <SelectField
          value={leftCode}
          onChange={setLeftCode}
          options={units.map(option)}
          aria-label={tr('display.rateCurrency', 'ارز')}
        />
        <span aria-hidden="true">=</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          dir="ltr"
          aria-label={tr('display.rateAmountLabel', 'مقدار')}
          value={rightAmount}
          onChange={(event) => setRightAmount(event.target.value)}
          disabled={isSaving}
          className={cn(box, 'w-36 tabular-nums')}
        />
        <SelectField
          value={rightCode}
          onChange={setRightCode}
          options={units.map(option)}
          aria-label={tr('display.rateCurrency', 'ارز')}
        />
        <input
          type="date"
          value={onDate}
          onChange={(event) => setOnDate(event.target.value)}
          disabled={isSaving}
          aria-label={tr('display.rateDate', 'تاریخ نرخ')}
          className={box}
        />
      </div>

      <p className="text-[11px] text-[hsl(var(--fg-tertiary))]">
        {tr(
          'display.rateHint',
          'نرخ برای همان روز ثبت می‌شود — ارقام گذشته با نرخ همان روز محاسبه می‌شوند، نه با نرخ امروز.',
        )}
      </p>

      {problem || error ? (
        <p className="text-[11px] text-[hsl(var(--color-destructive))]" role="alert">
          {problem ?? error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSaving}
        className="h-9 rounded-full bg-[hsl(var(--color-primary))] px-4 text-xs font-bold text-[hsl(var(--color-primary-fg))] disabled:opacity-40"
      >
        {isSaving ? tr('common.saving', 'در حال ثبت…') : tr('display.confirm', 'تأیید')}
      </button>
    </form>
  )
}
