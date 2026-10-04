'use client'

// ============================================
// «جریمه‌ی دیرکرد» — the late fee on one overdue sale invoice (#124).
//
// It shows what is overdue, what the business's policy asks for, and what has
// already been charged. Charging is a button a manager presses; nothing is
// charged by opening this panel, and nothing is ever charged automatically.
//
// The fee becomes an ordinary sale invoice for the same customer — it is paid,
// cancelled and reported like any other invoice.
//
// ⚠️ WHY NOTHING CAN BE CHARGED IS SAID IN WORDS (policy off, another currency,
// no due date, …) — an empty panel would read as «nothing is late».
// ⚠️ A fixed amount is entered WITH ITS CURRENCY and its period («per 30 days»)
// beside the field; a percentage says what it is a percentage of.
// ⚠️ Loads only when opened. «Not set up», «failed» and «nothing late» are
// three different sentences.
// ============================================

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlarmClock } from 'lucide-react'
import { formatNumber } from '@hisabche/formatting'
import { useCurrencyStore } from '@hisabche/store'
import {
  CURRENCY_CODES,
  LATE_FEE_PERIOD_DAYS,
  lateFeePolicySchema,
  type LateFeeBasisName,
  type LateFeePolicy,
} from '@hisabche/validation'
import {
  apiErrorMessage,
  useAssessLateFee,
  useLateFeePreview,
  useSaveLateFeePolicy,
} from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { useDateFormat } from '../../../hooks/use-date-format'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { Button } from '../button'
import { SelectField } from '../select-field'

/** Server and schema refusals with a translation. Anything else: the general message. */
export const LATE_FEE_ERROR_CODES = [
  'LATE_FEE_NOTHING_TO_ASSESS',
  'LATE_FEE_AMOUNT_REQUIRED',
  'LATE_FEE_CURRENCY_REQUIRED',
  'LATE_FEE_PERCENT_REQUIRED',
  'LATE_FEES_MIGRATION_PENDING',
] as const

/** Why nothing can be charged; each has a sentence. */
export const LATE_FEE_BLOCKED_STATES = [
  'off',
  'other_currency',
  'not_sale',
  'cancelled',
  'no_customer',
  'no_due_date',
  'fee_invoice',
] as const

const FEE_LANGUAGES = ['fa', 'af', 'en'] as const
const field =
  'h-10 w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'
const label = 'block text-xs text-[hsl(var(--fg-secondary))]'
const faint = 'text-xs text-[hsl(var(--fg-tertiary))]'
const danger = 'text-sm text-[hsl(var(--color-destructive))]'

type ErrorText = (error: unknown) => string

