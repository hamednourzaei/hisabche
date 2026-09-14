'use client'

// ============================================
// packages/ui/src/components/ui/invoice-detail/record-payment-form.tsx
//
// T9 — «چطور پرداخت شد», finally askable.
//
// ---------------------------------------------------------------------------
// WHAT WAS MISSING
//
// The invoice detail page could SHOW payments (H2 built that panel) but there
// was no way to add one. `POST /api/payments` with allocations existed and had
// no caller from this screen. So the only way an invoice ever got a paid
// amount was the create form writing `paid_amount` straight onto the row —
// which is the drift the owner reported on a real sale.
//
// ---------------------------------------------------------------------------
// ⚠️ THE AMOUNT IS CAPPED AT WHAT IS OUTSTANDING, AND THE CAP IS NOT COSMETIC
//
// The server refuses an over-allocation with PAYMENT_ALLOCATION_EXCEEDS_
// OUTSTANDING. Capping here means the person finds out while typing rather
// than after submitting. The server check is still the one that decides —
// this is a courtesy, not the enforcement.
//
// A customer paying MORE than this invoice's balance is a real and normal
// thing; it is recorded as a payment against the party with the remainder left
// as an advance, which is what the payments page is for. It is not this
// form's job, because this form settles ONE invoice.
// ============================================

import * as React from 'react'

import { Plus, X } from 'lucide-react'

import { Button } from '../button'
import { Input } from '../input'
import { Label } from '../label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select'
import { cn } from '../../../lib/utils'
import { MoneyInput } from '../money-input'

/** Mirrors `paymentMethodSchema`. Widening this without widening that is a 400. */
export const PAYMENT_METHODS = ['cash', 'bank', 'credit', 'mobile_money'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'نقدی',
  bank: 'بانکی / حواله',
  credit: 'نسیه',
  mobile_money: 'پول موبایلی',
}

export interface RecordPaymentFormProps {
  t: (key: string, fallback?: string) => string
  fmtMoney: (value: number) => string
  currency: string
  /** What is still owed on THIS invoice. The amount is capped at it. */
  outstanding: number
  isSubmitting: boolean
  /** Server-side refusal, shown verbatim rather than swallowed. */
  error?: string | null
  onSubmit: (input: {
    amount: number
    method: PaymentMethod
    reference: string
    date: string
  }) => void
  onCancel: () => void
}

const today = () => new Date().toISOString().slice(0, 10)

export function RecordPaymentForm({
  t,
  fmtMoney,
  currency,
  outstanding,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
}: RecordPaymentFormProps) {
  // Pre-filled with the full balance — «مشتری همه‌اش را داد» is the common
  // case, and the uncommon one is one edit away.
  const [amount, setAmount] = React.useState(String(outstanding > 0 ? outstanding : ''))
  const [method, setMethod] = React.useState<PaymentMethod>('cash')
  const [reference, setReference] = React.useState('')
  const [date, setDate] = React.useState(today())

  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= outstanding + 0.005

  return (
    <form
      className="space-y-3 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] p-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (!valid || isSubmitting) return
        onSubmit({ amount: parsed, method, reference: reference.trim(), date })
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t('invoiceDetail.addPayment', 'افزودن پرداخت')}
        </h3>
        <span className="text-xs text-[hsl(var(--fg-tertiary))]">
          {t('invoiceDetail.outstanding', 'مانده')}: {fmtMoney(outstanding)} {currency}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="payment-amount">{t('invoiceDetail.amount', 'مبلغ')}</Label>
          <MoneyInput
            id="payment-amount"
            value={amount}
            onChange={setAmount}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="payment-date">{t('invoiceDetail.date', 'تاریخ')}</Label>
          <Input
            id="payment-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>{t('invoiceDetail.method', 'روش پرداخت')}</Label>
        <Select
          value={method}
          onValueChange={(value) => setMethod(value as PaymentMethod)}
          disabled={isSubmitting}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_METHODS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`payment.method.${value}`, METHOD_LABEL[value])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="payment-reference">
          {t('invoiceDetail.reference', 'شماره مرجع (اختیاری)')}
        </Label>
        <Input
          id="payment-reference"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          disabled={isSubmitting}
          placeholder={t('invoiceDetail.referenceHint', 'شماره حواله، رسید، چک…')}
        />
      </div>

      {/* The server's refusal, verbatim. Replacing it with a generic message
          hides WHICH rule was broken, and these codes are specific for a
          reason — an over-allocation and a closed period are different
          problems with different fixes. */}
      {error ? (
        <p className="text-xs text-[hsl(var(--color-destructive))]" role="alert">
          {error}
        </p>
      ) : null}

      {!valid && amount !== '' ? (
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {t(
            'invoiceDetail.amountTooLarge',
            'مبلغ باید بیشتر از صفر و حداکثر به اندازه‌ی مانده باشد',
          )}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={!valid || isSubmitting} className="flex-1">
          {isSubmitting
            ? t('common.saving', 'در حال ثبت…')
            : t('invoiceDetail.savePayment', 'ثبت پرداخت')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t('common.cancel', 'انصراف')}
        </Button>
      </div>
    </form>
  )
}

export interface AddPaymentButtonProps {
  t: (key: string, fallback?: string) => string
  disabled?: boolean
  onClick: () => void
}

export function AddPaymentButton({ t, disabled, onClick }: AddPaymentButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn('gap-1.5')}
    >
      <Plus className="size-3.5" aria-hidden="true" />
      {t('invoiceDetail.addPayment', 'افزودن پرداخت')}
    </Button>
  )
}

export interface CancelPaymentButtonProps {
  t: (key: string, fallback?: string) => string
  disabled?: boolean
  onClick: () => void
}

/**
 * «حذف پرداخت» — which cancels rather than deletes.
 *
 * The label says حذف because that is what the person means. What happens is a
 * cancellation: the invoice reopens and the journal entry is reversed, and the
 * record of both stays. See `useCancelPayment`.
 */
export function CancelPaymentButton({ t, disabled, onClick }: CancelPaymentButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={t('invoiceDetail.removePayment', 'حذف پرداخت')}
      title={t('invoiceDetail.removePayment', 'حذف پرداخت')}
      className={cn(
        'shrink-0 rounded-lg p-1.5 transition-colors',
        'text-[hsl(var(--fg-tertiary))]',
        'hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))]',
        'disabled:cursor-not-allowed disabled:opacity-40',
      )}
    >
      <X className="size-3.5" aria-hidden="true" />
    </button>
  )
}
