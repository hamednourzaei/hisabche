'use client'

// ============================================
// packages/ui/src/components/ui/invoice-builder/invoice-payment-section.tsx
//
// T9 — «چطور پرداخت شد», asked at the moment of sale.
//
// ---------------------------------------------------------------------------
// WHY IT EXISTS
//
// The draft once defaulted `isPaid: true` and nothing in the UI wrote to it, so
// every sale was recorded as fully paid whether or not money changed hands. The
// section makes the answer a choice, and every choice maps to real `payments`
// + `payment_allocations` rows on the server — never to `paid_amount`.
//
//   full     the whole total — through one method or several
//   partial  less than the total — the rest stays owing
//   split    several methods, amounts typed per row
//   unpaid   nothing now — a description says what was agreed
//
// Each row carries its own description (transfer number, bank, who paid); the
// server stores it as that payment's notes.
//
// ⚠️ «قسطی» IS NOT A MODE, ON PURPOSE: nothing stores a payment plan. Partial
// payment records what was really paid and leaves the rest owing.
//
// ⚠️ AMOUNTS: every figure is shown grouped by thousands (fmtMoney), and every
// amount input is a MoneyInput — «۱۹۰,۰۰۰,۰۰۰», never «190000000».
// ============================================

import * as React from 'react'

import { CheckCircle2, Clock3, Layers, Plus, PieChart, Trash2, Wallet } from 'lucide-react'

import { Input } from '../input'
import { Label } from '../label'
import { MoneyInput } from '../money-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select'
import { cn } from '../../../lib/utils'

// ⚠️ THE TYPES LIVE IN `@hisabche/validation`: the draft store must hold this
// value and `packages/store` cannot import from `packages/ui`.
export type { InvoicePaymentValue, PaymentMode, PaymentTranche } from '@hisabche/validation'
export {
  emptyPaymentValue,
  paidAmountOf,
  paymentEntriesOf,
  tranchesTotal,
} from '@hisabche/validation'

import {
  paidAmountOf,
  tranchesTotal,
  type InvoicePaymentValue,
  type PaymentMode,
  type PaymentTranche,
} from '@hisabche/validation'

/**
 * ⚠️ `'other'` KEEPS THE ENUM CLOSED: the typed name goes in `methodLabel`, so
 * «چک», «چک بانکی» and «Cheque» are not three methods to every report.
 */
export const PAYMENT_METHODS = ['cash', 'bank', 'credit', 'mobile_money', 'other'] as const
export type InvoicePaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Fallbacks only — `t('payment.method.<x>')` is what renders. */
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

const MODES: Array<{
  mode: PaymentMode
  label: string
  hint: string
  Icon: typeof CheckCircle2
}> = [
  { mode: 'full', label: 'کامل پرداخت شد', hint: 'همه‌ی مبلغ الان دریافت شد', Icon: CheckCircle2 },
  { mode: 'partial', label: 'بخشی پرداخت شد', hint: 'باقی‌مانده بدهکار می‌ماند', Icon: PieChart },
  { mode: 'split', label: 'چند روش', hint: 'مثلاً بخشی نقد، بخشی حواله', Icon: Layers },
  { mode: 'unpaid', label: 'پرداخت نشد', hint: 'کل مبلغ بدهکار است', Icon: Clock3 },
]

let trancheSeq = 0
const newTranche = (patch: Partial<PaymentTranche> = {}): PaymentTranche => ({
  id: `tranche-${(trancheSeq += 1)}`,
  method: 'cash',
  amount: '',
  ...patch,
})

