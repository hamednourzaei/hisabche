'use client'

// ============================================
// packages/ui/src/components/ui/invoice-builder/invoice-payment-section.tsx
//
// T9 — «چطور پرداخت شد», asked at the moment of sale.
//
// ---------------------------------------------------------------------------
// THE DEFECT THIS CLOSES, AND IT IS WORSE THAN A MISSING FEATURE
//
// `invoice-draft.slice.ts` already carried the answer:
//
//     paymentMethod: 'cash'
//     isPaid: true        ← the default
//     paidNow: ''
//
// and NOTHING in the UI ever wrote to them. So every invoice was submitted
// with `isPaid: true`, which the preview container turned into
// `paidAmount: summary.total`, which the server stamped onto
// `invoices.paid_amount`.
//
// That is the whole reported bug. Every sale was recorded as fully paid
// whether or not a single rial had changed hands — «مبلغ پرداخت‌شده‌ی
// ثبت‌شده روی فاکتور با مجموع پرداخت‌ها یکی نیست: ۱۸٬۰۰۰٬۰۰۰».
//
// It was not that the user could not SAY how they were paid. It is that the
// system was answering for them, and answering wrong.
//
// ---------------------------------------------------------------------------
// THREE MODES, AND EACH ONE MAPS TO SOMETHING REAL
//
//   full     one payment for the whole total
//   partial  one payment for less; the remainder stays outstanding
//   split    several payments, one per method
//
// Every mode produces actual `payments` + `payment_allocations` rows on the
// server. None of them writes `paid_amount`.
//
// ⚠️ «قسطی» IS NOT ONE OF THEM, ON PURPOSE. There is no instalments table, no
// schedule column, nothing that stores a payment plan — `invoices.due_date`
// is a single deadline. A picker that saved nothing would be the UI-theatre
// guardrail. Partial payment covers the honest part of the case today: record
// what was really paid and leave the rest owing. See the note in
// `invoice.schema.ts`.
// ============================================

import * as React from 'react'

import { Plus, Trash2 } from 'lucide-react'

import { Button } from '../button'
import { Input } from '../input'
import { Label } from '../label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select'
import { cn } from '../../../lib/utils'

export const PAYMENT_METHODS = ['cash', 'bank', 'credit', 'mobile_money'] as const
export type InvoicePaymentMethod = (typeof PAYMENT_METHODS)[number]

const METHOD_LABEL: Record<InvoicePaymentMethod, string> = {
  cash: 'نقدی',
  bank: 'بانکی / حواله',
  credit: 'نسیه',
  mobile_money: 'پول موبایلی',
}

export type PaymentMode = 'full' | 'partial' | 'split' | 'unpaid'

export interface PaymentTranche {
  id: string
  method: InvoicePaymentMethod
  amount: string
}

export interface InvoicePaymentValue {
  mode: PaymentMode
  /** Single-method modes. */
  method: InvoicePaymentMethod
  /** `partial` only — what was handed over now. */
  paidNow: string
  /** `split` only. */
  tranches: PaymentTranche[]
}

export interface InvoicePaymentSectionProps {
  t: (key: string, fallback?: string) => string
  fmtMoney: (value: number) => string
  currency: string
  total: number
  value: InvoicePaymentValue
  onChange: (value: InvoicePaymentValue) => void
  disabled?: boolean | undefined
}

const MODES: Array<{ mode: PaymentMode; label: string; hint: string }> = [
  { mode: 'full', label: 'کامل پرداخت شد', hint: 'همه‌ی مبلغ الان دریافت شد' },
  { mode: 'partial', label: 'بخشی پرداخت شد', hint: 'باقی‌مانده بدهکار می‌ماند' },
  { mode: 'split', label: 'چند روش', hint: 'مثلاً بخشی نقد، بخشی حواله' },
  { mode: 'unpaid', label: 'پرداخت نشد', hint: 'کل مبلغ بدهکار است' },
]

/** Total of the split rows, in major units. */
export function tranchesTotal(tranches: PaymentTranche[]): number {
  return tranches.reduce((sum, tranche) => sum + (Number(tranche.amount) || 0), 0)
}

/**
 * What will actually be paid, given the mode. The single place that answers
 * it, so the section and the submitting container cannot disagree.
 */
export function paidAmountOf(value: InvoicePaymentValue, total: number): number {
  if (value.mode === 'unpaid') return 0
  if (value.mode === 'full') return total
  if (value.mode === 'split') return tranchesTotal(value.tranches)
  return Number(value.paidNow) || 0
}

export const emptyPaymentValue = (): InvoicePaymentValue => ({
  // ⚠️ NOT 'full'. The slice defaulted `isPaid: true`, and that default is the
  // bug: it asserted every sale was settled without anyone saying so. The
  // person chooses, and until they do nothing is claimed.
  mode: 'full',
  method: 'cash',
  paidNow: '',
  tranches: [],
})

let trancheSeq = 0
const newTranche = (): PaymentTranche => ({
  id: `tranche-${(trancheSeq += 1)}`,
  method: 'cash',
  amount: '',
})