export function InvoiceLateFeePanel({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations('lateFees')
  const locale = useIntlLocale()
  const appLocale = useLocale()
  const { date } = useDateFormat()
  const [open, setOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const preview = useLateFeePreview(invoiceId, open)
  const assess = useAssessLateFee(invoiceId)

  const errorText: ErrorText = (error) => {
    if ((error as { response?: { status?: number } } | null)?.response?.status === 403) {
      return t('forbidden')
    }
    const raw = apiErrorMessage(error, '')
    const code = LATE_FEE_ERROR_CODES.find((known) => raw.includes(known))
    return code ? t(`errors.${code}`) : t('errors.general')
  }
  const money = (value: number) => formatNumber(value, locale, 2)
  const whole = (value: number) => formatNumber(value, locale, 0)
  const language = FEE_LANGUAGES.find((known) => known === appLocale) ?? 'fa'
  const data = preview.data

  const policyText = (policy: LateFeePolicy) =>
    policy.basis === 'per_period'
      ? t('policyFixed', {
          amount: money(policy.amount ?? 0),
          currency: policy.currency ?? '',
          days: whole(LATE_FEE_PERIOD_DAYS),
        })
      : t('policyPercent', { percent: formatNumber(policy.percent ?? 0, locale, 3) })

  return (
    <section className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-[hsl(var(--fg-primary))]">
          <AlarmClock className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          {t('title')}
        </h3>
        <Button size="sm" variant="ghost" onClick={() => setOpen((value) => !value)}>
          {open ? t('hide') : t('show')}
        </Button>
      </div>

      {open && preview.isLoading ? (
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('loading')}</p>
      ) : null}
      {open && preview.error ? (
        <p role="alert" className={danger}>
          {errorText(preview.error)}
        </p>
      ) : null}

      {open && data ? (
        <div className="space-y-3 text-sm">
          <p className="text-[hsl(var(--fg-secondary))]">
            {data.policy && data.policy.isEnabled ? (
              <>
                {policyText(data.policy)}
                {data.policy.graceDays > 0
                  ? ` ${t('policyGrace', { days: whole(data.policy.graceDays) })}`
                  : ''}
                {data.policy.maxSharePercent < 100
                  ? ` ${t('policyCap', { percent: formatNumber(data.policy.maxSharePercent, locale, 3) })}`
                  : ''}
              </>
            ) : (
              t('policyOff')
            )}
          </p>

          {data.state !== 'ready' ? (
            <p className="text-[hsl(var(--fg-primary))]">
              {t(`blocked.${LATE_FEE_BLOCKED_STATES.find((s) => s === data.state) ?? 'off'}`)}
            </p>
          ) : data.lines.length === 0 ? (
            <p className="text-[hsl(var(--fg-primary))]">{t('nothingLate')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-[hsl(var(--fg-secondary))]">
                    <th className="px-2 py-1.5 text-start font-medium">{t('what')}</th>
                    <th className="px-2 py-1.5 text-start font-medium">{t('dueDate')}</th>
                    <th className="px-2 py-1.5 text-start font-medium">{t('daysLate')}</th>
                    <th className="px-2 py-1.5 text-start font-medium">
                      {t('overdue')} ({data.currency})
                    </th>
                    <th className="px-2 py-1.5 text-start font-medium">
                      {t('charged')} ({data.currency})
                    </th>
                    <th className="px-2 py-1.5 text-start font-medium">
                      {t('chargeable')} ({data.currency})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((line) => (
                    <tr key={line.seq} className="border-t border-[hsl(var(--border-default))]">
                      <td className="px-2 py-1.5">
                        {line.seq === 0
                          ? t('wholeInvoice')
                          : t('installment', { seq: whole(line.seq) })}
                      </td>
                      <td className="px-2 py-1.5">{date(line.dueDate)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{whole(line.daysLate)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{money(line.overdue)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{money(line.assessed)}</td>
                      <td className="px-2 py-1.5 font-medium tabular-nums text-[hsl(var(--fg-primary))]">
                        {money(line.toAssess)}
                        {line.capped ? <span className={faint}> · {t('capped')}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.assessments.length > 0 ? (
            <div className="space-y-1">
              <p className={label}>{t('history')}</p>
              <ul className="space-y-1">
                {data.assessments.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[hsl(var(--fg-primary))]">{date(row.assessedAt)}</span>
                    <span className="tabular-nums text-[hsl(var(--fg-primary))]">
                      {money(row.fee)} {data.currency}
                    </span>
                    <span className="text-[hsl(var(--fg-secondary))]">
                      {row.seq === 0
                        ? t('wholeInvoice')
                        : t('installment', { seq: whole(row.seq) })}
                      {' · '}
                      {t('lateBy', { days: whole(row.daysLate) })}
                    </span>
                    {row.feeInvoiceId === null ? (
                      <span className="text-[hsl(var(--color-destructive))]">{t('notIssued')}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.state === 'ready' &&
          (data.totalToAssess > 0 || data.assessments.some((row) => row.feeInvoiceId === null)) ? (
            confirming ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-[hsl(var(--fg-secondary))]">
                  {t('confirm', { amount: money(data.totalToAssess), currency: data.currency })}
                </span>
                <Button
                  size="sm"
                  disabled={assess.isPending}
                  onClick={() =>
                    assess.mutate({ language }, { onSettled: () => setConfirming(false) })
                  }
                >
                  {t('confirmYes')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                  {t('cancel')}
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setConfirming(true)}>
                {data.totalToAssess > 0
                  ? t('charge', { amount: money(data.totalToAssess), currency: data.currency })
                  : t('finish')}
              </Button>
            )
          ) : null}

          {assess.error ? (
            <p role="alert" className={danger}>
              {errorText(assess.error)}
            </p>
          ) : null}

          <p className={faint}>{t('note')}</p>

          {editingPolicy ? (
            <PolicyForm
              policy={data.policy}
              errorText={errorText}
              onDone={() => setEditingPolicy(false)}
            />
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditingPolicy(true)}>
              {t('editPolicy')}
            </Button>
          )}
        </div>
      ) : null}
    </section>
  )
}

/** The business's late fee policy. It applies to every invoice, not only this one. */
function PolicyForm({
  policy,
  errorText,
  onDone,
}: {
  policy: LateFeePolicy | null
  errorText: ErrorText
  onDone: () => void
}) {
  const t = useTranslations('lateFees')
  const tCurrency = useTranslations('currency')
  const locale = useIntlLocale()
  const primaryCurrency = useCurrencyStore((s) => s.primaryCurrency)
  const save = useSaveLateFeePolicy()

  const [isEnabled, setIsEnabled] = useState(policy?.isEnabled ?? false)
  const [basis, setBasis] = useState<LateFeeBasisName>(policy?.basis ?? 'per_period')
  const [amount, setAmount] = useState(policy?.amount != null ? String(policy.amount) : '')
  const [currency, setCurrency] = useState<string>(policy?.currency ?? primaryCurrency)
  const [percent, setPercent] = useState(policy?.percent != null ? String(policy.percent) : '')
  const [graceDays, setGraceDays] = useState(String(policy?.graceDays ?? 0))
  const [maxShare, setMaxShare] = useState(String(policy?.maxSharePercent ?? 100))
  const [problem, setProblem] = useState<string | null>(null)

  const numberOrNull = (text: string) => (text.trim() === '' ? null : Number(text))

  const submit = () => {
    const parsed = lateFeePolicySchema.safeParse({
      isEnabled,
      basis,
      amount: basis === 'per_period' ? numberOrNull(amount) : null,
      currency: basis === 'per_period' ? currency : null,
      percent: basis === 'percentage' ? numberOrNull(percent) : null,
      graceDays: Number(graceDays),
      maxSharePercent: Number(maxShare),
    })
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      const code = LATE_FEE_ERROR_CODES.find((known) => known === first?.message)
      setProblem(code ? t(`errors.${code}`) : t('errors.incomplete'))
      return
    }
    setProblem(null)
    save.mutate(parsed.data, { onSuccess: onDone })
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] p-3">
      <p className="font-medium text-[hsl(var(--fg-primary))]">{t('policyTitle')}</p>
      <p className={faint}>{t('policyScope')}</p>

      <label className="flex items-start gap-2 text-sm text-[hsl(var(--fg-primary))]">
        <input
          type="checkbox"
          name="isEnabled"
          checked={isEnabled}
          onChange={(event) => setIsEnabled(event.target.checked)}
          className="mt-1"
        />
        <span>{t('enabled')}</span>
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <span className={label}>{t('basis')}</span>
          <SelectField
            name="basis"
            data-field="basis"
            aria-label={t('basis')}
            value={basis}
            onChange={(next) => setBasis(next as LateFeeBasisName)}
            options={[
              { value: 'per_period', label: t('bases.per_period') },
              { value: 'percentage', label: t('bases.percentage') },
            ]}
            className={field}
          />
        </div>

        {basis === 'per_period' ? (
          <>
            <label className="space-y-1">
              <span className={label}>
                {t('amountPerPeriod', { days: formatNumber(LATE_FEE_PERIOD_DAYS, locale, 0) })}
              </span>
              <input
                name="amount"
                inputMode="decimal"
                dir="ltr"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
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
                options={CURRENCY_CODES.map((code) => ({
                  value: code,
                  label: `${tCurrency(code.toLowerCase())} (${code})`,
                }))}
                className={field}
              />
            </div>
          </>
        ) : (
          <label className="space-y-1">
            <span className={label}>{t('percentOfOverdue')}</span>
            <input
              name="percent"
              inputMode="decimal"
              dir="ltr"
              value={percent}
              onChange={(event) => setPercent(event.target.value)}
              className={cn(field, 'tabular-nums')}
            />
          </label>
        )}

        <label className="space-y-1">
          <span className={label}>{t('graceDays')}</span>
          <input
            name="graceDays"
            inputMode="numeric"
            dir="ltr"
            value={graceDays}
            onChange={(event) => setGraceDays(event.target.value)}
            className={cn(field, 'tabular-nums')}
          />
        </label>
        <label className="space-y-1">
          <span className={label}>{t('maxShare')}</span>
          <input
            name="maxSharePercent"
            inputMode="decimal"
            dir="ltr"
            value={maxShare}
            onChange={(event) => setMaxShare(event.target.value)}
            className={cn(field, 'tabular-nums')}
          />
        </label>
      </div>
      <p className={faint}>{basis === 'per_period' ? t('currencyHint') : t('percentHint')}</p>

      {problem || save.error ? (
        <p role="alert" className={danger}>
          {problem ?? errorText(save.error)}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button size="sm" disabled={save.isPending} onClick={submit}>
          {t('savePolicy')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          {t('cancel')}
        </Button>
      </div>
    </div>
  )
}
