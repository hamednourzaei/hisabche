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

import { CURRENCY_SIGN, currencySign } from '@hisabche/formatting'

import { SelectField } from '../select-field'
import { cn } from '../../../lib/utils'
import { toIsoDay } from '@hisabche/formatting'
import { rateFromPair } from '../../../lib/warehouse/rate-from-pair'
import { JalaliDatePicker } from '../jalali-datepicker'

/** A unit the business named itself carries this prefix inside the picker. */
const CUSTOM = 'unit:'
/** «واحد دیگر…» — type a new one. */
const OTHER = '__other__'

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
    const sign = currencySign(code as keyof typeof CURRENCY_SIGN)
    return code === base
      ? `${name} — ${tr('display.ownCurrency', 'ارز دفاتر')}`
      : sign && sign !== name
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

  const sign =
    currency in CURRENCY_SIGN ? currencySign(currency as keyof typeof CURRENCY_SIGN) : undefined
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
  /** Units the business named itself (live audit #82). */
  customUnits?: readonly string[] | undefined
  /** Given when units can be saved; the «واحد دیگر…» option appears with it. */
  onSaveUnit?: ((input: { name: string; perUnit: number; onDate: string }) => void) | undefined
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
  customUnits,
  onSaveUnit,
}: ExchangeRateFormProps) {
  const tr = (key: string, fallback: string) => (t ? t(key, fallback) : fallback)

  // A unit the business names itself (live audit #82) sits beside the
  // currencies: «هر ۱ ماشین = ۵۰۰٬۰۰۰ افغانی». Such a unit is quoted against
  // the books' currency only, and is never what a document is kept in.
  const named = (customUnits ?? []).map((unit) => `${CUSTOM}${unit}`)
  const units = [base, ...currencies, ...named, ...(onSaveUnit ? [OTHER] : [])]
  const [leftAmount, setLeftAmount] = React.useState('1')
  const [leftCode, setLeftCode] = React.useState(initialCurrency ?? base)
  const [rightAmount, setRightAmount] = React.useState('')
  const [rightCode, setRightCode] = React.useState(initialCurrency ? base : (currencies[0] ?? ''))
  const [newUnit, setNewUnit] = React.useState('')
  const [onDate, setOnDate] = React.useState(() => toIsoDay(new Date()))
  const [problem, setProblem] = React.useState<string | null>(null)

  if (currencies.length === 0) return null

  const nameOf = (code: string) =>
    code === OTHER
      ? tr('display.otherUnit', 'واحد دیگر…')
      : code.startsWith(CUSTOM)
        ? code.slice(CUSTOM.length)
        : tr(`currency.${code.toLowerCase()}`, LABEL[code] ?? code)
  const option = (code: string) => ({
    value: code,
    label:
      code === base ? `${nameOf(code)} — ${tr('display.ownCurrency', 'ارز دفاتر')}` : nameOf(code),
  })
  const box =
    'h-9 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 text-xs text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'
  const unitCode = (code: string) => (code === OTHER ? `${CUSTOM}${newUnit.trim()}` : code)

  const submit = () => {
    if (isSaving) return
    const left = unitCode(leftCode)
    const right = unitCode(rightCode)
    const customSide = [left, right].find((code) => code.startsWith(CUSTOM))
    if (customSide !== undefined) {
      const name = customSide.slice(CUSTOM.length)
      if (name.length < 1 || name.length > 40) {
        setProblem(tr('display.unitName', 'نام واحد را بنویسید (حداکثر ۴۰ حرف).'))
        return
      }
      if (left !== base && right !== base) {
        setProblem(tr('display.rateNeedsBase', 'یکی از دو طرف باید ارز دفاتر باشد.'))
        return
      }
    }
    const result = rateFromPair(
      { amount: Number(leftAmount), code: left },
      { amount: Number(rightAmount), code: right },
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
    if (result.code.startsWith(CUSTOM)) {
      onSaveUnit?.({ name: result.code.slice(CUSTOM.length), perUnit: result.afnPerUnit, onDate })
      return
    }
    onSave({ currency: result.code, rate: result.afnPerUnit, onDate })
  }

  const amount = (value: string, set: (next: string) => void, width: string) => (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      step="any"
      dir="ltr"
      aria-label={tr('display.rateAmountLabel', 'مقدار')}
      value={value}
      onChange={(event) => set(event.target.value)}
      disabled={isSaving}
      className={cn(box, width, 'tabular-nums')}
    />
  )
  const unitPicker = (value: string, set: (next: string) => void) => (
    <>
      <SelectField
        value={value}
        onChange={set}
        options={units.map(option)}
        aria-label={tr('display.rateCurrency', 'ارز')}
      />
      {value === OTHER ? (
        <input
          value={newUnit}
          maxLength={40}
          onChange={(event) => setNewUnit(event.target.value)}
          placeholder={tr('display.unitPlaceholder', 'مثلاً ماشین')}
          aria-label={tr('display.unitNameLabel', 'نام واحد')}
          disabled={isSaving}
          className={cn(box, 'w-28')}
        />
      ) : null}
    </>
  )

  // ONE line (owner's request, live audit #62): «هر [۱] [واحد] = [عدد] [واحد]
  // [تاریخ] [تأیید]». It wraps only where the screen is too narrow for it.
  // The date is the reader's calendar (#48), not the browser's 10/14/2026.
  return (
    <form
      data-exchange-rate-form=""
      title={tr(
        'display.rateHint',
        'نرخ برای همان روز ثبت می‌شود — ارقام گذشته با نرخ همان روز محاسبه می‌شوند، نه با نرخ امروز.',
      )}
      className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] p-2"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs lg:flex-nowrap">
        <span>{tr('display.each', 'هر')}</span>
        {amount(leftAmount, setLeftAmount, 'w-20')}
        {unitPicker(leftCode, setLeftCode)}
        <span aria-hidden="true">=</span>
        {amount(rightAmount, setRightAmount, 'w-32')}
        {unitPicker(rightCode, setRightCode)}
        <JalaliDatePicker
          value={onDate}
          onChange={setOnDate}
          disabled={isSaving === true}
          className="w-36 shrink-0"
        />
        <button
          type="submit"
          disabled={isSaving}
          className="h-9 shrink-0 rounded-full bg-[hsl(var(--color-primary))] px-4 text-xs font-bold text-[hsl(var(--color-primary-fg))] disabled:opacity-40"
        >
          {isSaving ? tr('common.saving', 'در حال ثبت…') : tr('display.confirm', 'تأیید')}
        </button>
      </div>

      {problem || error ? (
        <p className="mt-1.5 text-[11px] text-[hsl(var(--color-destructive))]" role="alert">
          {problem ?? error}
        </p>
      ) : null}
    </form>
  )
}
