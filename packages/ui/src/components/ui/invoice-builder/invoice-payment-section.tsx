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

// ⚠️ THE TYPES LIVE IN `@hisabche/validation`, NOT HERE.
//
// They were declared in this file, which meant the DRAFT STORE could not hold
// a payment value — `packages/store` cannot import from `packages/ui`. So the
// choice lived in `useState` inside the PREVIEW container: invisible on the
// builder at `/invoices/new`, and thrown away by walking back from preview.
//
// Re-exported here so every existing importer keeps working.
export type { InvoicePaymentValue, PaymentMode, PaymentTranche } from '@hisabche/validation'
export { emptyPaymentValue, paidAmountOf, tranchesTotal } from '@hisabche/validation'

import {
  paidAmountOf,
  tranchesTotal,
  type InvoicePaymentValue,
  type PaymentMode,
  type PaymentTranche,
} from '@hisabche/validation'

/**
 * ⚠️ `'other'` IS NEW, AND IT KEEPS THE ENUM CLOSED.
 *
 * A shop settling in cheques needs somewhere to write «چک». Making the method
 * free text would turn «چک», «چک بانکی» and «Cheque» into three different
 * payment methods to every report that groups by one — so the enum gains one
 * member and the typed name goes in a sibling `methodLabel`, exactly the shape
 * `unit` uses for `'custom'`.
 *
 * No migration: `invoices.payment_method` is a plain `text` column with no
 * CHECK constraint (`docs/base-schema-migration.sql`).
 */
export const PAYMENT_METHODS = ['cash', 'bank', 'credit', 'mobile_money', 'other'] as const
export type InvoicePaymentMethod = (typeof PAYMENT_METHODS)[number]

/**
 * Fallbacks only — `t('payment.method.<x>')` is what renders.
 *
 * ⚠️ Those keys existed in NO bundle, so every one of these Persian strings was
 * what an English user saw. They are real translations now; these stay so a
 * bundle one build behind renders a word rather than a key.
 */
const METHOD_LABEL: Record<InvoicePaymentMethod, string> = {
  cash: 'نقدی',
  bank: 'بانکی / حواله',
  credit: 'نسیه',
  mobile_money: 'پول موبایلی',
  other: 'روش دیگر',
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

          {/* ⚠️ ONLY FOR `other`, AND IT DOES NOT REPLACE THE METHOD.
              Free-text methods would make «چک», «چک بانکی» and «Cheque» three
              different payment methods to every report that groups by one. */}
          {value.method === 'other' ? (
            <div className="space-y-1">
              <Label htmlFor="method-label">{t('invoiceBuilder.methodLabel', 'نام روش')}</Label>
              <Input
                id="method-label"
                value={value.methodLabel ?? ''}
                onChange={(event) => set({ methodLabel: event.target.value })}
                placeholder={t('invoiceBuilder.methodLabelPlaceholder', 'مثلاً چک')}
                maxLength={40}
                disabled={disabled}
              />
            </div>
          ) : null}

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
            <div key={tranche.id}>
              <div className="flex items-end gap-2">
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

              {/* Each row names its own «other»: a split can be part cheque and
                  part transfer, and one shared label could describe only one. */}
              {tranche.method === 'other' ? (
                <Input
                  value={tranche.methodLabel ?? ''}
                  onChange={(event) =>
                    set({
                      tranches: value.tranches.map((item) =>
                        item.id === tranche.id
                          ? { ...item, methodLabel: event.target.value }
                          : item,
                      ),
                    })
                  }
                  placeholder={t('invoiceBuilder.methodLabelPlaceholder', 'مثلاً چک')}
                  maxLength={40}
                  disabled={disabled}
                  className="mt-1.5"
                />
              ) : null}
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
