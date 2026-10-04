'use client'

// ============================================
// «وام و سرمایه‌گذاری» — two registers beside the books (#125 #126).
//
//   وام‌ها           what the business borrowed or lent: principal, rate, dates,
//                    and the simple interest accrued to today.
//   سرمایه‌گذاری‌ها   what the business holds: its cost and the value a person
//                    stated on a day.
//
// ⚠️ NOTHING HERE POSTS TO THE LEDGER, and the note at the top says so: the
// interest is a calculation and the value is what somebody typed.
// ⚠️ Every amount is entered WITH its currency, and totals are per currency.
// ⚠️ A row is closed, never deleted or edited.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatNumber, toIsoDay } from '@hisabche/formatting'
import { useCurrencyStore } from '@hisabche/store'
import { CURRENCY_CODES } from '@hisabche/validation'
import {
  apiErrorMessage,
  useCreateInvestmentHolding,
  useCreateLoanFacility,
  useInvestmentHoldings,
  useLoanFacilities,
  useSetLoanFacilityActive,
  useUpdateInvestmentHolding,
  type FacilityKind,
  type InvestmentHolding,
} from '@hisabche/api'

import { cn } from '../../../../lib/utils'
import { useDateFormat } from '../../../../hooks/use-date-format'
import { useIntlLocale } from '../../../../hooks/use-intl-locale'
import { Button } from '../../button'
import { JalaliDatePicker } from '../../jalali-datepicker'
import { SelectField } from '../../select-field'

export const FINANCING_ERROR_CODES = [
  'FINANCING_DATES_INVERTED',
  'FINANCING_AMOUNT_INVALID',
  'FINANCING_VALUE_NEEDS_DATE',
  'FINANCING_MIGRATION_PENDING',
] as const
export const FINANCING_FREQUENCIES = [12, 4, 2, 1] as const

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'
const field =
  'h-10 w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'
const label = 'block text-xs text-[hsl(var(--fg-secondary))]'
const th = 'px-3 py-2.5 text-start text-xs font-medium text-[hsl(var(--fg-secondary))]'
const td = 'px-3 py-2.5 text-sm text-[hsl(var(--fg-primary))]'

const amountOf = (text: string): number | null => {
  const value = Number(text)
  return text.trim() !== '' && Number.isFinite(value) && value >= 0 ? value : null
}

export function FinancingTab() {
  const t = useTranslations('financing')
  const tCurrency = useTranslations('currency')

  const errorText = (error: unknown): string => {
    if ((error as { response?: { status?: number } } | null)?.response?.status === 403)
      return t('forbidden')
    const raw = apiErrorMessage(error, '')
    const code = FINANCING_ERROR_CODES.find((known) => raw.includes(known))
    return code ? t(`errors.${code}`) : t('errors.general')
  }
  const currencies = CURRENCY_CODES.map((code) => ({
    value: code,
    label: `${tCurrency(code.toLowerCase())} (${code})`,
  }))

  return (
    <div className="space-y-6">
      <p className={cn(card, 'p-3 text-xs text-[hsl(var(--fg-secondary))]')}>{t('notLedger')}</p>
      <Loans errorText={errorText} currencies={currencies} />
      <Holdings errorText={errorText} currencies={currencies} />
    </div>
  )
}

interface SectionProps {
  errorText: (error: unknown) => string
  currencies: Array<{ value: string; label: string }>
}

// ─── Loans ───────────────────────────────────────────────────────────────────

