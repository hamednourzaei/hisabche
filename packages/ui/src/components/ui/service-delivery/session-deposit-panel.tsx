'use client'

// ============================================
// «بیعانه‌ی این نوبت» — money taken when the service is booked (V54 5.4).
//
// ⚠️ NO SECOND DEPOSIT ENGINE. This is an ORDER DEPOSIT whose document is the
// session (`POST /orders/<sessionId>/deposits`, \`sourceType: 'service_session'\`):
//   receipt   Dr cash | bank         Cr customer advances   (not revenue)
//   apply     Dr customer advances   Cr receivable          (customer page)
//   refund    Dr customer advances   Cr cash | bank         (customer page)
// The server checks the session is real and belongs to this customer. Applying
// it to the invoice happens where every deposit is applied — the customer's
// deposits panel — so there is one place that settles advances.
//
// ⚠️ AMOUNTS: typed in major units of the BOOKS currency, sent as integer
// minor units. An unknown currency is not guessed: the form waits for it.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiErrorMessage, useCreateOrderDeposit, useCustomerDeposits } from '@hisabche/api'
import { fractionDigits, FRACTION_DIGITS, type KnownCurrency } from '@hisabche/formatting'

import { parseAmountMinor } from '../../../lib/bank-statement-csv'
import { useBookCurrency } from '../../../hooks/use-book-currency'
import { Button } from '../button'
import { Money } from '../capability/capability-kit'
import { MoneyInput } from '../money-input'
import { SelectField } from '../select-field'
import { useToast } from '../toast-provider'

function digitsOf(currency: string | undefined): 0 | 2 | 3 | null {
  if (!currency || !(currency in FRACTION_DIGITS)) return null
  return fractionDigits(currency as KnownCurrency)
}

export interface SessionDepositPanelProps {
  sessionId: string
  customerId: string
  mayWrite: boolean
}

export function SessionDepositPanel({ sessionId, customerId, mayWrite }: SessionDepositPanelProps) {
  const t = useTranslations()
  const tr = (key: string, fallback: string): string => {
    try {
      const value = t(key as never)
      return value === key ? fallback : value
    } catch {
      return fallback
    }
  }
  const toast = useToast()
  const currency = useBookCurrency()
  const digits = digitsOf(currency)
  const deposits = useCustomerDeposits(customerId)
  const create = useCreateOrderDeposit(sessionId)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'bank'>('cash')
  const [error, setError] = useState<string | null>(null)

  const mine = (deposits.data ?? []).filter((deposit) => deposit.orderId === sessionId)

  const submit = () => {
    if (digits === null) {
      setError(tr('serviceDelivery.deposit.currencyUnknown', 'ارز دفاتر خوانده نشد'))
      return
    }
    const amountMinor = parseAmountMinor(amount, digits)
    if (amountMinor === null || amountMinor <= 0) {
      setError(tr('serviceDelivery.deposit.amountInvalid', 'مبلغ معتبر وارد کنید'))
      return
    }
    setError(null)
    create.mutate(
      { customerId, amountMinor, paymentMethod: method, sourceType: 'service_session' },
      {
        onSuccess: () => {
          setAmount('')
          void deposits.refetch()
          toast.success(tr('serviceDelivery.deposit.saved', 'بیعانه ثبت شد'))
        },
        onError: (cause) =>
          setError(apiErrorMessage(cause, tr('serviceDelivery.deposit.failed', 'بیعانه ثبت نشد'))),
      },
    )
  }

  return (
    <section data-session-deposit className="space-y-3">
      <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
        {tr('serviceDelivery.deposit.title', 'بیعانه‌ی این نوبت')}
      </h3>

      {deposits.isError ? (
        <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
          {tr('serviceDelivery.deposit.unread', 'بیعانه‌ها خوانده نشد؛ این «خالی» نیست.')}
        </p>
      ) : mine.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {mine.map((deposit) => (
            <li key={deposit.id} className="flex items-center justify-between gap-2">
              <Money minor={deposit.amountMinor} currency={deposit.currency ?? undefined} />
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {tr('serviceDelivery.deposit.remaining', 'مانده')}:{' '}
                <Money minor={deposit.remainingMinor} currency={deposit.currency ?? undefined} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {tr('serviceDelivery.deposit.none', 'برای این نوبت بیعانه‌ای ثبت نشده است.')}
        </p>
      )}

      {mayWrite ? (
        <div className="space-y-2 rounded-xl border border-[hsl(var(--border-default))] p-3">
          <MoneyInput
            value={amount}
            onChange={setAmount}
            label={tr('serviceDelivery.deposit.amount', 'مبلغ بیعانه')}
          />
          <SelectField
            value={method}
            onChange={(value) => setMethod(value === 'bank' ? 'bank' : 'cash')}
            aria-label={tr('serviceDelivery.deposit.method', 'روش دریافت')}
            options={[
              { value: 'cash', label: tr('serviceDelivery.deposit.cash', 'نقد') },
              { value: 'bank', label: tr('serviceDelivery.deposit.bank', 'بانک') },
            ]}
          />
          {error ? (
            <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[hsl(var(--fg-tertiary))]">
              {tr(
                'serviceDelivery.deposit.help',
                'درآمد نیست؛ پیش‌دریافت مشتری است و از صفحه‌ی مشتری روی فاکتور اعمال می‌شود.',
              )}
            </span>
            <Button onClick={submit} disabled={create.isPending || !amount}>
              {create.isPending
                ? tr('serviceDelivery.actions.saving', 'در حال ذخیره…')
                : tr('serviceDelivery.deposit.record', 'ثبت بیعانه')}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
