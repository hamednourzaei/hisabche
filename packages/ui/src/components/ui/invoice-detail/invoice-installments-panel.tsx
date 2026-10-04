'use client'

// ============================================
// «اقساط» — when the unpaid part of this invoice is due, in parts (#123).
//
// A schedule, not a payment: money is still recorded with «ثبت پرداخت», and
// the «پرداخت‌شده» of each installment is what the server derives from the
// invoice's own balance. The amounts are in the INVOICE's currency and are
// never typed here — the server splits what the invoice owes right now.
//
// Loads only when opened. «Not set up», «failed» and «no plan» are three
// different sentences.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarRange } from 'lucide-react'
import { formatNumber, toIsoDay } from '@hisabche/formatting'
import {
  apiErrorMessage,
  useClearInstallmentPlan,
  useInstallmentPlan,
  useSaveInstallmentPlan,
} from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { useDateFormat } from '../../../hooks/use-date-format'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { Button } from '../button'
import { JalaliDatePicker } from '../jalali-datepicker'
import { SelectField } from '../select-field'

/** Server refusals with a translation. Anything else gets the general message. */
export const INSTALLMENT_ERROR_CODES = [
  'INSTALLMENT_COUNT_INVALID',
  'INSTALLMENT_NOTHING_OWED',
  'INSTALLMENT_SUM_MISMATCH',
  'INSTALLMENTS_MIGRATION_PENDING',
] as const

export const INSTALLMENT_COUNTS = [2, 3, 4, 6, 9, 12, 18, 24] as const

export function InvoiceInstallmentsPanel({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations('installments')
  const locale = useIntlLocale()
  const { date } = useDateFormat()
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState<number>(3)
  const [firstDueDate, setFirstDueDate] = useState(() => toIsoDay(new Date()))
  const [confirmingClear, setConfirmingClear] = useState(false)

  const plan = useInstallmentPlan(invoiceId, open)
  const save = useSaveInstallmentPlan(invoiceId)
  const clear = useClearInstallmentPlan(invoiceId)

  const message = (error: unknown): string => {
    const raw = apiErrorMessage(error, '')
    const code = INSTALLMENT_ERROR_CODES.find((known) => raw.includes(known))
    return code ? t(`errors.${code}`) : t('errors.general')
  }
  const money = (value: number) => formatNumber(value, locale, 2)
  const failure = save.error ?? clear.error

  return (
    <section className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-[hsl(var(--fg-primary))]">
          <CalendarRange className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          {t('title')}
        </h3>
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
          {plan.data.lines.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-[hsl(var(--fg-secondary))]">
                      <th className="px-2 py-1.5 text-start font-medium">{t('seq')}</th>
                      <th className="px-2 py-1.5 text-start font-medium">{t('dueDate')}</th>
                      <th className="px-2 py-1.5 text-start font-medium">
                        {t('amount')} ({plan.data.currency})
                      </th>
                      <th className="px-2 py-1.5 text-start font-medium">{t('paid')}</th>
                      <th className="px-2 py-1.5 text-start font-medium">{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.data.lines.map((line) => (
                      <tr key={line.seq} className="border-t border-[hsl(var(--border-default))]">
                        <td className="px-2 py-1.5 tabular-nums">
                          {formatNumber(line.seq, locale, 0)}
                        </td>
                        <td className="px-2 py-1.5">{date(line.dueDate)}</td>
                        <td className="px-2 py-1.5 tabular-nums">{money(line.amount)}</td>
                        <td className="px-2 py-1.5 tabular-nums">{money(line.paid)}</td>
                        <td
                          className={cn(
                            'px-2 py-1.5 text-xs font-medium',
                            line.remaining === 0
                              ? 'text-[hsl(var(--color-success))]'
                              : line.daysLate > 0
                                ? 'text-[hsl(var(--color-destructive))]'
                                : 'text-[hsl(var(--fg-secondary))]',
                          )}
                        >
                          {line.remaining === 0
                            ? t('statusPaid')
                            : line.daysLate > 0
                              ? t('statusLate', { days: formatNumber(line.daysLate, locale, 0) })
                              : t('statusDue')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {confirmingClear ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[hsl(var(--fg-secondary))]">
                    {t('clearConfirm')}
                  </span>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={clear.isPending}
                    onClick={() =>
                      clear.mutate(undefined, { onSuccess: () => setConfirmingClear(false) })
                    }
                  >
                    {t('clearYes')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmingClear(false)}>
                    {t('cancel')}
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setConfirmingClear(true)}>
                  {t('clear')}
                </Button>
              )}
            </>
          ) : plan.data.outstanding <= 0 ? (
            // Nothing owed is not «no plan yet»: there is nothing to split.
            <p className="text-[hsl(var(--fg-secondary))]">{t('nothingOwed')}</p>
          ) : (
            <>
              <p className="text-[hsl(var(--fg-secondary))]">
                {t('noPlan')}{' '}
                <span className="tabular-nums text-[hsl(var(--fg-primary))]">
                  {money(plan.data.outstanding)} {plan.data.currency}
                </span>
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <span className="block text-xs text-[hsl(var(--fg-secondary))]">
                    {t('count')}
                  </span>
                  <SelectField
                    name="count"
                    data-field="count"
                    aria-label={t('count')}
                    value={String(count)}
                    onChange={(value) => setCount(Number(value))}
                    options={INSTALLMENT_COUNTS.map((option) => ({
                      value: String(option),
                      label: formatNumber(option, locale, 0),
                    }))}
                    className="h-10 w-28 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-sm"
                  />
                </div>
                <div className="space-y-1" data-field="firstDueDate">
                  <span className="block text-xs text-[hsl(var(--fg-secondary))]">
                    {t('firstDueDate')}
                  </span>
                  <JalaliDatePicker
                    value={firstDueDate}
                    onChange={setFirstDueDate}
                    className="w-40"
                  />
                </div>
                <Button
                  size="sm"
                  disabled={save.isPending || !firstDueDate}
                  onClick={() => save.mutate({ count, firstDueDate })}
                >
                  {t('save')}
                </Button>
              </div>
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('hint')}</p>
            </>
          )}

          {failure ? (
            <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
              {message(failure)}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
