'use client'

// ============================================
// «پیش‌فروش / پیش‌خرید جدید» — /invoices/new?type=pre_sale | pre_purchase.
//
// An advance is MONEY before the invoice, not lines: who, how much, how, when,
// and a note of what was pre-sold / pre-bought. The server books it
// (advances-02): a pre-sale Dr cash|bank / Cr customer advances, a pre-purchase
// Dr supplier advances / Cr cash|bank. No revenue, no expense, no stock — those
// come with the sale / purchase invoice, where the advance is then applied.
//
// ⚠️ Amount typed in major units of the BOOKS currency, sent as integer minor
// units; an unread books currency stops the form rather than guessing.
// ⚠️ The id is made once per filled form, so a retried tap is the same advance.
// ============================================

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiErrorMessage, useCreateAdvance, useCustomers, type AdvanceKind } from '@hisabche/api'
import { FRACTION_DIGITS, fractionDigits, toIsoDay, type KnownCurrency } from '@hisabche/formatting'

import { parseAmountMinor } from '../../../lib/bank-statement-csv'
import { useBookCurrency } from '../../../hooks/use-book-currency'
import { useLocalePush } from '../../../hooks/use-locale-push'
import { Button } from '../button'
import { JalaliDatePicker } from '../jalali-datepicker'
import { MoneyInput } from '../money-input'
import { SelectField } from '../select-field'
import { Textarea } from '../textarea'

function digitsOf(currency: string | undefined): 0 | 2 | 3 | null {
  if (!currency || !(currency in FRACTION_DIGITS)) return null
  return fractionDigits(currency as KnownCurrency)
}

export function AdvanceForm({ kind }: { kind: AdvanceKind }) {
  const t = useTranslations()
  const tr = (key: string, fallback: string): string => {
    try {
      const value = t(key as never)
      return value === key ? fallback : value
    } catch {
      return fallback
    }
  }
  const push = useLocalePush()
  const currency = useBookCurrency()
  const digits = digitsOf(currency)
  const parties = useCustomers({ page: 1, limit: 100, sortDirection: 'desc' })
  const create = useCreateAdvance()

  const [id] = useState(() => crypto.randomUUID())
  const [partyId, setPartyId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'bank'>('cash')
  const [date, setDate] = useState(() => toIsoDay(new Date()))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const partyOptions = useMemo(
    () =>
      (parties.data?.customers ?? [])
        .filter((party): party is typeof party & { id: string } => Boolean(party.id))
        .map((party) => ({
          value: party.id,
          label: party.fullName,
          keywords: party.phone ?? undefined,
        })),
    [parties.data],
  )

  const isSale = kind === 'pre_sale'
  const title = isSale
    ? tr('advances.newPreSale', 'پیش‌فروش جدید')
    : tr('advances.newPrePurchase', 'پیش‌خرید جدید')

  const submit = () => {
    if (!partyId) {
      setError(
        isSale
          ? tr('advances.customerRequired', 'مشتری را انتخاب کنید')
          : tr('advances.supplierRequired', 'تأمین‌کننده را انتخاب کنید'),
      )
      return
    }
    if (digits === null) {
      setError(tr('advances.currencyUnknown', 'ارز دفاتر خوانده نشد'))
      return
    }
    const amountMinor = parseAmountMinor(amount, digits)
    if (amountMinor === null || amountMinor <= 0) {
      setError(tr('advances.amountInvalid', 'مبلغ معتبر وارد کنید'))
      return
    }
    setError(null)
    create.mutate(
      {
        id,
        kind,
        partyId,
        amountMinor,
        paymentMethod: method,
        date,
        note: note.trim() || undefined,
      },
      {
        onSuccess: () => push(`/invoices?tab=advances&view=${isSale ? 'preSale' : 'prePurchase'}`),
        onError: (cause) => setError(apiErrorMessage(cause, tr('advances.failed', 'ثبت نشد'))),
      },
    )
  }

  return (
    <div data-advance-form={kind} className="mx-auto w-full max-w-xl space-y-4 p-4">
      <div className="space-y-1">
        <h1 className="text-lg font-bold text-[hsl(var(--fg-primary))]">{title}</h1>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {isSale
            ? tr(
                'advances.preSaleHelp',
                'مشتری پیش از تحویل پول می‌دهد. درآمد نیست؛ پیش‌دریافت است و هنگام فاکتور فروش روی آن اعمال می‌شود.',
              )
            : tr(
                'advances.prePurchaseHelp',
                'پیش از رسیدن کالا به تأمین‌کننده پول می‌دهید. هزینه نیست؛ پیش‌پرداخت است و هنگام فاکتور خرید روی آن اعمال می‌شود.',
              )}
        </p>
      </div>

      <SelectField
        value={partyId}
        onChange={setPartyId}
        aria-label={
          isSale ? tr('advances.customer', 'مشتری') : tr('advances.supplier', 'تأمین‌کننده')
        }
        placeholder={
          isSale ? tr('advances.customer', 'مشتری') : tr('advances.supplier', 'تأمین‌کننده')
        }
        options={partyOptions}
        searchable
      />
      <MoneyInput value={amount} onChange={setAmount} label={tr('advances.amount', 'مبلغ')} />
      <SelectField
        value={method}
        onChange={(value) => setMethod(value === 'bank' ? 'bank' : 'cash')}
        aria-label={tr('advances.method', 'روش')}
        options={[
          { value: 'cash', label: tr('advances.cash', 'نقد') },
          { value: 'bank', label: tr('advances.bank', 'بانک') },
        ]}
      />
      <JalaliDatePicker value={date} onChange={setDate} className="w-full" />
      <Textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={500}
        rows={2}
        placeholder={
          isSale
            ? tr('advances.notePreSale', 'چه چیزی پیش‌فروش شد؟')
            : tr('advances.notePrePurchase', 'چه چیزی پیش‌خرید شد؟')
        }
      />

      {error ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => push('/invoices?tab=advances')}>
          {tr('advances.cancel', 'انصراف')}
        </Button>
        <Button onClick={submit} disabled={create.isPending}>
          {create.isPending ? tr('advances.saving', 'در حال ثبت…') : tr('advances.save', 'ثبت')}
        </Button>
      </div>
    </div>
  )
}