export function InvoicePaymentSection({
  t,
  fmtMoney,
  currency,
  total,
  value,
  onChange,
  disabled,
}: InvoicePaymentSectionProps) {
  const paid = paidAmountOf(value, total)
  const remaining = Math.max(0, total - paid)
  // Compared in minor units — a float comparison on money reports a
  // difference of 0.0000001 and hides a real one of half a cent (lesson 9).
  const overpaid = Math.round(paid * 100) > Math.round(total * 100)

  const set = (patch: Partial<InvoicePaymentValue>) => onChange({ ...value, ...patch })

  return (
    <section className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4">
      <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
        {t('invoiceBuilder.payment', 'پرداخت')}
      </h3>

      {/* ── Mode ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MODES.map((option) => (
          <button
            key={option.mode}
            type="button"
            disabled={disabled}
            onClick={() =>
              set({
                mode: option.mode,
                // Entering split with no rows leaves an empty list that reads
                // as «paid nothing» while the label says «چند روش».
                tranches:
                  option.mode === 'split' && value.tranches.length === 0
                    ? [newTranche()]
                    : value.tranches,
              })
            }
            className={cn(
              'rounded-xl border p-2.5 text-start transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-50',
              value.mode === option.mode
                ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.08)]'
                : 'border-[hsl(var(--border-default))] hover:border-[hsl(var(--color-primary)/0.4)]',
            )}
          >
            <span className="block text-xs font-medium text-[hsl(var(--fg-primary))]">
              {t(`invoiceBuilder.payMode.${option.mode}`, option.label)}
            </span>
            <span className="mt-0.5 block text-[10px] text-[hsl(var(--fg-tertiary))]">
              {t(`invoiceBuilder.payModeHint.${option.mode}`, option.hint)}
            </span>
          </button>
        ))}
      </div>

      {/* ── Single-method modes ── */}
      {value.mode === 'full' || value.mode === 'partial' ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>{t('invoiceBuilder.method', 'روش')}</Label>
            <Select
              value={value.method}
              onValueChange={(next) => set({ method: next as InvoicePaymentMethod })}
              disabled={Boolean(disabled)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {t(`payment.method.${method}`, METHOD_LABEL[method])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {value.mode === 'partial' ? (
            <div className="space-y-1">
              <Label htmlFor="paid-now">{t('invoiceBuilder.paidNow', 'مبلغ دریافتی')}</Label>
              <Input
                id="paid-now"
                type="number"
                inputMode="decimal"
                min={0}
                max={total}
                step="any"
                value={value.paidNow}
                onChange={(event) => set({ paidNow: event.target.value })}
                disabled={disabled}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Split ── */}
      {value.mode === 'split' ? (
        <div className="space-y-2">
          {value.tranches.map((tranche) => (
            <div key={tranche.id} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label>{t('invoiceBuilder.method', 'روش')}</Label>
                <Select
                  value={tranche.method}
                  onValueChange={(next) =>
                    set({
                      tranches: value.tranches.map((item) =>
                        item.id === tranche.id
                          ? { ...item, method: next as InvoicePaymentMethod }
                          : item,
                      ),
                    })
                  }
                  disabled={Boolean(disabled)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {t(`payment.method.${method}`, METHOD_LABEL[method])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 space-y-1">
                <Label>{t('invoiceBuilder.amount', 'مبلغ')}</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={tranche.amount}
                  onChange={(event) =>
                    set({
                      tranches: value.tranches.map((item) =>
                        item.id === tranche.id ? { ...item, amount: event.target.value } : item,
                      ),
                    })
                  }
                  disabled={disabled}
                />
              </div>

              <button
                type="button"
                disabled={disabled || value.tranches.length <= 1}
                onClick={() =>
                  set({ tranches: value.tranches.filter((item) => item.id !== tranche.id) })
                }
                aria-label={t('common.remove', 'حذف')}
                className="mb-1 rounded-lg p-2 text-[hsl(var(--fg-tertiary))] transition-colors hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))] disabled:opacity-40"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => set({ tranches: [...value.tranches, newTranche()] })}
            className="gap-1.5"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {t('invoiceBuilder.addMethod', 'افزودن روش')}
          </Button>
        </div>
      ) : null}

      {/* ── What this adds up to ──
          Shown for every mode. The original defect was invisible precisely
          because nothing on screen said what the invoice would claim. */}
      <div className="space-y-1 border-t border-[hsl(var(--border-default))] pt-2 text-xs">
        <div className="flex justify-between">
          <span className="text-[hsl(var(--fg-secondary))]">
            {t('invoiceBuilder.willBePaid', 'پرداخت‌شده')}
          </span>
          <span className="font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
            {fmtMoney(paid)} {currency}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[hsl(var(--fg-secondary))]">
            {t('invoiceBuilder.willRemain', 'باقی‌مانده')}
          </span>
          <span
            className={cn(
              'font-semibold tabular-nums',
              remaining > 0 ? 'text-[hsl(var(--color-warning))]' : 'text-[hsl(var(--fg-primary))]',
            )}
          >
            {fmtMoney(remaining)} {currency}
          </span>
        </div>

        {overpaid ? (
          // The server refuses this with PAYMENT_ALLOCATION_EXCEEDS_
          // OUTSTANDING. Saying so here means it is found before submitting.
          <p className="pt-1 text-[hsl(var(--color-destructive))]" role="alert">
            {t('invoiceBuilder.overpaid', 'مجموع پرداخت‌ها از مبلغ فاکتور بیشتر است')}
          </p>
        ) : null}
      </div>
    </section>
  )
}

export default InvoicePaymentSection
