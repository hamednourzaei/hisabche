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

import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  Coins,
  Landmark,
  Package,
  Plus,
  TrendingUp,
  X,
} from 'lucide-react'

import { CURRENCY_SIGN, currencySign } from '@hisabche/formatting'

import { SelectField } from '../select-field'
import { useAfterHydration } from '../../../hooks/use-after-hydration'
import { cn } from '../../../lib/utils'
import { toIsoDay } from '@hisabche/formatting'
import { rateFromPair } from '../../../lib/warehouse/rate-from-pair'
import { inStoredUnit, measuresFor, namedUnit, OWN_MEASURE } from '../../../lib/rate-measures'
import { typedNumber } from '../../../lib/typed-number'
import { JalaliDatePicker } from '../jalali-datepicker'
import { nameOfCurrency } from '../../../lib/currency-name'

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
  const hydrated = useAfterHydration()
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
  //
  // «Available» comes from exchange rates, and the persisted query cache can
  // hand those to the first client render while the server HTML was built
  // without them. Showing the picker before hydration finishes put a <div>
  // where the server had the rate button (React #418, DisplayBasisPicker).
  if (!hydrated || available.length <= 1) return null

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
  /** «انصراف» beside «ثبت» — given by the dialog that holds the form. */
  onCancel?: (() => void) | undefined
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
  onCancel,
}: ExchangeRateFormProps) {
  const tr = (key: string, fallback: string) => (t ? t(key, fallback) : fallback)

  // A unit the business names itself (live audit #82) sits beside the
  // currencies: «هر ۱ ماشین = ۵۰۰٬۰۰۰ افغانی». Such a unit is quoted against
  // the books' currency only, and is never what a document is kept in.
  const named = (customUnits ?? []).map((unit) => `${CUSTOM}${unit}`)
  // A new unit is made with «+» beside the picker, the way the product form
  // makes its own unit (owner, 18 Oct 2026) — not a «واحد دیگر…» option.
  const units = [base, ...currencies, ...named]
  const [leftAmount, setLeftAmount] = React.useState('1')
  const [leftCode, setLeftCode] = React.useState(initialCurrency ?? base)
  const [rightAmount, setRightAmount] = React.useState('')
  const [rightCode, setRightCode] = React.useState(initialCurrency ? base : (currencies[0] ?? ''))
  // How each side is said — «کیلوگرم», «میلیون» — turned into the stored
  // unit before the pair becomes a rate (`inStoredUnit`).
  const [leftMeasure, setLeftMeasure] = React.useState(() => measuresFor(leftCode)[0]!.id)
  const [rightMeasure, setRightMeasure] = React.useState(() => measuresFor(rightCode)[0]!.id)
  const [newUnit, setNewUnit] = React.useState('')
  /** Optional: the person's own measure for a named unit (بشکه، کیسه…). */
  const [ownMeasure, setOwnMeasure] = React.useState('')
  const [onDate, setOnDate] = React.useState(() => toIsoDay(new Date()))
  const [problem, setProblem] = React.useState<string | null>(null)

  if (currencies.length === 0) return null

  const nameOf = (code: string) =>
    code === OTHER
      ? tr('display.otherUnit', 'واحد دیگر…')
      : code.startsWith(CUSTOM)
        ? code.slice(CUSTOM.length)
        : nameOfCurrency(tr, code, LABEL[code] ?? code)
  const option = (code: string) => ({
    value: code,
    label:
      code === base ? `${nameOf(code)} — ${tr('display.ownCurrency', 'ارز دفاتر')}` : nameOf(code),
  })
  const unitCode = (code: string) => (code === OTHER ? `${CUSTOM}${newUnit.trim()}` : code)

  const submit = () => {
    if (isSaving) return
    const left = unitCode(leftCode)
    const right = unitCode(rightCode)
    const customSide = [left, right].find((code) => code.startsWith(CUSTOM))
    if (customSide !== undefined) {
      const name = customSide.slice(CUSTOM.length)
      const sideMeasure = customSide === left ? leftMeasure : rightMeasure
      if (sideMeasure === OWN_MEASURE && ownMeasure.trim().length === 0) {
        setProblem(tr('display.ownMeasureEmpty', 'نام واحد اندازه را بنویسید.'))
        return
      }
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
      { amount: inStoredUnit(typedNumber(leftAmount) ?? 0, leftCode, leftMeasure), code: left },
      { amount: inStoredUnit(typedNumber(rightAmount) ?? 0, rightCode, rightMeasure), code: right },
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
      const sideMeasure = result.code === left ? leftMeasure : rightMeasure
      const saved = namedUnit(result.code.slice(CUSTOM.length), sideMeasure, {
        kilogram: tr('display.measure.kilogram', 'کیلوگرم'),
        own: ownMeasure.trim(),
      })
      if (saved.length > 40) {
        setProblem(tr('display.unitName', 'نام واحد را بنویسید (حداکثر ۴۰ حرف).'))
        return
      }
      onSaveUnit?.({ name: saved, perUnit: result.afnPerUnit, onDate })
      return
    }
    onSave({ currency: result.code, rate: result.afnPerUnit, onDate })
  }

  // ─── The form (owner, 18 Oct 2026 — one design for the dashboard, the
  // warehouse and the invoice): «هر [ارز] [مقدار] [اندازه]», a swap, «معادل
  // است با [ارز] [مقدار]», the rate it will save — said live, the same
  // `rateFromPair` the save uses — with its day, «افزودن دلخواه» for a unit
  // the business names, then انصراف / ثبت.
  //
  // ⚠️ No «نوع تبدیل» picker: the product keeps ONE kind of rate (that day's,
  // `exchange_rates` / `custom_unit_rates`). A control that changes
  // nothing would be UI theater (G1).
  const sideIcon = (code: string) => {
    const Icon =
      code === base ? Landmark : code.startsWith(CUSTOM) || code === OTHER ? Package : Coins
    return <Icon className="size-4 shrink-0 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />
  }

  const field =
    'h-11 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'

  const side = (
    which: 'left' | 'right',
    code: string,
    setCode: (next: string) => void,
    value: string,
    setValue: (next: string) => void,
    measure: string,
    setMeasure: (next: string) => void,
  ) => (
    // The amount and its unit sit on the label's line; the currency (or the new
    // unit's name) takes the line under them. Side by side, three controls and
    // a label wrapped into a scattered column on a phone.
    <div data-rate-side={which} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <div className="order-last flex basis-full items-center gap-2">
        {sideIcon(code)}
        {code === OTHER ? (
          <input
            value={newUnit}
            maxLength={40}
            onChange={(event) => setNewUnit(event.target.value)}
            placeholder={tr('display.unitPlaceholder', 'مثلاً ماشین')}
            aria-label={tr('display.unitNameLabel', 'نام واحد')}
            disabled={isSaving}
            autoFocus
            className={cn(field, 'min-w-0 flex-1')}
          />
        ) : (
          <SelectField
            value={code}
            onChange={(next) => {
              setCode(next)
              setMeasure(measuresFor(next)[0]!.id)
            }}
            options={units.map(option)}
            aria-label={tr('display.rateCurrency', 'ارز')}
            className="min-w-0 flex-1"
          />
        )}
      </div>
      <input
        type="text"
        inputMode="decimal"
        dir="ltr"
        aria-label={tr('display.rateAmountLabel', 'مقدار')}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={isSaving}
        className={cn(field, 'min-w-0 flex-1 tabular-nums')}
      />
      {measuresFor(code).length > 1 ? (
        <SelectField
          value={measure}
          onChange={setMeasure}
          options={measuresFor(code).map((m) => ({
            value: m.id,
            label: tr(`display.measure.${m.id}`, m.label),
          }))}
          aria-label={tr('display.measureLabel', 'واحد اندازه')}
          className="w-auto min-w-[6rem]"
        />
      ) : null}
      {measure === OWN_MEASURE ? (
        <input
          value={ownMeasure}
          maxLength={20}
          onChange={(event) => setOwnMeasure(event.target.value)}
          placeholder={tr('display.ownMeasurePlaceholder', 'مثلاً بشکه')}
          aria-label={tr('display.ownMeasureLabel', 'واحد اندازه‌ی خودتان')}
          disabled={isSaving}
          data-own-measure=""
          className={cn(field, 'w-28')}
        />
      ) : null}
    </div>
  )

  /** «⇄» — the two sides change places, amounts and measures with them. */
  const swap = () => {
    setLeftCode(rightCode)
    setRightCode(leftCode)
    setLeftAmount(rightAmount)
    setRightAmount(leftAmount)
    setLeftMeasure(rightMeasure)
    setRightMeasure(leftMeasure)
  }

  /** «افزودن دلخواه»: the first side becomes a unit to name, the other the books' currency. */
  const making = leftCode === OTHER || rightCode === OTHER
  const toggleNewUnit = () => {
    if (making) {
      if (leftCode === OTHER) setLeftCode(base)
      if (rightCode === OTHER) setRightCode(base)
      setLeftMeasure(measuresFor(base)[0]!.id)
      setNewUnit('')
      return
    }
    setLeftCode(OTHER)
    setLeftMeasure(measuresFor(OTHER)[0]!.id)
    setRightCode(base)
    setRightMeasure(measuresFor(base)[0]!.id)
  }

  // What «ثبت» will store, said before it is pressed — the SAME computation.
  const preview = (() => {
    const result = rateFromPair(
      {
        amount: inStoredUnit(typedNumber(leftAmount) ?? 0, leftCode, leftMeasure),
        code: unitCode(leftCode),
      },
      {
        amount: inStoredUnit(typedNumber(rightAmount) ?? 0, rightCode, rightMeasure),
        code: unitCode(rightCode),
      },
      () => null,
      base,
    )
    if (!result.ok) return null
    const name = (code: string) => (code.startsWith(CUSTOM) ? code.slice(CUSTOM.length) : code)
    // Said like the codes beside it (Latin, as «1 USD = 65 AFN»): grouped by
    // hand, so no number locale is hard-coded (calendar-follows-language).
    const [whole, fraction] = String(Math.round(result.afnPerUnit * 10_000) / 10_000).split('.')
    const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return `1 ${name(result.code)} = ${fraction ? `${grouped}.${fraction}` : grouped} ${base}`
  })()

  const label = 'w-20 shrink-0 text-sm font-medium text-[hsl(var(--fg-secondary))]'
  return (
    <form
      data-exchange-rate-form=""
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <p className="text-xs text-[hsl(var(--fg-tertiary))]">
        {tr(
          'display.rateIntro',
          'مقدار مورد نظر را وارد کنید تا معادل آن به ارز دفاتر محاسبه شود.',
        )}
      </p>

      <div className="flex flex-col gap-3 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted)/0.4)] p-4">
        <div className="flex items-start gap-3">
          <span className={cn(label, 'pt-2.5')}>{tr('display.each', 'هر')}</span>
          {side(
            'left',
            leftCode,
            setLeftCode,
            leftAmount,
            setLeftAmount,
            leftMeasure,
            setLeftMeasure,
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="w-20 shrink-0" aria-hidden="true" />
          <div className="relative flex flex-1 items-center justify-center">
            <span
              className="absolute inset-x-0 top-1/2 h-px bg-[hsl(var(--border-default))]"
              aria-hidden="true"
            />
            <button
              type="button"
              data-rate-swap=""
              onClick={swap}
              disabled={isSaving}
              aria-label={tr('display.swapSides', 'جابه‌جایی دو طرف')}
              className="relative grid size-10 place-items-center rounded-full border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--surface-muted))]"
            >
              <ArrowLeftRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className={cn(label, 'pt-2.5')}>{tr('display.equalsTo', 'معادل است با')}</span>
          {side(
            'right',
            rightCode,
            setRightCode,
            rightAmount,
            setRightAmount,
            rightMeasure,
            setRightMeasure,
          )}
        </div>

        <div
          data-rate-preview=""
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-3"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]">
              <TrendingUp className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {tr('display.rateToSave', 'نرخ تبدیل')}
              </p>
              <p
                dir="ltr"
                className="text-start text-base font-bold tabular-nums text-[hsl(var(--color-primary))]"
              >
                {preview ?? '—'}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-[hsl(var(--fg-tertiary))]">
              {tr('display.rateDay', 'نرخِ روزِ')}
            </span>
            <JalaliDatePicker
              value={onDate}
              onChange={setOnDate}
              disabled={isSaving === true}
              className="w-40"
            />
          </div>
        </div>

        {onSaveUnit ? (
          <button
            type="button"
            data-new-unit=""
            onClick={toggleNewUnit}
            disabled={isSaving}
            className="flex w-full items-center gap-3 rounded-xl border border-dashed border-[hsl(var(--color-primary)/0.6)] bg-[hsl(var(--color-primary)/0.05)] p-3 text-start sm:w-auto sm:min-w-[18rem]"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))]">
              {making ? (
                <X className="size-5" aria-hidden="true" />
              ) : (
                <Plus className="size-5" aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[hsl(var(--color-primary))]">
                {making ? tr('common.cancel', 'انصراف') : tr('display.addCustom', 'افزودن دلخواه')}
              </span>
              <span className="block text-[11px] text-[hsl(var(--fg-tertiary))]">
                {tr('display.addCustomHint', 'یک واحد به نام خودتان، مثلاً «ماشین» یا «کیسه».')}
              </span>
            </span>
          </button>
        ) : null}

        <p className="text-[11px] text-[hsl(var(--fg-tertiary))]">
          {tr(
            'display.rateHint',
            'نرخ برای همان روز ثبت می‌شود — ارقام گذشته با نرخ همان روز محاسبه می‌شوند، نه با نرخ امروز.',
          )}
        </p>
      </div>

      {problem || error ? (
        <p className="text-xs text-[hsl(var(--color-destructive))]" role="alert">
          {problem ?? error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="h-12 rounded-full border border-[hsl(var(--border-default))] text-sm font-semibold text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]"
          >
            {tr('common.cancel', 'انصراف')}
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[hsl(var(--color-primary))] text-sm font-bold text-[hsl(var(--color-primary-fg))] disabled:opacity-40"
        >
          <Check className="size-4" aria-hidden="true" />
          {isSaving ? tr('common.saving', 'در حال ثبت…') : tr('display.save', 'ثبت')}
        </button>
      </div>
    </form>
  )
}
