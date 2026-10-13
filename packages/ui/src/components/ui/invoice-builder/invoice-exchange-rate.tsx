'use client'

// ============================================
// «نرخ تبدیل» on an invoice whose currency is not the one the books are kept in.
//
// Shown only then, and required then: the books hold ONE currency, so an
// invoice in another says what it was worth that day. Without it the invoice
// is not sent — and the server refuses it too.
//
// Written the way a rate is said, the same as the rate form on the warehouse
// page: «[amount] [invoice currency] = [amount] [books currency]».
// ============================================

import { exchangeRateOf } from '../../../lib/invoices/exchange-rate'

const amountInput =
  'h-10 w-full min-w-0 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 text-sm tabular-nums'
const unit = 'shrink-0 text-sm text-[hsl(var(--fg-secondary))]'

export function InvoiceExchangeRate({
  t,
  invoiceCurrency,
  bookCurrency,
  from,
  to,
  onChange,
}: {
  t: (key: string, fallback?: string) => string
  invoiceCurrency: string
  bookCurrency: string
  /** Amount of the invoice's currency, as typed. */
  from: string
  /** What that amount is worth in the books currency, as typed. */
  to: string
  onChange: (next: { from: string; to: string }) => void
}) {
  const nameOf = (code: string) => t(`currency.${code.toLowerCase()}`, code)
  const missing = exchangeRateOf(from, to) === null

  return (
    <div
      className="rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] p-3"
      data-invoice-rate={missing ? 'missing' : 'set'}
    >
      <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">
        {t('invoiceBuilder.rate.title', 'نرخ تبدیل')}
      </p>
      <p className="mt-0.5 text-xs text-[hsl(var(--fg-secondary))]">
        {t(
          'invoiceBuilder.rate.hint',
          'ارز این فاکتور با ارز دفاتر شما فرق دارد. نرخ همان روز را وارد کنید تا موجودی، بهای تمام‌شده و حساب‌ها درست ثبت شوند.',
        )}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex min-w-36 flex-1 items-center gap-2">
          <input
            name="exchangeRateFrom"
            aria-label={`${t('invoiceBuilder.rate.amount', 'مقدار')} ${nameOf(invoiceCurrency)}`}
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={from}
            onChange={(event) => onChange({ from: event.target.value, to })}
            className={amountInput}
          />
          <span className={unit}>{nameOf(invoiceCurrency)}</span>
        </div>
        <span aria-hidden="true" className="text-sm text-[hsl(var(--fg-tertiary))]">
          =
        </span>
        <div className="flex min-w-36 flex-1 items-center gap-2">
          <input
            name="exchangeRateTo"
            aria-label={`${t('invoiceBuilder.rate.amount', 'مقدار')} ${nameOf(bookCurrency)}`}
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={to}
            onChange={(event) => onChange({ from, to: event.target.value })}
            className={amountInput}
          />
          <span className={unit}>{nameOf(bookCurrency)}</span>
        </div>
      </div>
      {missing ? (
        <p role="alert" className="mt-1.5 text-xs text-[hsl(var(--color-warning))]">
          {t(
            'invoiceBuilder.rate.required',
            'بدون نرخ تبدیل این فاکتور ثبت نمی‌شود. هر دو مقدار باید بزرگ‌تر از صفر باشند.',
          )}
        </p>
      ) : null}
    </div>
  )
}