function Loans({ errorText, currencies }: SectionProps) {
  const t = useTranslations('financing')
  const locale = useIntlLocale()
  const { date } = useDateFormat()
  const primaryCurrency = useCurrencyStore((s) => s.primaryCurrency)
  const loans = useLoanFacilities()
  const create = useCreateLoanFacility()
  const setActive = useSetLoanFacilityActive()

  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<FacilityKind>('loan')
  const [counterparty, setCounterparty] = useState('')
  const [principal, setPrincipal] = useState('')
  const [currency, setCurrency] = useState<string>(primaryCurrency)
  const [rate, setRate] = useState('')
  const [startDate, setStartDate] = useState(() => toIsoDay(new Date()))
  const [endDate, setEndDate] = useState('')
  const [frequency, setFrequency] = useState('12')
  const [problem, setProblem] = useState<string | null>(null)

  const money = (value: number) => formatNumber(value, locale, 2)

  const submit = () => {
    const amount = amountOf(principal)
    const percent = amountOf(rate)
    if (
      counterparty.trim() === '' ||
      amount === null ||
      amount <= 0 ||
      percent === null ||
      !startDate
    ) {
      setProblem(t('errors.incomplete'))
      return
    }
    setProblem(null)
    create.mutate(
      {
        kind,
        counterparty,
        principal: amount,
        currency,
        annualRatePercent: percent,
        startDate,
        endDate: endDate || null,
        chargesPerYear: Number(frequency) as 1 | 2 | 4 | 12,
      },
      {
        onSuccess: () => {
          setAdding(false)
          setCounterparty('')
          setPrincipal('')
          setRate('')
          setEndDate('')
        },
      },
    )
  }

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">{t('loans.title')}</h2>
        {!adding ? (
          <Button size="sm" onClick={() => setAdding(true)}>
            {t('loans.add')}
          </Button>
        ) : null}
      </header>

      {adding ? (
        <div className={cn(card, 'space-y-3 p-4')}>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <span className={label}>{t('loans.kind')}</span>
              <SelectField
                name="kind"
                data-field="kind"
                aria-label={t('loans.kind')}
                value={kind}
                onChange={(next) => setKind(next as FacilityKind)}
                options={[
                  { value: 'loan', label: t('loans.kinds.loan') },
                  { value: 'receivable_facility', label: t('loans.kinds.receivable_facility') },
                ]}
                className={field}
              />
            </div>
            <label className="space-y-1">
              <span className={label}>{t('loans.counterparty')}</span>
              <input
                name="counterparty"
                value={counterparty}
                maxLength={120}
                onChange={(event) => setCounterparty(event.target.value)}
                className={field}
              />
            </label>
            <label className="space-y-1">
              <span className={label}>{t('loans.principal')}</span>
              <input
                name="principal"
                inputMode="decimal"
                dir="ltr"
                value={principal}
                onChange={(event) => setPrincipal(event.target.value)}
                className={cn(field, 'tabular-nums')}
              />
            </label>
            <div className="space-y-1">
              <span className={label}>{t('currency')}</span>
              <SelectField
                name="currency"
                data-field="currency"
                aria-label={t('currency')}
                value={currency}
                onChange={setCurrency}
                options={currencies}
                className={field}
              />
            </div>
            <label className="space-y-1">
              <span className={label}>{t('loans.rate')}</span>
              <input
                name="annualRatePercent"
                inputMode="decimal"
                dir="ltr"
                value={rate}
                onChange={(event) => setRate(event.target.value)}
                className={cn(field, 'tabular-nums')}
              />
            </label>
            <div className="space-y-1">
              <span className={label}>{t('loans.frequency')}</span>
              <SelectField
                name="chargesPerYear"
                data-field="chargesPerYear"
                aria-label={t('loans.frequency')}
                value={frequency}
                onChange={setFrequency}
                options={FINANCING_FREQUENCIES.map((option) => ({
                  value: String(option),
                  label: t(`loans.frequencies.${option}`),
                }))}
                className={field}
              />
            </div>
            <div className="space-y-1" data-field="startDate">
              <span className={label}>{t('loans.startDate')}</span>
              <JalaliDatePicker value={startDate} onChange={setStartDate} />
            </div>
            <div className="space-y-1" data-field="endDate">
              <span className={label}>{t('loans.endDate')}</span>
              <JalaliDatePicker
                value={endDate}
                onChange={setEndDate}
                placeholder={t('loans.noEnd')}
              />
            </div>
          </div>
          {problem || create.error ? (
            <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
              {problem ?? errorText(create.error)}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button size="sm" disabled={create.isPending} onClick={submit}>
              {t('save')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {loans.isLoading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
      ) : loans.error || !loans.data ? (
        <p role="alert" className={cn(card, 'p-4 text-sm text-[hsl(var(--color-destructive))]')}>
          {errorText(loans.error)}
        </p>
      ) : loans.data.facilities.length === 0 ? (
        <p className={cn(card, 'p-6 text-center text-sm text-[hsl(var(--fg-secondary))]')}>
          {t('loans.empty')}
        </p>
      ) : (
        <>
          {loans.data.totals.length > 0 ? (
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {loans.data.totals.map((total) => (
                <div key={`${total.currency}-${total.kind}`} className={cn(card, 'p-3')}>
                  <dt className="text-xs text-[hsl(var(--fg-secondary))]">
                    {t(`loans.kinds.${total.kind}`)} ({total.currency})
                  </dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
                    {money(total.principal)}
                  </dd>
                  <dd className="text-xs tabular-nums text-[hsl(var(--fg-tertiary))]">
                    {t('loans.accrued')}: {money(total.accruedInterest)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className={cn(card, 'overflow-x-auto')}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                  <th className={th}>{t('loans.counterparty')}</th>
                  <th className={th}>{t('loans.principal')}</th>
                  <th className={th}>{t('loans.rate')}</th>
                  <th className={th}>{t('loans.term')}</th>
                  <th className={th}>{t('loans.accrued')}</th>
                  <th className={th}>{t('loans.instalment')}</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {loans.data.facilities.map((loan) => (
                  <tr
                    key={loan.id}
                    className={cn(
                      'border-b border-[hsl(var(--border-default))]',
                      !loan.isActive && 'opacity-60',
                    )}
                  >
                    <td className={td}>
                      <span className="font-medium">{loan.counterparty}</span>
                      <span className="block text-xs text-[hsl(var(--fg-tertiary))]">
                        {t(`loans.kinds.${loan.kind}`)}
                        {!loan.isActive ? ` · ${t('closed')}` : ''}
                      </span>
                    </td>
                    <td className={cn(td, 'tabular-nums')}>
                      {money(loan.principal)}{' '}
                      <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                        {loan.currency}
                      </span>
                    </td>
                    <td className={cn(td, 'tabular-nums')}>
                      {formatNumber(loan.annualRatePercent, locale, 2)}٪
                    </td>
                    <td className={cn(td, 'text-xs')}>
                      {date(loan.startDate)} –{' '}
                      {loan.endDate ? date(loan.endDate) : t('loans.noEnd')}
                    </td>
                    <td className={cn(td, 'tabular-nums')}>
                      {money(loan.accruedInterest)}
                      <span className="block text-xs text-[hsl(var(--fg-tertiary))]">
                        {t('loans.days', { days: formatNumber(loan.accruedDays, locale, 0) })}
                      </span>
                    </td>
                    <td className={cn(td, 'tabular-nums')}>
                      {loan.instalment ? (
                        <>
                          {money(loan.instalment.perInstalment)}
                          <span className="block text-xs text-[hsl(var(--fg-tertiary))]">
                            × {formatNumber(loan.instalment.count, locale, 0)}
                          </span>
                        </>
                      ) : (
                        // No end date = no term to spread it over. Not zero.
                        <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                          {t('loans.noInstalment')}
                        </span>
                      )}
                    </td>
                    <td className={td}>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={setActive.isPending && setActive.variables?.id === loan.id}
                        onClick={() => setActive.mutate({ id: loan.id, isActive: !loan.isActive })}
                      >
                        {loan.isActive ? t('close') : t('reopen')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('loans.note')}</p>
        </>
      )}
      {setActive.error ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {errorText(setActive.error)}
        </p>
      ) : null}
    </section>
  )
}

// ─── Holdings ────────────────────────────────────────────────────────────────

function Holdings({ errorText, currencies }: SectionProps) {
  const t = useTranslations('financing')
  const locale = useIntlLocale()
  const { date } = useDateFormat()
  const primaryCurrency = useCurrencyStore((s) => s.primaryCurrency)
  const holdings = useInvestmentHoldings()
  const create = useCreateInvestmentHolding()
  const update = useUpdateInvestmentHolding()

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [cost, setCost] = useState('')
  const [value, setValue] = useState('')
  const [currency, setCurrency] = useState<string>(primaryCurrency)
  const [problem, setProblem] = useState<string | null>(null)
  const [revaluing, setRevaluing] = useState<InvestmentHolding | null>(null)
  const [newValue, setNewValue] = useState('')

  const money = (amount: number) => formatNumber(amount, locale, 2)

  const submit = () => {
    const paid = amountOf(cost)
    const worth = amountOf(value)
    if (name.trim() === '' || paid === null || worth === null) {
      setProblem(t('errors.incomplete'))
      return
    }
    setProblem(null)
    create.mutate(
      { label: name, cost: paid, marketValue: worth, currency, valuedOn: toIsoDay(new Date()) },
      {
        onSuccess: () => {
          setAdding(false)
          setName('')
          setCost('')
          setValue('')
        },
      },
    )
  }

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
          {t('holdings.title')}
        </h2>
        {!adding ? (
          <Button size="sm" onClick={() => setAdding(true)}>
            {t('holdings.add')}
          </Button>
        ) : null}
      </header>

      {adding ? (
        <div className={cn(card, 'space-y-3 p-4')}>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="space-y-1">
              <span className={label}>{t('holdings.label')}</span>
              <input
                name="label"
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                className={field}
              />
            </label>
            <label className="space-y-1">
              <span className={label}>{t('holdings.cost')}</span>
              <input
                name="cost"
                inputMode="decimal"
                dir="ltr"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
                className={cn(field, 'tabular-nums')}
              />
            </label>
            <label className="space-y-1">
              <span className={label}>{t('holdings.value')}</span>
              <input
                name="marketValue"
                inputMode="decimal"
                dir="ltr"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className={cn(field, 'tabular-nums')}
              />
            </label>
            <div className="space-y-1">
              <span className={label}>{t('currency')}</span>
              <SelectField
                name="currency"
                data-field="currency"
                aria-label={t('currency')}
                value={currency}
                onChange={setCurrency}
                options={currencies}
                className={field}
              />
            </div>
          </div>
          {problem || create.error ? (
            <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
              {problem ?? errorText(create.error)}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button size="sm" disabled={create.isPending} onClick={submit}>
              {t('save')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {holdings.isLoading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
      ) : holdings.error || !holdings.data ? (
        <p role="alert" className={cn(card, 'p-4 text-sm text-[hsl(var(--color-destructive))]')}>
          {errorText(holdings.error)}
        </p>
      ) : holdings.data.holdings.length === 0 ? (
        <p className={cn(card, 'p-6 text-center text-sm text-[hsl(var(--fg-secondary))]')}>
          {t('holdings.empty')}
        </p>
      ) : (
        <>
          {holdings.data.summaries.length > 0 ? (
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {holdings.data.summaries.map((summary) => (
                <div key={summary.currency} className={cn(card, 'p-3')}>
                  <dt className="text-xs text-[hsl(var(--fg-secondary))]">
                    {t('holdings.value')} ({summary.currency})
                  </dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
                    {money(summary.marketValue)}
                  </dd>
                  <dd className="text-xs tabular-nums text-[hsl(var(--fg-tertiary))]" dir="ltr">
                    {t('holdings.difference')}: {money(summary.unrealisedGain)}
                    {summary.unrealisedGainPercent !== null
                      ? ` (${formatNumber(summary.unrealisedGainPercent, locale, 2)}%)`
                      : ''}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className={cn(card, 'overflow-x-auto')}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                  <th className={th}>{t('holdings.label')}</th>
                  <th className={th}>{t('holdings.cost')}</th>
                  <th className={th}>{t('holdings.value')}</th>
                  <th className={th}>{t('holdings.valuedOn')}</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {holdings.data.holdings.map((holding) => (
                  <tr
                    key={holding.id}
                    className={cn(
                      'border-b border-[hsl(var(--border-default))]',
                      !holding.isActive && 'opacity-60',
                    )}
                  >
                    <td className={td}>
                      <span className="font-medium">{holding.label}</span>
                      {!holding.isActive ? (
                        <span className="block text-xs text-[hsl(var(--fg-tertiary))]">
                          {t('closed')}
                        </span>
                      ) : null}
                    </td>
                    <td className={cn(td, 'tabular-nums')}>
                      {money(holding.cost)}{' '}
                      <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                        {holding.currency}
                      </span>
                    </td>
                    <td className={cn(td, 'tabular-nums')}>
                      {revaluing?.id === holding.id ? (
                        <span className="flex items-center gap-1.5">
                          <input
                            name="marketValue"
                            inputMode="decimal"
                            dir="ltr"
                            aria-label={t('holdings.value')}
                            value={newValue}
                            onChange={(event) => setNewValue(event.target.value)}
                            className={cn(field, 'h-9 w-28 tabular-nums')}
                          />
                          <Button
                            size="sm"
                            disabled={update.isPending || amountOf(newValue) === null}
                            onClick={() =>
                              update.mutate(
                                {
                                  id: holding.id,
                                  marketValue: amountOf(newValue) ?? 0,
                                  valuedOn: toIsoDay(new Date()),
                                },
                                { onSuccess: () => setRevaluing(null) },
                              )
                            }
                          >
                            {t('save')}
                          </Button>
                        </span>
                      ) : (
                        money(holding.marketValue)
                      )}
                    </td>
                    <td className={cn(td, 'text-xs')}>{date(holding.valuedOn)}</td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-1.5">
                        {holding.isActive && revaluing?.id !== holding.id ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRevaluing(holding)
                              setNewValue(String(holding.marketValue))
                            }}
                          >
                            {t('holdings.revalue')}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={update.isPending && update.variables?.id === holding.id}
                          onClick={() =>
                            update.mutate({ id: holding.id, isActive: !holding.isActive })
                          }
                        >
                          {holding.isActive ? t('close') : t('reopen')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('holdings.note')}</p>
        </>
      )}
      {update.error ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {errorText(update.error)}
        </p>
      ) : null}
    </section>
  )
}