const minor = (value: number) => Math.round(value * 100)

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
  const overpaid = minor(paid) > minor(total)
  const rows = value.tranches
  const singleFull = value.mode === 'full' && rows.length <= 1
  // Full through several methods must add up to the invoice, or it is not full.
  const fullMismatch =
    value.mode === 'full' && rows.length > 1 && minor(tranchesTotal(rows)) !== minor(total)
  // Partial that covers everything is really full; say so instead of guessing.
  const partialCoversAll =
    value.mode === 'partial' && rows.length > 0 && minor(paid) >= minor(total)
  const percent = total > 0 ? Math.min(100, Math.round((Math.min(paid, total) / total) * 100)) : 0

  const set = (patch: Partial<InvoicePaymentValue>) => onChange({ ...value, ...patch })
  const setRow = (id: string, patch: Partial<PaymentTranche>) =>
    set({ tranches: rows.map((row) => (row.id === id ? { ...row, ...patch } : row)) })

  const chooseMode = (mode: PaymentMode) => {
    if (mode === 'unpaid') {
      set({ mode })
      return
    }
    // Every paying mode works on rows. The first one inherits what a draft
    // saved before rows existed had chosen, so nothing typed is lost.
    const seeded =
      rows.length > 0
        ? rows
        : [
            newTranche({
              method: value.method,
              ...(value.methodLabel ? { methodLabel: value.methodLabel } : {}),
              amount: mode === 'partial' ? value.paidNow : '',
            }),
          ]
    set({ mode, tranches: seeded })
  }

  const addRow = () => {
    // A new row starts with what is still unpaid — the common next step.
    const already = value.mode === 'full' && rows.length === 1 ? 0 : tranchesTotal(rows)
    const firstRows =
      value.mode === 'full' && rows.length === 1
        ? rows.map((row) => ({ ...row, amount: row.amount || '' }))
        : rows
    const left = Math.max(0, total - already)
    set({
      tranches: [
        ...firstRows,
        newTranche({ amount: left > 0 && value.mode !== 'full' ? String(left) : '' }),
      ],
    })
  }

  return (
    <section
      className="overflow-hidden rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]"
      aria-labelledby="invoice-payment-title"
    >
      {/* ── Header: what is being paid ── */}
      <header className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border-default))] px-4 py-3">
        <h3
          id="invoice-payment-title"
          className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]"
        >
          <span className="grid size-7 place-items-center rounded-lg bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]">
            <Wallet className="size-4" aria-hidden="true" />
          </span>
          {t('invoiceBuilder.payment', 'پرداخت')}
        </h3>
        <div className="text-end">
          <p className="text-[10px] text-[hsl(var(--fg-tertiary))]">
            {t('invoiceBuilder.invoiceTotal', 'مبلغ فاکتور')}
          </p>
          <p className="text-sm font-bold tabular-nums text-[hsl(var(--fg-primary))]" dir="ltr">
            {fmtMoney(total)} <span className="text-[10px] font-medium">{currency}</span>
          </p>
        </div>
      </header>

      <div className="space-y-4 p-4">
        {/* ── Mode: 2 × 2, readable at sidebar width ── */}
        <div role="radiogroup" className="grid grid-cols-2 gap-2">
          {MODES.map(({ mode, label, hint, Icon }) => {
            const active = value.mode === mode
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => chooseMode(mode)}
                className={cn(
                  'group relative flex min-h-[4.5rem] flex-col items-start gap-1 rounded-xl border p-3 text-start transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary)/0.5)]',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  active
                    ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.08)] shadow-sm'
                    : 'border-[hsl(var(--border-default))] hover:border-[hsl(var(--color-primary)/0.4)] hover:bg-[hsl(var(--surface-muted))]',
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <Icon
                    className={cn(
                      'size-4 shrink-0',
                      active
                        ? 'text-[hsl(var(--color-primary))]'
                        : 'text-[hsl(var(--fg-tertiary))]',
                    )}
                    aria-hidden="true"
                  />
                  <span
                    className={cn(
                      'size-3.5 shrink-0 rounded-full border-2 transition-colors',
                      active
                        ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary))]'
                        : 'border-[hsl(var(--border-strong,var(--border-default)))]',
                    )}
                    aria-hidden="true"
                  />
                </span>
                <span className="text-xs font-semibold leading-5 text-[hsl(var(--fg-primary))]">
                  {t(`invoiceBuilder.payMode.${mode}`, label)}
                </span>
                <span className="text-[10px] leading-4 text-[hsl(var(--fg-tertiary))]">
                  {t(`invoiceBuilder.payModeHint.${mode}`, hint)}
                </span>
              </button>
            )
          })}
        </div>

        {/* ── Payment rows (every paying mode) ── */}
        {value.mode !== 'unpaid' ? (
          <div className="space-y-2.5">
            {rows.map((row, index) => (
              <div
                key={row.id}
                className="space-y-2.5 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-[hsl(var(--fg-secondary))]">
                    {t('invoiceBuilder.paymentRow', 'پرداخت')} {fmtMoney(index + 1)}
                  </span>
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => set({ tranches: rows.filter((item) => item.id !== row.id) })}
                      aria-label={t('common.remove', 'حذف')}
                      className="rounded-lg p-1.5 text-[hsl(var(--fg-tertiary))] transition-colors hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))] disabled:opacity-40"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-2.5 min-[380px]:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[11px]">{t('invoiceBuilder.method', 'روش')}</Label>
                    <Select
                      value={row.method}
                      onValueChange={(next) =>
                        setRow(row.id, { method: next as InvoicePaymentMethod })
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

                  <div className="space-y-1">
                    <Label htmlFor={`amount-${row.id}`} className="text-[11px]">
                      {t('invoiceBuilder.paidNow', 'مبلغ دریافتی')}
                    </Label>
                    {singleFull ? (
                      // One method for the whole invoice: the amount IS the total.
                      <div
                        id={`amount-${row.id}`}
                        dir="ltr"
                        className="flex h-10 items-center justify-end rounded-xl border border-dashed border-[hsl(var(--border-default))] px-3 text-sm font-semibold tabular-nums text-[hsl(var(--fg-primary))]"
                      >
                        {fmtMoney(total)}
                      </div>
                    ) : (
                      <MoneyInput
                        id={`amount-${row.id}`}
                        value={row.amount}
                        onChange={(raw) => setRow(row.id, { amount: raw })}
                        placeholder="0"
                        disabled={disabled}
                      />
                    )}
                  </div>
                </div>

                {row.method === 'other' ? (
                  <Input
                    value={row.methodLabel ?? ''}
                    onChange={(event) => setRow(row.id, { methodLabel: event.target.value })}
                    placeholder={t('invoiceBuilder.methodLabelPlaceholder', 'مثلاً چک')}
                    aria-label={t('invoiceBuilder.methodLabel', 'نام روش')}
                    maxLength={40}
                    disabled={disabled}
                  />
                ) : null}

                <div className="space-y-1">
                  <Label htmlFor={`note-${row.id}`} className="text-[11px]">
                    {t('invoiceBuilder.paymentNote', 'توضیحات')}
                  </Label>
                  <Input
                    id={`note-${row.id}`}
                    value={row.note ?? ''}
                    onChange={(event) => setRow(row.id, { note: event.target.value })}
                    placeholder={t(
                      'invoiceBuilder.paymentNotePlaceholder',
                      'مثلاً شماره حواله، نام بانک یا پرداخت‌کننده',
                    )}
                    maxLength={500}
                    disabled={disabled}
                  />
                </div>

                {!singleFull && remaining > 0 && !row.amount ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setRow(row.id, { amount: String(remaining) })}
                    className="text-[11px] font-medium text-[hsl(var(--color-primary))] hover:underline disabled:opacity-50"
                  >
                    {t('invoiceBuilder.fillRemaining', 'پر کردن با باقی‌مانده')}:{' '}
                    {fmtMoney(remaining)}
                  </button>
                ) : null}
              </div>
            ))}

            <button
              type="button"
              disabled={disabled}
              onClick={addRow}
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[hsl(var(--color-primary)/0.5)] text-xs font-medium text-[hsl(var(--color-primary))] transition-colors hover:bg-[hsl(var(--color-primary)/0.06)] disabled:opacity-50"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              {t('invoiceBuilder.addMethod', 'افزودن روش')}
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="unpaid-note" className="text-[11px]">
              {t('invoiceBuilder.paymentNote', 'توضیحات')}
            </Label>
            <Input
              id="unpaid-note"
              value={value.note ?? ''}
              onChange={(event) => set({ note: event.target.value })}
              placeholder={t(
                'invoiceBuilder.unpaidNotePlaceholder',
                'مثلاً قرار پرداخت تا آخر ماه',
              )}
              maxLength={500}
              disabled={disabled}
            />
          </div>
        )}

        {/* ── What this adds up to ── */}
        <div className="space-y-2 rounded-xl bg-[hsl(var(--surface-muted))] p-3">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-[hsl(var(--border-default))]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              className={cn(
                'h-full rounded-full transition-all',
                overpaid ? 'bg-[hsl(var(--color-destructive))]' : 'bg-[hsl(var(--color-primary))]',
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('invoiceBuilder.willBePaid', 'پرداخت‌شده')}
            </span>
            <span className="font-semibold tabular-nums text-[hsl(var(--fg-primary))]" dir="ltr">
              {fmtMoney(paid)} {currency}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('invoiceBuilder.willRemain', 'باقی‌مانده')}
            </span>
            <span
              dir="ltr"
              className={cn(
                'font-semibold tabular-nums',
                remaining > 0
                  ? 'text-[hsl(var(--color-warning))]'
                  : 'text-[hsl(var(--color-success))]',
              )}
            >
              {fmtMoney(remaining)} {currency}
            </span>
          </div>

          {overpaid ? (
            <p className="text-[11px] text-[hsl(var(--color-destructive))]" role="alert">
              {t('invoiceBuilder.overpaid', 'مجموع پرداخت‌ها از مبلغ فاکتور بیشتر است')}
            </p>
          ) : fullMismatch ? (
            <p className="text-[11px] text-[hsl(var(--color-warning))]" role="alert">
              {t(
                'invoiceBuilder.fullMismatch',
                'برای «کامل پرداخت شد» جمع روش‌ها باید برابر مبلغ فاکتور باشد',
              )}
            </p>
          ) : partialCoversAll ? (
            <p className="text-[11px] text-[hsl(var(--fg-tertiary))]">
              {t('invoiceBuilder.partialCoversAll', 'این مبلغ کل فاکتور را پوشش می‌دهد')}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default InvoicePaymentSection
